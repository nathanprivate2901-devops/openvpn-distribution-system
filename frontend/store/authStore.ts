import { create } from 'zustand';
import { User } from '@/types';
import { authStorage } from '@/lib/auth';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  setAuth: (user: User, token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  initAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: (user: User, token: string) => {
    authStorage.setUser(user);
    authStorage.setToken(token);
    set({ user, token, isAuthenticated: true, isLoading: false });
  },

  setUser: (user: User) => {
    authStorage.setUser(user);
    set({ user });
  },

  logout: () => {
    authStorage.clearAuth();
    set({ user: null, token: null, isAuthenticated: false });
  },

  initAuth: () => {
    const token = authStorage.getToken();
    const user = authStorage.getUser();

    if (token && user) {
      set({ user, token, isAuthenticated: true, isLoading: false });
    } else {
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
