// Legacy auth store - kept for backward compatibility
// Authentication is now handled by Clerk

import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// This store is deprecated - use Clerk's useUser() and useAuth() hooks instead
export const useAuthStore = create<AuthState>()(() => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,
}));
