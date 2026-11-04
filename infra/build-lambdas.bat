@echo off
setlocal

docker build -q -t docflow-lambda-builder -f "%~dp0scripts\builder.Dockerfile" "%~dp0scripts"
if errorlevel 1 exit /b 1

docker run --rm -e HOME=/tmp -v "%~dp0..:/repo" -w /repo/infra docflow-lambda-builder bash -c "sed -i 's/\r$//' scripts/build-lambda.sh && bash scripts/build-lambda.sh %*"
if errorlevel 1 (
  echo Falha no build das Lambdas
  exit /b 1
)

echo.
echo Pronto. Para aplicar no LocalStack em execucao:  make deploy
echo Ou recrie so o LocalStack:  docker compose --profile aws up -d --force-recreate localstack