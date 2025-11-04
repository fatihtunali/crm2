/**
 * Role-based permission system
 *
 * Roles (in order of privilege):
 * - super_admin: Full system access, can manage all organizations
 * - org_admin: Can manage their organization's data and users
 * - org_user: Full CRUD access to their organization's data
 * - viewer: Read-only access to their organization's data
 */

export type UserRole = 'super_admin' | 'org_admin' | 'org_user' | 'viewer';

export interface Permission {
  // Resource permissions
  canViewUsers: boolean;
  canCreateUsers: boolean;
  canUpdateUsers: boolean;
  canDeleteUsers: boolean;

  canViewAgents: boolean;
  canCreateAgents: boolean;
  canUpdateAgents: boolean;
  canDeleteAgents: boolean;

  canViewRequests: boolean;
  canCreateRequests: boolean;
  canUpdateRequests: boolean;
  canDeleteRequests: boolean;

  canViewQuotations: boolean;
  canCreateQuotations: boolean;
  canUpdateQuotations: boolean;
  canDeleteQuotations: boolean;

  canViewBookings: boolean;
  canCreateBookings: boolean;
  canUpdateBookings: boolean;
  canDeleteBookings: boolean;

  canViewClients: boolean;
  canCreateClients: boolean;
  canUpdateClients: boolean;
  canDeleteClients: boolean;

  canViewSuppliers: boolean;
  canCreateSuppliers: boolean;
  canUpdateSuppliers: boolean;
  canDeleteSuppliers: boolean;

  canViewInvoices: boolean;
  canCreateInvoices: boolean;
  canUpdateInvoices: boolean;
  canDeleteInvoices: boolean;

  canViewFinance: boolean;
  canManageFinance: boolean;

  canViewReports: boolean;
  canExportData: boolean;

  // UI access
  canAccessSettings: boolean;
  canAccessApiDocs: boolean;
}

/**
 * Get permissions for a given role
 */
export function getPermissions(role: UserRole): Permission {
  switch (role) {
    case 'super_admin':
      return {
        // Full access to everything
        canViewUsers: true,
        canCreateUsers: true,
        canUpdateUsers: true,
        canDeleteUsers: true,

        canViewAgents: true,
        canCreateAgents: true,
        canUpdateAgents: true,
        canDeleteAgents: true,

        canViewRequests: true,
        canCreateRequests: true,
        canUpdateRequests: true,
        canDeleteRequests: true,

        canViewQuotations: true,
        canCreateQuotations: true,
        canUpdateQuotations: true,
        canDeleteQuotations: true,

        canViewBookings: true,
        canCreateBookings: true,
        canUpdateBookings: true,
        canDeleteBookings: true,

        canViewClients: true,
        canCreateClients: true,
        canUpdateClients: true,
        canDeleteClients: true,

        canViewSuppliers: true,
        canCreateSuppliers: true,
        canUpdateSuppliers: true,
        canDeleteSuppliers: true,

        canViewInvoices: true,
        canCreateInvoices: true,
        canUpdateInvoices: true,
        canDeleteInvoices: true,

        canViewFinance: true,
        canManageFinance: true,

        canViewReports: true,
        canExportData: true,

        canAccessSettings: true,
        canAccessApiDocs: true,
      };

    case 'org_admin':
      return {
        // Can manage users
        canViewUsers: true,
        canCreateUsers: true,
        canUpdateUsers: true,
        canDeleteUsers: true,

        // Full CRUD on all resources
        canViewAgents: true,
        canCreateAgents: true,
        canUpdateAgents: true,
        canDeleteAgents: true,

        canViewRequests: true,
        canCreateRequests: true,
        canUpdateRequests: true,
        canDeleteRequests: true,

        canViewQuotations: true,
        canCreateQuotations: true,
        canUpdateQuotations: true,
        canDeleteQuotations: true,

        canViewBookings: true,
        canCreateBookings: true,
        canUpdateBookings: true,
        canDeleteBookings: true,

        canViewClients: true,
        canCreateClients: true,
        canUpdateClients: true,
        canDeleteClients: true,

        canViewSuppliers: true,
        canCreateSuppliers: true,
        canUpdateSuppliers: true,
        canDeleteSuppliers: true,

        canViewInvoices: true,
        canCreateInvoices: true,
        canUpdateInvoices: true,
        canDeleteInvoices: true,

        canViewFinance: true,
        canManageFinance: true,

        canViewReports: true,
        canExportData: true,

        canAccessSettings: true,
        canAccessApiDocs: true,
      };

    case 'org_user':
      return {
        // Cannot manage users
        canViewUsers: false,
        canCreateUsers: false,
        canUpdateUsers: false,
        canDeleteUsers: false,

        // Full CRUD on operational resources
        canViewAgents: true,
        canCreateAgents: true,
        canUpdateAgents: true,
        canDeleteAgents: true,

        canViewRequests: true,
        canCreateRequests: true,
        canUpdateRequests: true,
        canDeleteRequests: true,

        canViewQuotations: true,
        canCreateQuotations: true,
        canUpdateQuotations: true,
        canDeleteQuotations: true,

        canViewBookings: true,
        canCreateBookings: true,
        canUpdateBookings: true,
        canDeleteBookings: true,

        canViewClients: true,
        canCreateClients: true,
        canUpdateClients: true,
        canDeleteClients: true,

        canViewSuppliers: true,
        canCreateSuppliers: true,
        canUpdateSuppliers: true,
        canDeleteSuppliers: true,

        canViewInvoices: true,
        canCreateInvoices: true,
        canUpdateInvoices: true,
        canDeleteInvoices: true,

        canViewFinance: true,
        canManageFinance: false, // Can view but not manage

        canViewReports: true,
        canExportData: true,

        canAccessSettings: false,
        canAccessApiDocs: true,
      };

    case 'viewer':
      return {
        // Read-only access
        canViewUsers: false,
        canCreateUsers: false,
        canUpdateUsers: false,
        canDeleteUsers: false,

        canViewAgents: true,
        canCreateAgents: false,
        canUpdateAgents: false,
        canDeleteAgents: false,

        canViewRequests: true,
        canCreateRequests: false,
        canUpdateRequests: false,
        canDeleteRequests: false,

        canViewQuotations: true,
        canCreateQuotations: false,
        canUpdateQuotations: false,
        canDeleteQuotations: false,

        canViewBookings: true,
        canCreateBookings: false,
        canUpdateBookings: false,
        canDeleteBookings: false,

        canViewClients: true,
        canCreateClients: false,
        canUpdateClients: false,
        canDeleteClients: false,

        canViewSuppliers: true,
        canCreateSuppliers: false,
        canUpdateSuppliers: false,
        canDeleteSuppliers: false,

        canViewInvoices: true,
        canCreateInvoices: false,
        canUpdateInvoices: false,
        canDeleteInvoices: false,

        canViewFinance: true,
        canManageFinance: false,

        canViewReports: true,
        canExportData: false,

        canAccessSettings: false,
        canAccessApiDocs: true,
      };

    default:
      // Default to most restrictive permissions
      return getPermissions('viewer');
  }
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(role: UserRole, permissionKey: keyof Permission): boolean {
  const permissions = getPermissions(role);
  return permissions[permissionKey];
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'org_admin':
      return 'Org Admin';
    case 'org_user':
      return 'Org User';
    case 'viewer':
      return 'Viewer';
    default:
      return role;
  }
}

/**
 * Get role description
 */
export function getRoleDescription(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return 'Full system access, can manage all organizations and users';
    case 'org_admin':
      return 'Can manage organization data and users, full CRUD access';
    case 'org_user':
      return 'Full access to create and manage operational data';
    case 'viewer':
      return 'Read-only access to organization data';
    default:
      return '';
  }
}
