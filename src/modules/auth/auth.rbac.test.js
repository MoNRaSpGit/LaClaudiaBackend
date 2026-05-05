import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLES, roleHasPermission } from './auth.rbac.js';

describe('roleHasPermission', () => {
  it('allows admin dashboard update permission', () => {
    expect(roleHasPermission(ROLES.ADMIN, PERMISSIONS.SCANNER_DASHBOARD_UPDATE)).toBe(true);
  });

  it('does not allow operario dashboard update permission', () => {
    expect(roleHasPermission(ROLES.OPERARIO, PERMISSIONS.SCANNER_DASHBOARD_UPDATE)).toBe(false);
  });

  it('allows operario payment create permission', () => {
    expect(roleHasPermission(ROLES.OPERARIO, PERMISSIONS.SCANNER_PAYMENT_CREATE)).toBe(true);
  });

  it('allows operario ranking read permission', () => {
    expect(roleHasPermission(ROLES.OPERARIO, PERMISSIONS.SCANNER_RANKING_READ)).toBe(true);
  });

  it('allows operario stock request permissions', () => {
    expect(roleHasPermission(ROLES.OPERARIO, PERMISSIONS.STOCK_REQUEST_CREATE)).toBe(true);
    expect(roleHasPermission(ROLES.OPERARIO, PERMISSIONS.STOCK_REQUEST_READ)).toBe(true);
    expect(roleHasPermission(ROLES.OPERARIO, PERMISSIONS.STOCK_REQUEST_RESOLVE)).toBe(true);
  });

  it('is resilient to unknown roles or permissions', () => {
    expect(roleHasPermission('guest', PERMISSIONS.SCANNER_DASHBOARD_READ)).toBe(false);
    expect(roleHasPermission(ROLES.ADMIN, '')).toBe(false);
    expect(roleHasPermission('', PERMISSIONS.SCANNER_DASHBOARD_READ)).toBe(false);
  });
});
