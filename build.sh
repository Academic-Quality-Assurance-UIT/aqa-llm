#!/usr/bin/env bash
set -euo pipefail

ENV_PATH="../.env"  
VAR_NAME="CONNECTION_STRING" 
TEMPLATE_FILE="./src/template.Modelfile"
OUTPUT_DIR="./dist"
OUTPUT_FILE="$OUTPUT_DIR/Modelfile"

# —— 1. Load the connection string ——
if [ ! -f "$ENV_PATH" ]; then
  echo "Error: $ENV_PATH not found." >&2
  exit 1
fi

# extract and eval the CONNECTION_STRING line
eval "$(grep -E "^${VAR_NAME}=" "$ENV_PATH")"

if [ -z "${CONNECTION_STRING:-}" ]; then
  echo "Error: $VAR_NAME is empty or not set in $ENV_PATH" >&2
  exit 1
fi

# —— 2. Dump the schema-only DDL, strip comments, squeeze blank lines ——
echo "⏳ Dumping schema, removing comments, collapsing blank lines..."
SCHEMA_SQL=$(
  pg_dump "$CONNECTION_STRING" --schema-only \
    | sed \
        -e '/^[[:space:]]*--/d' \
        -e '/\/\*/,/\*\//d' \
    | cat -s
)

# —— 3. Prepare output directory ——
mkdir -p "$OUTPUT_DIR"

# —— 4. Inject into new file ——
if [ ! -f "$TEMPLATE_FILE" ]; then
  echo "Error: template file $TEMPLATE_FILE not found." >&2
  exit 1
fi

{
  while IFS= read -r line; do
    if [[ "$line" == *"<< SCHEMA >>"* ]]; then
      prefix=${line%%<< SCHEMA >>*}
      suffix=${line#*<< SCHEMA >>}
      printf '%s\n' "$prefix"
      printf '%s\n' "$SCHEMA_SQL"
      printf '%s\n' "$suffix"
    else
      printf '%s\n' "$line"
    fi
  done < "$TEMPLATE_FILE"
} > "$OUTPUT_FILE"

echo "✔ Schema injected into $OUTPUT_FILE (comments removed, blank lines collapsed)"

 
ollama create aqa-sql -f ./dist/Modelfile     