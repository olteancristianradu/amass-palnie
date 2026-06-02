import { NextResponse } from 'next/server';
import { getScope } from '@/lib/scope';
import { getStatus, disconnect } from '@/lib/outlook';

export async function GET() {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await getStatus(scope.userId)) });
}

// DELETE — deconectează Outlook pentru contul curent.
export async function DELETE() {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false }, { status: 401 });
  await disconnect(scope.userId);
  return NextResponse.json({ ok: true });
}
