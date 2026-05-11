import React from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Globe, UserX, Lock } from 'lucide-react'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import type { ProfileUser, ProfileCandidate } from '@/components/profile/ProfileHeader'
import { ScorecardView } from '@/components/ScorecardView'
import type { ScorecardData } from '@/components/ScorecardView'
import { VouchesSection } from '@/components/profile/VouchesSection'
import type { Vouch } from '@/components/profile/VouchesSection'
import { VouchForm } from '@/components/VouchForm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { getPublicScorecard } from '@/lib/api'
import ShareButton from './ShareButton'

// ---------------------------------------------------------------------------
// ISR — revalidate every 60 s
// ---------------------------------------------------------------------------

export const revalidate = 60

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: { username: string }
}): Promise<Metadata> {
    const { username } = await params

  const data = await getPublicScorecard(username)

  if (!data) return { title: 'Profile not found' }

  const sc = data as Record<string, unknown>
  const profile = (sc.profile as Record<string, unknown>) ?? {}
  const name = (profile.username as string) || username
  const summary = (profile.summary as string) || undefined
  const avatarUrl = (profile.avatarUrl as string) || undefined

  return {
    title: `${name}'s 16Signals Profile`,
    description: summary ?? `View ${name}'s verified Web3 reputation on 16Signals.`,
    openGraph: {
      title: `${name} on 16Signals`,
      description: summary ?? '',
      images: avatarUrl ? [{ url: avatarUrl }] : [],
    },
  }
}

// ---------------------------------------------------------------------------
// Empty / not-found states
// ---------------------------------------------------------------------------

function NotFoundState({ username }: { username: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <UserX className="h-12 w-12 text-muted-foreground" strokeWidth={1.5} />
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Profile not found</h1>
        <p className="text-sm text-muted-foreground">
          @{username} hasn&apos;t joined 16Signals yet.
        </p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href="/">Go to home</Link>
      </Button>
    </div>
  )
}

function NoScorecardState({ name }: { name: string }) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 border-dashed p-10 text-center">
      <Lock className="h-8 w-8 text-muted-foreground/50" strokeWidth={1.5} />
      <p className="text-sm text-muted-foreground">
        {name} hasn&apos;t generated a scorecard yet.
      </p>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Page — async Server Component
// ---------------------------------------------------------------------------

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params;
  console.log("📄 Generating profile page for:", username);

  const data = await getPublicScorecard(username)

  // 404 — full-screen empty state, no two-column layout
  if (!data) return <NotFoundState username={username} />

  // Extract fields from ScorecardUiDto: { profile, score, trust, insights }
  const sc = data as Record<string, unknown>
  const profile = (sc.profile as Record<string, unknown>) ?? {}

  // Serialisable props for child Server / Client components
  const user: ProfileUser = {
    name: (profile.username as string) || username,
    username,
    email: '',
    avatarUrl: (profile.avatarUrl as string) || undefined,
  }

  const candidate: ProfileCandidate = {
    bio: (profile.summary as string) || undefined,
    location: undefined,
    website: undefined,
  }

  const scorecard = data as unknown as ScorecardData

  // wallet is not exposed on the public scorecard endpoint;
  // VouchForm self-vouch guard handles the empty string case gracefully.
  const ownerWalletAddress = ''

  const vouches: Vouch[] = ((sc.vouches as Vouch[]) ?? [])

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* ── Full-width: profile header ──────────────────────────── */}
      <div className="relative mb-8">
        {/* Share — client island */}
        <div className="absolute right-0 top-0 z-10">
          <ShareButton username={username} displayName={user.name} />
        </div>

        <ProfileHeader
  user={user}
  candidate={candidate}
/>

        {/* Public profile badge */}
        <div className="mt-2">
          <Badge
            variant="outline"
            className="inline-flex items-center gap-1 rounded-full border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
          >
            <Globe className="h-3 w-3 shrink-0" />
            Public profile
          </Badge>
        </div>
      </div>

      {/* ── Two-column body ─────────────────────────────────────── */}
      {/*
        Desktop: left 60% (scorecard) / right 40% (vouches + form)
        Mobile:  single column, order preserved by DOM order
      */}
      <div className="grid grid-cols-1 gap-8 md:grid-cols-[3fr_2fr]">
        {/* Left column — scorecard */}
        <div className="min-w-0">
          {scorecard ? (
            <ScorecardView scorecard={scorecard} isPublic={true} />
          ) : (
            <NoScorecardState name={user.name} />
          )}
        </div>

        {/* Right column — sticky on desktop */}
        <div className="flex flex-col gap-6 md:sticky md:top-8 md:self-start">
          <VouchesSection vouches={vouches} isPublic={true} />
          <VouchForm username={username} ownerWalletAddress={ownerWalletAddress} />
        </div>
      </div>
    </div>
  )
}
