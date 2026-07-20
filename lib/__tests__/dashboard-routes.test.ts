import { dashboardRouteForRole } from '../dashboard-routes'

describe('dashboardRouteForRole', () => {
  it('maps admin to the admin portal', () => {
    expect(dashboardRouteForRole('admin')).toBe('/admin')
  })

  it('falls back to /dashboards/admin for an unknown role', () => {
    expect(dashboardRouteForRole('not_a_role')).toBe('/dashboards/admin')
  })

  it('maps marketing_manager to /dashboards/marketing', () => {
    expect(dashboardRouteForRole('marketing_manager')).toBe('/dashboards/marketing')
  })

  it('maps marketing_executive to /dashboards/marketing', () => {
    expect(dashboardRouteForRole('marketing_executive')).toBe('/dashboards/marketing')
  })

  it('maps sales_manager to /dashboards/sales', () => {
    expect(dashboardRouteForRole('sales_manager')).toBe('/dashboards/sales')
  })

  it('maps sales_executive to /dashboards/sales', () => {
    expect(dashboardRouteForRole('sales_executive')).toBe('/dashboards/sales')
  })

  it('maps purchase to /dashboards/purchase', () => {
    expect(dashboardRouteForRole('purchase')).toBe('/dashboards/purchase')
  })

  it('maps sales_purchase to /dashboards/sales-purchase', () => {
    expect(dashboardRouteForRole('sales_purchase')).toBe('/dashboards/sales-purchase')
  })

  it('falls back to admin for unknown roles', () => {
    expect(dashboardRouteForRole('unknown')).toBe('/dashboards/admin')
    expect(dashboardRouteForRole('')).toBe('/dashboards/admin')
  })
})