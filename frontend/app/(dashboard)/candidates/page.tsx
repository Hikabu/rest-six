"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { JobsController_getMyJobs } from "@/lib/api";

function CandidatesPageSkeleton() {
  return (
    <div className="flex flex-col gap-8 w-full pb-10">
      <section>
        <Skeleton className="h-9 w-32" />
        <Skeleton className="mt-2 h-4 w-44" />
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function CandidatesPage() {
  const { data: jobsResponse, isLoading } = useQuery({
    queryKey: ["jobs", "me"],
    queryFn: () => JobsController_getMyJobs(),
  });

  const jobs = Array.isArray(jobsResponse)
    ? jobsResponse
    : (jobsResponse as any)?.data || (jobsResponse as any)?.items || [];

  if (isLoading) {
    return <CandidatesPageSkeleton />;
  }

  if (jobs.length === 0) {
    return (
      <div className="flex h-[calc(100vh-10rem)] w-full items-center justify-center">
        <EmptyState
          icon={Users}
          title="No candidates yet"
          description="Candidates appear here after you publish a job and applications start coming in."
          primaryAction={{ label: "Create your first job", route: "/hr/jobs/new" }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 w-full pb-10">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Candidates
        </h1>
        <p className="text-slate-500 mt-1">Review your applicants.</p>
      </section>
      {/* Existing candidates table/list would go here */}
      <section className="text-slate-500">
        Candidates table placeholder (Data exists)
      </section>
    </div>
  );
}
