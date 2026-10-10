/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      // Legacy admin routes: /dashboard/* -> /admin/*
      { source: "/dashboard", destination: "/admin", permanent: true },
      { source: "/dashboard/:path*", destination: "/admin/:path*", permanent: true },
      // Legacy user dashboard route: /account -> /user
      { source: "/account", destination: "/user", permanent: true },
      { source: "/account/:path*", destination: "/user/:path*", permanent: true },
      // Legacy storefront slug removal: /frontEnd/* -> /* (public pages)
      // NOTE: the /frontEnd/admin login is handled first so it lands on
      // /login/admin (NOT /admin, which is now the guarded dashboard).
      { source: "/frontEnd/admin/login_eyara_xyz", destination: "/login/admin/login_eyara_xyz", permanent: true },
      { source: "/frontEnd/admin", destination: "/login/admin", permanent: true },
      { source: "/frontEnd", destination: "/", permanent: true },
      { source: "/frontEnd/:path*", destination: "/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
