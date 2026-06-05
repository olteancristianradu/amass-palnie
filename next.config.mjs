/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // imagine Docker mică (.next/standalone/server.js)
  // ESLint disponibil via `npm run lint` (non-interactiv, acum că există .eslintrc.json), DAR NU
  // blochează build-ul (main = auto-deploy la client; un warning de lint nu trebuie să oprească deploy-ul).
  eslint: { ignoreDuringBuilds: true },
  experimental: { serverComponentsExternalPackages: ['bcryptjs'], instrumentationHook: true },
  // Antete de securitate (set CONSERVATOR — fără CSP, ca să nu spargă UI-ul/aspect.js inline).
  // HSTS contează doar pe HTTPS (tunelul e HTTPS; pe HTTP local e ignorat).
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' },
      ],
    }];
  },
};
export default nextConfig;
