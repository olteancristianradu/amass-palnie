import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        amass: {
          navy: '#1E2A3A',
          accent: '#C45A2B',
          green: '#15803D',
          slate: '#64748B',
          bg: '#fafafa'
        }
      }
    }
  },
  plugins: []
};
export default config;
