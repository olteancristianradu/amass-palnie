#!/bin/sh
set -e
# Asigură că schema e aplicată pe baza de date din VOLUM (creează dev.db dacă lipsește).
# IMPORTANT: invocăm CLI-ul prin calea reală a pachetului (node_modules/prisma/build/index.js),
# NU prin .bin/prisma — symlink-ul e „aplatizat" de COPY în Docker și nu-și mai găsește
# fișierele .wasm colocate (prisma_schema_build_bg.wasm) → db push eșua silent, fără tabele.
# SIGURANȚĂ ANTI-PIERDERE: backup automat al bazei ÎNAINTE de orice migrare de schemă.
# La fiecare pornire copiem dev.db (cu timestamp) în volum și păstrăm ultimele 10.
DB=/app/prisma/dev.db
if [ -f "$DB" ]; then
  cp "$DB" "$DB.bak-$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
  { ls -1t "$DB".bak-* 2>/dev/null | tail -n +11 | xargs -r rm -f; } 2>/dev/null || true
  echo "[entrypoint] backup dev.db făcut (în volum, dev.db.bak-*)."
fi
echo "[entrypoint] prisma db push…"
node node_modules/prisma/build/index.js db push --skip-generate || echo "[entrypoint] db push a eșuat (continui oricum)"
# Plasă de siguranță: garantează coloanele critice (ex. `active`) chiar dacă db push a eșuat → login nu se mai blochează.
if [ -f scripts/ensure-schema.js ]; then node scripts/ensure-schema.js || true; fi
# Pornește serverul Next standalone (include hook-ul de auto-sync din instrumentation).
echo "[entrypoint] pornesc serverul pe :$PORT"
exec node server.js
