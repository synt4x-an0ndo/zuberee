/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  async headers() {
    return [
      {
        // Public uploaded images. Served cross-origin so the storefront can
        // also draw them to a <canvas> (the padded square favicon the
        // frontend builds from the store logo) without tainting it.
        // These files are already publicly readable; "*" grants no new access.
        source: "/storage/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
      {
        source: "/uploads/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

export default nextConfig;
