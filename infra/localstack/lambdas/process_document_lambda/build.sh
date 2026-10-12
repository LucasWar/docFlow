#!/bin/bash
# Uso: ./build.sh
# Requer: schema.prisma em ./prisma/schema.prisma (copie o do seu projeto)
set -euo pipefail

cd "$(dirname "$0")"

rm -rf node_modules index.zip
npm install

# O generator do schema.prisma precisa incluir o target do runtime da Lambda:
#
# generator client {
#   provider      = "prisma-client-js"
#   binaryTargets = ["native", "rhel-openssl-3.0.x"]        # x86_64
#   # Em Mac Apple Silicon use: "linux-arm64-openssl-3.0.x"
# }
npx prisma generate --schema=./prisma/schema.prisma

# Remove o que a Lambda não precisa (o SDK v3 já vem no runtime nodejs22.x)
rm -rf node_modules/@aws-sdk node_modules/.bin node_modules/prisma node_modules/@prisma/engines
find node_modules/.prisma/client -name "libquery_engine-*" ! -name "*rhel-openssl-3.0.x*" -delete
find node_modules -name "*.md" -delete

zip -r -9 index.zip index.mjs package.json node_modules utils > /dev/null
echo "index.zip gerado: $(du -h index.zip | cut -f1)"