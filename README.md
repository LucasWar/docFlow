# DocFlow

DocFlow é uma API para cadastro de usuários, envio de PDFs e extração assíncrona do conteúdo dos documentos.  
Os PDFs são armazenados em S3 (LocalStack no ambiente local), extraídos em páginas e trechos e enriquecidos com embeddings locais.  
A API oferece busca semântica vetorial nos trechos processados, isolada pelo usuário autenticado.  
Este README descreve o comportamento observado no código; componentes mencionados no conceito, mas ausentes da implementação, estão identificados explicitamente.

## Sumário

1. [Funcionalidades](#1-funcionalidades)
2. [Arquitetura](#2-arquitetura)
3. [Fluxos principais](#3-fluxos-principais)
4. [Máquina de estados do documento](#4-máquina-de-estados-do-documento)
5. [Stack e decisões técnicas](#5-stack-e-decisões-técnicas)
6. [Estrutura de pastas](#6-estrutura-de-pastas)
7. [Pré-requisitos e execução local](#7-pré-requisitos-e-execução-local)
8. [Variáveis de ambiente](#8-variáveis-de-ambiente)
9. [Referência da API](#9-referência-da-api)
10. [Modelo de dados](#10-modelo-de-dados)
11. [Segurança](#11-segurança)
12. [Confiabilidade e operação](#12-confiabilidade-e-operação)
13. [Limitações conhecidas e próximos passos](#13-limitações-conhecidas-e-próximos-passos)
14. [Evolução em relação ao planejamento inicial](#14-evolução-em-relação-ao-planejamento-inicial)
15. [Licença e contribuição](#15-licença-e-contribuição)
16. [Pontos que precisam de confirmação](#16-pontos-que-precisam-de-confirmação)

## 1. Funcionalidades

### Implementado

- Cadastro e autenticação de usuários com JWT de acesso e refresh token em cookie `httpOnly`.
- Criação de documento e emissão de URL pré-assinada de S3 para envio direto do arquivo.
- Notificação S3 → SQS → Lambda para extração de PDFs.
- Extração de texto por página, limpeza básica do conteúdo e divisão em trechos com sobreposição.
- Persistência de páginas, trechos e embeddings de 384 dimensões no PostgreSQL com pgvector.
- Serviço local de embeddings baseado em `paraphrase-multilingual-MiniLM-L12-v2`, executado com ONNX Runtime.
- Busca vetorial dos cinco trechos mais próximos, filtrada pelo usuário autenticado.
- Listagem e consulta de documentos do usuário.

### Planejado/Em andamento ou não localizado no código

- Endpoint `/ask`, resposta RAG, integração com Anthropic e streaming/SSE: não localizados.
- Busca textual combinada com busca vetorial e fusão RRF: não implementadas; a busca disponível é vetorial.
- Ollama e operação `ollama pull`: não configurados; o modelo é baixado durante o build da imagem do serviço de embeddings.
- Redis/BullMQ: Redis aparece no Compose da API, mas não há integração de aplicação com Redis/BullMQ; o processamento utiliza SQS e Lambda.
- Presigned POST: o código gera URL pré-assinada para `PutObject` (upload HTTP `PUT`).
- OCR de PDFs escaneados, reranking, exclusão de documentos e limpeza de objetos órfãos: não localizados.

## 2. Arquitetura

```mermaid
flowchart LR
    C[Cliente] -->|POST /documents/upload| API[NestJS API]
    API -->|cria documento QUEUED| DB[(PostgreSQL + pgvector)]
    API -->|URL pré-assinada PUT| C
    C -->|PUT PDF| S3[(LocalStack S3)]
    S3 -->|ObjectCreated| Q1[SQS documentsqueue]
    Q1 --> L1[Lambda document-processor]
    L1 -->|texto, páginas e trechos| DB
    L1 -->|documentId| Q2[SQS embeddingqueue]
    Q2 --> L2[Lambda document-create-embedding]
    L2 -->|lotes de texto| ES[Serviço FastAPI / ONNX]
    ES -->|vetores 384D| L2
    L2 -->|embedding e modelo| DB

    C -->|POST /documents/search| API
    API -->|embedding da consulta| ESQ[Serviço local de embeddings]
    ESQ --> API
    API -->|consulta por distância vetorial, top 5| DB
    DB -->|trechos e similaridade| API
    API --> C

    API -. "não implementado: /ask, RAG e LLM" .-> ASK["TODO: confirmar eventual implementação futura"]
```

O endpoint de busca da API chama `http://localhost:8000/embeddings`; a Lambda de embeddings chama o hostname Docker `embeddings-service:8000`. O diagrama mostra ambos os usos do mesmo serviço.

| Componente | Responsabilidade | O que NÃO faz |
|---|---|---|
| API NestJS | Autenticação, documentos, URL pré-assinada e busca semântica | Não recebe os bytes do PDF nem implementa `/ask` ou geração de resposta por LLM |
| LocalStack S3 | Armazenar objetos e emitir notificações de criação | Não extrai nem valida o conteúdo do PDF |
| `documentsqueue` | Receber eventos S3 para iniciar extração | Não tem DLQ/redrive configurada pelo script de inicialização |
| Lambda `document-processor` | Validar o objeto, extrair páginas, criar trechos e solicitar embeddings | Não gera os vetores |
| `embeddingqueue` | Desacoplar a solicitação de embeddings do processamento do PDF | Não é uma fila Redis/BullMQ |
| Lambda `document-create-embedding` | Buscar trechos sem vetor, gerar embeddings em lotes e persistir os vetores | Não altera o status do documento para indicar conclusão dos embeddings |
| Serviço FastAPI/ONNX | Gerar embeddings localmente | Não é Ollama, Anthropic ou uma API de geração de texto |
| PostgreSQL + pgvector | Guardar usuários, documentos, páginas, trechos, sessões e vetores | Não possui atualmente índice vetorial HNSW ou índice full-text criado nas migrations |

## 3. Fluxos principais

### (a) Upload e processamento

1. O cliente autenticado envia `fileName`, `storageKey` e `size` para `POST /documents/upload`.
2. A API cria o registro com status `QUEUED` e emite uma URL pré-assinada `PUT`, válida por 60 segundos.
3. O cliente envia os bytes diretamente ao bucket `documentsflows3`. A chave assinada gerada pela API tem o formato `uploads/<uuid>-<fileName>`.
4. A notificação S3 é encaminhada à fila `documentsqueue`, consumida pela Lambda `document-processor`.
5. A Lambda verifica a chave, tamanho e tipo declarados, baixa o objeto com condição `IfMatch` usando o ETag, verifica a assinatura `%PDF-` e extrai o texto por página.
6. Em uma transação, grava páginas e trechos e marca o documento como `COMPLETED`; depois envia o identificador à `embeddingqueue`.
7. A Lambda `document-create-embedding` carrega até 32 trechos por lote, chama o serviço local e persiste os vetores em `document_chunks`.

`COMPLETED` significa que a extração e a gravação de páginas/trechos terminaram; não garante que todos os embeddings já foram gerados.

### (b) Busca

1. O usuário autenticado envia `searchText` para `POST /documents/search`.
2. A API gera um embedding da consulta no serviço local.
3. A API consulta os trechos com embedding, calcula a distância pgvector e retorna até cinco resultados do próprio usuário.

A consulta ordena por distância de cosseno (`<=>`) e expõe `similarity` como `1 - distância`. Não combina busca textual e vetorial.

### (c) Pergunta e resposta (RAG)

Não há fluxo implementado de pergunta e resposta. O repositório não contém rota `/ask`, construção de prompt com contexto, integração com Anthropic nem resposta em streaming. A busca vetorial existente pode retornar trechos, mas não os envia a um LLM.

## 4. Máquina de estados do documento

```mermaid
stateDiagram-v2
    [*] --> QUEUED: API cria documento
    QUEUED --> PROCESSING: Lambda reivindica registro
    FAILED --> PROCESSING: nova tentativa/reprocessamento
    PROCESSING --> COMPLETED: extração e persistência concluídas
    PROCESSING --> FAILED: falha permanente de validação do PDF
    PROCESSING --> QUEUED: falha transitória de processamento
    UPLOADED: definido no enum, sem transição encontrada
```

O status `COMPLETED` não é alterado pela Lambda de embeddings. O enum também contém `UPLOADED`, mas nenhum caminho encontrado grava esse status. O estado transitório `QUEUED` e o estado permanente `FAILED` são definidos pela Lambda de processamento; a API inicia o registro em `QUEUED`.

## 5. Stack e decisões técnicas

| Tecnologia | Uso observado |
|---|---|
| NestJS e TypeScript | API HTTP, módulos de autenticação, usuários, documentos e embeddings |
| PostgreSQL 16 + pgvector | Persistência relacional e coluna `vector(384)`; a migration ativa a extensão `vector` |
| LocalStack | Emulação local de S3, SQS, Lambda, CloudWatch, IAM e Logs |
| SQS + duas Lambdas | Separa extração de PDF da geração de embeddings por uma segunda fila |
| `unpdf` | Extração do conteúdo textual e número de páginas do PDF |
| FastAPI, Transformers e ONNX Runtime | Embeddings locais do modelo multilíngue, com pooling médio e normalização L2 |
| URL pré-assinada S3 | Permite ao cliente fazer upload diretamente ao bucket via `PUT`, sem encaminhar o arquivo pelo controller |
| Redis | Serviço declarado no Compose da API; sem cliente ou uso encontrado na aplicação |

Não foram encontrados no código comentários ou documentação que justifiquem escolhas como RRF, HNSW, Anthropic, Redis/BullMQ ou Ollama; esses elementos não são descritos aqui como decisões implementadas.

## 6. Estrutura de pastas

```text
.
├── README.md
├── api/
│   ├── docker-compose.yml              # PostgreSQL/pgvector e Redis
│   ├── package.json                    # Scripts e dependências NestJS
│   ├── prisma/
│   │   ├── schema.prisma               # Modelos e enums da API
│   │   └── migrations/                 # Extensão vector, tabelas e alterações
│   └── src/
│       ├── modules/
│       │   ├── auth/                   # Cadastro, login, refresh e logout
│       │   ├── database/               # PrismaService
│       │   ├── documents/               # Upload, listagem, consulta e busca
│       │   ├── embeddings/              # Embedding da consulta de busca
│       │   └── users/                   # Operações de usuário
│       └── shared/                     # Guard JWT e decorators
├── infra/
│   ├── docker-compose.yml              # LocalStack e serviço de embeddings
│   ├── localstack/
│   │   ├── init/init-aws.sh            # Buckets, filas, notificações e Lambdas
│   │   └── lambdas/
│   │       ├── process_document_lambda/ # Extração e segmentação de PDFs
│   │       └── embedding_lambda/        # Geração e persistência de vetores
│   └── embedding-service/              # API FastAPI e imagem ONNX
└── localStack/                         # Dados/cache locais; não é o Compose ativo
```

Não foram encontrados `package.json` ou README na raiz antes desta documentação, nem workflow de CI em `.github/workflows`. Os manifests da aplicação estão em `api/` e nas pastas das Lambdas.

## 7. Pré-requisitos e execução local

### Pré-requisitos

- Docker Engine com Docker Compose e suporte ao socket Docker, necessário para executar Lambdas no LocalStack.
- Node.js e npm compatíveis com as dependências declaradas em `api/package.json` e nas Lambdas. O repositório não fixa uma versão do Node.
- Bash e `zip` para executar os scripts `build.sh` das Lambdas (por exemplo, Git Bash ou WSL no Windows).
- AWS CLI para os comandos opcionais de inspeção das filas e logs.
- Arquivos `.env` locais preenchidos com valores de desenvolvimento. Não há `.env.example`; use a tabela de variáveis abaixo e não reutilize segredos em documentação.

### 1. Criar a rede Docker compartilhada

Os dois arquivos Compose declaram a rede externa `docflow`; ela precisa existir antes de iniciar os serviços:

```bash
docker network create docflow
```

### 2. Instalar dependências e iniciar o banco

No diretório `api/`, configure o `.env` para que `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` e `POSTGRES_PORT` correspondam a um banco local. O Compose também inicia Redis, embora a API não o utilize.

```bash
cd api
npm install
docker compose up -d postgres redis
```

### 3. Aplicar migrations

O datasource é configurado em `prisma7.config.ts`, e não no caminho padrão `prisma.config.ts`; por isso, passe a configuração explicitamente:

```bash
npx prisma migrate deploy --config prisma7.config.ts
```

`DATABASE_URL` deve apontar para o PostgreSQL iniciado no passo anterior. O script de inicialização do LocalStack também define `DATABASE_URL` para as Lambdas; confirme que ela aponta para o mesmo banco e credenciais.

### 4. Construir os pacotes das Lambdas

Execute a partir da raiz do projeto em um shell Bash. Os scripts geram `index.zip`, artefato esperado pelo script de inicialização do LocalStack.

```bash
cd infra/localstack/lambdas/process_document_lambda
bash build.sh

cd ../embedding_lambda
bash build.sh
```

### 5. Iniciar LocalStack e o serviço de embeddings

No `.env` de `infra/`, configure `LOCALSTACK_AUTH_TOKEN` conforme sua instalação do LocalStack. O Compose constrói o contêiner de embeddings; o Dockerfile baixa o modelo ONNX durante o build. Não há comando `ollama pull`.

```bash
cd infra
docker compose up -d --build
```

O script de inicialização cria o bucket, as duas filas, a notificação S3 e as funções Lambda. Como ele depende dos arquivos `index.zip`, construa as Lambdas antes de iniciar o LocalStack pela primeira vez.

### 6. Iniciar a API

Em outro terminal, na pasta `api/`, preencha `DATABASE_URL`, os dois segredos JWT e as credenciais S3 de desenvolvimento:

```bash
cd api
npm run start:dev
```

A API escuta na porta `3000` por padrão (ou no valor de `PORT`). O serviço de embeddings publica a porta `8000`. Não há script de deploy da API no `package.json`.

### Testes e outros scripts da API

Os scripts declarados em `api/package.json` são executados a partir de `api/`:

| Comando | Ação |
|---|---|
| `npm run build` | Compila a aplicação NestJS |
| `npm run lint` | Executa ESLint com `--fix` |
| `npm run format` | Formata arquivos TypeScript de `src/` e `test/` |
| `npm test -- --runInBand` | Executa Jest em modo serial |
| `npm run test:watch` | Executa Jest em modo watch |
| `npm run test:cov` | Executa Jest com cobertura |
| `npm run test:e2e` | Aponta para `./test/jest-e2e.json` |

No estado analisado, `npm test -- --runInBand` falha antes de executar testes: `src/app.controller.spec.ts` importa `./app.controller` e `./app.service`, que não existem. Também não foi localizada a pasta `api/test/` nem o arquivo de configuração E2E referenciado pelo script `test:e2e`. Não foram encontrados workflows de CI.

## 8. Variáveis de ambiente

Os exemplos desta tabela são fictícios. Os arquivos `.env` existentes não são reproduzidos aqui, e não há `.env.example`.

| Nome | Obrigatória? | Finalidade | Exemplo fictício | Onde é usada |
|---|---|---|---|---|
| `PORT` | Não | Porta HTTP da API; padrão `3000` | `3000` | API |
| `DATABASE_URL` | Sim | Conexão PostgreSQL | `postgresql://dev:senha-ficticia@localhost:5432/docflow?schema=public` | API, Prisma CLI e Lambdas |
| `JWT_ACCESS_TOKEN_SECRET` | Sim | Assinar e validar JWT de acesso | `access-secret-de-exemplo-nao-usar` | API |
| `JWT_REFRESH_TOKEN_SECRET` | Sim | Assinar e validar refresh JWT | `refresh-secret-de-exemplo-nao-usar` | API |
| `S3_ACCESS_ID` | Sim para assinar URL | Credencial de desenvolvimento usada pelo S3 client | `localstack-access-key` | API |
| `S3_SECRET_ACCESS_KEY` | Sim para assinar URL | Credencial de desenvolvimento usada pelo S3 client | `localstack-secret-ficticio` | API |
| `POSTGRES_DB` | Sim para Compose da API | Nome do banco | `docflow` | `api/docker-compose.yml` |
| `POSTGRES_USER` | Sim para Compose da API | Usuário do banco | `docflow_dev` | `api/docker-compose.yml` |
| `POSTGRES_PASSWORD` | Sim para Compose da API | Senha local do banco | `senha-local-ficticia` | `api/docker-compose.yml` |
| `POSTGRES_PORT` | Sim para Compose da API | Porta publicada do PostgreSQL | `5432` | `api/docker-compose.yml` |
| `REDIS_PORT` | Sim para Compose da API | Porta publicada do Redis | `6379` | `api/docker-compose.yml`; sem uso encontrado na aplicação |
| `LOCALSTACK_AUTH_TOKEN` | Conforme sua instalação do LocalStack | Token de autenticação do LocalStack | `ls-token-ficticio` | `infra/docker-compose.yml` |
| `CHUNK_SIZE` | Não | Tamanho alvo do trecho em caracteres; padrão `500` | `500` | Lambda `document-processor` |
| `CHUNK_OVERLAP` | Não | Sobreposição dos trechos em caracteres; padrão `80` | `80` | Lambda `document-processor` |
| `MAX_FILE_SIZE_BYTES` | Não | Limite de bytes do PDF; padrão 20 MiB | `20971520` | Lambda `document-processor` |
| `MAX_PAGES` | Não | Limite de páginas; padrão `500` | `500` | Lambda `document-processor` |
| `MAX_TOTAL_CHARS` | Não | Limite de texto extraído; padrão `5000000` | `5000000` | Lambda `document-processor` |
| `ALLOWED_BUCKETS` | Não | Lista de buckets permitidos separada por vírgula; vazio desativa a restrição | `documentsflows3` | Lambda `document-processor` |
| `UPLOAD_PREFIX` | Não | Prefixo permitido para chaves; padrão `uploads/` | `uploads/` | Lambda `document-processor` |
| `MODEL_DIR` | Não | Diretório local do modelo; padrão `/opt/model` | `/opt/model` | Serviço FastAPI de embeddings |
| `ORT_THREADS` | Não | Threads do ONNX Runtime; padrão `2` | `2` | Serviço FastAPI de embeddings |
| `MAX_LENGTH` | Não | Tamanho máximo tokenizado; padrão `256` | `256` | Serviço FastAPI de embeddings |
| `GEMINI_API_KEY` | Não para os caminhos atuais | Presente em arquivos de ambiente/configuração, mas não lida pelo serviço atual de embeddings | `chave-ficticia-nao-usar` | Sem uso observado pela aplicação; a configuração de inicialização da Lambda contém configuração independente |
| `GEMINI_EMBEDDING_MODEL` | Não para os caminhos atuais | Presente em arquivos de ambiente/configuração, mas não seleciona o modelo ativo | `modelo-ficticio` | Sem leitura no código atual de embeddings |
| `EMBEDDING_DIMENSIONS` | Não para os caminhos atuais | Presente em arquivos de ambiente/configuração; o código valida 384 dimensões fixas | `384` | Sem leitura no código atual de embeddings |
| `SQS_CHUNKS_QUEUE_NAME` | Não no código atual | Presente no `.env` da Lambda de processamento, mas a função usa `embeddingqueue` literal | `embeddingqueue` | Sem leitura do `.env`; helper SQS da Lambda de processamento |

**Atenção:** a aplicação e as Lambdas não compartilham um carregador de configuração uniforme. A URL do S3, bucket, fila de embeddings, endpoint do serviço local, dimensões e nome do modelo aparecem fixos no código. O script do LocalStack também injeta algumas variáveis diretamente. Revise essa configuração antes de alterar nomes, portas ou provedores.

## 9. Referência da API

Não há prefixo global configurado. O guard JWT usa `Authorization: Bearer <accessToken>`. Nas respostas abaixo, identificadores e tokens são placeholders fictícios.

| Método | Rota | Autenticação | Descrição |
|---|---|---|---|
| `POST` | `/auth/register` | Não | Cadastra usuário |
| `POST` | `/auth/login` | Não | Autentica, define cookie `refresh_token` e retorna access token |
| `POST` | `/auth/refresh` | Cookie `refresh_token` | Rotaciona refresh token e retorna novo access token |
| `POST` | `/auth/logout` | Bearer + cookie `refresh_token` | Revoga a sessão e limpa o cookie; o controller não encerra explicitamente a resposta |
| `GET` | `/users` | Bearer | Lista usuários; veja a observação de segurança abaixo |
| `GET` | `/users/me` | Bearer | Retorna o usuário autenticado |
| `POST` | `/documents/upload` | Bearer | Cria documento e retorna URL pré-assinada de upload |
| `GET` | `/documents` | Bearer | Lista documentos do usuário |
| `GET` | `/documents/:id` | Bearer | Busca documento pelo ID dentro do usuário autenticado |
| `POST` | `/documents/search` | Bearer | Busca os cinco trechos semanticamente mais próximos |

### Cadastro

```http
POST /auth/register
Content-Type: application/json
```

```json
{
  "name": "Ana Exemplo",
  "email": "ana@example.test",
  "passworld": "senha-ficticia"
}
```

O campo se chama `passworld` no DTO e no serviço. O código retorna o registro criado; o repositório não seleciona campos de resposta e, portanto, pode serializar `passworldHash`. Não exponha esse campo em produção; confirme/corrija o contrato.

### Login e refresh

```http
POST /auth/login
Content-Type: application/json
```

```json
{
  "email": "ana@example.test",
  "passworld": "senha-ficticia"
}
```

Resposta observada: `{"accessToken":"<token-ficticio>"}`. O refresh token é definido no cookie `refresh_token` com `httpOnly` e duração de sete dias. `Secure` e `SameSite` não são configurados no código.

`POST /auth/refresh` lê esse cookie e responde com novo `accessToken`, além de rotacionar o cookie de refresh. `POST /auth/logout` requer access token e cookie; confirme o encerramento HTTP porque o controller não envia status/corpo nem encerra explicitamente a resposta.

### Upload direto com URL pré-assinada

```http
POST /documents/upload
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "fileName": "manual.pdf",
  "storageKey": "uploads/manual.pdf",
  "size": 12345
}
```

Resposta:

```json
{
  "url": "http://localhost:4566/documentsflows3/uploads/<uuid>-manual.pdf?<assinatura-ficticia>"
}
```

A URL representa um `PutObject` e expira em 60 segundos. O cliente deve enviar os bytes do PDF à URL, usando HTTP `PUT`:

```bash
curl -X PUT "<url-retornada>" \
  -H "Content-Type: application/pdf" \
  --data-binary "@manual.pdf"
```

O `storageKey` enviado na requisição é persistido no banco, mas não é usado para montar a chave assinada. A chave real é construída com UUID e `fileName`. O objeto deve satisfazer o formato de chave PDF que a Lambda aceita (`uploads/<uuid>-<nome>.pdf`).

### Listagem e detalhe de documentos

```http
GET /documents
Authorization: Bearer <accessToken>
```

```http
GET /documents/<document-id>
Authorization: Bearer <accessToken>
```

As respostas são os registros de `Document` serializados pelo Prisma. O endpoint de listagem recebe `filters`, mas atualmente não os utiliza.

### Busca semântica

```http
POST /documents/search
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "searchText": "Como funciona o processo descrito no documento?"
}
```

Formato dos resultados:

```json
[
  {
    "id": "<chunk-uuid>",
    "document_id": "<document-uuid>",
    "content": "Trecho correspondente...",
    "page_number": 3,
    "similarity": 0.82
  }
]
```

### Usuários

`GET /users/me` retorna o usuário autenticado com `id`, `name` e `email`. `GET /users` exige autenticação, mas consulta todos os usuários e não filtra pelo usuário atual; os registros retornados incluem os campos padrão do Prisma. Esse endpoint deve ser restringido antes de qualquer uso fora de um ambiente controlado.

## 10. Modelo de dados

```mermaid
erDiagram
    User ||--o{ Document : possui
    User ||--o{ Session : autentica
    Document ||--o{ DocumentPage : contem
    Document ||--o{ DocumentChunk : indexa
    Document ||--o{ ProcessingJobs : registra
    DocumentPage ||--o{ DocumentChunk : agrupa

    User {
        uuid id PK
        string name
        string email UK
        string passworld_hash
        datetime created_at
        datetime deleted_at
    }
    Document {
        uuid id PK
        uuid user_id FK
        string file_name
        string storage_key
        float size
        int page_count
        StatusDocument status
        string error_message
        datetime created_at
        datetime processed_at
    }
    DocumentPage {
        uuid id PK
        uuid document_id FK
        int page_number
        string content
    }
    DocumentChunk {
        uuid id PK
        uuid document_id FK
        uuid page_id FK
        string chunk_index
        string content
        vector embedding
        string embedding_model
    }
    ProcessingJobs {
        uuid id PK
        uuid document_id FK
        StatusDocument status
        int attempts
        string error
        datetime started_at
        datetime finished_at
    }
    Session {
        string id PK
        uuid userId FK
        string refreshTokenJti UK
        string previousRefreshTokenJti
        datetime refreshExpiresAt
        RevokedReason revoked_reason
        datetime revokedAt
    }
```

- `User` tem email único; a migration cria também um índice não único adicional em `email`.
- Exclusão de usuário remove documentos e sessões por cascata. Exclusão de documento remove páginas, trechos e jobs relacionados; exclusão de página remove trechos.
- `StatusDocument`: `UPLOADED`, `QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`.
- `RevokedReason`: `LOGOUT`, `EXPIRES`, `REFRESH`.
- `document_chunks.embedding` é `vector(384)` e a migration ativa `CREATE EXTENSION vector`.
- Não há índice GIN/full-text, coluna `tsvector`, função de atualização full-text ou índice HNSW nas migrations existentes. A consulta vetorial atual ordena por `<=>` sem índice vetorial especializado.
- `ProcessingJobs` existe no schema, mas nenhum caminho observado grava registros nessa tabela.

## 11. Segurança

### Proteções encontradas

- DTOs de autenticação usam validação de tipos, email, campos obrigatórios e senha com comprimento mínimo de oito caracteres. A aplicação registra um `ValidationPipe` global sem opções adicionais de whitelist.
- Senhas são armazenadas como hash bcrypt (custo configurado como `7`).
- JWT de acesso expira em 15 minutos; refresh token expira em sete dias e é armazenado em cookie `httpOnly`. Há rotação do JTI no refresh.
- As operações de documento e a busca vetorial filtram pelo `userId` autenticado.
- A API valida tamanho declarado entre 0 e 20 MiB; a Lambda valida tamanho real, `Content-Type`, número de páginas (até 500 por padrão), texto total (até 5 milhões de caracteres) e assinatura `%PDF-`.
- A Lambda usa o ETag obtido por `HeadObject` na leitura do objeto via `IfMatch`.
- A Lambda valida prefixo, UUID e extensão `.pdf` da chave. A lista de buckets permitidos só restringe o acesso quando `ALLOWED_BUCKETS` está preenchida.

### Lacunas e riscos observados

- O upload não valida o nome do arquivo nem a chave `storageKey` na API; a Lambda rejeita chaves incompatíveis com o padrão esperado.
- A verificação de PDF exige que `%PDF-` apareça nos primeiros 1024 bytes; isso não é uma análise antimalware nem garante que o arquivo seja seguro.
- Não há rate limiting, configuração CORS explícita, proteção contra prompt injection, OCR ou endpoint LLM no código encontrado.
- Cookies não definem `Secure`/`SameSite`; reveja as opções para implantação HTTPS.
- `POST /auth/register` pode retornar o campo hash, e `GET /users` lista usuários sem filtro, incluindo campos não selecionados. São riscos de exposição de dados.
- Há credenciais/configurações sensíveis embutidas no script de inicialização do LocalStack. Não publique esse conteúdo; mova os valores para configuração local e rotacione qualquer credencial real que tenha sido usada.
- Há referências a variáveis Gemini em `.env`, mas o serviço atual usa modelo local fixo; não trate essas variáveis como uma integração Gemini funcional.

## 12. Confiabilidade e operação

### Idempotência e erros

- A Lambda de PDF altera o documento de `QUEUED`/`FAILED` para `PROCESSING` com `updateMany`; se nenhum registro for reivindicado, ignora o evento como duplicado ou já processado.
- Falhas permanentes encontradas depois de reivindicar o documento e iniciar a extração marcam `FAILED`. Rejeições anteriores à reivindicação (por exemplo, bucket/chave inválidos ou objeto ausente) são registradas e descartadas sem atualizar o status, podendo deixar o documento em `QUEUED`.
- Erros transitórios durante o processamento tentam restaurar `QUEUED` e retornam a mensagem como falha.
- A Lambda de embeddings seleciona apenas chunks com `embedding IS NULL` e faz update condicionado a continuar nulo, reduzindo gravações duplicadas.
- As Lambdas retornam `batchItemFailures`, mas o mapeamento criado em `init-aws.sh` não configura `FunctionResponseTypes=ReportBatchItemFailures`. Não conte com o tratamento parcial de falhas sem validar essa configuração no LocalStack/AWS.
- O script cria filas sem DLQ, política de redrive ou atributos explícitos de visibility timeout. O timeout de cada Lambda é 180 s, enquanto a fila SQS não configura timeout de visibilidade; reveja o alinhamento antes de cargas com falhas ou processamento longo.
- Não há registro de tentativas na tabela `ProcessingJobs`, apesar de ela existir no schema.
- A gravação de páginas/trechos e o envio posterior à fila de embeddings não formam uma única transação distribuída. Se o envio falhar após o commit, a Lambda reporta erro mesmo com a extração gravada.

### Inspeção local

Com AWS CLI instalado e credenciais locais de teste configuradas, liste filas:

```bash
aws --endpoint-url http://localhost:4566 sqs list-queues
```

Confira funções e mapeamentos:

```bash
aws --endpoint-url http://localhost:4566 lambda list-functions
aws --endpoint-url http://localhost:4566 lambda list-event-source-mappings
```

Consulte grupos de log:

```bash
aws --endpoint-url http://localhost:4566 logs describe-log-groups \
  --log-group-name-prefix /aws/lambda/
```

O script não cria DLQ nem fila de mensagens mortas para inspecionar/reprocessar. Para reprocessamento de mensagens, primeiro defina e configure explicitamente redrive/DLQ e confirme o comportamento dos event source mappings; não há procedimento automatizado de redrive no repositório.

## 13. Limitações conhecidas e próximos passos

- PDFs escaneados não têm OCR configurado; a extração usa texto do PDF com `unpdf`.
- A segmentação é por caracteres e delimitadores simples, não por parágrafo ou estrutura semântica.
- A busca é vetorial; não há componente lexical/full-text, RRF, reranking nem índice HNSW.
- Não existe fluxo `/ask`, geração de resposta por LLM, Anthropic ou SSE.
- Os nomes/endpoints do serviço de embeddings e dimensões estão fixos em mais de um componente; a troca de provedor não está abstraída.
- Não foram encontrados endpoints para atualizar ou excluir documentos, nem rotina de limpeza de objetos S3 órfãos.
- Não há DLQ, política de redrive ou configuração explícita de visibility timeout; configure e teste esses mecanismos antes de considerar o pipeline resiliente a falhas.
- A configuração da API, Lambdas e LocalStack tem divergências de nomes/valores; alinhe banco, credenciais de desenvolvimento, chaves assinadas e endpoint do serviço antes de executar o fluxo ponta a ponta.
- A migração para AWS real exige configurar IAM/roles, permissões S3→SQS e SQS→Lambda, bucket/política de notificações, secrets, rede/endpoint, logs e política DLQ/redrive. O script atual cria recursos com ARN/role locais e não é um deploy de produção.
- O teste unitário existente está quebrado por importações de `AppController` e `AppService` ausentes. Não há pasta/configuração de testes E2E localizada.

## 14. Evolução em relação ao planejamento inicial

O arquivo `Ideia-de_projeto.html` mencionado na solicitação não está presente na árvore acessível deste repositório. Portanto, a tabela abaixo só compara tecnologias e funcionalidades citadas explicitamente no pedido com o código observado; os demais itens conceituais precisam ser verificados quando o arquivo estiver disponível.

| Planejado no conceito (conforme itens citados no pedido; confirmar no HTML) | Situação atual no código |
|---|---|
| Redis/BullMQ | Redis consta no Compose da API, mas não há integração encontrada com a aplicação; o processamento usa SQS e duas Lambdas |
| Ollama e pull de modelo | Não encontrados. A imagem do serviço FastAPI baixa um modelo ONNX do Hugging Face durante o build |
| Anthropic e endpoint `/ask` | Não encontrados; não há geração de resposta por LLM |
| Streaming/SSE | Não encontrado |
| Busca híbrida com RRF | Não implementada; `POST /documents/search` usa distância vetorial e limite de cinco resultados |
| Presigned POST | Implementada assinatura de `PutObject`, portanto o upload direto é `PUT` |
| Embeddings configuráveis via Gemini | Há nomes de variáveis Gemini em arquivos de ambiente/configuração, mas o caminho ativo chama o modelo ONNX local fixo |
| Pipeline assíncrono de documentos | Implementado com notificações S3, `documentsqueue`, Lambda de extração, `embeddingqueue` e Lambda de embeddings |

## 15. Licença e contribuição

O `package.json` da API declara licença `UNLICENSED`. Não foi encontrado arquivo `LICENSE` ou `CONTRIBUTING.md` na raiz analisada.

- TODO: confirmar a licença do projeto.
- TODO: definir orientações para contribuição.

## 16. Pontos que precisam de confirmação

- TODO: disponibilizar/verificar `Ideia-de_projeto.html` para comparar o planejamento completo sem inferir requisitos.
- TODO: confirmar versões mínimas de Node.js/npm e procedimento suportado para Windows sem Bash/WSL.
- TODO: alinhar as variáveis de conexão do PostgreSQL usadas pela API, Compose e Lambdas.
- TODO: confirmar a resposta HTTP esperada para `POST /auth/logout`, cujo controller não encerra explicitamente a resposta.
- TODO: definir se `/auth/register` deve omitir `passworldHash` e restringir `GET /users`, que hoje retorna todos os usuários.
- TODO: decidir se Redis é necessário ou deve ser removido do Compose da API.
- TODO: confirmar se a configuração Gemini é obsoleta ou se existe integração omitida da árvore analisada.
- TODO: confirmar política de tamanho mínimo de upload: o DTO aceita `size = 0`, mas a Lambda rejeita arquivo vazio.
- TODO: confirmar como lidar com nomes de arquivo sem `.pdf` ou com barras, que podem deixar registros `QUEUED` sem processamento.
- TODO: habilitar/validar `ReportBatchItemFailures`, configurar DLQs/redrive e alinhar visibility timeout com os 180 segundos das Lambdas.
- TODO: decidir se `COMPLETED` deve significar somente extração ou também embeddings disponíveis.
- TODO: confirmar uso esperado de `UPLOADED`, `ProcessingJobs`, `RevokedReason.EXPIRES` e `RevokedReason.REFRESH`, definidos no schema mas não usados pelos caminhos encontrados.
- TODO: confirmar se há funcionalidades RAG, Anthropic, SSE, OCR, busca híbrida ou deploy AWS em outro branch/repositório.
- TODO: definir licença e processo de contribuição.
