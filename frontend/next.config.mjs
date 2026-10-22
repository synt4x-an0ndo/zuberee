import path from "node:path";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { agentUpgrade: "security" },
  // Next dev HMR validates Origin separately from Host. Allow loopback and
  // this machine's actual LAN addresses (phones), never arbitrary origins.
  allowedDevOrigins: [
    "127.0.0.1", "[::1]",
    ...Object.values(networkInterfaces()).flat()
      .filter((address) => address && !address.internal && address.family === "IPv4")
      .map((address) => address.address),
    ...(process.env.ZUBEREE_DEV_ORIGINS || "").split(",").map((host) => host.trim()).filter(Boolean),
  ],
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
