#!/bin/bash

# Preserve generated files during build.
cp -r /Cosmos-Keyboards/* /temp-cosmos
cp -r /temp-cosmos/* /Cosmos-Keyboards
rm -rf /temp-cosmos

npx concurrently "venv/bin/mkdocs serve -a 0.0.0.0:8000" "npm:dev -- --host 0.0.0.0 --port 5173"
exec "$@"
