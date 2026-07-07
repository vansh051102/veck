// Single source of truth for which dashboard route a role lands on.
// Used by the login redirect, the /dashboard redirector, each role
// dashboard's own self-check-and-redirect, and the sidebar nav link.
export function dashboardRouteForRole(role: string): string {
  switch (role) {
    case 'admin':
      return '/dashboards/admin'
    case 'marketing_manager':
    case 'marketing_executive':
      return '/dashboards/marketing'
    case 'sales_manager':
    case 'sales_executive':
      return '/dashboards/sales'
    case 'purchase':
      return '/dashboards/purchase'
    case 'sales_purchase':
      return '/dashboards/sales-purchase'
    default:
      return '/dashboards/admin'
  }
}
