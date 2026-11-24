import { UserPermissions, UserRole } from '../types';

export const PERMISSION_KEYS: (keyof UserPermissions)[] = [
  'can_take_orders',
  'can_view_tables',
  'can_manage_tables',
  'can_settle_bills',
  'can_apply_discounts',
  'can_manage_menu_stock',
  'can_view_reports',
  'can_award_bonus_points',
];

export const PERMISSION_LABELS: Record<keyof UserPermissions, { label: string; desc: string }> = {
  can_take_orders: {
    label: 'Take Orders & Send KOT',
    desc: 'Create dining drafts, add notes, and print kitchen tickets',
  },
  can_view_tables: {
    label: 'View Floor & Table Board',
    desc: 'See live vacant and occupied tables across sections',
  },
  can_manage_tables: {
    label: 'Manage Floor Plan & Tables',
    desc: 'Add, rename, reorganize, or remove dining tables',
  },
  can_settle_bills: {
    label: 'Settle Bills & Collect Payment',
    desc: 'Execute final checkout, redeem points, and print tax receipts',
  },
  can_apply_discounts: {
    label: 'Apply Custom Discounts',
    desc: 'Grant bill discounts or item cancellations during counter billing',
  },
  can_manage_menu_stock: {
    label: 'Manage Menu Catalog & Stock',
    desc: 'Edit menu items, prices, restock inventory, and log kitchen wastage',
  },
  can_view_reports: {
    label: 'View Reports & Analytics',
    desc: 'Access sales KPIs, revenue charts, and staff performance reports',
  },
  can_award_bonus_points: {
    label: 'Award Loyalty Bonus Points',
    desc: 'Manually grant courtesy loyalty points to customer profiles',
  },
};

export const ROLE_PRESETS: Record<UserRole, UserPermissions> = {
  owner: {
    can_take_orders: true,
    can_view_tables: true,
    can_manage_tables: true,
    can_settle_bills: true,
    can_apply_discounts: true,
    can_manage_menu_stock: true,
    can_view_reports: true,
    can_award_bonus_points: true,
  },
  manager: {
    can_take_orders: true,
    can_view_tables: true,
    can_manage_tables: true,
    can_settle_bills: true,
    can_apply_discounts: true,
    can_manage_menu_stock: true,
    can_view_reports: true,
    can_award_bonus_points: true,
  },
  staff: {
    can_take_orders: true,
    can_view_tables: true,
    can_manage_tables: false,
    can_settle_bills: true,
    can_apply_discounts: false,
    can_manage_menu_stock: false,
    can_view_reports: false,
    can_award_bonus_points: true,
  },
  waiter: {
    can_take_orders: true,
    can_view_tables: true,
    can_manage_tables: false,
    can_settle_bills: false,
    can_apply_discounts: false,
    can_manage_menu_stock: false,
    can_view_reports: false,
    can_award_bonus_points: false,
  },
};

export function resolveUserPermissions(
  role: string,
  customPermissionsJson?: string | Record<string, boolean> | null
): UserPermissions {
  if (role === 'owner') {
    return { ...ROLE_PRESETS.owner };
  }

  const validRole: UserRole =
    role === 'manager' || role === 'staff' || role === 'waiter' ? (role as UserRole) : 'staff';
  const base = { ...ROLE_PRESETS[validRole] };

  if (!customPermissionsJson) return base;

  let parsed: Record<string, boolean> = {};
  if (typeof customPermissionsJson === 'string') {
    try {
      parsed = JSON.parse(customPermissionsJson);
    } catch {
      parsed = {};
    }
  } else if (typeof customPermissionsJson === 'object') {
    parsed = customPermissionsJson;
  }

  const result: UserPermissions = { ...base };
  for (const key of PERMISSION_KEYS) {
    if (typeof parsed[key] === 'boolean') {
      result[key] = parsed[key];
    }
  }

  return result;
}
