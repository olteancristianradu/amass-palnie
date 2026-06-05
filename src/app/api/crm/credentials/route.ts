import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { auditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false, error: 'Neautentificat' }, { status: 401 });
  const userId = (session.user as any).id;
  const { crmUser, crmPass } = await req.json().catch(() => ({} as any));
  if (!crmUser || !crmPass) return NextResponse.json({ ok: false, error: 'Date lipsă' }, { status: 400 });
  const enc = encrypt(crmPass);
  await prisma.crmCredentials.upsert({
    where: { userId },
    create: { userId, crmUser, crmPassEnc: enc },
    update: { crmUser, crmPassEnc: enc, cookieJar: null, cookieTs: null }
  });
  await auditLog({ userId, func: 'crm/credentials', action: 'UPDATE', fields: 'crmUser=' + crmUser });
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const userId = (session.user as any).id;
  const c = await prisma.crmCredentials.findUnique({ where: { userId } });
  return NextResponse.json({ ok: true, hasCredentials: !!c, crmUser: c?.crmUser ?? null, utilizatorId: c?.utilizatorId ?? null, autoSync: c?.autoSync ?? false });
}

// PATCH — pornește/oprește auto-sync pentru contul curent.
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const userId = (session.user as any).id;
  const { autoSync } = await req.json().catch(() => ({} as any));
  const c = await prisma.crmCredentials.findUnique({ where: { userId } });
  if (!c) return NextResponse.json({ ok: false, error: 'Nu ai credențiale CRM configurate' }, { status: 400 });
  await prisma.crmCredentials.update({ where: { userId }, data: { autoSync: !!autoSync } });
  await auditLog({ userId, func: 'crm/credentials', action: 'UPDATE', fields: 'autoSync=' + !!autoSync });
  return NextResponse.json({ ok: true, autoSync: !!autoSync });
}
