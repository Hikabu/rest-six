'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Github,
  Mail,
  Wallet,
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Copy,
  Check,
  Link2,
  Unlink,
  RefreshCw,
} from 'lucide-react'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/use-toast'
import { useAuthStore } from '@/lib/auth-store'
import { SolanaLinkButton } from './SolanaLinkButton'

import {
  getLinkedGithub,
  getGithubConnectUrl,
  triggerGithubSync,
  getGithubSyncStatus,
  getLinkedWallet,
  getMfaSetup,
  activateMfa,
  deleteAccount,
} from '@/lib/api'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateAddress(addr: string): string {
  if (!addr) return ''
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1800)
        })
      }}
      aria-label="Copy to clipboard"
      className="cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

function AccountRow({
  icon,
  label,
  username,
  onLink,
  onSync,
  isSyncing,
  isLinking,
}: {
  icon: React.ReactNode
  label: string
  username?: string
  onLink: () => void
  onSync?: () => void
  isSyncing?: boolean
  isLinking?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-2.5">
        <span className="text-muted-foreground">{icon}</span>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {username ? (
            <span className="text-xs text-muted-foreground">{username}</span>
          ) : (
            <span className="text-xs text-muted-foreground/60">Not linked</span>
          )}
        </div>
      </div>
      {username ? (
        onSync && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSync}
            disabled={isSyncing}
            className="h-7 cursor-pointer px-2.5 text-xs text-muted-foreground hover:text-primary"
          >
            <RefreshCw className={`mr-1 h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Data'}
          </Button>
        )
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={onLink}
          disabled={isLinking}
          className="h-7 cursor-pointer px-2.5 text-xs"
        >
          <Link2 className="mr-1 h-3 w-3" />
          {isLinking ? 'Connecting...' : 'Connect'}
        </Button>
      )}
    </div>
  )
}

function MfaSetupFlow({
  setupData,
  onActivate,
  onCancel,
  isActivating,
}: {
  setupData: any
  onActivate: (otp: string) => void
  onCancel: () => void
  isActivating?: boolean
}) {
  const [otp, setOtp] = useState('')

  return (
    <div className="flex flex-col gap-4">
      {/* QR Code */}
      <div className="flex flex-col items-center gap-2">
        <img
          src={setupData.qrUri}
          alt="Scan this QR code with your authenticator app"
          className="h-36 w-36 rounded-lg border border-border bg-white p-1"
        />
        <p className="text-center text-xs text-muted-foreground">
          Scan with Google Authenticator, Authy, or any TOTP app.
        </p>
      </div>

      {/* Manual code */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Or enter manually</Label>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <code className="flex-1 break-all font-mono text-xs tracking-widest text-foreground">
            {setupData.manualCode}
          </code>
          <CopyButton value={setupData.manualCode} />
        </div>
      </div>

      {/* OTP input */}
      <div className="flex flex-col gap-1">
        <Label htmlFor="mfa-otp-input" className="text-xs text-muted-foreground">
          Enter the 6-digit code from your app
        </Label>
        <Input
          id="mfa-otp-input"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          inputMode="numeric"
          maxLength={6}
          className="h-9 text-center font-mono text-base tracking-[0.35em]"
        />
      </div>

      {/* Recovery codes */}
      {setupData.recoveryCodes && setupData.recoveryCodes.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            2FA activated — save these recovery codes
          </div>
          <div className="grid grid-cols-2 gap-1">
            {setupData.recoveryCodes.map((code: string) => (
              <code
                key={code}
                className="rounded bg-muted/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
              >
                {code}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => onActivate(otp)}
          disabled={otp.length !== 6 || isActivating || (setupData.recoveryCodes?.length > 0)}
          className="cursor-pointer"
        >
          {isActivating ? 'Activating…' : 'Activate 2FA'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isActivating}
          className="cursor-pointer"
        >
          {setupData.recoveryCodes?.length > 0 ? 'Close' : 'Cancel'}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SettingsAccordion() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // --- DANGER ---
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const deleteMut = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      useAuthStore.getState().clearAuth()
      toast({ title: 'Account deleted' })
      router.push('/')
    },
  })

  // --- GITHUB ---
  const { data: githubData } = useQuery({
    queryKey: ['linkedGithub'],
    queryFn: getLinkedGithub,
  })

  const githubConnectMut = useMutation({
    mutationFn: getGithubConnectUrl,
    onSuccess: (data: any) => {
      window.location.href = data.url
    },
  })

  const [isGithubSyncing, setIsGithubSyncing] = useState(false)
  const githubSyncMut = useMutation({
    mutationFn: triggerGithubSync,
    onSuccess: () => {
      setIsGithubSyncing(true)
      toast({ title: 'GitHub sync started' })
    },
  })

  useQuery({
    queryKey: ['githubSyncStatus'],
    queryFn: getGithubSyncStatus,
    enabled: isGithubSyncing,
    refetchInterval: (query) => ((query.state.data as any)?.status === 'done' ? false : 2000),
  })
  
  // To handle the completion of github sync polling
  useQuery({
    queryKey: ['githubSyncStatus'],
    queryFn: getGithubSyncStatus,
    enabled: isGithubSyncing,
    refetchInterval: 2000,
  })

  // Watch for sync completion to reset UI
  // Note: Since react-query polling handles it, we can use a small effect
  const { data: syncStatusData } = useQuery({
    queryKey: ['githubSyncStatus'],
    queryFn: getGithubSyncStatus,
    enabled: isGithubSyncing,
    refetchInterval: (query) => ((query.state.data as any)?.status === 'done' ? false : 2000),
  })

  React.useEffect(() => {
    if ((syncStatusData as any)?.status === 'done' && isGithubSyncing) {
      setIsGithubSyncing(false)
      toast({ title: 'GitHub sync completed!' })
      queryClient.invalidateQueries({ queryKey: ['linkedGithub'] })
    }
  }, [syncStatusData, isGithubSyncing, queryClient, toast])


  // --- WALLET ---
  const { data: walletData } = useQuery({
    queryKey: ['linkedWallet'],
    queryFn: getLinkedWallet,
  })




  // --- MFA ---
  const [isMfaSetupOpen, setIsMfaSetupOpen] = useState(false)
  
  // Replace mfaEnabled prop with API or use token logic. If githubData returns it or user profile?
  // Let's assume Profile API returns it. But wait, `getLinkedGithub` might not have it.
  // Actually, MFA setup query returns active status, but we only fetch it on open.
  // Let's assume mfaEnabled = user.mfaEnabled (which we can query).
  // The user prompt only specified: "getMfaSetupQuery: useQuery({ queryFn: getMfaSetup, enabled: isSetupOpen })"
  const { data: mfaSetupData, isFetching: isMfaFetching } = useQuery({
    queryKey: ['mfaSetup'],
    queryFn: getMfaSetup,
    enabled: isMfaSetupOpen,
  })

  const activateMut = useMutation({
    mutationFn: activateMfa,
    onSuccess: (data: any) => {
      // Data should contain recovery codes
      // We manually update the query cache so MfaSetupFlow displays the codes
      queryClient.setQueryData(['mfaSetup'], { ...((mfaSetupData as any) || {}), recoveryCodes: data.recoveryCodes })
      toast({ title: 'Two-factor authentication enabled!' })
    },
    onError: () => {
      toast({ title: 'Invalid code. Please try again.', variant: 'destructive' })
    }
  })

  // To display the badge properly, ideally we'd check `me.mfaEnabled`.
  // If not available, we can mock or derive it from setupData.
  const mfaEnabled = false // TODO: Pull from User profile 

  return (
    <Accordion type="single" collapsible className="w-full">
      {/* ── LINKED ACCOUNTS ─────────────────────────────────────────── */}
      <AccordionItem value="linked-accounts">
        <AccordionTrigger className="hover:no-underline">
          <span className="text-sm font-medium">Login options</span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col divide-y divide-border/60">
            <AccountRow
              icon={<Github className="h-4 w-4" />}
              label="GitHub"
              username={(githubData as any)?.username}
              onLink={() => githubConnectMut.mutate()}
              onSync={() => githubSyncMut.mutate()}
              isLinking={githubConnectMut.isPending}
              isSyncing={isGithubSyncing}
            />
            <AccountRow
              icon={<Mail className="h-4 w-4" />}
              label="Google"
              username={undefined}
              onLink={() => toast({ title: "Google integration coming soon" })}
            />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── SOLANA WALLET ────────────────────────────────────────────── */}
      <AccordionItem value="wallet">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Solana Wallet</span>
            {(walletData as any)?.isLinked ? (
              <Circle className="h-2 w-2 fill-teal-400 text-teal-400" />
            ) : (
              <Circle className="h-2 w-2 fill-muted-foreground/40 text-muted-foreground/40" />
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent>
          {(walletData as any)?.isLinked && (walletData as any)?.address ? (
            <div className="flex items-center justify-between gap-3 py-1">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-teal-400" />
                <code className="font-mono text-sm text-foreground">
                  {truncateAddress((walletData as any).address)}
                </code>
                <CopyButton value={(walletData as any).address} />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toast({ title: "Unlink functionality coming soon" })}
                className="h-7 cursor-pointer px-2.5 text-xs text-muted-foreground hover:text-destructive"
              >
                <Unlink className="mr-1 h-3 w-3" />
                Unlink
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 py-1">
              <p className="text-xs text-muted-foreground">
                Connect a Solana wallet to enable on-chain verification and Web3 scoring.
              </p>
              <SolanaLinkButton 
                variant="outline"
                size="sm"
                className="w-fit cursor-pointer"
              />
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* ── MFA ──────────────────────────────────────────────────────── */}
      <AccordionItem value="mfa">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Two-factor authentication</span>
            {mfaEnabled ? (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-400">
                <ShieldCheck className="mr-0.5 h-2.5 w-2.5" />
                Enabled
              </Badge>
            ) : (
              <Badge variant="outline" className="border-border bg-transparent text-[10px] text-muted-foreground">
                <ShieldOff className="mr-0.5 h-2.5 w-2.5" />
                Disabled
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent>
          {mfaEnabled ? (
            <div className="flex items-center gap-2 py-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <p className="text-sm text-muted-foreground">
                Two-factor authentication is active on your account.
              </p>
            </div>
          ) : mfaSetupData ? (
            <MfaSetupFlow
              setupData={mfaSetupData}
              onActivate={(otp) => activateMut.mutate({ otp })}
              onCancel={() => {
                setIsMfaSetupOpen(false)
                queryClient.removeQueries({ queryKey: ['mfaSetup'] })
              }}
              isActivating={activateMut.isPending}
            />
          ) : (
            <div className="flex flex-col gap-3 py-1">
              <p className="text-xs text-muted-foreground">
                Add an extra layer of security to your account with a time-based one-time password.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMfaSetupOpen(true)}
                disabled={isMfaFetching}
                className="w-fit cursor-pointer"
              >
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                {isMfaFetching ? 'Loading...' : 'Set up 2FA'}
              </Button>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* ── DANGER ZONE ──────────────────────────────────────────────── */}
      <AccordionItem value="danger-zone">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            <span className="text-sm font-medium text-destructive">Danger zone</span>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex flex-col gap-3 py-1">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="w-fit cursor-pointer">
                  Delete account
                </Button>
              </AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete account</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your account, scorecard, and all data. There is no way to recover this.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="delete-confirm-input" className="text-xs text-muted-foreground">
                    Type <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">DELETE</code> to confirm
                  </Label>
                  <Input
                    id="delete-confirm-input"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                    className="font-mono"
                  />
                </div>

                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirm('')} className="cursor-pointer">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    disabled={deleteConfirm !== 'DELETE' || deleteMut.isPending}
                    onClick={(e) => {
                      e.preventDefault()
                      if (deleteConfirm === 'DELETE') {
                        deleteMut.mutate()
                      }
                    }}
                    className="cursor-pointer bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50"
                  >
                    {deleteMut.isPending ? 'Deleting…' : 'Delete my account'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
