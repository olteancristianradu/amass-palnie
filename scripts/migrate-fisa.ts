import { PrismaClient } from '@prisma/client';
import { migrateFisaBlob } from '../src/lib/fisa-migrate';
const p = new PrismaClient();
(async () => {
  const clients = await p.client.findMany({ select: { id: true, strategieV1: true, strategieV2: true } });
  let updated = 0, touchedV1 = 0, touchedV2 = 0;
  for (const c of clients) {
    const data: any = {};
    if (c.strategieV1) { try { const { blob, changed } = migrateFisaBlob(JSON.parse(c.strategieV1), 'V1'); if (changed) { data.strategieV1 = JSON.stringify(blob); touchedV1++; } } catch {} }
    if (c.strategieV2) { try { const { blob, changed } = migrateFisaBlob(JSON.parse(c.strategieV2), 'V2'); if (changed) { data.strategieV2 = JSON.stringify(blob); touchedV2++; } } catch {} }
    if (Object.keys(data).length) { await p.client.update({ where: { id: c.id }, data }); updated++; }
  }
  console.log(`Migrare ADITIVĂ gata: ${updated} clienți actualizați (V1: ${touchedV1}, V2: ${touchedV2}) din ${clients.length}. Cheile vechi PĂSTRATE + *_raw.`);
  await p.$disconnect();
})();
