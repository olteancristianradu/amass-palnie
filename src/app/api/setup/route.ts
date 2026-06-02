import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';

// One-time setup endpoint: creează primul admin dacă nu există useri.
// Apel: POST /api/setup { email, password, name }
// Blochează dacă există deja useri (evită takeover).
export async function POST(req: NextRequest) {
  try {
    const count = await prisma.user.count();
    if (count > 0) {
      return NextResponse.json({ ok: false, error: 'Setup deja făcut — există useri.' }, { status: 403 });
    }
    const body = await req.json();
    const { email, password, name } = body;
    if (!email || !password || password.length < 6) {
      return NextResponse.json({ ok: false, error: 'Date invalide (email + parola min 6 char)' }, { status: 400 });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), passwordHash: hash, name: name || email, role: 'admin' }
    });
    return NextResponse.json({ ok: true, id: user.id, email: user.email });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
