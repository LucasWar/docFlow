#!/bin/bash
# Roda dentro do LocalStack (ready.d) a cada subida. Idempotente: pode rodar várias vezes.
set -euo pipefail
[[ "${INIT_DEBUG:-0}" == "1" ]] && set -x

# ── Nomes ─────────────────────────────────────────────────────────
ACCOUNT_ID="000000000000"
BUCKET_NAME="documentsflows3"

QUEUE_EXTRACT="documentsqueue"
QUEUE_EMBEDDING="embeddingqueue"

LAMBDA_EXTRACT="document-processor"
LAMBDA_EMBEDDING="document-create-embedding"
LAMBDA_EXTRACT_DIR="/opt/lambdas/process_document_lambda"
LAMBDA_EMBEDDING_DIR="/opt/lambdas/embedding_lambda"

ROLE_NAME="lambda-role"
ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

LAMBDA_TIMEOUT=180
LAMBDA_MEMORY=1024
# O visibility timeout da fila precisa ser >= timeout da Lambda (a AWS exige; aqui usamos 2x)
QUEUE_VISIBILITY=$((LAMBDA_TIMEOUT * 2))
# Depois de N falhas a mensagem vai para a DLQ em vez de ficar em loop
MAX_RECEIVE_COUNT=3

log() { echo "[init] $*"; }
die() { echo "[init] ERRO: $*" >&2; exit 1; }

# ── Pré-requisitos ────────────────────────────────────────────────
for dir in "$LAMBDA_EXTRACT_DIR" "$LAMBDA_EMBEDDING_DIR"; do
  [[ -f "$dir/index.zip" ]] || die "$dir/index.zip não existe. Rode 'make build-lambdas' e recrie o LocalStack."
  [[ -f "$dir/env.local.json" ]] || die "$dir/env.local.json não existe. Copie env.local.example.json (ou rode 'make setup')."
done

# ── Helpers ───────────────────────────────────────────────────────
queue_url() { awslocal sqs get-queue-url --queue-name "$1" --query 'QueueUrl' --output text; }
queue_arn() {
  awslocal sqs get-queue-attributes --queue-url "$(queue_url "$1")" \
    --attribute-names QueueArn --query 'Attributes.QueueArn' --output text
}

# Cria <nome>-dlq e <nome> com redrive para a DLQ. create-queue é idempotente com os mesmos atributos.
ensure_queue_with_dlq() {
  local name="$1" dlq="$1-dlq" dlq_arn
  awslocal sqs create-queue --queue-name "$dlq" >/dev/null
  dlq_arn="$(queue_arn "$dlq")"

  cat > "/tmp/attrs-$name.json" <<JSON
{
  "VisibilityTimeout": "$QUEUE_VISIBILITY",
  "RedrivePolicy": "{\"deadLetterTargetArn\":\"$dlq_arn\",\"maxReceiveCount\":\"$MAX_RECEIVE_COUNT\"}"
}
JSON
  awslocal sqs create-queue --queue-name "$name" --attributes "file:///tmp/attrs-$name.json" >/dev/null
  log "Fila $name (+ $dlq) ok"
}

# Cria a Lambda ou atualiza código/configuração se já existir.
ensure_lambda() { # $1=nome $2=pasta (com index.zip e env.local.json)
  local name="$1" dir="$2"
  if awslocal lambda get-function --function-name "$name" >/dev/null 2>&1; then
    log "Lambda $name já existe: atualizando código e configuração"
    awslocal lambda update-function-code --function-name "$name" --zip-file "fileb://$dir/index.zip" >/dev/null
    awslocal lambda wait function-updated-v2 --function-name "$name"
    awslocal lambda update-function-configuration --function-name "$name" \
      --timeout "$LAMBDA_TIMEOUT" --memory-size "$LAMBDA_MEMORY" \
      --environment "file://$dir/env.local.json" >/dev/null
    awslocal lambda wait function-updated-v2 --function-name "$name"
  else
    log "Criando Lambda $name"
    awslocal lambda create-function \
      --function-name "$name" \
      --runtime nodejs22.x \
      --handler index.handler \
      --zip-file "fileb://$dir/index.zip" \
      --role "$ROLE_ARN" \
      --timeout "$LAMBDA_TIMEOUT" \
      --memory-size "$LAMBDA_MEMORY" \
      --environment "file://$dir/env.local.json" >/dev/null
  fi
  awslocal lambda wait function-active-v2 --function-name "$name"
}

# SQS → Lambda. ReportBatchItemFailures: os handlers devolvem batchItemFailures e só os itens
# que falharam voltam para a fila.
ensure_mapping() { # $1=lambda $2=queue-arn
  local count
  count="$(awslocal lambda list-event-source-mappings --function-name "$1" \
    --event-source-arn "$2" --query 'length(EventSourceMappings)' --output text)"
  if [[ "$count" == "0" ]]; then
    awslocal lambda create-event-source-mapping \
      --function-name "$1" \
      --event-source-arn "$2" \
      --batch-size 1 \
      --function-response-types ReportBatchItemFailures >/dev/null
    log "Mapping $2 → $1 criado"
  else
    log "Mapping $2 → $1 já existe"
  fi
}

log "Criando infraestrutura..."

# ── IAM ───────────────────────────────────────────────────────────
if ! awslocal iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  cat > /tmp/trust.json <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow", "Principal": { "Service": "lambda.amazonaws.com" }, "Action": "sts:AssumeRole" }
  ]
}
JSON
  awslocal iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document file:///tmp/trust.json >/dev/null
  log "Role $ROLE_NAME criada"
fi

# ── SQS (com DLQ) ─────────────────────────────────────────────────
ensure_queue_with_dlq "$QUEUE_EXTRACT"
ensure_queue_with_dlq "$QUEUE_EMBEDDING"
QUEUE_ARN_EXTRACT="$(queue_arn "$QUEUE_EXTRACT")"
QUEUE_ARN_EMBEDDING="$(queue_arn "$QUEUE_EMBEDDING")"

# ── S3 ────────────────────────────────────────────────────────────
if ! awslocal s3api head-bucket --bucket "$BUCKET_NAME" >/dev/null 2>&1; then
  awslocal s3 mb "s3://$BUCKET_NAME" >/dev/null
  log "Bucket $BUCKET_NAME criado"
fi

# CORS aberto de propósito: só existe em ambiente local, para o browser fazer PUT na URL pré-assinada.
cat > /tmp/cors.json <<'JSON'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["PUT", "HEAD", "GET"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}
JSON
awslocal s3api put-bucket-cors --bucket "$BUCKET_NAME" --cors-configuration file:///tmp/cors.json

# Na AWS real seria preciso uma queue policy permitindo s3.amazonaws.com; o LocalStack não exige.
cat > /tmp/notification.json <<JSON
{
  "QueueConfigurations": [
    { "QueueArn": "$QUEUE_ARN_EXTRACT", "Events": ["s3:ObjectCreated:*"] }
  ]
}
JSON
awslocal s3api put-bucket-notification-configuration \
  --bucket "$BUCKET_NAME" --notification-configuration file:///tmp/notification.json

# ── Lambdas + triggers ────────────────────────────────────────────
ensure_lambda "$LAMBDA_EXTRACT" "$LAMBDA_EXTRACT_DIR"
ensure_lambda "$LAMBDA_EMBEDDING" "$LAMBDA_EMBEDDING_DIR"

ensure_mapping "$LAMBDA_EMBEDDING" "$QUEUE_ARN_EMBEDDING"
ensure_mapping "$LAMBDA_EXTRACT" "$QUEUE_ARN_EXTRACT"

log "Infraestrutura pronta."