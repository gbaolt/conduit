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
    ],
  },
  transpilePackages: ['@repo/contract', '@repo/ui'],
};

export default nextConfig;
