/**
 * Permission Middleware - Unit Tests
 *
 * Tests for RBAC permission system
 * Run with: npm test
 *
 * @module middleware/permissions.test
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  checkWildcardPermission,
  checkResourcePermission,
  validatePermissionsStructure,
  mergePermissions,
  parsePermissions,
  DEFAULT_PERMISSIONS,
  type Permissions,
  RESOURCES,
  ACTIONS
} from '../lib/rbac';

describe('RBAC Utilities', () => {
  describe('checkWildcardPermission', () => {
    it('should grant access with wildcard permission', () => {
      const permissions: Permissions = {
        '*': { read: true, create: true, update: true, delete: true }
      };

      expect(checkWildcardPermission(permissions, ACTIONS.READ)).toBe(true);
      expect(checkWildcardPermission(permissions, ACTIONS.CREATE)).toBe(true);
      expect(checkWildcardPermission(permissions, ACTIONS.DELETE)).toBe(true);
    });

    it('should deny access without wildcard permission', () => {
      const permissions: Permissions = {
        quotations: { read: true }
      };

      expect(checkWildcardPermission(permissions, ACTIONS.READ)).toBe(false);
      expect(checkWildcardPermission(permissions, ACTIONS.CREATE)).toBe(false);
    });

    it('should deny access with wildcard but action set to false', () => {
      const permissions: Permissions = {
        '*': { read: true, delete: false }
      };

      expect(checkWildcardPermission(permissions, ACTIONS.READ)).toBe(true);
      expect(checkWildcardPermission(permissions, ACTIONS.DELETE)).toBe(false);
    });
  });

  describe('checkResourcePermission', () => {
    it('should grant access with specific resource permission', () => {
      const permissions: Permissions = {
        quotations: { read: true, create: true }
      };

      expect(checkResourcePermission(permissions, RESOURCES.QUOTATIONS, ACTIONS.READ)).toBe(true);
      expect(checkResourcePermission(permissions, RESOURCES.QUOTATIONS, ACTIONS.CREATE)).toBe(true);
    });

    it('should deny access without specific resource permission', () => {
      const permissions: Permissions = {
        quotations: { read: true }
      };

      expect(checkResourcePermission(permissions, RESOURCES.QUOTATIONS, ACTIONS.CREATE)).toBe(false);
      expect(checkResourcePermission(permissions, RESOURCES.QUOTATIONS, ACTIONS.DELETE)).toBe(false);
    });

    it('should grant access via wildcard even if resource not specified', () => {
      const permissions: Permissions = {
        '*': { read: true, create: true, update: true, delete: true }
      };

      expect(checkResourcePermission(permissions, RESOURCES.QUOTATIONS, ACTIONS.READ)).toBe(true);
      expect(checkResourcePermission(permissions, RESOURCES.CLIENTS, ACTIONS.DELETE)).toBe(true);
    });

    it('should deny access for non-existent resource', () => {
      const permissions: Permissions = {
        quotations: { read: true }
      };

      expect(checkResourcePermission(permissions, RESOURCES.CLIENTS, ACTIONS.READ)).toBe(false);
    });
  });

  describe('validatePermissionsStructure', () => {
    it('should validate correct permission structure', () => {
      const permissions = {
        quotations: { read: true, create: false },
        clients: { read: true, update: true }
      };

      const result = validatePermissionsStructure(permissions);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject non-object permissions', () => {
      const result = validatePermissionsStructure("invalid");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be an object');
    });

    it('should reject null permissions', () => {
      const result = validatePermissionsStructure(null);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be an object');
    });

    it('should reject non-object resource permissions', () => {
      const permissions = {
        quotations: "invalid"
      };

      const result = validatePermissionsStructure(permissions);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must map to an actions object');
    });

    it('should reject non-boolean action values', () => {
      const permissions = {
        quotations: { read: "yes" }
      };

      const result = validatePermissionsStructure(permissions);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('must be a boolean');
    });

    it('should reject unknown action types', () => {
      const permissions = {
        quotations: { read: true, invalidAction: true }
      };

      const result = validatePermissionsStructure(permissions);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Unknown action');
    });

    it('should validate wildcard permissions', () => {
      const permissions = {
        '*': { read: true, create: true, update: true, delete: true }
      };

      const result = validatePermissionsStructure(permissions);
      expect(result.isValid).toBe(true);
    });
  });

  describe('mergePermissions', () => {
    it('should merge permissions with OR logic', () => {
      const perms1: Permissions = {
        quotations: { read: true }
      };
      const perms2: Permissions = {
        quotations: { create: true }
      };

      const merged = mergePermissions([perms1, perms2]);

      expect(merged.quotations?.read).toBe(true);
      expect(merged.quotations?.create).toBe(true);
    });

    it('should combine permissions from multiple resources', () => {
      const perms1: Permissions = {
        quotations: { read: true }
      };
      const perms2: Permissions = {
        clients: { read: true, create: true }
      };

      const merged = mergePermissions([perms1, perms2]);

      expect(merged.quotations?.read).toBe(true);
      expect(merged.clients?.read).toBe(true);
      expect(merged.clients?.create).toBe(true);
    });

    it('should handle empty array', () => {
      const merged = mergePermissions([]);
      expect(Object.keys(merged).length).toBe(0);
    });

    it('should use OR logic - any true makes result true', () => {
      const perms1: Permissions = {
        quotations: { read: true, create: false }
      };
      const perms2: Permissions = {
        quotations: { read: false, create: true }
      };

      const merged = mergePermissions([perms1, perms2]);

      expect(merged.quotations?.read).toBe(true);
      expect(merged.quotations?.create).toBe(true);
    });

    it('should merge wildcard permissions', () => {
      const perms1: Permissions = {
        quotations: { read: true }
      };
      const perms2: Permissions = {
        '*': { read: true, create: true, update: true, delete: true }
      };

      const merged = mergePermissions([perms1, perms2]);

      expect(merged['*']?.read).toBe(true);
      expect(merged['*']?.delete).toBe(true);
      expect(merged.quotations?.read).toBe(true);
    });

    it('should handle overlapping permissions correctly', () => {
      const perms1: Permissions = {
        quotations: { read: true, create: true, update: false }
      };
      const perms2: Permissions = {
        quotations: { update: true, delete: true }
      };
      const perms3: Permissions = {
        quotations: { read: false } // Should still be true from perms1
      };

      const merged = mergePermissions([perms1, perms2, perms3]);

      expect(merged.quotations?.read).toBe(true); // true from perms1
      expect(merged.quotations?.create).toBe(true); // true from perms1
      expect(merged.quotations?.update).toBe(true); // true from perms2
      expect(merged.quotations?.delete).toBe(true); // true from perms2
    });
  });

  describe('parsePermissions', () => {
    it('should parse valid JSON permissions', () => {
      const json = '{"quotations": {"read": true, "create": true}}';
      const parsed = parsePermissions(json);

      expect(parsed).not.toBeNull();
      expect(parsed?.quotations?.read).toBe(true);
      expect(parsed?.quotations?.create).toBe(true);
    });

    it('should return null for invalid JSON', () => {
      const json = 'invalid json{';
      const parsed = parsePermissions(json);

      expect(parsed).toBeNull();
    });

    it('should return null for invalid permission structure', () => {
      const json = '{"quotations": "invalid"}';
      const parsed = parsePermissions(json);

      expect(parsed).toBeNull();
    });

    it('should parse wildcard permissions', () => {
      const json = '{"*": {"read": true, "create": true, "update": true, "delete": true}}';
      const parsed = parsePermissions(json);

      expect(parsed).not.toBeNull();
      expect(parsed?.['*']?.read).toBe(true);
      expect(parsed?.['*']?.delete).toBe(true);
    });
  });

  describe('DEFAULT_PERMISSIONS', () => {
    it('should have valid SUPER_ADMIN permissions', () => {
      const perms = DEFAULT_PERMISSIONS.SUPER_ADMIN;
      const validation = validatePermissionsStructure(perms);

      expect(validation.isValid).toBe(true);
      expect(perms['*']?.read).toBe(true);
      expect(perms['*']?.create).toBe(true);
      expect(perms['*']?.update).toBe(true);
      expect(perms['*']?.delete).toBe(true);
    });

    it('should have valid ADMIN permissions', () => {
      const perms = DEFAULT_PERMISSIONS.ADMIN;
      const validation = validatePermissionsStructure(perms);

      expect(validation.isValid).toBe(true);
      expect(perms.quotations?.read).toBe(true);
      expect(perms.quotations?.delete).toBe(true);
      expect(perms.users?.read).toBe(true);
      expect(perms.users?.update).toBe(true);
    });

    it('should have valid AGENT permissions', () => {
      const perms = DEFAULT_PERMISSIONS.AGENT;
      const validation = validatePermissionsStructure(perms);

      expect(validation.isValid).toBe(true);
      expect(perms.quotations?.read).toBe(true);
      expect(perms.quotations?.create).toBe(true);
      expect(perms.quotations?.delete).toBe(false);
    });

    it('should have valid USER permissions', () => {
      const perms = DEFAULT_PERMISSIONS.USER;
      const validation = validatePermissionsStructure(perms);

      expect(validation.isValid).toBe(true);
      expect(perms.quotations?.read).toBe(true);
      expect(perms.clients?.read).toBe(true);
    });

    it('should have valid VIEWER permissions', () => {
      const perms = DEFAULT_PERMISSIONS.VIEWER;
      const validation = validatePermissionsStructure(perms);

      expect(validation.isValid).toBe(true);
      expect(perms.reports?.read).toBe(true);
    });
  });

  describe('Permission Hierarchy Tests', () => {
    it('SUPER_ADMIN should have more permissions than ADMIN', () => {
      const superAdmin = DEFAULT_PERMISSIONS.SUPER_ADMIN;
      const admin = DEFAULT_PERMISSIONS.ADMIN;

      // Super admin has wildcard
      expect(superAdmin['*']).toBeDefined();
      expect(admin['*']).toBeUndefined();

      // Super admin can access any resource via wildcard
      expect(checkResourcePermission(superAdmin, RESOURCES.AUDIT_LOGS, ACTIONS.READ)).toBe(true);
      expect(checkResourcePermission(admin, RESOURCES.AUDIT_LOGS, ACTIONS.READ)).toBe(false);
    });

    it('ADMIN should have more permissions than AGENT', () => {
      const admin = DEFAULT_PERMISSIONS.ADMIN;
      const agent = DEFAULT_PERMISSIONS.AGENT;

      // Admin can delete quotations, agent cannot
      expect(admin.quotations?.delete).toBe(true);
      expect(agent.quotations?.delete).toBe(false);

      // Admin can manage users, agent cannot
      expect(admin.users?.read).toBe(true);
      expect(agent.users).toBeUndefined();
    });

    it('AGENT should have more permissions than USER', () => {
      const agent = DEFAULT_PERMISSIONS.AGENT;
      const user = DEFAULT_PERMISSIONS.USER;

      // Agent can create quotations, user cannot
      expect(agent.quotations?.create).toBe(true);
      expect(user.quotations?.create).toBeUndefined();

      // Agent can update clients, user cannot
      expect(agent.clients?.update).toBe(true);
      expect(user.clients?.update).toBeUndefined();
    });

    it('USER should have more permissions than VIEWER', () => {
      const user = DEFAULT_PERMISSIONS.USER;
      const viewer = DEFAULT_PERMISSIONS.VIEWER;

      // User can read quotations, viewer cannot
      expect(user.quotations?.read).toBe(true);
      expect(viewer.quotations).toBeUndefined();

      // Both can read reports
      expect(user.reports?.read).toBe(true);
      expect(viewer.reports?.read).toBe(true);
    });
  });

  describe('Multi-Role Scenarios', () => {
    it('should grant combined permissions when user has multiple roles', () => {
      const role1: Permissions = {
        quotations: { read: true, create: true }
      };
      const role2: Permissions = {
        quotations: { update: true },
        clients: { read: true }
      };

      const combined = mergePermissions([role1, role2]);

      expect(combined.quotations?.read).toBe(true);
      expect(combined.quotations?.create).toBe(true);
      expect(combined.quotations?.update).toBe(true);
      expect(combined.clients?.read).toBe(true);
    });

    it('should grant permission if ANY role grants it', () => {
      const restrictiveRole: Permissions = {
        quotations: { read: true }
      };
      const permissiveRole: Permissions = {
        quotations: { read: true, create: true, update: true, delete: true }
      };

      const combined = mergePermissions([restrictiveRole, permissiveRole]);

      // Should have all permissions from permissive role
      expect(combined.quotations?.delete).toBe(true);
    });
  });
});
