import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, UserRole } from '../types';
import { authService } from '../services/api';

interface AuthStore {
  user: User | null;
  token: string | null;
  refreshTokenValue: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set: any, get: any) => ({
      // TEMPORARY: Provide mock user data for POC testing in development
      user: import.meta.env.DEV ? {
        id: 'dev-user-1',
        username: 'dev-user',
        email: 'dev@example.com',
        name: 'Development User',
        role: UserRole.ADMIN,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } : null,
      token: import.meta.env.DEV ? 'dev-token-for-poc' : null,
      refreshTokenValue: null,
      // TEMPORARY: Set isAuthenticated to true for POC testing in development
      isAuthenticated: import.meta.env.DEV ? true : false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await authService.login({ username, password }) as any;
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      refreshToken: async () => {
        const { token, refreshTokenValue } = get();
        if (!refreshTokenValue) return;
        if (!token) return;

        try {
          const response = await authService.refreshToken(refreshTokenValue) as any;
          set({
            user: response.user,
            token: response.token,
          });
        } catch (error) {
          // Token refresh failed, logout
          get().logout();
          throw error;
        }
      },

      updateProfile: async (updates: Partial<User>) => {
        const { user } = get();
        if (!user) return;

        set({ isLoading: true });
        try {
          const updatedUser = await authService.updateProfile(updates);
          set({
            user: updatedUser,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state: any) => ({
        user: state.user,
        token: state.token,
        refreshTokenValue: state.refreshTokenValue,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);