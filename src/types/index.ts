export interface User {
  id: string;
  name: string;
  username: string;
  role: 'owner' | 'staff';
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
