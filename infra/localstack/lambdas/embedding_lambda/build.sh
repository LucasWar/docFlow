#!/bin/bash
# Uso: ./build.sh
# Requer: index.mjs, package.json e prisma/schema.prisma na mesma pasta do script
# Opcional: ARCH=arm64 ./build.sh   (Lambda em Graviton; padrão x86_64)
#           FUNCTION_NAME=minha-lambda ./build.sh   (envia o zip via AWS CLI)
set -euo pipefail

cd "$(dirname "$0")"

ARCH="${ARCH:-x86_64}"
if [ "$ARCH" = "arm64" ]; then
  TARGET="linux-arm64-openssl-3.0.x"
else
  TARGET="rhel-openssl-3.0.x"
fi

# --- Checagens ---------------------------------------------------------------
for f in index.mjs package.json prisma/schema.prisma; do
  [ -f "$f" ] || { echo "Arquivo não encontrado: $f"; exit 1; }
done

command -v zip >/dev/null 2>&1 || { echo "Comando 'zip' não encontrado. Instale-o (ex.: sudo apt install zip)."; exit 1; }

# O generator do schema.prisma precisa incluir o target do runtime da Lambda:
#
# generator client {
#   provider      = "prisma-client-js"
#   binaryTargets = ["native", "rhel-openssl-3.0.x"]        # x86_64
#   # Para Lambda ARM use: "linux-arm64-openssl-3.0.x"
# }
if ! grep -q "$TARGET" prisma/schema.prisma; then
  echo "O schema.prisma não tem o binaryTarget \"$TARGET\" no generator client."
  echo "Adicione: binaryTargets = [\"native\", \"$TARGET\"]"
  exit 1
fi

# --- Build -------------------------------------------------------------------
rm -rf node_modules index.zip
npm install --no-audit --no-fund

npx prisma generate --schema=./prisma/schema.prisma

# Remove o que a Lambda não precisa:
# - @aws-sdk: esta Lambda não usa (e o runtime nodejs já traz o SDK v3)
# - .bin, prisma, @prisma/engines: CLI/migrate, só servem para gerar o client
rm -rf node_modules/@aws-sdk node_modules/.bin node_modules/prisma node_modules/@prisma/engines

# Mantém só o engine da Lambda; remove os de outras plataformas
find node_modules/.prisma/client -name "libquery_engine-*" ! -name "*${TARGET}*" -delete

# Runtimes do Prisma para outros bancos / edge (a Lambda usa Postgres + engine nativo)
find node_modules/@prisma/client/runtime -type f \
  \( -name "*.wasm*" -o -name "*mysql*" -o -name "*sqlite*" -o -name "*sqlserver*" -o -name "*cockroachdb*" -o -name "edge*" -o -name "react-native*" \) \
  -delete 2>/dev/null || true

# Lixo genérico
find node_modules -type f \( -name "*.md" -o -name "*.map" -o -name "*.d.ts" -o -name "*.d.mts" -o -name "*.d.cts" -o -name "LICENSE*" -o -name "CHANGELOG*" \) -delete
find node_modules -type d \( -name "test" -o -name "tests" -o -name "__tests__" -o -name "docs" -o -name "examples" -o -name ".github" \) -prune -exec rm -rf {} +

# --- Zip ---------------------------------------------------------------------
# .env fica de fora de propósito: configure DATABASE_URL e GEMINI_API_KEY
# nas variáveis de ambiente da Lambda, para não vazar segredos dentro do zip.
zip -r -9 index.zip index.mjs package.json node_modules > /dev/null
echo "index.zip gerado: $(du -h index.zip | cut -f1)"

# --- Deploy opcional ---------------------------------------------------------
if [ -n "${FUNCTION_NAME:-}" ]; then
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file fileb://index.zip \
    --architectures "$ARCH" > /dev/null
  echo "Deploy enviado para $FUNCTION_NAME"
fi
