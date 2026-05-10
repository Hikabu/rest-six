"use client";

import { useState, type ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
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
      {content}
      <Toaster />
    </QueryClientProvider>
  );
}
