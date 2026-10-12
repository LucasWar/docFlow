#!/bin/bash

set -e
set -x

echo "Criando infraestrutura..."

QUEUE_NAME_DOCUMENTS_EXTRACT="documentsqueue"
QUEUE_NAME_CREATE_EMBEDDING="embeddingqueue"

BUCKET_NAME="documentsflows3"

LAMBDA_NAME_EXTRACT_DATE="document-processor"
LAMBDA_NAME_CREATE_EMBEDDING="document-create-embedding"

awslocal sqs create-queue --queue-name "$QUEUE_NAME_DOCUMENTS_EXTRACT"
awslocal sqs create-queue --queue-name "$QUEUE_NAME_CREATE_EMBEDDING"

# echo "=== FILAS EXISTENTES ==="
# awslocal sqs list-queues
# echo "========================"

awslocal s3 mb "s3://$BUCKET_NAME"

QUEUE_URL_DOCUMENTS_EXTRACT=$(awslocal sqs get-queue-url \
  --queue-name "$QUEUE_NAME_DOCUMENTS_EXTRACT" \
  --query 'QueueUrl' --output text)

QUEUE_ARN_DOCUMENTS_EXTRACT=$(awslocal sqs get-queue-attributes \
  --queue-url "$QUEUE_URL_DOCUMENTS_EXTRACT" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)

QUEUE_URL_CREATE_EMBEDDING=$(awslocal sqs get-queue-url \
  --queue-name "$QUEUE_NAME_CREATE_EMBEDDING" \
  --query 'QueueUrl' --output text)

QUEUE_ARN_CREATE_EMBEDDING=$(awslocal sqs get-queue-attributes \
  --queue-url "$QUEUE_URL_CREATE_EMBEDDING" \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)

echo "Queue ARN: $QUEUE_ARN_DOCUMENTS_EXTRACT"

cat > /tmp/notification.json <<EOF
{
  "QueueConfigurations": [
    {
      "QueueArn": "$QUEUE_ARN_DOCUMENTS_EXTRACT",
      "Events": ["s3:ObjectCreated:*"]
    }
  ]
}
EOF

awslocal s3api put-bucket-notification-configuration \
  --bucket "$BUCKET_NAME" \
  --notification-configuration file:///tmp/notification.json

echo "Criando Lambda de extração de dados..."
awslocal lambda create-function \
  --function-name "$LAMBDA_NAME_EXTRACT_DATE" \
  --runtime nodejs22.x \
  --handler index.handler \
  --zip-file fileb:///opt/lambdas/process_document_lambda/index.zip \
  --role arn:aws:iam::000000000000:role/lambda-role \
  --timeout 180 \
  --memory-size 1024 \
  --environment file:///opt/lambdas/process_document_lambda/env.local.json

echo "Aguardando Lambda ficar ativa..."
awslocal lambda wait function-active-v2 \
  --function-name "$LAMBDA_NAME_EXTRACT_DATE"

echo "Criando Lambda de embedding..."
awslocal lambda create-function \
  --function-name "$LAMBDA_NAME_CREATE_EMBEDDING" \
  --runtime nodejs22.x \
  --handler index.handler \
  --zip-file fileb:///opt/lambdas/embedding_lambda/index.zip \
  --role arn:aws:iam::000000000000:role/lambda-role \
  --timeout 180 \
  --memory-size 1024 \
  --environment file:///opt/lambdas/embedding_lambda/env.local.json


echo "Aguardando Lambda ficar ativa..."
awslocal lambda wait function-active-v2 \
  --function-name "$LAMBDA_NAME_CREATE_EMBEDDING"

awslocal lambda create-event-source-mapping \
  --function-name "$LAMBDA_NAME_CREATE_EMBEDDING" \
  --event-source-arn "$QUEUE_ARN_CREATE_EMBEDDING" \
  --batch-size 1

awslocal lambda create-event-source-mapping \
  --function-name "$LAMBDA_NAME_EXTRACT_DATE" \
  --event-source-arn "$QUEUE_ARN_DOCUMENTS_EXTRACT" \
  --batch-size 1

echo "Infraestrutura pronta."