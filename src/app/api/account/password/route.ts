import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { getScope } from '@/lib/scope';
import { auditLog } from '@/lib/audit';

// POST /api/account/password — schimbarea propriei parole (verifică parola curentă).
export async function POST(req: NextRequest) {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false }, { status: 401 });
  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword) return NextResponse.json({ ok: false, error: 'Completează parola curentă și cea nouă' }, { status: 400 });
  if (String(newPassword).length < 8) return NextResponse.json({ ok: false, error: 'Parola nouă trebuie să aibă minim 8 caractere' }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: scope.userId } });
  if (!user) return NextResponse.json({ ok: false, error: 'User inexistent' }, { status: 404 });
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return NextResponse.json({ ok: false, error: 'Parola curentă e greșită' }, { status: 403 });
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
  await auditLog({ userId: user.id, func: 'account/password', action: 'UPDATE', entity: 'User', entityId: user.id, fields: 'passwordHash' });
  return NextResponse.json({ ok: true });
}
