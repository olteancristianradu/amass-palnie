#!/bin/sh
set -e
# Asigură că schema e aplicată pe baza de date din VOLUM (creează dev.db dacă lipsește).
echo "[entrypoint] prisma db push…"
node_modules/.bin/prisma db push --skip-generate || echo "[entrypoint] db push a eșuat (continui oricum)"
# Pornește serverul Next standalone (include hook-ul de auto-sync din instrumentation).
echo "[entrypoint] pornesc serverul pe :$PORT"
exec node server.js
