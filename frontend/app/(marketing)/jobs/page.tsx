'use client'

import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  listJobs, 
  getMyApplications, 
  getJob, 
  getGapPreview, 
  applyToJob, 
  getMyScorecard 
} from '@/lib/api'
import { FilterBar, FilterState } from '@/components/jobs/FilterBar'
import { JobCard, JobCardSkeleton, Job } from '@/components/jobs/JobCard'
import { JobDetailSheet } from '@/components/jobs/JobDetailSheet'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  
  return debouncedValue
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function JobsPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [filters, setFilters] = useState<FilterState>({})
  const debouncedFilters = useDebounce(filters, 300)
  
  const [page, setPage] = useState(1)
  const [allJobs, setAllJobs] = useState<Job[]>([])
  
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set())

  // Reset pagination and jobs when filters change
  useEffect(() => {
    setPage(1)
    setAllJobs([])
  }, [debouncedFilters])

  // Applications query
  const { data: applications } = useQuery({
    queryKey: ['applications'],
    queryFn: getMyApplications,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (applications) {
      // Handle either raw array or data-wrapped array
      const apps = Array.isArray(applications) ? applications : (applications as any).data || []
      setAppliedJobIds(new Set(apps.map((a: any) => a.jobId)))
    }
  }, [applications])

  // Jobs list query
  const { data: jobsDataRaw, isLoading, isFetching } = useQuery({
    queryKey: ['jobs', debouncedFilters, page],
    queryFn: () => listJobs({
      search: debouncedFilters.search,
      roleType: debouncedFilters.roleType,
      seniority: debouncedFilters.seniority,
      isWeb3: debouncedFilters.isWeb3,
      isDepositPaid: debouncedFilters.isDepositPaid,
      isVerifiedPayer: debouncedFilters.isVerifiedPayer,
      page,
      limit: debouncedFilters.limit ?? 20,
    }),
    // v4 compat
    keepPreviousData: true,
    // v5 compat
    placeholderData: (prev: any) => prev,
  } as any)

  const jobsData = jobsDataRaw as { jobs: Job[]; total: number } | undefined

  useEffect(() => {
    if (jobsData?.jobs) {
      if (page === 1) {
        setAllJobs(jobsData.jobs)
      } else {
        setAllJobs((prev: Job[]) => {
          // Avoid duplicates
          const existingIds = new Set(prev.map(j => j.id))
          const newJobs = jobsData.jobs.filter((j: Job) => !existingIds.has(j.id))
          return [...prev, ...newJobs]
        })
      }
    }
  }, [jobsData, page])

  // -------------------------------------------------------------------------
  // Job Detail / Apply logic
  // -------------------------------------------------------------------------

  const { data: jobDetailData } = useQuery({
    queryKey: ['job', selectedJobId],
    queryFn: () => getJob(selectedJobId!),
    enabled: !!selectedJobId,
  })

  const scorecardQuery = useQuery({ 
    queryKey: ['scorecard'], 
    queryFn: getMyScorecard, 
    staleTime: Infinity 
  })
  const hasScorecard = !!scorecardQuery.data

  const { data: gapPreviewData, isLoading: gapLoading } = useQuery({
    queryKey: ['gap', selectedJobId],
    queryFn: () => getGapPreview({ jobId: selectedJobId! }),
    enabled: !!selectedJobId && hasScorecard,
    staleTime: 300_000,
  })

  const { mutate: applyMutation, isPending: isApplying } = useMutation({
    mutationFn: () => applyToJob(selectedJobId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      toast({ title: 'Application submitted!' })
      if (selectedJobId) {
        setAppliedJobIds(prev => new Set([...prev, selectedJobId]))
      }
    }
  })

  const total = jobsData?.total ?? 0
  const hasMore = allJobs.length < total

  return (
    <div className="min-h-screen bg-[#0B1020]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">Job Board</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isLoading && page === 1 ? 'Loading jobs…' : `${total} role${total !== 1 ? 's' : ''} available`}
          </p>
        </div>

        {/* Filter bar */}
        <FilterBar filters={filters} onChange={setFilters} />

        {/* Grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading && page === 1
            ? Array.from({ length: 6 }).map((_, i) => <JobCardSkeleton key={i} />)
            : allJobs.length > 0
            ? allJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  isApplied={appliedJobIds.has(job.id)}
                  isSelected={selectedJobId === job.id}
                  onClick={() =>
                    setSelectedJobId((prev) => (prev === job.id ? null : job.id))
                  }
                />
              ))
            : (
              <div className="col-span-full flex flex-col items-center gap-2 py-16 text-center">
                <p className="text-sm font-medium text-foreground">No jobs match your filters</p>
                <p className="text-xs text-muted-foreground">
                  Try adjusting or clearing filters to see more results.
                </p>
              </div>
            )}
        </div>
        
        {/* Load more */}
        {hasMore && (
          <div className="mt-8 flex justify-center">
            <Button 
              variant="outline" 
              onClick={() => setPage(p => p + 1)}
              disabled={isFetching}
            >
              {isFetching ? 'Loading...' : 'Load more'}
            </Button>
          </div>
        )}
      </div>

      <JobDetailSheet
        job={jobDetailData as any}
        jobId={selectedJobId}
        open={!!selectedJobId}
        onClose={() => setSelectedJobId(null)}
        hasScorecard={hasScorecard}
        isApplied={selectedJobId ? appliedJobIds.has(selectedJobId) : false}
        onApply={() => applyMutation()}
        isApplying={isApplying}
        gapData={gapPreviewData as any}
        gapLoading={gapLoading}
      />
    </div>
  )
}
