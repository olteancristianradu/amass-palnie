import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth';
import { prisma } from './db';

export interface Scope {
  userId: string;
  role: string;
  isAdmin: boolean;
  isManager: boolean;       // are descendenți (vede o echipă) SAU e admin
}

export async function getScope(): Promise<Scope | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const userId = (session.user as any).id as string;
  const role = ((session.user as any).role as string) || 'agent';
  const isAdmin = role === 'admin';
  // manager „efectiv" = admin SAU rol manager SAU are cel puțin un raport direct în arbore
  let hasReports = false;
  if (!isAdmin && role !== 'manager') {
    const c = await prisma.user.count({ where: { managerId: userId } });
    hasReports = c > 0;
  }
  return { userId, role, isAdmin, isManager: isAdmin || role === 'manager' || hasReports };
}

/**
 * Mulțimea de owner-i vizibili pentru un user, IERARHIC (subtree-ul de sub el):
 *  - admin → toți userii
 *  - altcineva → el însuși + toți descendenții (recursiv, prin managerId)
 * Vede „la toți de sub el", nu lateral, nu deasupra.
 */
export async function getVisibleOwnerIds(scope: Scope): Promise<string[] | 'ALL'> {
  if (scope.isAdmin) return 'ALL';
  // BFS în jos pe arborele org
  const all = await prisma.user.findMany({ select: { id: true, managerId: true } });
  const childrenOf = new Map<string, string[]>();
  for (const u of all) {
    if (u.managerId) {
      const arr = childrenOf.get(u.managerId) || [];
      arr.push(u.id);
      childrenOf.set(u.managerId, arr);
    }
  }
  const visible = new Set<string>([scope.userId]);
  const queue = [scope.userId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const child of (childrenOf.get(cur) || [])) {
      if (!visible.has(child)) { visible.add(child); queue.push(child); }
    }
  }
  return [...visible];
}

/**
 * Filtru Prisma pe owner pentru listele de clienți, ținând cont de ierarhie + ?owner.
 */
export async function clientScopeWhere(scope: Scope, ownerParam?: string | null): Promise<any> {
  const visible = await getVisibleOwnerIds(scope);
  if (visible === 'ALL') {
    if (ownerParam && ownerParam !== 'all') return { ownerId: ownerParam };
    return {};
  }
  // dacă cere un agent anume ȘI e în subtree → filtrează la el; altfel tot subtree-ul
  if (ownerParam && ownerParam !== 'all' && visible.includes(ownerParam)) return { ownerId: ownerParam };
  return { ownerId: { in: visible } };
}

/** Poate userul accesa un client anume (e în subtree-ul lui)? */
export async function canAccessClient(scope: Scope, ownerId: string): Promise<boolean> {
  const visible = await getVisibleOwnerIds(scope);
  return visible === 'ALL' || visible.includes(ownerId);
}

/**
 * Găsește un client după idLucrare DOAR în scope-ul userului (anti-IDOR pe rutele CRM).
 * NB: idLucrare nu e unic singur (@@unique([ownerId, idLucrare])) → findFirst cu owner în set.
 */
export async function findClientInScope(scope: Scope, idLucrare: string) {
  const visible = await getVisibleOwnerIds(scope);
  const where = visible === 'ALL' ? { idLucrare } : { idLucrare, ownerId: { in: visible } };
  return prisma.client.findFirst({ where });
}
