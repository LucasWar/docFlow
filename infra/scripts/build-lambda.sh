#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
LAMBDAS_DIR="$INFRA_DIR/localstack/lambdas"
PRISMA_SCHEMA="${PRISMA_SCHEMA:-$INFRA_DIR/../api/prisma/schema.prisma}"

# Diretórios de código que entram no pacote (os que existirem)
CODE_DIRS=(lib services utils)

ARCH="${ARCH:-x86_64}"
case "$ARCH" in
  x86_64) PRISMA_TARGET="rhel-openssl-3.0.x" ;;
  arm64)  PRISMA_TARGET="linux-arm64-openssl-3.0.x" ;;
  *) printf '✖ ARCH inválido: "%s" (use x86_64 ou arm64)\n' "$ARCH" >&2; exit 1 ;;
esac

log()  { printf '\033[1;34m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$*" >&2; }
fail() { printf '\033[1;31m✖ %s\033[0m\n' "$*" >&2; exit 1; }

for cmd in node npm zip; do
  command -v "$cmd" >/dev/null || fail "'$cmd' não encontrado no PATH (dica: use 'make build-lambdas', que roda tudo em Docker)"
done

# Copia o schema ajustando o generator para o runtime da Lambda.
patch_schema() { # $1=origem $2=destino
  PRISMA_TARGET="$PRISMA_TARGET" node -e '
    const fs = require("fs");
    const [src, dst] = process.argv.slice(1);
    const target = process.env.PRISMA_TARGET;
    const schema = fs.readFileSync(src, "utf8");

    const genRe = /generator\s+client\s*\{[^}]*\}/;
    const dsRe = /datasource\s+\w+\s*\{[^}]*\}/;
    const gen = schema.match(genRe);
    const ds = schema.match(dsRe);
    if (!gen) { console.error("generator client nao encontrado em " + src); process.exit(1); }
    if (!ds) { console.error("datasource nao encontrado em " + src); process.exit(1); }

    // datasource: o Prisma 7 tira a url do schema (vai para prisma.config.ts); o Prisma 6 das Lambdas exige.
    let dsBlock = ds[0];
    if (!/^\s*url\s*=/m.test(dsBlock)) {
      dsBlock = dsBlock.replace(/\}\s*$/, () => `  url = env("DATABASE_URL")\n}`);
      console.error("aviso: url = env(\"DATABASE_URL\") adicionada ao datasource (schema no formato Prisma 7)");
    }

    // generator: recria no formato do Prisma 6 (client JS + engine do runtime da Lambda).
    // Mantém previewFeatures e descarta output/moduleFormat/runtime etc. do generator da API.
    const prev = gen[0].match(/^\s*previewFeatures\s*=.*$/m);
    const feats = prev ? [...prev[0].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
    if (/^\s*extensions\s*=/m.test(dsBlock) && !feats.includes("postgresqlExtensions")) {
      feats.push("postgresqlExtensions");
    }
    const genBlock =
      `generator client {\n  provider = "prisma-client-js"\n` +
      (feats.length ? `  previewFeatures = [${feats.map((f) => `"${f}"`).join(", ")}]\n` : "") +
      `  binaryTargets = ["native", "${target}"]\n}`;

    fs.writeFileSync(dst, schema.replace(genRe, () => genBlock).replace(dsRe, () => dsBlock));
  ' "$1" "$2"
}

resolve_schema() {
  if [[ -f "$PRISMA_SCHEMA" ]]; then
    echo "$PRISMA_SCHEMA"
  elif [[ -f prisma/schema.prisma ]]; then
    warn "Schema da API não encontrado em $PRISMA_SCHEMA; usando cópia local prisma/schema.prisma"
    echo "$PWD/prisma/schema.prisma"
  else
    fail "Schema Prisma não encontrado (esperado: $PRISMA_SCHEMA)"
  fi
}

list_mjs() {
  find . -maxdepth 1 -name '*.mjs' -print0
  for d in "${CODE_DIRS[@]}"; do
    if [[ -d $d ]]; then find "$d" -name '*.mjs' -print0; fi
  done
}

STAGE_DIR=""
build_one() {
  local name="$1"
  local dir="$LAMBDAS_DIR/$name"
  [[ -d "$dir" ]] || fail "Lambda não encontrada: $dir"
  cd "$dir"

  local out="$dir/index.zip"
  STAGE_DIR="$dir/.build"
  trap 'rm -rf "$STAGE_DIR"' EXIT

  [[ -f index.mjs ]]    || fail "$name: index.mjs (handler) não encontrado"
  [[ -f package.json ]] || fail "$name: package.json não encontrado"

  local schema_src
  schema_src="$(resolve_schema)"

  log "[$name] Validando sintaxe"
  while IFS= read -r -d '' file; do
    node --check "$file" || fail "Erro de sintaxe em $file"
  done < <(list_mjs)

  rm -rf "$STAGE_DIR" "$out"
  mkdir -p "$STAGE_DIR/prisma"

  log "[$name] Instalando dependências (arch: $ARCH) em diretório isolado"
  cp package.json "$STAGE_DIR/"
  if [[ -f package-lock.json ]]; then cp package-lock.json "$STAGE_DIR/"; fi
  patch_schema "$schema_src" "$STAGE_DIR/prisma/schema.prisma"

  (
    cd "$STAGE_DIR"
    if [[ -f package-lock.json ]]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

    log "[$name] Gerando Prisma Client"
    npx prisma generate --schema=./prisma/schema.prisma

    log "[$name] Removendo arquivos desnecessários"
    # @aws-sdk já vem no runtime nodejs22.x; prisma CLI/engines só servem para gerar o client
    rm -rf node_modules/@aws-sdk node_modules/.bin node_modules/prisma node_modules/@prisma/engines

    # Mantém só o engine da arquitetura da Lambda
    if [[ -d node_modules/.prisma/client ]]; then
      find node_modules/.prisma/client -name "libquery_engine-*" ! -name "*${PRISMA_TARGET}*" -delete
      ls node_modules/.prisma/client | grep -q "libquery_engine-${PRISMA_TARGET}" \
        || warn "Engine do Prisma para ${PRISMA_TARGET} não encontrada (ok só com engine-less/driver adapters)"
    fi

    # Runtimes do Prisma para outros bancos / edge (aqui é Postgres + engine nativo)
    if [[ -d node_modules/@prisma/client/runtime ]]; then
      find node_modules/@prisma/client/runtime -type f \
        \( -name "*.wasm*" -o -name "*mysql*" -o -name "*sqlite*" -o -name "*sqlserver*" -o -name "*cockroachdb*" -o -name "edge*" -o -name "react-native*" \) \
        -delete || true
    fi

    # Lixo genérico
    find node_modules -type f \( -name "*.md" -o -name "*.map" -o -name "*.d.ts" -o -name "*.d.mts" -o -name "*.d.cts" -o -name "LICENSE*" -o -name "CHANGELOG*" \) -delete
    find node_modules -type d \( -name "test" -o -name "tests" -o -name "__tests__" -o -name "docs" -o -name "examples" -o -name ".github" \) -prune -exec rm -rf {} + || true
  )

  log "[$name] Copiando código-fonte"
  cp ./*.mjs "$STAGE_DIR/"
  for d in "${CODE_DIRS[@]}"; do
    if [[ -d $d ]]; then cp -r "$d" "$STAGE_DIR/$d"; fi
  done

  # .env fica de fora de propósito: a configuração vem do env.local.json (variáveis da Lambda)
  log "[$name] Gerando index.zip"
  (cd "$STAGE_DIR" && zip -qr -9 "$out" . -x "prisma/*" "package-lock.json")

  local zip_mb unzipped_mb
  zip_mb=$(du -m "$out" | cut -f1)
  unzipped_mb=$(du -sm "$STAGE_DIR" | cut -f1)
  echo "✔ $name/index.zip: $(du -h "$out" | cut -f1) (descompactado ≈ ${unzipped_mb}MB, limite 250MB)"
  if (( zip_mb > 50 )); then warn "ZIP acima de 50MB: na AWS real precisaria subir via S3"; fi
}

targets=()
if [[ $# -gt 0 ]]; then
  targets=("$@")
else
  for d in "$LAMBDAS_DIR"/*/; do
    n="$(basename "$d")"
    if [[ $n != _* && -f "$d/index.mjs" ]]; then targets+=("$n"); fi
  done
fi
[[ ${#targets[@]} -gt 0 ]] || fail "Nenhuma Lambda encontrada em $LAMBDAS_DIR"

for n in "${targets[@]}"; do
  ( build_one "$n" )
done