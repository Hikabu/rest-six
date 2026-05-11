'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getLinkedGithub,
  getLinkedWallet,
  triggerGithubSync,
  startAnalysis,
  getAnalysisCooldown,
  getMe,
  getCandidateProfile,
  updateUser,
  updateCandidateProfile,
} from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import { GenerateScorecardSection } from '@/components/profile/GenerateScorecardSection'
import { ProfileHeader } from '@/components/profile/ProfileHeader'
import { ScorecardSection } from '@/components/profile/ScorecardSection'
import { SettingsAccordion } from '@/components/profile/SettingsAccordion'

<<<<<<<< HEAD:frontend/app/profile/page.tsx
function ProfileContent() {
========
export default function ProfileClient() {
>>>>>>>> frontend:frontend/app/profile/ProfileClient.tsx
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  // Handle GitHub connection callback
  useEffect(() => {
    if (searchParams.get('github_connected') === 'true') {
      toast({ title: "GitHub connected successfully!" })
      queryClient.invalidateQueries({ queryKey: ['github'] })
      queryClient.invalidateQueries({ queryKey: ['analysisCooldown'] })
      // Clear the query param from URL without refreshing
      router.replace('/profile')
    }
  }, [searchParams, queryClient, router, toast])


  // 0. Profile Queries & Mutations
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: getMe })
  const { data: candidate } = useQuery({ queryKey: ['candidate'], queryFn: getCandidateProfile })

  const updateUserMut = useMutation({
    mutationFn: updateUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  })
  const updateCandMut = useMutation({
    mutationFn: updateCandidateProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['candidate'] }),
  })

  const handleSaveProfile = async (data: { name: string; bio: string; location: string; website: string }) => {
    try {
      await Promise.all([
        updateUserMut.mutateAsync({ name: data.name }),
        updateCandMut.mutateAsync({ bio: data.bio, location: data.location, website: data.website })
      ])
      toast({ title: "Profile saved" })
      setIsEditing(false)
    } catch (error) {
      toast({ title: "Failed to save profile", variant: "destructive" })
    }
  }

  // 1. Cooldown Query
  const { data: cooldown } = useQuery({
    queryKey: ['analysisCooldown'],
    queryFn: getAnalysisCooldown,
    staleTime: 30_000,
  })

  // 2. GitHub Status
  const { data: githubData } = useQuery({
    queryKey: ['github'],
    queryFn: getLinkedGithub,
  })
  
  const handleSyncGithub = async () => {
    try {
      await syncMut.mutateAsync()
    } catch (error: any) {
      // 409 Conflict means GitHub is not connected yet
      if (error?.status === 409) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL
        if (apiUrl) {
          // Full browser  to the OAuth entry point
          window.location.href = `${apiUrl}/sync/github/connect`
        } else {
          toast({ title: "API URL not configured", variant: "destructive" })
        }
      } else {
        toast({
          title: "Sync failed",
          description: error?.message || "Please try again later",
          variant: "destructive"
        })
      }
    }
  }

  const syncMut = useMutation({
    mutationFn: triggerGithubSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['github'] })
      queryClient.invalidateQueries({ queryKey: ['analysisCooldown'] })
      toast({ title: "GitHub sync started" })
    },
  })

  // 3. Wallet Status
  const { data: walletData } = useQuery({
    queryKey: ['wallet'],
    queryFn: getLinkedWallet,
  })

  // 4. Generate Mutation
  const generateMut = useMutation({
    mutationFn: startAnalysis,
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['analysisCooldown'] })
      toast({ title: "Analysis started" })
      // Dispatch event to transition ScorecardSection into loading state
      if (typeof window !== 'undefined' && data?.jobId) {
        window.dispatchEvent(new CustomEvent('startAnalysis', { detail: { jobId: data.jobId } }))
      }
    },
  })

  // Gate Logic (Derived state for UI purposes, although GenerateScorecardSection
  // does its own internal logic if cooldownUntil is passed)
  const now = new Date()
  const isGithubOnCooldown = cooldown?.github?.cooldownUntil
    ? new Date(cooldown.github.cooldownUntil) > now
    : false
  const isGenerateOnCooldown = cooldown?.generate?.cooldownUntil
    ? new Date(cooldown.generate.cooldownUntil) > now
    : false

  const hasAnySource = githubData?.connected || walletData?.connected

  const githubStatus = {
    isLinked: !!githubData?.connected,
    cooldownUntil: cooldown?.github?.cooldownUntil ?? undefined,
  }

  const walletStatus = {
    isLinked: !!walletData?.connected,
    address: (walletData as any)?.address ?? undefined,
    cooldownUntil: cooldown?.wallet?.cooldownUntil ?? undefined,
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 space-y-8">
      {/* S1: Profile Header */}
      <ProfileHeader
        user={{
          name: (user as any)?.name ?? '',
          username: (user as any)?.username ?? '',
          email: (user as any)?.email ?? '',
          avatarUrl: (user as any)?.avatarUrl ?? undefined,
        }}
        candidate={{
          bio: (candidate as any)?.bio ?? '',
          location: (candidate as any)?.location ?? '',
          website: (candidate as any)?.website ?? '',
        }}
        isEditing={isEditing}
        onToggleEdit={() => setIsEditing(!isEditing)}
        onSave={handleSaveProfile}
        isSaving={updateUserMut.isPending || updateCandMut.isPending}
      />

      {/* S1b: Generate Scorecard Section */}
      <GenerateScorecardSection
        githubStatus={githubStatus}
        walletStatus={walletStatus}
        generateCooldownUntil={cooldown?.generate?.cooldownUntil ?? undefined}
        onSyncGithub={handleSyncGithub}
        onGenerate={() => generateMut.mutate()}
        isSyncing={syncMut.isPending}
        isGenerating={generateMut.isPending}
      />

      {/* S2: Scorecard Section */}
      <ScorecardSection />
      
      {/* S3: Vouches Section (Placeholder) */}
      
      {/* S4: Applications Section (Placeholder) */}
      
      {/* S5: Settings Accordion */}
      <div className="pt-6 border-t mt-8">
        <h2 className="text-lg font-semibold mb-4">Account Settings</h2>
        <SettingsAccordion />
      </div>
    </div>
  )
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading profile...</div>}>
      <ProfileContent />
    </Suspense>
  )
}
