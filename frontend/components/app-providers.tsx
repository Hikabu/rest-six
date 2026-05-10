"use client";

import { useState, type ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";

// Solana
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import '@solana/wallet-adapter-react-ui/styles.css'
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";

const wallets = [new PhantomWalletAdapter()];

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
      <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}>
        {content}
        <Toaster />
      </PrivyProvider>
    </QueryClientProvider>
  );
}