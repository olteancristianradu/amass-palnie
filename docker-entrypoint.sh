#!/bin/sh
set -e
# Asigură că schema e aplicată pe baza de date din VOLUM (creează dev.db dacă lipsește).
# IMPORTANT: invocăm CLI-ul prin calea reală a pachetului (node_modules/prisma/build/index.js),
# NU prin .bin/prisma — symlink-ul e „aplatizat" de COPY în Docker și nu-și mai găsește
# fișierele .wasm colocate (prisma_schema_build_bg.wasm) → db push eșua silent, fără tabele.
echo "[entrypoint] prisma db push…"
node node_modules/prisma/build/index.js db push --skip-generate || echo "[entrypoint] db push a eșuat (continui oricum)"
# Pornește serverul Next standalone (include hook-ul de auto-sync din instrumentation).
echo "[entrypoint] pornesc serverul pe :$PORT"
exec node server.js
