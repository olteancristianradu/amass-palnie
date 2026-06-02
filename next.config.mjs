/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // imagine Docker mică (.next/standalone/server.js)
  experimental: { serverComponentsExternalPackages: ['bcryptjs'], instrumentationHook: true }
};
export default nextConfig;
