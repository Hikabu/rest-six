'use client'

import React from 'react'
import {
  Github,
  Wallet,
  Sparkles,
  Loader2,
  Clock,
  CheckCircle2,
  Circle,
  RefreshCw,
} from 'lucide-react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { SolanaLinkButton } from './SolanaLinkButton'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GithubStatus {
  isLinked: boolean
  lastSyncedAt?: string
  cooldownUntil?: string
}

export interface WalletStatus {
  isLinked: boolean
  address?: string
  cooldownUntil?: string
}

export interface GenerateScorecardSectionProps {
  githubStatus: GithubStatus
  walletStatus: WalletStatus
  /** ISO timestamp; undefined / null means available now */
  generateCooldownUntil?: string
  onSyncGithub: () => void
  onGenerate: () => void
  isSyncing: boolean
  isGenerating: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns remaining time as "Xh Ym", "Xm", or null if past / absent. */
function formatCountdown(until: string | undefined): string | null {
  if (!until) return null
  const ms = new Date(until).getTime() - Date.now()
  if (ms <= 0) return null
  const totalMinutes = Math.ceil(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h`
  return `${minutes}m`
}

/** Human-readable "synced N ago" label. */
function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/** Truncate wallet address: first 4 + last 4 chars. */
function truncateAddress(address: string): string {
  if (address.length <= 10) return address
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Amber "cooldown" badge displayed below the row action button. */
function CooldownChip({ until }: { until: string | undefined }) {
  const label = formatCountdown(until)
  if (!label) return null
  return (
    <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-400 ring-1 ring-amber-500/20">
      <Clock className="h-3 w-3 shrink-0" />
      Available in {label}
    </span>
  )
}

/** Thin horizontal separator between rows. */
function RowSeparator() {
  return <div className="mx-0 h-px bg-border/60" />
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function GenerateScorecardSection({
  githubStatus,
  walletStatus,
  generateCooldownUntil,
  onSyncGithub,
  onGenerate,
  isSyncing,
  isGenerating,
}: GenerateScorecardSectionProps) {
  // Cooldown derivations
  const githubOnCooldown =
    !!githubStatus.cooldownUntil &&
    Date.now() < new Date(githubStatus.cooldownUntil).getTime()

  const walletOnCooldown =
    !!walletStatus.cooldownUntil &&
    Date.now() < new Date(walletStatus.cooldownUntil).getTime()

  const generateOnCooldown =
    !!generateCooldownUntil &&
    Date.now() < new Date(generateCooldownUntil).getTime()

  const noSourceLinked = !githubStatus.isLinked && !walletStatus.isLinked

  const generateDisabled =
    noSourceLinked || generateOnCooldown || isGenerating

  const generateTooltip = noSourceLinked
    ? 'Sync at least one source first'
    : generateOnCooldown
      ? `Available in ${formatCountdown(generateCooldownUntil) ?? ''}`
      : undefined

  return (
    <Card className="w-full overflow-hidden border-l-2 border-l-[hsl(var(--accent))] rounded-xl">
      {/* ── Header ── */}
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-semibold text-foreground">
          Generate Scorecard
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Sync your data sources, then analyse.
        </CardDescription>
      </CardHeader>

      {/* ── Body ── */}
      <CardContent className="flex flex-col gap-0 px-6 pt-4 pb-5">

        {/* ── ROW: GitHub ── */}
        <div className="flex flex-col gap-1 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Left: icon + label + status chip */}
            <div className="flex items-center gap-2.5 min-w-0">
              <Github
                className={`h-4 w-4 shrink-0 ${githubStatus.isLinked ? 'text-emerald-400' : 'text-muted-foreground'}`}
              />
              <span className="text-sm font-medium text-foreground whitespace-nowrap">
                GitHub
              </span>
              {githubStatus.isLinked ? (
                <Badge
                  variant="outline"
                  className="text-[11px] border-emerald-500/30 bg-emerald-500/10 text-emerald-400 px-1.5 py-0 font-normal"
                >
                  <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                  {githubStatus.lastSyncedAt
                    ? `Synced ${formatRelativeTime(githubStatus.lastSyncedAt)}`
                    : 'Synced'}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[11px] border-border bg-transparent text-muted-foreground px-1.5 py-0 font-normal"
                >
                  <Circle className="mr-1 h-2.5 w-2.5" />
                  Not connected
                </Badge>
              )}
            </div>

            {/* Right: action */}
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncGithub}
              disabled={(githubStatus.isLinked && githubOnCooldown) || isSyncing}
              className="h-7 px-2.5 text-xs shrink-0 cursor-pointer"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Syncing…
                </>
              ) : githubStatus.isLinked ? (
                <>
                  <RefreshCw className="mr-1.5 h-3 w-3" />
                  Sync now
                </>
              ) : (
                <>
                  <Github className="mr-1.5 h-3 w-3" />
                  Connect GitHub
                </>
              )}
            </Button>
          </div>

          {/* Cooldown chip */}
          {githubOnCooldown && (
            <div className="pl-[26px]">
              <CooldownChip until={githubStatus.cooldownUntil} />
            </div>
          )}
        </div>

        <RowSeparator />

        {/* ── ROW: Wallet ── */}
        <div className="flex flex-col gap-1 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Left: icon + label + status chip */}
            <div className="flex items-center gap-2.5 min-w-0">
              <Wallet
                className={`h-4 w-4 shrink-0 ${walletStatus.isLinked ? 'text-teal-400' : 'text-muted-foreground'}`}
              />
              <span className="text-sm font-medium text-foreground whitespace-nowrap">
                Solana Wallet
              </span>
              {walletStatus.isLinked && walletStatus.address ? (
                <Badge
                  variant="outline"
                  className="text-[11px] border-teal-500/30 bg-teal-500/10 text-teal-400 px-1.5 py-0 font-mono font-normal"
                >
                  {truncateAddress(walletStatus.address)}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-[11px] border-border bg-transparent text-muted-foreground px-1.5 py-0 font-normal"
                >
                  <Circle className="mr-1 h-2.5 w-2.5" />
                  Not linked
                </Badge>
              )}
            </div>

            {/* Right: only show action if not linked */}
            {!walletStatus.isLinked && (
              <SolanaLinkButton 
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs shrink-0 cursor-pointer"
                onSuccess={() => {}} // Invalidation handled inside
              />
            )}
          </div>

          {/* Cooldown chip */}
          {walletOnCooldown && (
            <div className="pl-[26px]">
              <CooldownChip until={walletStatus.cooldownUntil} />
            </div>
          )}
        </div>

        <RowSeparator />

        {/* ── ROW: Generate CTA ── */}
        <div className="pt-4">
          {generateTooltip ? (
            <Tooltip>
              <TooltipTrigger asChild>
                {/* Wrapper div keeps tooltip working even on disabled button */}
                <div className="w-full cursor-not-allowed">
                  <Button
                    variant="default"
                    size="default"
                    disabled
                    className="w-full pointer-events-none"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyse &amp; generate scorecard
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                {generateTooltip}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              id="generate-scorecard-btn"
              variant="default"
              size="default"
              onClick={onGenerate}
              disabled={generateDisabled}
              className="w-full cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analysing…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Analyse &amp; generate scorecard
                </>
              )}
            </Button>
          )}

          {/* Generate-level cooldown indicator */}
          {generateOnCooldown && !noSourceLinked && (
            <div className="mt-2 flex justify-center">
              <CooldownChip until={generateCooldownUntil} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default GenerateScorecardSection
