import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 });
  const userId = (session.user as any).id;
  const entries = await prisma.auditLog.findMany({
    where: { userId },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500
  });
  return NextResponse.json({ ok: true, entries });
}
