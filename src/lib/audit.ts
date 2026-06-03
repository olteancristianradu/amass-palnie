import { prisma } from './db';

export interface AuditEntry {
  userId?: string;
  func: string;
  action: string;
  entity?: string;
  entityId?: string;
  fields?: string;
  diff?: string;
}

/** Câte intrări păstrăm maxim în AuditLog (tabel altfel crește nelimitat). */
const AUDIT_MAX_ROWS = 10000;
/** Probabilitatea de a rula prune-ul după o scriere (~1% → nu costă la fiecare apel). */
const AUDIT_PRUNE_PROBABILITY = 0.01;

/**
 * Șterge surplusul de intrări, păstrând DOAR ultimele AUDIT_MAX_ROWS (cele mai noi).
 * Strategie: găsim createdAt-ul intrării de la poziția AUDIT_MAX_ROWS (orderBy createdAt desc)
 * și ștergem tot ce e mai vechi. Rulat probabilistic ca să nu coste la fiecare scriere.
 */
async function pruneAuditLog(): Promise<void> {
  try {
    // Sărim direct la poziția AUDIT_MAX_ROWS; dacă nu există, tabelul e sub cap → nimic de șters.
    const boundary = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: AUDIT_MAX_ROWS,
      take: 1,
      select: { createdAt: true }
    });
    if (boundary.length === 0) return;
    await prisma.auditLog.deleteMany({ where: { createdAt: { lt: boundary[0].createdAt } } });
  } catch (e) {
    console.error('auditLog prune failed:', e);
  }
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        func: entry.func,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        fields: entry.fields,
        diff: entry.diff
      }
    });
    // CAP anti-creștere nelimitată: prune probabilistic (~1% din apeluri).
    if (Math.random() < AUDIT_PRUNE_PROBABILITY) {
      await pruneAuditLog();
    }
  } catch (e) {
    console.error('auditLog failed:', e);
  }
}
