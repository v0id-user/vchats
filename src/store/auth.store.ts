import { create } from "zustand";
import { persist } from "zustand/middleware";
import { login as loginFn, register as registerFn } from "../server/auth";

export interface User {
  id: string;
  username: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;

  // Actions
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        }),

      login: async (username, password) => {
        const result = await loginFn({ data: { username, password } });
        if (result.success && result.token && result.user) {
          set({
            user: result.user,
            token: result.token,
            isAuthenticated: true,
          });
          return { success: true };
        }
        return { success: false, error: result.error };
      },

      register: async (username, password) => {
        const result = await registerFn({ data: { username, password } });
        if (result.success && result.token && result.user) {
          set({
            user: result.user,
            token: result.token,
            isAuthenticated: true,
          });
          return { success: true };
        }
        return { success: false, error: result.error };
      },
    }),
    {
      name: "vchats-auth",
    }
  )
);
