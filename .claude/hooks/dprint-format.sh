#!/usr/bin/env bash
# PostToolUse hook: format the file just edited/written with dprint.
# Reads the JSON tool input on stdin and extracts the file_path field.
# Silently no-ops if the file is outside the dprint includes glob,
# if dprint is unavailable, or if jq is not installed.

set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

INPUT="$(cat)"
FILE="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')"

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  exit 0
fi

case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.cjs|*.mjs|*.json|*.md|*.svelte) ;;
  *) exit 0 ;;
esac

# Skip generated/vendored paths even though dprint.json already excludes them.
case "$FILE" in
  */node_modules/*|*/.svelte-kit/*|*/build/*|*/target/*|*/venv/*) exit 0 ;;
esac

if command -v npx >/dev/null 2>&1; then
  npx --no-install dprint fmt "$FILE" >/dev/null 2>&1 || true
fi

exit 0
