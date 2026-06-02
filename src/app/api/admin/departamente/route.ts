import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getScope } from '@/lib/scope';
import { auditLog } from '@/lib/audit';

// Gestiunea DEPARTAMENTELOR — DOAR admin (pattern getScope + scope.role === 'admin', ca în api/users).
// Departamentul e o GRUPARE; NU afectează rolurile de permisiuni (agent/manager/admin) sau vizibilitatea verticală.
async function requireAdmin() {
  const scope = await getScope();
  if (!scope || scope.role !== 'admin') return null;
  return scope;
}

// GET — listă departamente + nr. useri în fiecare.
export async function GET() {
  const scope = await requireAdmin();
  if (!scope) return NextResponse.json({ ok: false, error: 'Doar admin' }, { status: 403 });
  const departments = await prisma.department.findMany({
    select: { id: true, name: true, createdAt: true, _count: { select: { users: true } } },
    orderBy: { name: 'asc' }
  });
  return NextResponse.json({ ok: true, departments });
}

// POST { name } — creează un departament.
export async function POST(req: NextRequest) {
  const scope = await requireAdmin();
  if (!scope) return NextResponse.json({ ok: false, error: 'Doar admin' }, { status: 403 });
  const { name } = await req.json().catch(() => ({}));
  const n = String(name ?? '').trim();
  if (!n) return NextResponse.json({ ok: false, error: 'Numele departamentului e necesar' }, { status: 400 });
  const exists = await prisma.department.findUnique({ where: { name: n } });
  if (exists) return NextResponse.json({ ok: false, error: 'Departament cu acest nume există deja' }, { status: 400 });
  const d = await prisma.department.create({ data: { name: n } });
  await auditLog({ userId: scope.userId, func: 'departamente/create', action: 'CREATE', entity: 'Department', entityId: d.id, fields: 'name=' + n });
  return NextResponse.json({ ok: true, id: d.id });
}

// PATCH { id, name } — redenumește un departament.
export async function PATCH(req: NextRequest) {
  const scope = await requireAdmin();
  if (!scope) return NextResponse.json({ ok: false, error: 'Doar admin' }, { status: 403 });
  const { id, name } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ ok: false, error: 'id lipsă' }, { status: 400 });
  const n = String(name ?? '').trim();
  if (!n) return NextResponse.json({ ok: false, error: 'Numele departamentului e necesar' }, { status: 400 });
  const target = await prisma.department.findUnique({ where: { id }, select: { id: true } });
  if (!target) return NextResponse.json({ ok: false, error: 'Departament inexistent' }, { status: 404 });
  const clash = await prisma.department.findUnique({ where: { name: n } });
  if (clash && clash.id !== id) return NextResponse.json({ ok: false, error: 'Departament cu acest nume există deja' }, { status: 400 });
  await prisma.department.update({ where: { id }, data: { name: n } });
  await auditLog({ userId: scope.userId, func: 'departamente/update', action: 'UPDATE', entity: 'Department', entityId: id, fields: 'name=' + n });
  return NextResponse.json({ ok: true });
}

// DELETE { id } — șterge un departament. Userii rămân FĂRĂ departament (departmentId → null prin onDelete: SetNull).
export async function DELETE(req: NextRequest) {
  const scope = await requireAdmin();
  if (!scope) return NextResponse.json({ ok: false, error: 'Doar admin' }, { status: 403 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ ok: false, error: 'id lipsă' }, { status: 400 });
  const target = await prisma.department.findUnique({ where: { id }, select: { id: true, _count: { select: { users: true } } } });
  if (!target) return NextResponse.json({ ok: false, error: 'Departament inexistent' }, { status: 404 });
  await prisma.department.delete({ where: { id } });
  await auditLog({ userId: scope.userId, func: 'departamente/delete', action: 'DELETE', entity: 'Department', entityId: id, fields: `users=${target._count.users}` });
  return NextResponse.json({ ok: true, detachedUsers: target._count.users });
}
