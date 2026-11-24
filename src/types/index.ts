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

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  permissions?: UserPermissions;
}

export interface CafeTable {
  id: string;
  table_number: string;
  table_name: string;
  section: string;
  capacity: number;
  status: 'vacant' | 'occupied';
  active_order_id?: string | null;
  is_active: number;
  sort_order: number;
  created_at: string;
}

export interface SetupStatusResponse {
  isInitialized: boolean;
  cafe_name: string;
  error?: string;
}

export interface AuthMeResponse {
  user: User | null;
  cafe_name: string;
  error?: string;
}
