import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getScope, canAccessClient } from '@/lib/scope';
import { sendMail } from '@/lib/outlook';
import { renderStrategiePdf } from '@/lib/strategie-pdf';
import { auditLog } from '@/lib/audit';

// POST — trimite emailul de deviz prin Outlook (Graph). Atașează PDF-ul fișei dacă vine clientId.
export async function POST(req: NextRequest) {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false }, { status: 401 });
  const { to, cc, subject, html, clientId, attachPdf } = await req.json().catch(() => ({} as any));
  if (!to || !subject || !html) return NextResponse.json({ ok: false, error: 'Lipsesc To / Subiect / Corp' }, { status: 400 });

  let attachments;
  if (clientId && attachPdf) {
    const c = await prisma.client.findUnique({ where: { id: clientId } });
    if (!c || !(await canAccessClient(scope, c.ownerId))) return NextResponse.json({ ok: false, error: 'Acces interzis la client' }, { status: 403 });
    const buf = await renderStrategiePdf(c);
    attachments = [{ name: 'strategie-' + c.idLucrare + '.pdf', contentType: 'application/pdf', contentBytesBase64: Buffer.from(buf).toString('base64') }];
  }
  try {
    await sendMail(scope.userId, { to, cc, subject, html, attachments });
    await auditLog({ userId: scope.userId, func: 'outlook/send', action: 'EMAIL', entityId: clientId, fields: 'to=' + to + (attachments ? '; +PDF' : '') });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
