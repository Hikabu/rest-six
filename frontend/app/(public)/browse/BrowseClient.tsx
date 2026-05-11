"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { FilterBar, FilterState } from "@/components/jobs/FilterBar";
import { JobCard, JobCardSkeleton, Job } from "@/components/jobs/JobCard";
import { JobDetailSheet } from "@/components/jobs/JobDetailSheet";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listJobs, getJob } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Candidate {
  id: string;
  username: string;
  displayName?: string;
  skills?: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ---------------------------------------------------------------------------
// CandidateCard
// ---------------------------------------------------------------------------

function CandidateCard({ candidate }: { candidate: Candidate }) {
  const display = candidate.displayName || candidate.username;
  const initials = getInitials(display);

  return (
    <Card className="group relative cursor-default overflow-hidden rounded-2xl border bg-[#151C2E] p-0 shadow-sm transition-colors duration-150 hover:border-primary/60">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-primary/15 text-primary text-xs font-mono font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {display}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              @{candidate.username}
            </p>
          </div>
        </div>

        {/* Skill chips */}
        {candidate.skills && candidate.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {candidate.skills.slice(0, 3).map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {skill}
              </span>
            ))}
            {candidate.skills.length > 3 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                +{candidate.skills.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="mt-4">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
            <Link href={`/u/${candidate.username}`}>View profile</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CandidateCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-border bg-[#151C2E] p-5">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-full bg-muted/30" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/2 rounded-md bg-muted/40" />
          <div className="h-3 w-1/3 rounded-md bg-muted/30" />
        </div>
      </div>
      <div className="mt-3 flex gap-1.5">
        <div className="h-5 w-14 rounded-full bg-muted/20" />
        <div className="h-5 w-16 rounded-full bg-muted/20" />
        <div className="h-5 w-12 rounded-full bg-muted/20" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BrowseClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialTab = searchParams.get("tab") === "people" ? "people" : "jobs";
  const [tab, setTab] = useState(initialTab);

  // ── Jobs state ────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<FilterState>({});
  const debouncedFilters = useDebounce(filters, 300);
  const [page, setPage] = useState(1);
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const {
    data: jobsData,
    isLoading: jobsLoading,
    isFetching: jobsFetching,
  } = useQuery({
    queryKey: ["jobs", debouncedFilters, page],
    queryFn: () => listJobs({ ...debouncedFilters, page, limit: 12 }),
  });

  const jobsTotal = jobsData?.total ?? 0;
  const hasMoreJobs = allJobs.length < jobsTotal;

  const { data: jobDetailData } = useQuery({
    queryKey: ["job", selectedJobId],
    queryFn: () => getJob(selectedJobId!),
    enabled: !!selectedJobId,
  });
  
  const jobDetail = jobDetailData as any;

  useEffect(() => {
    if (debouncedFilters) {
      setPage(1);
      setAllJobs([]);
    }
  }, [debouncedFilters]);

  useEffect(() => {
    if (jobsData?.jobs) {
      if (page === 1) {
        setAllJobs(jobsData.jobs);
      } else {
        setAllJobs((prev) => {
          const existingIds = new Set(prev.map((j) => j.id));
          const newJobs = jobsData.jobs.filter((j: any) => !existingIds.has(j.id));
          return [...prev, ...newJobs];
        });
      }
    }
  }, [jobsData, page]);

  // ── Talent state ──────────────────────────────────────────────────────────
  const [talentSearch, setTalentSearch] = useState("");
  const debouncedTalentSearch = useDebounce(talentSearch, 300);

  const { data: talentData, isLoading: talentLoading } = useQuery({
    queryKey: ["public-profiles", debouncedTalentSearch],
    queryFn: () =>
      fetch(
        (process.env.NEXT_PUBLIC_API_URL || "") +
          "/api/profiles?q=" +
          debouncedTalentSearch
      ).then((r) => r.json()),
    enabled: debouncedTalentSearch.length > 2,
  });

  const candidates: Candidate[] = talentData?.profiles || [];

  // ── Sync tab with URL ─────────────────────────────────────────────────────
  const handleTabChange = (value: string) => {
    setTab(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value === "people") {
      params.set("tab", "people");
    } else {
      params.delete("tab");
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero strip ────────────────────────────────────────────────────── */}
      <div className="flex h-20 items-center border-b border-border bg-background/50">
        <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6">
          <h1 className="text-xl font-semibold text-foreground">
            Find your next role
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Browse open roles and talent on Colosseum
          </p>
        </div>
      </div>

      {/* ── Tabs row (sticky just below nav h-14) ─────────────────────────── */}
      <div className="sticky top-14 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-screen-xl px-4 sm:px-6">
          <Tabs value={tab} onValueChange={handleTabChange}>
            <TabsList className="h-11 w-full rounded-none border-0 bg-transparent p-0 md:w-auto">
              <TabsTrigger
                value="jobs"
                className="h-11 rounded-none border-b-2 border-transparent px-5 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Jobs
              </TabsTrigger>
              <TabsTrigger
                value="people"
                className="h-11 rounded-none border-b-2 border-transparent px-5 text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Talent
              </TabsTrigger>
            </TabsList>

            {/* ── Filter bar lives inside Tabs so it can be tab-specific ── */}
            <div className="mx-auto max-w-screen-xl">
              {/* Jobs filter bar */}
              {tab === "jobs" && (
                <div className="overflow-x-auto">
                  <FilterBar filters={filters} onChange={setFilters} />
                </div>
              )}

              {/* Talent search bar */}
              {tab === "people" && (
                <div className="py-3">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={talentSearch}
                      onChange={(e) => setTalentSearch(e.target.value)}
                      placeholder="Search by name or skill"
                      className="h-8 rounded-lg border-border bg-transparent pl-8 text-xs placeholder:text-muted-foreground focus-visible:ring-primary/40"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── Content area ─────────────────────────────────────────── */}
            <div className="mx-auto max-w-screen-xl px-4 py-6 sm:px-6">
              {/* ── JOBS TAB ─────────────────────────────────────────────── */}
              <TabsContent value="jobs" className="mt-0 outline-none">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {jobsLoading && page === 1
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <JobCardSkeleton key={i} />
                      ))
                    : allJobs.length > 0
                    ? allJobs.map((job) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          isApplied={false}
                          isSelected={selectedJobId === job.id}
                          onClick={() =>
                            setSelectedJobId((prev) =>
                              prev === job.id ? null : job.id
                            )
                          }
                        />
                      ))
                    : !jobsLoading && (
                        <div className="col-span-full flex flex-col items-center gap-2 py-20 text-center">
                          <p className="text-sm font-medium text-foreground">
                            No jobs match your filters
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Try adjusting or clearing filters to see more
                            results.
                          </p>
                        </div>
                      )}
                </div>

                {/* Load more */}
                {hasMoreJobs && (
                  <div className="mt-8 flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={jobsFetching}
                    >
                      {jobsFetching ? "Loading…" : "Load more"}
                    </Button>
                  </div>
                )}
              </TabsContent>

              {/* ── TALENT TAB ───────────────────────────────────────────── */}
              <TabsContent value="people" className="mt-0 outline-none">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {talentLoading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <CandidateCardSkeleton key={i} />
                      ))
                    : candidates.length > 0
                    ? candidates.map((c) => (
                        <CandidateCard key={c.id} candidate={c} />
                      ))
                    : !talentLoading && (
                        <div className="col-span-full flex flex-col items-center gap-2 py-20 text-center">
                          <p className="text-sm font-medium text-foreground">
                            {debouncedTalentSearch
                              ? "No candidates match your search"
                              : "No talent listed yet"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {debouncedTalentSearch
                              ? "Try a different name or skill."
                              : "Check back soon as the community grows."}
                          </p>
                        </div>
                      )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* ── Job detail slide-over (public: read-only, sign-in CTA) ────────── */}
      <JobDetailSheet
        job={jobDetail}
        jobId={selectedJobId}
        open={!!selectedJobId}
        onClose={() => setSelectedJobId(null)}
        // Public view: no scorecard, no apply — sheet's built-in unauthenticated
        // branch renders "Log in to apply" automatically via useAuthStore check
        hasScorecard={false}
        isApplied={false}
        onApply={() => {}}
        isApplying={false}
        gapData={undefined}
        gapLoading={false}
      />
    </div>
  );
}
