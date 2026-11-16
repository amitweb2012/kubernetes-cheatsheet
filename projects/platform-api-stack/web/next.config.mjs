/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    // Local development only. In Kubernetes, NGINX Ingress routes /api to Express.
    return process.env.API_INTERNAL_URL
      ? [{ source: "/api/:path*", destination: `${process.env.API_INTERNAL_URL}/api/:path*` }]
      : [];
  }
};

export default nextConfig;
