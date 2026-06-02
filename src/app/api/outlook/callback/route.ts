import { NextRequest, NextResponse } from 'next/server';
import { getScope } from '@/lib/scope';
import { exchangeCode } from '@/lib/outlook';
import { auditLog } from '@/lib/audit';

// GET — callback OAuth Microsoft: schimbă codul pe token-uri (criptate) + revine la Setări.
export async function GET(req: NextRequest) {
  const base = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
  const scope = await getScope();
  if (!scope) return NextResponse.redirect(base + '/login');
  const sp = new URL(req.url).searchParams;
  const err = sp.get('error');
  if (err) return NextResponse.redirect(base + '/settings?outlook=err&msg=' + encodeURIComponent(sp.get('error_description') || err));
  const code = sp.get('code');
  const state = sp.get('state');
  if (!code || state !== scope.userId) return NextResponse.redirect(base + '/settings?outlook=err&msg=state');
  try {
    const account = await exchangeCode(scope.userId, code);
    await auditLog({ userId: scope.userId, func: 'outlook/connect', action: 'UPDATE', fields: 'account=' + account });
    return NextResponse.redirect(base + '/settings?outlook=ok&acct=' + encodeURIComponent(account));
  } catch (e: any) {
    return NextResponse.redirect(base + '/settings?outlook=err&msg=' + encodeURIComponent(e.message || 'eroare'));
  }
}
