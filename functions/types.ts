export interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

export type UserRole = 'owner' | 'manager' | 'staff' | 'waiter';

export interface UserPermissions {
  can_take_orders: boolean;
  can_view_tables: boolean;
  can_manage_tables: boolean;
  can_settle_bills: boolean;
  can_apply_discounts: boolean;
  can_manage_menu_stock: boolean;
  can_view_reports: boolean;
  can_award_bonus_points: boolean;
}

export interface UserSession {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  permissions?: UserPermissions;
  exp: number;
}
