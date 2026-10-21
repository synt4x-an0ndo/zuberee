/** UI requirements only; the API remains the authorization authority. Unmapped routes fail closed. */
const ROUTES = [
  ['/admin/chat', 'view customers'],
  ['/admin/shipping', 'view settings'], ['/admin/couriers', 'view settings'],
  ['/admin/fraud-checker', 'view orders'], ['/admin/about_us', 'view settings'],
  ['/admin/socialLinks', 'view settings'], ['/admin/footerSettings', 'view settings'],
  ['/admin/facebook_conversion_api', 'view settings'],
  ['/admin/users', 'view users'], ['/admin/roles', 'view roles'],
  ['/admin/products', 'view products'], ['/admin/categories', 'view categories'], ['/admin/category', 'view categories'],
  ['/admin/orders/new', 'create orders'], ['/admin/orders/edit', 'edit orders'], ['/admin/orders/invoice', 'download orders'], ['/admin/orders', 'view orders'],
  ['/admin/sizes', 'view sizes'], ['/admin/inventory', 'manage inventory'],
  ['/admin/customer_leaderboard', 'view leaderboard'], ['/admin/customers', 'view customers'],
  ['/admin/incomplete_orders', 'incomplete_order'], ['/admin/banners', 'view banners'],
  ['/admin/settings', 'view settings'], ['/admin/theme-settings', 'view settings'],
  ['/admin/sales-report', 'view dashboard summary'], ['/admin/sales', 'view dashboard summary'],
];
export function requiredAdminPermission(pathname) {
  if (pathname === '/admin') return 'view dashboard';
  return ROUTES.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1] || null;
}
