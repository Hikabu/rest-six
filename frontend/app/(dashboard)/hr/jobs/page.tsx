"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { JobsController_getMyJobs } from "@/lib/api";

function JobsPageSkeleton() {
  return (
    <div className="flex flex-col gap-8 w-full pb-10">
      <section>
        <Skeleton className="h-9 w-24" />
        <Skeleton className="mt-2 h-4 w-48" />
      </section>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function HRJobsPage() {
  const { data: jobsResponse, isLoading } = useQuery({
    queryKey: ["jobs", "me"],
    queryFn: () => JobsController_getMyJobs(),
  });

  const jobs = Array.isArray(jobsResponse)
    ? jobsResponse
    : (jobsResponse as any)?.data || (jobsResponse as any)?.items || [];

  if (isLoading) {
    return <JobsPageSkeleton />;
  }

  if (jobs.length === 0) {
    return (
      <div className="flex h-[calc(100vh-10rem)] w-full items-center justify-center">
        <EmptyState
          icon={Briefcase}
          title="You haven't posted any jobs yet"
          description="Create a job post → fund escrow → candidates apply with real work → shortlist the best → hire with confidence."
          primaryAction={{ label: "Create job post", route: "/hr/jobs/new" }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 w-full pb-10">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Jobs
        </h1>
        <p className="text-slate-500 mt-1">Manage your job postings.</p>
      </section>
      {/* Existing jobs table/list would go here */}
      <section className="text-slate-500">
        Jobs table placeholder (Data exists)
      </section>
    </div>
  );
}
