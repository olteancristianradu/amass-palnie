export { default } from 'next-auth/middleware';

// Middleware protejează DOAR rute UI (page routes). API routes au check getServerSession intern
// → returnează JSON 401, nu redirect HTML.
export const config = {
  matcher: ['/((?!login|api|_next/static|_next/image|favicon.ico).*)']
};
