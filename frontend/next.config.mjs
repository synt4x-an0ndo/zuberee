import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: { root: projectRoot },
  async redirects() {
    return [
      // Legacy admin routes: /dashboard/* -> /admin/*
      { source: "/dashboard", destination: "/admin", permanent: true },
      { source: "/dashboard/:path*", destination: "/admin/:path*", permanent: true },
      // Legacy user dashboard route: /account -> /user
      { source: "/account", destination: "/user", permanent: true },
      { source: "/account/:path*", destination: "/user/:path*", permanent: true },
      // Legacy storefront slug removal: /frontEnd/* -> /* (public pages)
      // NOTE: the dedicated admin-login landing page was removed; every legacy
      // admin-login URL now lands on /login, which redirects by role after
      // sign-in (admins -> /admin, customers -> /user).
      { source: "/frontEnd/admin/login_eyara_xyz", destination: "/login", permanent: true },
      { source: "/login/admin/login_eyara_xyz", destination: "/login", permanent: true },
      { source: "/frontEnd/admin/login_zuberee_xyz", destination: "/login", permanent: true },
      { source: "/login/admin/login_zuberee_xyz", destination: "/login", permanent: true },
      { source: "/frontEnd/admin", destination: "/login", permanent: true },
      { source: "/frontEnd", destination: "/", permanent: true },
      { source: "/frontEnd/:path*", destination: "/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
