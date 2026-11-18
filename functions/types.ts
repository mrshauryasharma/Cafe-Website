export interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
}

export interface UserSession {
  id: string;
  name: string;
  username: string;
  role: 'owner' | 'staff';
  exp: number;
}
