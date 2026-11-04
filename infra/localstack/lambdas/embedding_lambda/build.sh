#!/usr/bin/env bash
# Gera index.zip para a Lambda (e, opcionalmente, faz o deploy).
#
# Estrutura esperada (tudo na mesma pasta):
#   index.mjs  config.mjs  errors.mjs  clients.mjs  lib/  services/
#   package.json  package-lock.json  prisma/schema.prisma  build.sh
#
# Uso:
#   ./build.sh                                # x86_64
#   ARCH=arm64 ./build.sh                     # Lambda em Graviton
#   FUNCTION_NAME=minha-lambda ./build.sh     # gera o zip e envia via AWS CLI
#
# O generator do schema.prisma precisa incluir o target do runtime:
#   generator client {
#     provider      = "prisma-client-js"
#     binaryTargets = ["native", "rhel-openssl-3.0.x"]   # ARM: "linux-arm64-openssl-3.0.x"
#   }
set -euo pipefail
cd "$(dirname "$0")"

ROOT="$(pwd)"
STAGE="$ROOT/.build"
OUT="$ROOT/index.zip"
SCHEMA="prisma/schema.prisma"

# Diretórios de código que entram no pacote (os que existirem)
CODE_DIRS=(lib services)

ARCH="${ARCH:-x86_64}"
case "$ARCH" in
  x86_64) TARGET="rhel-openssl-3.0.x" ;;
  arm64)  TARGET="linux-arm64-openssl-3.0.x" ;;
  *) printf '✖ ARCH inválido: "%s" (use x86_64 ou arm64)\n' "$ARCH" >&2; exit 1 ;;
esac

log()  { printf '\033[1;34m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$*" >&2; }
fail() { printf '\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

# ── Pré-requisitos ────────────────────────────────────────────────
for cmd in node npm zip; do
  command -v "$cmd" >/dev/null || fail "'$cmd' não encontrado no PATH (ex.: sudo apt install zip)"
done
[[ -z "${FUNCTION_NAME:-}" ]] || command -v aws >/dev/null || fail "'aws' CLI não encontrado, necessário para FUNCTION_NAME"
for f in index.mjs package.json "$SCHEMA"; do
  [[ -f "$f" ]] || fail "Arquivo não encontrado: $f"
done
grep -q "$TARGET" "$SCHEMA" \
  || fail "binaryTargets do $SCHEMA não inclui \"$TARGET\" (adicione: binaryTargets = [\"native\", \"$TARGET\"])"

# Valida a sintaxe de todo o código antes de empacotar
log "Validando sintaxe"
while IFS= read -r -d '' file; do
  node --check "$file" || fail "Erro de sintaxe em $file"
done < <(find . -maxdepth 1 -name '*.mjs' -print0
         for d in "${CODE_DIRS[@]}"; do [[ -d $d ]] && find "$d" -name '*.mjs' -print0; done)

trap 'rm -rf "$STAGE"' EXIT
rm -rf "$STAGE" "$OUT"
mkdir -p "$STAGE"

# ── Instala dependências em diretório isolado (não toca no seu node_modules) ──
log "Instalando dependências (arch: $ARCH)"
cp package.json "$STAGE/"
[[ -f package-lock.json ]] && cp package-lock.json "$STAGE/"
cp -r prisma "$STAGE/prisma"

(
  cd "$STAGE"
  if [[ -f package-lock.json ]]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

  log "Gerando Prisma Client"
  npx prisma generate --schema="./$SCHEMA"

  # ── Limpeza: remove o que a Lambda não precisa ──────────────────
  log "Removendo arquivos desnecessários"
  # - @aws-sdk: esta Lambda não usa (e o runtime nodejs já traz o SDK v3)
  # - .bin, prisma, @prisma/engines: CLI/migrate, só servem para gerar o client
  rm -rf node_modules/@aws-sdk node_modules/.bin node_modules/prisma node_modules/@prisma/engines

  # Mantém só o engine da Lambda; remove os de outras plataformas
  if [[ -d node_modules/.prisma/client ]]; then
    find node_modules/.prisma/client -name "libquery_engine-*" ! -name "*${TARGET}*" -delete
    ls node_modules/.prisma/client | grep -q "libquery_engine-${TARGET}" \
      || warn "Engine do Prisma para ${TARGET} não encontrada (ok apenas se usar engine-less/driver adapters)"
  fi

  # Runtimes do Prisma para outros bancos / edge (a Lambda usa Postgres + engine nativo)
  if [[ -d node_modules/@prisma/client/runtime ]]; then
    find node_modules/@prisma/client/runtime -type f \
      \( -name "*.wasm*" -o -name "*mysql*" -o -name "*sqlite*" -o -name "*sqlserver*" -o -name "*cockroachdb*" -o -name "edge*" -o -name "react-native*" \) \
      -delete || true
  fi

  # Lixo genérico
  find node_modules -type f \( -name "*.md" -o -name "*.map" -o -name "*.d.ts" -o -name "*.d.mts" -o -name "*.d.cts" -o -name "LICENSE*" -o -name "CHANGELOG*" \) -delete
  find node_modules -type d \( -name "test" -o -name "tests" -o -name "__tests__" -o -name "docs" -o -name "examples" -o -name ".github" \) -prune -exec rm -rf {} + || true
)

# ── Código da Lambda (só o que é código: ignora node_modules, prisma, .build, zips) ──
log "Copiando código-fonte"
cp ./*.mjs "$STAGE/"
for d in "${CODE_DIRS[@]}"; do
  [[ -d $d ]] && cp -r "$d" "$STAGE/$d"
done

# ── Empacota ──────────────────────────────────────────────────────
# .env fica de fora de propósito: configure DATABASE_URL, EMBEDDINGS_URL e EMBEDDING_MODEL
# nas variáveis de ambiente da Lambda, para não vazar segredos dentro do zip.
log "Gerando index.zip"
(cd "$STAGE" && zip -qr -9 "$OUT" . -x "prisma/*" "package-lock.json")

ZIP_MB=$(du -m "$OUT" | cut -f1)
UNZIPPED_MB=$(du -sm "$STAGE" | cut -f1)
echo "✔ index.zip gerado: $(du -h "$OUT" | cut -f1) (descompactado ≈ ${UNZIPPED_MB}MB, limite 250MB)"
(( ZIP_MB > 50 )) && warn "ZIP acima de 50MB: precisa subir via S3 (limite do upload direto na Lambda)"

# ── Deploy opcional ───────────────────────────────────────────────
if [[ -n "${FUNCTION_NAME:-}" ]]; then
  log "Enviando para $FUNCTION_NAME"
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://$OUT" \
    --architectures "$ARCH" > /dev/null
  echo "✔ Deploy enviado para $FUNCTION_NAME"
fi
exit 0