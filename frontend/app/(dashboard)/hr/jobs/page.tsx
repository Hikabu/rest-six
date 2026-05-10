"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, PlusCircle } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get("filter");

  const { data: jobsResponse, isLoading } = useQuery({
    queryKey: ["jobs", "me"],
    queryFn: () => JobsController_getMyJobs(),
  });

  const jobs = Array.isArray(jobsResponse)
    ? jobsResponse
    : (jobsResponse as any)?.data || (jobsResponse as any)?.items || [];

  const filteredJobs = useMemo(() => {
    if (statusFilter === "draft") {
      return jobs.filter((j: any) => j.status === "draft");
    }
    return jobs;
  }, [jobs, statusFilter]);

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
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {statusFilter === "draft" ? "Draft jobs" : "All jobs"}
          </h1>
          <p className="text-slate-500 mt-1">
            {statusFilter === "draft"
              ? "Continue editing drafts or publish when ready."
              : "Manage your job postings and open the candidate pipeline."}
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/hr/jobs/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create job
          </Link>
        </Button>
      </section>

      <CardTable jobs={filteredJobs} />

      {statusFilter === "draft" && filteredJobs.length === 0 && jobs.length > 0 ? (
        <p className="text-sm text-slate-500">
          No drafts right now.{" "}
          <Link href="/hr/jobs" className="text-violet-600 dark:text-violet-400 hover:underline">
            View all jobs
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function CardTable({ jobs }: { jobs: any[] }) {
  return (
    <section>
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
              <TableHead>Job title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Applicants</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-slate-500 py-10">
                  No jobs match this filter.
                </TableCell>
              </TableRow>
            ) : (
              jobs.map((job: any) => (
                <TableRow key={job.id} className="group">
                  <TableCell className="font-medium text-slate-900 dark:text-white">
                    {job.title ?? "Untitled"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={job.status === "draft" ? "secondary" : "default"}
                      className={
                        job.status === "active"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100"
                          : job.status === "paused"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100"
                            : job.status === "closed"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100"
                              : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-100"
                      }
                    >
                      {job.status ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400 tabular-nums">
                    {job.applicantsCount ?? job.applicationsCount ?? 0}
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400">
                    {job.createdAt
                      ? new Date(job.createdAt).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/hr/jobs/${job.id}`}>Pipeline</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
