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
  } catch (e) {
    console.error('auditLog failed:', e);
  }
}
