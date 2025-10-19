import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, AuthState } from '../types';
import { apiService } from '../services/api';

interface AuthStore extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const response = await apiService.auth.login({ email, password });
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
        const { token } = get();
        if (!token) return;

        try {
          const response = await apiService.auth.refreshToken();
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
          const updatedUser = await apiService.auth.updateProfile(updates);
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
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);