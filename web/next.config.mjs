/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Every page is client-rendered and auth is a bearer token held in the
  // browser, so nothing here needs a Node server at runtime. Exporting to plain
  // files lets the web app sit on any static host (Cloudflare Pages) for free.
  // The trade-off: no route handlers, no middleware, no next/image optimiser —
  // adding any of those means dropping this line and paying for a Node host.
  output: 'export',
  // The VUX design system lives at ../design-system so every product can share
  // one copy. Without this, Next refuses to compile files outside web/.
  experimental: { externalDir: true },
};

export default nextConfig;
