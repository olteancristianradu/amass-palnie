// Rulat o singură dată la pornirea serverului Next.js (runtime nodejs).
// Pornește scheduler-ul de auto-sync CRM.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startAutoSync } = await import('./lib/auto-sync');
    startAutoSync();
  }
}
