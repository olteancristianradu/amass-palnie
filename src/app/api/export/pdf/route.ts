import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getScope, canAccessClient } from '@/lib/scope';
import { renderStrategiePdf } from '@/lib/strategie-pdf';

export async function GET(req: NextRequest) {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id lipsă' }, { status: 400 });
  const c = await prisma.client.findUnique({ where: { id } });
  if (!c || !(await canAccessClient(scope, c.ownerId))) return NextResponse.json({ ok: false }, { status: 404 });
  const buffer = await renderStrategiePdf(c);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="strategie-${c.idLucrare}.pdf"`
    }
  });
}
