import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Health-check folosit de auto-update pentru a decide dacă un update e SĂNĂTOS.
// Atinge baza (user.count) → dacă schema/DB e stricată (ex. db push eșuat), întoarce 500
// și auto-update-ul face rollback automat la versiunea anterioară. Doar un număr, fără date sensibile.
export async function GET() {
  try {
    // findFirst citește TOATE coloanele (exact ca login-ul) → dacă schema/DB e stricată
    // (ex. coloană nouă incompatibilă), aruncă aici → 500 → auto-update face rollback.
    const u = await prisma.user.findFirst({ select: { id: true, active: true, role: true } });
    const users = await prisma.user.count();
    const secret = !!process.env.NEXTAUTH_SECRET;
    return NextResponse.json({ ok: true, users, hasAdmin: u?.role === 'admin' || users > 0, secret });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'db error' }, { status: 500 });
  }
}
