"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuthStore } from "@/lib/auth-store"
import { Button } from "@/components/ui/button"

export function SiteHeader() {
  const { token, role } = useAuthStore()
  const pathname = usePathname()

  // Hide the global SiteHeader on the landing page since it has its own custom animated Navigation
  if (pathname === "/") {
    return null
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold tracking-tight">16signals</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/jobs" className="transition-colors hover:text-foreground/80 text-foreground/60">
              Browse Jobs
            </Link>
            <Link href="/about" className="transition-colors hover:text-foreground/80 text-foreground/60">
              About
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {token ? (
            <Button asChild variant="default" size="sm">
              <Link href={role === 'employer' ? '/dashboard' : '/profile'}>
                Go to Dashboard
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/auth"></Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/auth?mode=candidate">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

