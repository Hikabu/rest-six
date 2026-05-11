"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

/**
 * Listens for the `auth:logout` DOM event (dispatched by the auth store and
 * apiFetch on 401) and navigates to /auth. This pattern keeps the Zustand
 * store and API layer decoupled from the Next.js router.
 */
function AuthSessionWatcher() {
  const router = useRouter();
  // Stable ref so the effect doesn't re-register on re-renders
  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    function handleLogout() {
      routerRef.current.push("/auth");
    }

    window.addEventListener("auth:logout", handleLogout);
    return () => window.removeEventListener("auth:logout", handleLogout);
  }, []);

  return null;
}

function makeQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      /**
       * Global error handler for all useQuery / useSuspenseQuery calls.
       * On 401 we immediately log out and navigate (via the auth:logout event)
       * rather than letting the component decide what to do.
       */
      onError(error) {
        if (error instanceof ApiError && error.status === 401) {
          // logout() will dispatch the auth:logout DOM event which
          // AuthSessionWatcher will pick up and call router.push('/auth').
          useAuthStore.getState().logout();
        }
      },
    }),
    defaultOptions: {
      queries: {
        // Never auto-retry on 401 — the global handler above takes over.
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status === 401) return false;
          return failureCount < 2;
        },
        staleTime: 60 * 1000, // 1 minute default
      },
    },
  });
}

// Use a module-level singleton so it's not recreated on every render,
// but we still call makeQueryClient() lazily on first mount.
let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always create a new client
    return makeQueryClient();
  }
  // Browser: reuse the same client
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  const content = privyAppId ? (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ["email", "wallet"],
      }}
    >
      {children}
    </PrivyProvider>
  ) : (
    children
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionWatcher />
      {content}
      <Toaster />
    </QueryClientProvider>
  );
}