export const ErrorMessage = {
  // Erros genéricos
  INTERNAL_SERVER_ERROR: { message: 'Ocorreu um erro inesperado. Tente novamente mais tarde.' },
  VALIDATION_ERROR: { message: 'Os dados informados são inválidos.' },
  INVALID_REQUEST: { message: 'A solicitação enviada é inválida.' },
  RESOURCE_NOT_FOUND: { message: 'O recurso solicitado não foi encontrado.' },
  RESOURCE_ALREADY_EXISTS: { message: 'Este recurso já existe.' },
  CONFLICT: { message: 'Não foi possível concluir a operação devido a um conflito.' },
  OPERATION_NOT_ALLOWED: { message: 'Esta operação não é permitida.' },
  SERVICE_UNAVAILABLE: { message: 'O serviço está temporariamente indisponível. Tente novamente.' },
  RATE_LIMIT_EXCEEDED: {
    message: 'Você realizou muitas solicitações. Aguarde um momento e tente novamente.',
  },

  // Autenticação e autorização
  UNAUTHORIZED: { message: 'Você precisa estar autenticado para realizar esta operação.' },
  INVALID_CREDENTIALS: { message: 'E-mail ou senha inválidos.' },
  TOKEN_EXPIRED: { message: 'Sua sessão expirou. Faça login novamente.' },
  FORBIDDEN: { message: 'Você não tem permissão para realizar esta operação.' },
  INSUFFICIENT_PERMISSIONS: {
    message: 'Você não possui as permissões necessárias para esta ação.',
  },
  EMAIL_NOT_REGISTERED: { message: 'Este e-mail não está cadastrado.' },
  EMAIL_NOT_REGISTRED: { message: 'Email não cadastrado' },
  // Arquivos e upload
  FILE_NOT_FOUND: { message: 'O arquivo solicitado não foi encontrado.' },
  FILE_UPLOAD_FAILED: { message: 'Não foi possível enviar o arquivo. Tente novamente.' },
  FILE_TOO_LARGE: { message: 'O arquivo excede o tamanho máximo permitido.' },
  FILE_TYPE_NOT_SUPPORTED: { message: 'Este formato de arquivo não é suportado.' },
  FILE_EMPTY: { message: 'O arquivo enviado está vazio.' },
  FILE_CORRUPTED: { message: 'O arquivo está corrompido e não pode ser utilizado.' },
  FILE_READ_FAILED: { message: 'Não foi possível ler o arquivo enviado.' },
  FILE_DELETE_FAILED: { message: 'Não foi possível excluir o arquivo. Tente novamente.' },
  FILE_DOWNLOAD_FAILED: { message: 'Não foi possível baixar o arquivo. Tente novamente.' },
  FILE_LIMIT_EXCEEDED: { message: 'O limite de arquivos permitido foi atingido.' },
  FILE_DUPLICATE: { message: 'Este arquivo já foi enviado.' },

  // Processamento e extração de arquivos
  FILE_PROCESSING_FAILED: { message: 'Não foi possível processar o arquivo.' },
  FILE_PARSING_FAILED: { message: 'Não foi possível interpretar o conteúdo do arquivo.' },
  FILE_EXTRACTION_FAILED: { message: 'Não foi possível extrair o conteúdo do arquivo.' },
  FILE_FORMAT_INVALID: { message: 'O formato do arquivo é inválido.' },
  FILE_PASSWORD_PROTECTED: {
    message: 'O arquivo está protegido por senha e não pode ser processado.',
  },
  FILE_CONTENT_EMPTY: { message: 'Nenhum conteúdo útil foi encontrado no arquivo.' },
  FILE_PROCESSING_TIMEOUT: {
    message: 'O processamento do arquivo demorou demais. Tente novamente.',
  },
  FILE_PROCESSING_IN_PROGRESS: {
    message: 'O arquivo ainda está sendo processado. Aguarde a conclusão.',
  },

  // Inteligência artificial
  AI_SERVICE_ERROR: {
    message: 'Ocorreu um erro durante o processamento por inteligência artificial.',
  },
  AI_SERVICE_UNAVAILABLE: {
    message: 'O serviço de inteligência artificial está temporariamente indisponível.',
  },
  AI_REQUEST_FAILED: {
    message: 'Não foi possível concluir a solicitação à inteligência artificial.',
  },
  AI_RESPONSE_INVALID: { message: 'Não foi possível interpretar a resposta gerada.' },
  AI_RESPONSE_TIMEOUT: {
    message: 'A inteligência artificial demorou demais para responder. Tente novamente.',
  },
  AI_TOKEN_LIMIT_EXCEEDED: { message: 'O conteúdo excede o limite permitido para processamento.' },
  AI_CONTENT_NOT_SUPPORTED: {
    message: 'O conteúdo enviado não pode ser processado pela inteligência artificial.',
  },

  // Indexação e embeddings
  DOCUMENT_INDEXING_FAILED: { message: 'Não foi possível preparar o documento para pesquisa.' },
  DOCUMENT_EMBEDDING_FAILED: {
    message: 'Não foi possível preparar o conteúdo do documento para pesquisa semântica.',
  },
  DOCUMENT_NOT_INDEXED: { message: 'O documento ainda não está disponível para pesquisa.' },
  DOCUMENT_INDEX_NOT_FOUND: { message: 'O índice de pesquisa do documento não foi encontrado.' },
  VECTOR_STORAGE_ERROR: {
    message: 'Ocorreu um erro ao armazenar os dados necessários para a pesquisa.',
  },

  // Pesquisa avançada
  SEARCH_FAILED: { message: 'Não foi possível realizar a pesquisa. Tente novamente.' },
  SEARCH_QUERY_EMPTY: { message: 'Digite algo para realizar a pesquisa.' },
  SEARCH_QUERY_INVALID: { message: 'A consulta de pesquisa é inválida.' },
  SEARCH_TIMEOUT: { message: 'A pesquisa demorou demais para responder. Tente novamente.' },
  SEARCH_FILTER_INVALID: { message: 'Um ou mais filtros de pesquisa são inválidos.' },

  // Documentos e coleções
  DOCUMENT_NOT_FOUND: { message: 'O documento solicitado não foi encontrado.' },
  DOCUMENT_ALREADY_PROCESSED: { message: 'Este documento já foi processado.' },
  DOCUMENT_PROCESSING_FAILED: {
    message: 'Não foi possível concluir o processamento do documento.',
  },
  DOCUMENT_REPROCESSING_FAILED: { message: 'Não foi possível reprocessar o documento.' },
  COLLECTION_NOT_FOUND: { message: 'A coleção solicitada não foi encontrada.' },
  COLLECTION_ACCESS_DENIED: { message: 'Você não tem permissão para acessar esta coleção.' },

  // Limites e armazenamento
  STORAGE_LIMIT_EXCEEDED: { message: 'O limite de armazenamento da sua conta foi atingido.' },
  QUOTA_EXCEEDED: { message: 'Você atingiu o limite de utilização permitido para sua conta.' },
} as const

export type ErrorCode = keyof typeof ErrorMessage
