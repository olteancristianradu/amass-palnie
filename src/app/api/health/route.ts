import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Health-check folosit de auto-update pentru a decide dacă un update e SĂNĂTOS.
// Atinge baza (user.count) → dacă schema/DB e stricată (ex. db push eșuat), întoarce 500
// și auto-update-ul face rollback automat la versiunea anterioară. Doar un număr, fără date sensibile.
export async function GET() {
  try {
    // findFirst FĂRĂ select citește TOATE coloanele (exact ca login-ul) → dacă lipsește ORICE
    // coloană din DB (nu doar `active`), aruncă aici → 500 → auto-update face ROLLBACK automat.
    await prisma.user.findFirst();
    // NU expunem numere/stare (repo + tunel PUBLIC) — health-check-ul cere doar HTTP 200 + {ok:true}.
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // Logăm detaliul pe server, dar NU îl expunem public (poate dezvălui schema/coloane).
    console.error('[health] DB check failed:', e?.message);
    return NextResponse.json({ ok: false, error: 'db unavailable' }, { status: 500 });
  }
}
