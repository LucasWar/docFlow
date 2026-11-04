#!/usr/bin/env bash
# Gera index.zip para a Lambda.
#
# Estrutura esperada (tudo na mesma pasta):
#   index.mjs  config.mjs  errors.mjs  clients.mjs  lib/  services/
#   package.json  package-lock.json  prisma/schema.prisma  build.sh
#
# Uso:
#   ./build.sh                                              # x86_64
#   PRISMA_TARGET=linux-arm64-openssl-3.0.x ./build.sh      # Lambda arm64
#
# O generator do schema.prisma precisa incluir o target do runtime:
#   generator client {
#     provider      = "prisma-client-js"
#     binaryTargets = ["native", "rhel-openssl-3.0.x"]   # ou "linux-arm64-openssl-3.0.x"
#   }
set -euo pipefail
cd "$(dirname "$0")"

ROOT="$(pwd)"
STAGE="$ROOT/.build"
OUT="$ROOT/index.zip"
SCHEMA="prisma/schema.prisma"
PRISMA_TARGET="${PRISMA_TARGET:-rhel-openssl-3.0.x}"

# Diretórios de código que entram no pacote (os que existirem)
CODE_DIRS=(lib services utils)

log()  { printf '\033[1;34m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$*" >&2; }
fail() { printf '\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

# ── Pré-requisitos ────────────────────────────────────────────────
for cmd in node npm zip; do
  command -v "$cmd" >/dev/null || fail "'$cmd' não encontrado no PATH"
done
[[ -f package.json ]] || fail "package.json não encontrado"
[[ -f "$SCHEMA" ]]    || fail "$SCHEMA não encontrado"
[[ -f index.mjs ]]    || fail "index.mjs (handler) não encontrado"
grep -q "$PRISMA_TARGET" "$SCHEMA" \
  || fail "binaryTargets do $SCHEMA não inclui \"$PRISMA_TARGET\""

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
log "Instalando dependências"
cp package.json "$STAGE/"
[[ -f package-lock.json ]] && cp package-lock.json "$STAGE/"
cp -r prisma "$STAGE/prisma"

(
  cd "$STAGE"
  if [[ -f package-lock.json ]]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

  log "Gerando Prisma Client"
  npx prisma generate --schema="./$SCHEMA"

  # ── Limpeza: remove o que a Lambda não precisa ──────────────────
  # (o AWS SDK v3 já vem no runtime nodejs22.x)
  log "Removendo arquivos desnecessários"
  rm -rf node_modules/@aws-sdk node_modules/.bin node_modules/prisma node_modules/@prisma/engines
  if [[ -d node_modules/.prisma/client ]]; then
    find node_modules/.prisma/client -name "libquery_engine-*" ! -name "*${PRISMA_TARGET}*" -delete
    ls node_modules/.prisma/client | grep -q "libquery_engine-${PRISMA_TARGET}" \
      || warn "Engine do Prisma para ${PRISMA_TARGET} não encontrada (ok apenas se usar engine-less/driver adapters)"
  fi
  find node_modules \( -name "*.md" -o -name "*.map" -o -name "*.d.ts" \) -delete
)

# ── Código da Lambda (só o que é código: ignora node_modules, prisma, .build, zips) ──
log "Copiando código-fonte"
cp ./*.mjs "$STAGE/"
for d in "${CODE_DIRS[@]}"; do
  [[ -d $d ]] && cp -r "$d" "$STAGE/$d"
done

# ── Empacota ──────────────────────────────────────────────────────
log "Gerando index.zip"
(cd "$STAGE" && zip -qr -9 "$OUT" . -x "prisma/*" "package-lock.json")

ZIP_MB=$(du -m "$OUT" | cut -f1)
UNZIPPED_MB=$(du -sm "$STAGE" | cut -f1)
echo "✔ index.zip gerado: $(du -h "$OUT" | cut -f1) (descompactado ≈ ${UNZIPPED_MB}MB, limite 250MB)"
(( ZIP_MB > 50 )) && warn "ZIP acima de 50MB: precisa subir via S3 (limite do upload direto na Lambda)"
exit 0