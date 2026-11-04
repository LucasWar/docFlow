# Infraestrutura local DocFlow

Esta pasta sobe tudo o que o DocFlow precisa para rodar localmente:

| Serviço                   | Função                                                                  |
| ------------------------- | ----------------------------------------------------------------------- |
| **PostgreSQL (pgvector)** | Banco principal e armazenamento dos vetores                             |
| **Redis**                 | Cache/filas da API                                                      |
| **LocalStack**            | Simula AWS: S3, SQS, Lambda, IAM, CloudWatch e Logs                     |
| **embeddings-service**    | FastAPI + ONNX (`multilingual-e5-small`), gera vetores de 384 dimensões |

A API NestJS está descrita em [`../api/README.md`](../api/README.md).

## Sumário

- [Início rápido](#início-rápido)
- [Windows (passo a passo)](#windows-passo-a-passo)
- [Comandos](#comandos)
- [Estrutura](#estrutura)
- [Como funciona](#como-funciona)
- [Configuração](#configuração)
- [Prisma nas Lambdas](#prisma-nas-lambdas)
- [Atualizando uma Lambda](#atualizando-uma-lambda)
- [Solução de problemas](#solução-de-problemas)
- [Migrando do compose antigo](#migrando-do-compose-antigo)

## Início rápido

Pré-requisitos: **Docker** com Compose, **make** (Linux/Mac/WSL/Git Bash) e um **token do LocalStack** ([app.localstack.cloud](https://app.localstack.cloud) → Auth Tokens).

```bash
cd infra
make setup     # cria .env e os env.local.json das Lambdas a partir dos exemplos
# edite o .env e preencha LOCALSTACK_AUTH_TOKEN
make up        # gera os ZIPs que faltam e sobe tudo, aguardando ficar saudável
make status    # smoke test: bucket, filas, Lambdas e /health dos embeddings
```

Depois aplique as migrations da API (veja [`../api/README.md`](../api/README.md)). O banco sobe vazio.

> Só precisa de Postgres e Redis (ex.: desenvolvendo a API sem o fluxo de documentos)? Use `make db`.

## Windows (passo a passo)

Funciona no PowerShell sem `make`. Se preferir, use WSL2 e siga o [Início rápido](#início-rápido) normalmente (clone o repositório dentro do WSL, não em `C:\`).

**Pré-requisitos:** Docker Desktop (backend WSL2, aberto e rodando), Git, Node 22 (só para a API) e o token do LocalStack.

```powershell
# 1. Configurar (a partir da pasta infra)
cd infra
copy .env.example .env
copy localstack\lambdas\process_document_lambda\env.local.example.json localstack\lambdas\process_document_lambda\env.local.json
copy localstack\lambdas\embedding_lambda\env.local.example.json localstack\lambdas\embedding_lambda\env.local.json
notepad .env          # preencha LOCALSTACK_AUTH_TOKEN

# 2. Gerar os ZIPs das Lambdas (roda em Docker, não precisa de Node nem zip)
.\build-lambdas.bat
dir localstack\lambdas\*\index.zip

# 3. Subir tudo (a 1ª vez baixa o modelo de embeddings: pode levar vários minutos)
docker compose --profile aws up -d --build --wait

# 4. Validar
docker compose exec -T localstack awslocal s3 ls
docker compose exec -T localstack awslocal sqs list-queues
docker compose exec -T localstack awslocal lambda list-functions --query "Functions[].FunctionName"
curl.exe http://localhost:8000/health
```

Equivalências sem `make`:

| `make`                   | PowerShell/CMD                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `make db`                | `docker compose up -d --wait`                                                                                    |
| `make down`              | `docker compose --profile aws down`                                                                              |
| `make restart-aws`       | `docker compose --profile aws up -d --force-recreate --wait localstack`                                          |
| `make logs S=localstack` | `docker compose --profile aws logs -f --tail=100 localstack`                                                     |
| `make reset` ⚠           | `docker compose --profile aws down -v` (apaga os dados)                                                          |
| `make deploy`            | `.\build-lambdas.bat <lambda>` + `update-function-code` (veja [Atualizando uma Lambda](#atualizando-uma-lambda)) |

## Comandos

| Comando                             | O que faz                                                                      |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `make setup`                        | Cria `.env` e `env.local.json` a partir dos exemplos (não sobrescreve)         |
| `make up`                           | Gera os ZIPs que faltam e sobe tudo, aguardando ficar saudável                 |
| `make db`                           | Sobe só Postgres + Redis                                                       |
| `make build-lambdas`                | Gera os `index.zip` em Docker (`LAMBDA=nome` para uma só, `ARCH=arm64`)        |
| `make deploy`                       | Rebuild + atualiza o código das Lambdas no LocalStack **em execução**          |
| `make restart-aws`                  | Recria só o LocalStack (reaplica init, ZIPs e variáveis); o banco não é tocado |
| `make status`                       | Smoke test dos recursos AWS e dos embeddings                                   |
| `make ps` / `make logs S=<serviço>` | Status e logs                                                                  |
| `make down`                         | Para tudo, mantendo os dados                                                   |
| `make reset`                        | ⚠ Apaga **todos** os dados (Postgres, Redis, LocalStack), com confirmação      |

`build-lambdas`, `deploy` e `restart-aws` nunca apagam volumes. Só o `reset` apaga dados.

## Estrutura

```text
infra/
├── docker-compose.yml          # postgres, redis, localstack, embeddings-service
├── Makefile                    # interface de comandos
├── build-lambdas.bat           # build dos ZIPs para Windows (não mexe no Compose)
├── .env.example                # modelo do .env (copie para .env)
├── .gitattributes              # força LF nos scripts (importante no Windows)
├── postgres/init/              # cria a extensão vector na 1ª criação do volume
├── scripts/
│   ├── build-lambda.sh         # build único para qualquer Lambda
│   └── builder.Dockerfile      # Node 22 + zip: mesmo build em qualquer SO
├── embedding-service/          # FastAPI + ONNX
└── localstack/
    ├── init/init-aws.sh        # cria bucket, filas, DLQs, role, Lambdas e triggers
    └── lambdas/
        ├── process_document_lambda/   # extração de PDF → chunks
        └── embedding_lambda/          # chunks → vetores
```

Cada Lambda contém `index.mjs`, `package.json`, `lib/`, `services/` e o `env.local.example.json`. Os arquivos `env.local.json`, `index.zip`, `.env` e `.build/` são gerados localmente e ignorados pelo Git.

## Como funciona

O backend não publica diretamente na fila de extração: ele cria o registro do documento (`QUEUED`) e entrega ao cliente uma URL pré-assinada. O cliente envia o PDF ao S3 e o evento do S3 inicia o processamento.

```mermaid
flowchart LR
    UI[Frontend] -->|POST /documents/upload| API[NestJS API]
    API -->|registra QUEUED e assina PUT| DB[(PostgreSQL)]
    UI -->|PUT do PDF| S3[S3]
    S3 -->|ObjectCreated| Q1[documentsqueue]
    Q1 --> L1[document-processor]
    L1 -->|texto, páginas, chunks| DB
    L1 -->|documentId| Q2[embeddingqueue]
    Q2 --> L2[document-create-embedding]
    L2 -->|lotes de até 32| ES[embeddings-service]
    L2 -->|vetores 384D, COMPLETED| DB
    Q1 -.3 falhas.-> D1[documentsqueue-dlq]
    Q2 -.3 falhas.-> D2[embeddingqueue-dlq]
```

**`document-processor`** valida bucket/chave, tamanho, content type e a assinatura `%PDF-`, extrai o texto por página e divide em chunks (padrão: 500 caracteres, sobreposição de 80). Limites padrão: 20 MiB, 500 páginas e 5 milhões de caracteres.

**`document-create-embedding`** busca apenas chunks sem vetor, processa em lotes de até 32 e pode retomar de onde parou. Grava `COMPLETED` ao terminar; entre as duas etapas o documento fica `PROCESSING`.

**Resiliência:**

- Os event source mappings usam `ReportBatchItemFailures`: só os itens que falharam voltam para a fila.
- Após 3 tentativas a mensagem vai para a DLQ (`*-dlq`), sem loop infinito.
- O visibility timeout das filas (360 s) é maior que o timeout das Lambdas (180 s), como a AWS exige.
- O `init-aws.sh` é idempotente: se um recurso já existe, atualiza em vez de falhar.

**Rede:** tudo roda na rede `docflow`, criada pelo próprio Compose. Os containers das Lambdas entram nela (`LAMBDA_DOCKER_NETWORK`), então usam `postgres:5432` e `embeddings-service:8000` diretamente. A API, rodando no host, usa `localhost`. As portas são publicadas apenas em `127.0.0.1`.

**Profiles:** Postgres e Redis sobem sempre. `localstack` e `embeddings-service` ficam no profile `aws` (o `make up` já o ativa).

## Configuração

### Arquivos

| Arquivo                                      | Função                                                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `infra/.env`                                 | Lido pelo Compose: token do LocalStack, versão da imagem, credenciais e portas do Postgres/Redis          |
| `localstack/lambdas/<lambda>/env.local.json` | Variáveis de ambiente de cada Lambda, no formato `{"Variables": {...}}`. Modelo: `env.local.example.json` |

### Credenciais do banco: onde precisam ser iguais

A mesma senha do Postgres aparece em três lugares e precisa coincidir:

1. `infra/.env` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`)
2. `DATABASE_URL` da **API** (host `localhost`)
3. `DATABASE_URL` dos dois **`env.local.json`** das Lambdas (host `postgres`, não `localhost`)

Formato nas Lambdas: `postgresql://USER:SENHA@postgres:5432/DB?schema=public`. Se a senha tiver `@ : / # %`, faça URL-encode (`@` → `%40`).

> O Postgres só lê `POSTGRES_PASSWORD` na **primeira** criação do volume. Mudar o `.env` depois não troca a senha de um banco que já existe. Veja [Solução de problemas](#solução-de-problemas).

### Variáveis do `.env`

| Variável                                                             | Uso                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------ |
| `LOCALSTACK_AUTH_TOKEN`                                              | Obrigatório. Token do LocalStack                             |
| `LOCALSTACK_VERSION`                                                 | Tag da imagem (padrão `latest`). Fixe uma versão testada     |
| `INIT_DEBUG`                                                         | `1` ativa `set -x` no `init-aws.sh` (imprime valores no log) |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` | Banco                                                        |
| `REDIS_PORT`                                                         | Porta do Redis no host                                       |

### Variáveis das Lambdas

| Lambda    | Variável                                                                                  | Uso                                                                              |
| --------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| ambas     | `DATABASE_URL`                                                                            | Conexão Prisma com o Postgres                                                    |
| processor | `SQS_QUEUE_NAME` / `SQS_QUEUE_URL`, `SQS_ENDPOINT`                                        | Fila de embeddings e endpoint do LocalStack                                      |
| processor | `CHUNK_SIZE`, `CHUNK_OVERLAP`                                                             | Segmentação (padrões 500 e 80)                                                   |
| processor | `MAX_FILE_SIZE_BYTES`, `MAX_PAGES`, `MAX_TOTAL_CHARS`, `UPLOAD_PREFIX`, `ALLOWED_BUCKETS` | Limites e validação do objeto (prefixo padrão `uploads/`)                        |
| embedding | `EMBEDDINGS_URL`                                                                          | Endpoint do FastAPI (confirme no código se é a URL base ou inclui `/embeddings`) |
| embedding | `EMBEDDING_MODEL`                                                                         | Rótulo do modelo gravado com os vetores                                          |
| embedding | `MAX_RETRIES`, `REQUEST_TIMEOUT_MS`, `LAMBDA_SAFETY_MARGIN_MS`                            | Tentativas, timeout HTTP e margem antes do limite da Lambda                      |

### Embeddings

O build da imagem baixa `intfloat/multilingual-e5-small` do Hugging Face e o inclui na imagem; em execução o modelo é carregado localmente. O Compose limita o serviço a 2 CPUs e 2 GB, com `MAX_LENGTH=256`. Expõe `/health` e `/embeddings` na porta `8000`.

## Prisma nas Lambdas

O schema tem **fonte única**: `api/prisma/schema.prisma`, o mesmo que roda as migrations. As Lambdas não têm cópia própria.

Durante o build, `scripts/build-lambda.sh` copia o schema para uma pasta temporária e o adapta ao Prisma 6 usado nas Lambdas:

- adiciona `url = env("DATABASE_URL")` ao `datasource` quando falta (o Prisma 7 removeu a `url` do schema);
- recria o `generator` como `prisma-client-js`, com o `binaryTargets` do runtime da Lambda, descartando `output` e outras opções do generator da API;
- mantém `previewFeatures` e acrescenta `postgresqlExtensions` quando o `datasource` usa `extensions`.

O arquivo da API não é alterado. Para usar outro schema: `PRISMA_SCHEMA=/caminho/schema.prisma make build-lambdas`.

Pontos de atenção:

- Se a API usa Prisma 7 e as Lambdas o 6.x, cada uma gera seu próprio client e isso funciona. Recursos de schema que só existem no 7 podem quebrar o build das Lambdas.
- O código das Lambdas deve importar de `@prisma/client` (padrão), nunca de um caminho gerado como `../generated/prisma`.
- Migrar as Lambdas para o Prisma 7 exigiria `@prisma/adapter-pg` e mudar a criação do `PrismaClient`.

## Atualizando uma Lambda

**Código:** edite e rode `make deploy` (ou `make deploy LAMBDA=embedding_lambda`). O LocalStack não reinicia.

**Variáveis (`env.local.json`):** use `make restart-aws`, ou atualize só a configuração:

```bash
docker compose exec -T localstack awslocal lambda update-function-configuration \
  --function-name document-processor \
  --environment file:///opt/lambdas/process_document_lambda/env.local.json
```

Funções: `process_document_lambda` → `document-processor`; `embedding_lambda` → `document-create-embedding`.

Sem `make` (Windows):

```powershell
.\build-lambdas.bat embedding_lambda
docker compose exec -T localstack awslocal lambda update-function-code --function-name document-create-embedding --zip-file fileb:///opt/lambdas/embedding_lambda/index.zip
```

## Solução de problemas

| Sintoma                                                                     | Causa provável e solução                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Authentication failed ... credentials for docflow are not valid` na Lambda | A senha do `DATABASE_URL` em `env.local.json` não é a do banco (o volume já existia com outra senha). Teste a senha: `docker run --rm --network docflow -e PGPASSWORD=SENHA pgvector/pgvector:pg16 psql -h postgres -U docflow -d docflow -c "select 1"`. Corrija o `env.local.json` ou altere a senha no banco: `docker compose exec postgres psql -U docflow -d docflow -c "ALTER USER docflow WITH PASSWORD 'nova';"`. Sem dados importantes? `make reset` recria o volume com a senha do `.env` |
| `P1012: Argument "url" is missing` no build                                 | Versão antiga do `build-lambda.sh`. Use a atual, que adapta o schema do Prisma 7                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `port is already allocated` (5432/6379)                                     | O compose antigo ainda está rodando. `docker ps` e pare-o                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| LocalStack `unhealthy` ou reiniciando                                       | Token vazio/inválido no `.env`, ou erro no init: `make logs S=localstack` (use `INIT_DEBUG=1` para detalhar)                                                                                                                                                                                                                                                                                                                                                                                        |
| Init falha com `index.zip não existe`                                       | Rode `make build-lambdas` e depois `make restart-aws`                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Init falha com `env.local.json não existe`                                  | Rode `make setup` (ou copie os exemplos)                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `\r: command not found` / `exec format error`                               | Scripts com quebra de linha do Windows. Rode `git add --renormalize .` e refaça o checkout                                                                                                                                                                                                                                                                                                                                                                                                          |
| `init-aws.sh` não executa                                                   | Precisa de permissão de execução: `git update-index --chmod=+x infra/localstack/init/init-aws.sh`                                                                                                                                                                                                                                                                                                                                                                                                   |
| Lambda não conecta no banco                                                 | `DATABASE_URL` deve usar o host `postgres` (não `localhost`)                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Mensagem foi para a DLQ                                                     | Falhou 3 vezes. Veja os logs da Lambda e reenvie o documento. Inspecione: `awslocal sqs receive-message --queue-url <url-da-dlq>`                                                                                                                                                                                                                                                                                                                                                                   |
| Build do embeddings muito lento                                             | É o download do modelo na 1ª vez; as seguintes usam cache                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Mudei o `.env` mas o banco não mudou                                        | O Postgres só lê as credenciais ao criar o volume (veja a linha da senha acima)                                                                                                                                                                                                                                                                                                                                                                                                                     |

Para acompanhar o fluxo de ponta a ponta: faça o upload de um PDF pela aplicação e rode `make logs S=localstack`. As duas Lambdas devem ser invocadas em sequência e o documento passa de `QUEUED` para `PROCESSING` e depois `COMPLETED`.
