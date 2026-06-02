import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getScope } from '@/lib/scope';
import { auditLog } from '@/lib/audit';

// Doar admin gestionează conturile.
async function requireAdmin() {
  const scope = await getScope();
  if (!scope || scope.role !== 'admin') return null;
  return scope;
}

export async function GET() {
  const scope = await requireAdmin();
  if (!scope) return NextResponse.json({ ok: false, error: 'Doar admin' }, { status: 403 });
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, active: true, managerId: true, createdAt: true, _count: { select: { clienti: true, reports: true } }, crmCreds: { select: { crmUser: true } } },
    orderBy: { createdAt: 'asc' }
  });
  return NextResponse.json({ ok: true, users });
}

export async function POST(req: NextRequest) {
  const scope = await requireAdmin();
  if (!scope) return NextResponse.json({ ok: false, error: 'Doar admin' }, { status: 403 });
  const { email, password, name, role } = await req.json();
  if (!email || !password || password.length < 6) {
    return NextResponse.json({ ok: false, error: 'Email + parolă (min 6 caractere) necesare' }, { status: 400 });
  }
  const r = ['agent', 'manager', 'admin'].includes(role) ? role : 'agent';
  const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (exists) return NextResponse.json({ ok: false, error: 'Email deja folosit' }, { status: 400 });
  const hash = await bcrypt.hash(password, 10);
  const u = await prisma.user.create({
    data: { email: email.toLowerCase(), passwordHash: hash, name: name || email, role: r }
  });
  await auditLog({ userId: scope.userId, func: 'users/create', action: 'CREATE', entity: 'User', entityId: u.id, fields: 'email=' + u.email + '; role=' + r });
  return NextResponse.json({ ok: true, id: u.id });
}

export async function PATCH(req: NextRequest) {
  const scope = await requireAdmin();
  if (!scope) return NextResponse.json({ ok: false, error: 'Doar admin' }, { status: 403 });
  const { id, role, password, managerId, active, reassignTo } = await req.json();
  if (!id) return NextResponse.json({ ok: false, error: 'id lipsă' }, { status: 400 });

  // REASIGNARE clienți: mută toți clienții lui `id` → `reassignTo`. DOAR în aplicație — NU atinge gestcom CRM.
  // Sărim clienții al căror idLucrare există deja la destinație (constrângere unică @@unique([ownerId,idLucrare])).
  if (reassignTo !== undefined) {
    if (!reassignTo || reassignTo === id) return NextResponse.json({ ok: false, error: 'Alege un alt utilizator destinație' }, { status: 400 });
    const tgt = await prisma.user.findUnique({ where: { id: reassignTo }, select: { id: true } });
    if (!tgt) return NextResponse.json({ ok: false, error: 'Utilizator destinație inexistent' }, { status: 404 });
    const src = await prisma.client.findMany({ where: { ownerId: id }, select: { id: true, idLucrare: true } });
    const have = new Set((await prisma.client.findMany({ where: { ownerId: reassignTo }, select: { idLucrare: true } })).map(c => c.idLucrare));
    let moved = 0, skipped = 0;
    for (const c of src) {
      if (have.has(c.idLucrare)) { skipped++; continue; }
      await prisma.client.update({ where: { id: c.id }, data: { ownerId: reassignTo } });
      moved++;
    }
    await auditLog({ userId: scope.userId, func: 'users/reassign', action: 'REASSIGN', entity: 'Client', entityId: id, fields: `moved=${moved} skipped=${skipped} to=${reassignTo}` });
    return NextResponse.json({ ok: true, moved, skipped });
  }

  const data: any = {};
  if (role && ['agent', 'manager', 'admin'].includes(role)) data.role = role;
  if (password && password.length >= 6) data.passwordHash = await bcrypt.hash(password, 10);
  // Freeze/unfreeze cont. Nu-ți poți îngheța propriul cont (te-ai bloca afară).
  if (typeof active === 'boolean') {
    if (id === scope.userId && active === false) return NextResponse.json({ ok: false, error: 'Nu-ți poți îngheța propriul cont' }, { status: 400 });
    data.active = active;
  }
  if (managerId !== undefined) {
    // Previne cicluri: managerId nou nu poate fi în subtree-ul lui id (sau el însuși).
    if (managerId === id) return NextResponse.json({ ok: false, error: 'Un user nu poate fi propriul manager' }, { status: 400 });
    if (managerId) {
      const all = await prisma.user.findMany({ select: { id: true, managerId: true } });
      const childrenOf = new Map<string, string[]>();
      all.forEach(u => { if (u.managerId) { const a = childrenOf.get(u.managerId) || []; a.push(u.id); childrenOf.set(u.managerId, a); } });
      const sub = new Set<string>([id]); const q = [id];
      while (q.length) { const c = q.shift()!; (childrenOf.get(c) || []).forEach(ch => { if (!sub.has(ch)) { sub.add(ch); q.push(ch); } }); }
      if (sub.has(managerId)) return NextResponse.json({ ok: false, error: 'Ciclu interzis: managerul ales e în subordinea acestui user' }, { status: 400 });
    }
    data.managerId = managerId || null;
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ ok: false, error: 'Nimic de schimbat' }, { status: 400 });
  await prisma.user.update({ where: { id }, data });
  await auditLog({ userId: scope.userId, func: 'users/update', action: 'UPDATE', entity: 'User', entityId: id, fields: Object.keys(data).join(',') });
  return NextResponse.json({ ok: true });
}

// Ștergere cont. Protecții: nu te poți șterge pe tine, nu ștergi ultimul admin,
// nu ștergi un cont care deține clienți (întâi reasignezi sau folosești „Îngheață").
export async function DELETE(req: NextRequest) {
  const scope = await requireAdmin();
  if (!scope) return NextResponse.json({ ok: false, error: 'Doar admin' }, { status: 403 });
  const { id, force } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ ok: false, error: 'id lipsă' }, { status: 400 });
  if (id === scope.userId) return NextResponse.json({ ok: false, error: 'Nu-ți poți șterge propriul cont' }, { status: 400 });
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, _count: { select: { clienti: true } } } });
  if (!target) return NextResponse.json({ ok: false, error: 'Cont inexistent' }, { status: 404 });
  if (target.role === 'admin') {
    const admins = await prisma.user.count({ where: { role: 'admin' } });
    if (admins <= 1) return NextResponse.json({ ok: false, error: 'Nu poți șterge ultimul admin' }, { status: 400 });
  }
  const n = target._count.clienti;
  if (n > 0 && !force) {
    // Implicit refuzăm (anti-pierdere). `hasClients` permite UI-ului să ofere ștergere forțată (duplicate).
    return NextResponse.json({ ok: false, hasClients: n, error: `Contul deține ${n} clienți. Reasignează-i întâi (buton „Clienți →"), folosește „Îngheață", sau confirmă ștergerea forțată (duplicate).` }, { status: 400 });
  }
  if (force && n > 0) {
    // Ștergere forțată (duplicate): șterge clienții lui (cascadă arhivă + remindere) apoi userul. DOAR în aplicație — NU atinge CRM.
    await prisma.client.deleteMany({ where: { ownerId: id } });
  }
  await prisma.user.delete({ where: { id } });
  await auditLog({ userId: scope.userId, func: 'users/delete', action: 'DELETE', entity: 'User', entityId: id, fields: force ? `force; clienti=${n}` : 'fără clienți' });
  return NextResponse.json({ ok: true, deletedClients: force ? n : 0 });
}
