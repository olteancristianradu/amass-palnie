export { default } from 'next-auth/middleware';

// Middleware protejează DOAR rute UI (page routes). API routes au check getServerSession intern
// → returnează JSON 401, nu redirect HTML.
// Exclude și fișierele statice cu extensie (ex. /aspect.js, /logo-amass.png) — `.*\..*` —
// altfel motorul Aspect (/aspect.js) era redirecționat la login (307) și nu se încărca.
export const config = {
  matcher: ['/((?!login|api|_next/static|_next/image|favicon.ico|.*\\..*).*)']
};
