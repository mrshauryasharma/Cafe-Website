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
