/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages ship TypeScript source; let Next compile them.
  transpilePackages: [
    "@civil/core",
    "@civil/excel",
    "@civil/platform",
    "@civil/runner",
    "@civil/tool-sdk",
    "@civil/tool-borehole",
    "@civil/tool-culvert-gl",
  ],
};

export default nextConfig;
