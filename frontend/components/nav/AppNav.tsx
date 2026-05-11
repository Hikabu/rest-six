"use client";

import { useAuthStore } from "@/lib/auth-store";
import { PublicNav } from "./PublicNav";
import { CandidateNav } from "./CandidateNav";
import { EmployerNav } from "./EmployerNav";

/**
 * Smart navbar that auto-selects the correct variant based on auth state.
 * Placed in the root layout so every page always has a navbar.
 */
export function AppNav() {
  const role = useAuthStore((s) => s.role);
  const username = useAuthStore((s) => s.username);

  if (role === "employer") {
    return <EmployerNav companyName={username ?? "Employer"} />;
  }

  if (role === "candidate" && username) {
    return <CandidateNav username={username} />;
  }

  // Not logged in — show public nav (includes sign-in/get-started)
  return <PublicNav />;
}
