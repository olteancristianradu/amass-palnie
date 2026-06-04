import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

// One-time setup endpoint: creează primul admin dacă nu există useri.
// Apel: POST /api/setup { email, password, name }
// Blochează dacă există deja useri (evită takeover).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, name } = body;
    if (!email || !password || password.length < 6) {
      return NextResponse.json({ ok: false, error: 'Date invalide (email + parola min 6 char)' }, { status: 400 });
    }
    const hash = await bcrypt.hash(password, 10);
    // ANTI-RACE: re-verifică count ȘI creează în ACEEAȘI tranzacție (SQLite serializează scrierile)
    // → două cereri concurente nu mai pot crea doi admini în fereastra de setup.
    const user = await prisma.$transaction(async (tx) => {
      if ((await tx.user.count()) > 0) return null;
      return tx.user.create({
        data: { email: email.toLowerCase(), passwordHash: hash, name: name || email, role: 'admin' }
      });
    });
    if (!user) return NextResponse.json({ ok: false, error: 'Setup deja făcut — există useri.' }, { status: 403 });
    return NextResponse.json({ ok: true, id: user.id, email: user.email });
  } catch {
    // NU expune e.message (repo/tunel public) — mesaj generic.
    return NextResponse.json({ ok: false, error: 'Eroare la setup.' }, { status: 500 });
  }
}
