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

export type KotTicketType = 'new_order' | 'add_on' | 'cancel_item';
export type KotStatus = 'pending' | 'printed';

export interface KotItem {
  menu_item_id?: string;
  name: string;
  quantity: number;
  unit_price: number;
  notes?: string;
}

export interface KotTicket {
  id: string;
  kot_number: string;
  draft_id?: string | null;
  table_id?: string | null;
  table_number: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  waiter_id?: string | null;
  waiter_name: string;
  ticket_type: KotTicketType;
  items_json: string;
  items?: KotItem[];
  reason?: string | null;
  status: KotStatus;
  created_at: string;
  printed_at?: string | null;
}
