"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import Cookies from "js-cookie";

export type AuthRole = "candidate" | "employer";

type AuthState = {
  token: string | null;
  role: AuthRole | null;
  username: string | null;
  email: string | null;
  walletAddress: string | null;
  id: string | null;
  setAuth: (auth: {
    token?: string | null;
    role?: AuthRole | string | null;
    username?: string | null;
    email?: string | null;
    walletAddress?: string | null;
    id?: string | null;
  }) => void;
  clearAuth: () => void;
};

function normalizeRole(role?: AuthRole | string | null): AuthRole | null {
  if (!role) {
    return null;
  }

  const normalized = role.toLowerCase();
  if (normalized === "candidate" || normalized === "employer") {
    return normalized;
  }
  if (normalized === "recruiter") {
    return "employer";
  }

  return null;
}

const TOKEN_COOKIE_NAME = "16signals-token";
const ROLE_COOKIE_NAME = "16signals-role";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      username: null,
      email: null,
      walletAddress: null,
      id: null,
      setAuth: ({ token, role, username, email, walletAddress, id }) => {
        const normalizedRole = normalizeRole(role);
        
        // Sync with cookies for middleware
        if (token !== undefined) {
          if (token) {
            Cookies.set(TOKEN_COOKIE_NAME, token, { expires: 7, path: "/" });
          } else {
            Cookies.remove(TOKEN_COOKIE_NAME);
          }
        }
        
        if (normalizedRole) {
          Cookies.set(ROLE_COOKIE_NAME, normalizedRole, { expires: 7, path: "/" });
        } else if (role === null) {
          Cookies.remove(ROLE_COOKIE_NAME);
        }

        set((state) => ({
          token: token ?? state.token,
          role: normalizedRole ?? state.role,
          username: username ?? state.username,
          email: email ?? state.email,
          walletAddress: walletAddress ?? state.walletAddress,
          id: id ?? state.id,
        }));
      },
      clearAuth: () => {
        Cookies.remove(TOKEN_COOKIE_NAME);
        Cookies.remove(ROLE_COOKIE_NAME);
        set({ token: null, role: null, username: null, email: null, walletAddress: null, id: null });
      },
    }),
    { name: "16signals-auth" },
  ),
);

if (typeof globalThis !== "undefined") {
  globalThis.useAuthStore = useAuthStore;
}
