import type { NextConfig } from 'next';

/**
 * Static export — produces `dapp/out/` with pure HTML/CSS/JS. Deployable
 * to any CDN-edge static host (Cloudflare Pages, Netlify static, S3+CF).
 *
 * Trade-offs vs SSR:
 *  - No `headers()` / `redirects()` / `rewrites()` here — they require a
 *    server. Cloudflare Pages reads response headers from
 *    `dapp/public/_headers` instead; same security policy lives there.
 *  - No <Image> remote optimisation — we don't use it.
 *  - No API routes — we have none.
 *
 * The whole dapp is client-side (wagmi + RainbowKit), so server-side
 * rendering would just delay the same wallet calls. Static is faster.
 */
const nextConfig: NextConfig = {
  output: 'export',
  // Disable Next.js' default image optimisation since the static export
  // host can't run it. Our SVG icons + base64 data-URIs don't need it.
  images: { unoptimized: true },
};

export default nextConfig;
