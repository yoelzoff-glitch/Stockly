export type UserRole = 'owner' | 'admin' | 'user';

export interface Profile {
  id: string; // References auth.users(id)
  tenant_id?: string;
  full_name?: string;
  email?: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}
