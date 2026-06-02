import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getScope } from '@/lib/scope';

const DIR = path.join(process.cwd(), 'reports');

// Titlu prietenos din numele fișierului (01-audit-inchidere.md -> "Audit inchidere")
function titleOf(file: string) {
  return file.replace(/\.md$/, '').replace(/^\d+-/, '').replace(/-/g, ' ')
    .replace(/^\w/, c => c.toUpperCase());
}

export async function GET(req: NextRequest) {
  const scope = await getScope();
  if (!scope) return NextResponse.json({ ok: false }, { status: 401 });
  // Rapoartele conțin date personale ale clienților → doar admin/manager.
  if (!scope.isManager) return NextResponse.json({ ok: false, error: 'Acces restricționat (doar manager/admin).' }, { status: 403 });

  const file = new URL(req.url).searchParams.get('file');
  let files: string[] = [];
  try {
    files = (await fs.readdir(DIR)).filter(f => f.endsWith('.md')).sort();
  } catch {
    return NextResponse.json({ ok: true, reports: [], content: null });
  }

  if (file) {
    // doar fișiere din DIR (basename), anti path-traversal
    const safe = path.basename(file);
    if (!files.includes(safe)) return NextResponse.json({ ok: false, error: 'Raport inexistent' }, { status: 404 });
    const content = await fs.readFile(path.join(DIR, safe), 'utf8');
    return NextResponse.json({ ok: true, content, file: safe });
  }

  return NextResponse.json({ ok: true, reports: files.map(f => ({ file: f, title: titleOf(f) })) });
}
