import { User } from '@/types';

const TOKEN_KEY = 'openvpn_token';
const USER_KEY = 'openvpn_user';

export const authStorage = {
  getToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken: (token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
  },

  removeToken: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
  },

  getUser: (): User | null => {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  setUser: (user: User): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  removeUser: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(USER_KEY);
  },

  clearAuth: (): void => {
    authStorage.removeToken();
    authStorage.removeUser();
  },
};

export const isAuthenticated = (): boolean => {
  return !!authStorage.getToken();
};

export const isAdmin = (): boolean => {
  const user = authStorage.getUser();
  return user?.role === 'admin';
};
