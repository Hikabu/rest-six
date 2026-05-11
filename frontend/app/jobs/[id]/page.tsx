"use client";

import * as React from "react";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage, getJob, normalizeJobStatus, unwrapApiSuccessData, isValidJobPostPathId } from "@/lib/api";

function StatusBadge({ status }: { status: unknown }) {
  const st = normalizeJobStatus(status);
  return (
    <Badge
      variant={st === "draft" ? "secondary" : "default"}
      className={
        st === "active"
          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400"
          : st === "closed"
            ? "bg-red-100 text-red-800 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400"
            : "bg-slate-100 text-slate-800 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400"
      }
    >
      {st || "—"}
    </Badge>
  );
}

export default function JobPreviewPage() {
  const params = useParams();
  const rawId = params?.id;
  const id = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : "";

  if (!isValidJobPostPathId(id)) {
    notFound();
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["job", id],
    queryFn: () => getJob(id),
  });

  const job = unwrapApiSuccessData<Record<string, unknown> | null>(data) ?? null;

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8 space-y-4">
        <div className="text-lg font-semibold">Could not load job</div>
        <div className="text-sm text-muted-foreground">
          {getApiErrorMessage(error)}
        </div>
        <Button asChild variant="outline">
          <Link href="/hr/jobs">Back to jobs</Link>
        </Button>
      </div>
    );
  }

  if (!job) {
    notFound();
  }

  const title = String(job.title ?? "Untitled");
  const description = String(job.description ?? "");
  const escrowStatus = normalizeJobStatus(job.escrowStatus);
  const escrowEnabled =
    typeof job.escrowStatus === "string" ? job.escrowStatus !== "UNFUNDED" : false;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={job.status} />
            <Badge variant="outline">
              {escrowEnabled ? "Escrow enabled" : "Escrow disabled"}
            </Badge>
          </div>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href="/hr/jobs">Back</Link>
        </Button>
      </div>

      <section className="rounded-xl border p-5 space-y-2">
        <h2 className="text-sm font-medium">Description (Markdown)</h2>
        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {description || "—"}
        </pre>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border p-4">
          <div className="text-xs text-muted-foreground">Salary</div>
          <div className="mt-1 text-sm font-medium">Not stored separately</div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-xs text-muted-foreground">Bonus</div>
          <div className="mt-1 text-sm font-medium">
            {job.bonusAmount != null ? String(job.bonusAmount) : "—"}{" "}
            {String(job.currency ?? "")}
          </div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="text-xs text-muted-foreground">Escrow status</div>
          <div className="mt-1 text-sm font-medium">{escrowStatus || "—"}</div>
        </div>
      </section>
    </div>
  );
}

