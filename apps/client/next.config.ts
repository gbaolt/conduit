import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    'app.conduit.localhost',
    'conduit.localhost',
    '*.conduit.localhost',
  ],
  cacheComponents: true,
  partialPrefetching: true,
  typedRoutes: true,
  reactCompiler: true,
  experimental: {
    useTypeScriptCli: false,
    typedEnv: true,
    authInterrupts: true,
    optimizeCss: true,
    optimizePackageImports: ['@tabler/icons-react'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'gravatar.com',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'assets.giabao.dev',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'assets.conduit.giabao.dev',
        port: '',
      },
    ],
  },
  // The app sets no other Content-Security-Policy directive yet. Workers may load only from this origin, so /sw.js runs and no other script can register.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "worker-src 'self'" },
        ],
      },
    ];
  },
  transpilePackages: ['@conduit/contract', '@conduit/ui'],
};

export default nextConfig;
