#!/bin/bash

export $(grep -v '^#' .env | xargs)

if [ -z "$PARAM" ]; then
  echo "❌ PARAM not found in .env"
  exit 1
fi

echo "🚀 Running with PARAM = $PARAM"

pnpm start

ollama create aqa-sql:$PARAM -f ./dist/Modelfile
