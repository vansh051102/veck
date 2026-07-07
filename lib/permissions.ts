// ============================================================================
// PERMISSION CONSTANTS
// ============================================================================

export const PERMISSIONS = {
  // Leads
  LEADS_CREATE: 'leads:create',
  LEADS_READ: 'leads:read',
  LEADS_EDIT: 'leads:edit',
  LEADS_DELETE: 'leads:delete',
  LEADS_ASSIGN: 'leads:assign',
  LEADS_EXPORT: 'leads:export',
  LEADS_IMPORT: 'leads:import',

  // Contacts
  CONTACTS_CREATE: 'contacts:create',
  CONTACTS_READ: 'contacts:read',
  CONTACTS_EDIT: 'contacts:edit',

  // Activities
  ACTIVITIES_CREATE: 'activities:create',
  ACTIVITIES_READ: 'activities:read',
  ACTIVITIES_EDIT: 'activities:edit',
  ACTIVITIES_DELETE: 'activities:delete',

  // Quotes
  QUOTES_CREATE: 'quotes:create',
  QUOTES_READ: 'quotes:read',
  QUOTES_EDIT: 'quotes:edit',
  QUOTES_SEND: 'quotes:send',

  // Purchase Requests
  PURCHASE_REQUESTS_CREATE: 'purchase_requests:create',
  PURCHASE_REQUESTS_READ: 'purchase_requests:read',
  PURCHASE_REQUESTS_EDIT: 'purchase_requests:edit',

  // Checklists
  CHECKLISTS_CREATE: 'checklists:create',
  CHECKLISTS_READ: 'checklists:read',
  CHECKLISTS_EDIT: 'checklists:edit',

  // Analytics
  ANALYTICS_READ: 'analytics:read',

  // Settings
  SETTINGS_READ: 'settings:read',
  SETTINGS_EDIT: 'settings:edit',

  // Users
  USERS_CREATE: 'users:create',
  USERS_READ: 'users:read',
  USERS_EDIT: 'users:edit',
  USERS_DELETE: 'users:delete',

  // Roles
  ROLES_CREATE: 'roles:create',
  ROLES_READ: 'roles:read',
  ROLES_EDIT: 'roles:edit',

  // Master Data
  MASTER_DATA_CREATE: 'master_data:create',
  MASTER_DATA_READ: 'master_data:read',
  MASTER_DATA_EDIT: 'master_data:edit',

  // Reports
  REPORTS_READ: 'reports:read',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// ============================================================================
// ROLE → PERMISSION MAPPING (DEFAULTS)
// ============================================================================

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],

  marketing_manager: [
    PERMISSIONS.LEADS_CREATE,
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.LEADS_EDIT,
    PERMISSIONS.LEADS_IMPORT,
    PERMISSIONS.CONTACTS_CREATE,
    PERMISSIONS.CONTACTS_READ,
    PERMISSIONS.CONTACTS_EDIT,
    PERMISSIONS.ACTIVITIES_CREATE,
    PERMISSIONS.ACTIVITIES_READ,
    PERMISSIONS.ACTIVITIES_EDIT,
    PERMISSIONS.ACTIVITIES_DELETE,
    PERMISSIONS.ANALYTICS_READ,
  ],

  marketing_executive: [
    PERMISSIONS.LEADS_CREATE,
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.LEADS_EDIT,
    PERMISSIONS.LEADS_IMPORT,
    PERMISSIONS.CONTACTS_CREATE,
    PERMISSIONS.CONTACTS_READ,
    PERMISSIONS.CONTACTS_EDIT,
    PERMISSIONS.ACTIVITIES_CREATE,
    PERMISSIONS.ACTIVITIES_READ,
  ],

  sales_manager: [
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.LEADS_EDIT,
    PERMISSIONS.LEADS_ASSIGN,
    PERMISSIONS.CONTACTS_READ,
    PERMISSIONS.ACTIVITIES_CREATE,
    PERMISSIONS.ACTIVITIES_READ,
    PERMISSIONS.ACTIVITIES_EDIT,
    PERMISSIONS.ACTIVITIES_DELETE,
    PERMISSIONS.QUOTES_READ,
    PERMISSIONS.ANALYTICS_READ,
  ],

  sales_executive: [
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.LEADS_EDIT,
    PERMISSIONS.CONTACTS_READ,
    PERMISSIONS.ACTIVITIES_CREATE,
    PERMISSIONS.ACTIVITIES_READ,
    PERMISSIONS.QUOTES_READ,
  ],

  purchase: [
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.QUOTES_CREATE,
    PERMISSIONS.QUOTES_READ,
    PERMISSIONS.QUOTES_EDIT,
    PERMISSIONS.QUOTES_SEND,
    PERMISSIONS.PURCHASE_REQUESTS_CREATE,
    PERMISSIONS.PURCHASE_REQUESTS_READ,
    PERMISSIONS.PURCHASE_REQUESTS_EDIT,
    PERMISSIONS.CHECKLISTS_CREATE,
    PERMISSIONS.CHECKLISTS_READ,
    PERMISSIONS.CHECKLISTS_EDIT,
  ],

  sales_purchase: [
    PERMISSIONS.LEADS_READ,
    PERMISSIONS.LEADS_EDIT,
    PERMISSIONS.CONTACTS_READ,
    PERMISSIONS.ACTIVITIES_CREATE,
    PERMISSIONS.ACTIVITIES_READ,
    PERMISSIONS.QUOTES_CREATE,
    PERMISSIONS.QUOTES_READ,
    PERMISSIONS.QUOTES_EDIT,
    PERMISSIONS.QUOTES_SEND,
    PERMISSIONS.PURCHASE_REQUESTS_CREATE,
    PERMISSIONS.PURCHASE_REQUESTS_READ,
    PERMISSIONS.PURCHASE_REQUESTS_EDIT,
    PERMISSIONS.CHECKLISTS_CREATE,
    PERMISSIONS.CHECKLISTS_READ,
    PERMISSIONS.CHECKLISTS_EDIT,
  ],
}
