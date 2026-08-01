import type { NextConfig } from "next";

// The API is deployed at http://62.72.58.29:5001 — plain HTTP, no TLS. If the
// frontend is ever served over HTTPS, calling that origin directly from the
// browser is a mixed-content request and gets silently blocked; even over
// HTTP it's a cross-origin call that depends on CORS staying configured
// correctly on the backend. Routing it through a same-origin rewrite sidesteps
// both: the browser only ever talks to its own origin, and this server-side
// proxy is the one thing that speaks to the backend's bare HTTP address.
const API_ORIGIN = process.env.API_PROXY_ORIGIN ?? "http://62.72.58.29:5001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
