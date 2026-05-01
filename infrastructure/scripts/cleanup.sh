#!/bin/bash
# FISH_MARKET Cleanup Script
# Usage:
#   Dry run  → bash cleanup.sh --dry-run
#   Execute  → bash cleanup.sh --execute

MODE=$1
echo "🐟 FISH_MARKET Cleanup — $MODE"

# Find specific temporary or lint junk files
FILES=(
  "client/client_start.log"
  "client/owner_lint_final*.json"
  "server/server_lint_v2.json"
  "client/tsc_final.txt"
  "client/client_lint_out.txt"
  "client/compact_lint.txt"
  "client/dev_error.log"
  "client/final_lint.json"
  "client/lint.txt"
  "client/lint2.txt"
  "client/lint_output.txt"
  "client/lint_results.json"
  "client/owner_lint.json"
  "client/owner_lint_utf8.json"
  "client/tsc.txt"
  "client/tsc_out2.txt"
  "client/tsc_out3.txt"
  "client/tsc_out4.txt"
  "client/tsc_output.txt"
  "client/unix_lint.txt"
  "my_tree.txt"
  "size_before.txt"
  "structure.txt"
  "tree.txt"
)

for FILE in "${FILES[@]}"; do
  # If file exists, list or delete
  ls $FILE >/dev/null 2>&1
  if [ $? -eq 0 ]; then
    if [ "$MODE" == "--dry-run" ]; then
      echo "[DRY-RUN] Would delete: $FILE"
    else
      rm -f $FILE
      echo "[DELETED] $FILE"
    fi
  fi
done

# Clean npm logs and generic temp files broadly
if [ "$MODE" == "--execute" ]; then
  find . -type f -name "*.log" -not -path "*/node_modules/*" -delete
  find . -type f -name ".DS_Store" -delete
  find . -type f -name "*.tmp" -delete
  find . -type f -name "*_old.*" -not -path "*/node_modules/*" -delete
  find . -type f -name "*_v2.*" -not -path "*/node_modules/*" -delete
  find . -type f -name "*_final.*" -not -path "*/node_modules/*" -delete
  find . -type f -name "*_backup.*" -not -path "*/node_modules/*" -delete
  echo "✅ Cleanup complete!"
elif [ "$MODE" == "--dry-run" ]; then
  echo ""
  echo "Generic files that would be deleted:"
  find . -type f -name "*.log" -not -path "*/node_modules/*"
  find . -type f -name ".DS_Store"
  find . -type f -name "*.tmp"
  find . -type f -name "*_old.*" -not -path "*/node_modules/*"
  find . -type f -name "*_v2.*" -not -path "*/node_modules/*"
  find . -type f -name "*_final.*" -not -path "*/node_modules/*"
  find . -type f -name "*_backup.*" -not -path "*/node_modules/*"
fi
