export const ROLES = Object.freeze({
  ADMIN: 'admin',
  OPERARIO: 'operario'
});

export const PERMISSIONS = Object.freeze({
  SCANNER_PRODUCTS_READ: 'scanner.products.read',
  SCANNER_PRODUCT_UPDATE: 'scanner.product.update',
  SCANNER_LOOKUP_READ: 'scanner.lookup.read',
  SCANNER_SALE_CREATE: 'scanner.sale.create',
  SCANNER_DASHBOARD_READ: 'scanner.dashboard.read',
  SCANNER_PAYMENT_CREATE: 'scanner.payment.create',
  SCANNER_DASHBOARD_UPDATE: 'scanner.dashboard.update'
});

export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ADMIN]: new Set([
    PERMISSIONS.SCANNER_PRODUCTS_READ,
    PERMISSIONS.SCANNER_PRODUCT_UPDATE,
    PERMISSIONS.SCANNER_LOOKUP_READ,
    PERMISSIONS.SCANNER_SALE_CREATE,
    PERMISSIONS.SCANNER_DASHBOARD_READ,
    PERMISSIONS.SCANNER_PAYMENT_CREATE,
    PERMISSIONS.SCANNER_DASHBOARD_UPDATE
  ]),
  [ROLES.OPERARIO]: new Set([
    PERMISSIONS.SCANNER_PRODUCTS_READ,
    PERMISSIONS.SCANNER_PRODUCT_UPDATE,
    PERMISSIONS.SCANNER_LOOKUP_READ,
    PERMISSIONS.SCANNER_SALE_CREATE
  ])
});

export function roleHasPermission(role, permission) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  const normalizedPermission = String(permission || '').trim();

  if (!normalizedRole || !normalizedPermission) {
    return false;
  }

  const allowedPermissions = ROLE_PERMISSIONS[normalizedRole];
  if (!allowedPermissions) {
    return false;
  }

  return allowedPermissions.has(normalizedPermission);
}
