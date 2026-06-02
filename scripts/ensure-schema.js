// Plasă de siguranță la PORNIRE: garantează coloanele critice chiar dacă `prisma db push` eșuează.
// (Incidentul real: coloana `active` lipsea din DB deși clientul o aștepta → orice citire de user
//  arunca „column active does not exist" → login blocat. Aici o adăugăm idempotent, fără pierdere.)
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// SQL idempotent: ALTER eșuează „liniștit" dacă coloana există deja.
const ADDS = [
  'ALTER TABLE User ADD COLUMN active BOOLEAN DEFAULT 1',
];

(async () => {
  for (const s of ADDS) {
    try { await p.$executeRawUnsafe(s); console.log('[ensure-schema] aplicat:', s); }
    catch (e) { /* coloana există deja → ok */ }
  }
  try { await p.$executeRawUnsafe('UPDATE User SET active=1 WHERE active IS NULL'); } catch (e) {}
  await p.$disconnect().catch(() => {});
})().catch(() => { /* nu blocăm pornirea */ }).finally(() => process.exit(0));
