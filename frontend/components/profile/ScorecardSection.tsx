'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { startAnalysis, getMyScorecard, getMyRawScorecard } from '@/lib/api'
import { ScorecardView, ScorecardData } from '@/components/ScorecardView'
import { AnalysisPoller } from '@/components/AnalysisPoller'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { normalizeScorecard } from '@/lib/scorecard/normalizeScorecard'

export function ScorecardSection() {
  const queryClient = useQueryClient()
  const [scorecardState, setScorecardState] = useState<'empty'|'loading'|'done'>('empty')
  const [analysisJobId, setAnalysisJobId] = useState<string | null>(
    () => typeof window !== 'undefined' ? sessionStorage.getItem('analysis_job_id') : null
  )
  const [isRawDataOpen, setIsRawDataOpen] = useState(false)

  // ON MOUNT: getMyScorecard
  const { data: scorecardData, isLoading: isScorecardLoading, isError: isScorecardError } = useQuery({
    queryKey: ['scorecard'],
    queryFn: getMyScorecard,
    staleTime: Infinity,
    retry: false, // Don't retry on 404
  })

  // RAW DATA: Lazy load
  const { data: rawData, isLoading: isRawLoading } = useQuery({
    queryKey: ['scorecard', 'raw'],
    queryFn: getMyRawScorecard,
    enabled: isRawDataOpen && scorecardState === 'done',
    staleTime: Infinity,
  })

  // GENERATE MUTATION (Used for Regenerate inside ScorecardView)
  const generateMut = useMutation({
    mutationFn: startAnalysis,
    onSuccess: (data: any) => {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('analysis_job_id', data.jobId)
      }
      setAnalysisJobId(data.jobId)
      setScorecardState('loading')
      queryClient.invalidateQueries({ queryKey: ['analysisCooldown'] })
    }
  })

  // State machine logic for mounting and data fetching
  useEffect(() => {
    // If analysis is already running based on sessionStorage
    if (analysisJobId) {
      setScorecardState('loading')
      return
    }

    if (isScorecardLoading) return

    // If scorecardData exists, set state to done
    if (scorecardData && !isScorecardError) {
      setScorecardState('done')
    } else {
      setScorecardState('empty')
    }
  }, [analysisJobId, scorecardData, isScorecardError, isScorecardLoading])

  // Optional: Global listener to allow GenerateScorecardSection (sibling in page.tsx) to trigger analysis
  useEffect(() => {
    const handleStartAnalysis = (e: CustomEvent) => {
      const jobId = e.detail?.jobId
      if (jobId) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('analysis_job_id', jobId)
        }
        setAnalysisJobId(jobId)
        setScorecardState('loading')
      }
    }
    window.addEventListener('startAnalysis', handleStartAnalysis as EventListener)
    return () => {
      window.removeEventListener('startAnalysis', handleStartAnalysis as EventListener)
    }
  }, [])

  if (scorecardState === 'empty') {
    // CTA defers to GenerateScorecardSection above
    return null 
  }

  if (scorecardState === 'loading' && analysisJobId) {
    return (
      <AnalysisPoller 
        jobId={analysisJobId} 
        onComplete={() => {
          setAnalysisJobId(null)
          setScorecardState('done')
          queryClient.invalidateQueries({ queryKey: ['analysisCooldown'] })
        }} 
      />
    )
  }

  if (scorecardState === 'done' && scorecardData) {
    const normalized = normalizeScorecard(scorecardData)

    return (
      <div className="space-y-6">
        <ScorecardView 
        scorecard={normalized}
          // scorecard={scorecardData as unknown as ScorecardData} 
          isPublic={false}
          onRegenerate={() => generateMut.mutate()}
        />
      </div>
    )
  }

  // Fallback loading state before the state machine fully resolves
  return <div className="h-20 flex items-center justify-center text-sm text-muted-foreground animate-pulse">Loading scorecard state...</div>
}
