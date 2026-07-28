/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The VUX design system lives at ../design-system so every product can share
  // one copy. Without this, Next refuses to compile files outside web/.
  experimental: { externalDir: true },
};

export default nextConfig;
