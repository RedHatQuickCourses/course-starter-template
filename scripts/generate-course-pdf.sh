#!/bin/bash
set -euo pipefail

REPO_NAME="${1:-$(basename "$(git rev-parse --show-toplevel)")}"
OUTPUT_DIR="modules/appendix/attachments"

echo "Generating course PDF: ${REPO_NAME}.pdf"

npx antora --extension @antora/pdf-extension antora-playbook.yml

PDF_FILE=$(find build/assembler -name '*.pdf' -type f -size +0 2>/dev/null | head -1)
if [ -z "$PDF_FILE" ]; then
  PDF_FILE=$(find build/site -path '*/_exports/*.pdf' -type f -size +0 2>/dev/null | head -1)
fi
if [ -z "$PDF_FILE" ]; then
  echo "ERROR: No PDF was generated" >&2
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
cp "$PDF_FILE" "${OUTPUT_DIR}/${REPO_NAME}.pdf"
echo "PDF generated: ${OUTPUT_DIR}/${REPO_NAME}.pdf"
