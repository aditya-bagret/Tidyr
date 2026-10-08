import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @tidyr/shared ships TypeScript source (D-001).
  transpilePackages: ['@tidyr/shared'],
  poweredByHeader: false,
  // `next dev` would otherwise write an AGENTS.md into the app; CLAUDE.md at the root covers it.
  agentRules: false,
  // The CSP needs a per-request nonce, so it's set in src/proxy.ts; the static headers live here.
  headers() {
    return Promise.resolve([
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]);
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
