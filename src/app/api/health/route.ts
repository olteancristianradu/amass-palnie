import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Health-check folosit de auto-update pentru a decide dacă un update e SĂNĂTOS.
// Atinge baza (user.count) → dacă schema/DB e stricată (ex. db push eșuat), întoarce 500
// și auto-update-ul face rollback automat la versiunea anterioară. Doar un număr, fără date sensibile.
export async function GET() {
  try {
    const users = await prisma.user.count();
    return NextResponse.json({ ok: true, users });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'db error' }, { status: 500 });
  }
}
