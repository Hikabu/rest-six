"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { components } from "@/src/api/schema";
import {
  ApiError,
  JobsController_confirmRequirements,
  JobsController_create,
  JobsController_parseJd,
  JobsController_publish,
  type JobsController_confirmRequirementsRequest,
  type JobsController_createRequest,
  type JobsController_parseJdRequest,
  type JobsController_publishRequest,
} from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";

type JobRoleType = components["schemas"]["JobResponseDto"]["roleType"];
type JobSeniority = components["schemas"]["JobResponseDto"]["seniorityLevel"];
type Weight = "LOW" | "MEDIUM" | "HIGH";

type ParsedPreview = {
  requiredSkills: string[];
  requiredRoleType: JobRoleType;
  seniorityLevel: JobSeniority;
  collaborationWeight: Weight;
  ownershipWeight: Weight;
  innovationWeight: Weight;
  isWeb3Role: boolean;
  parserConfidence: number;
};

type WizardStep =
  | "basic"
  | "escrow"
  | "analyzing"
  | "requirements"
  | "review"
  | "published";

const ROLE_TYPES: JobRoleType[] = [
  "BACKEND",
  "FRONTEND",
  "FULLSTACK",
  "INFRASTRUCTURE",
  "DATA_ML",
  "SMART_CONTRACT",
  "WEB3_BACKEND",
  "WEB3_FRONTEND",
  "WEB3_FULLSTACK",
  "DEFI_PROTOCOL",
  "SECURITY_WEB3",
  "SECURITY",
  "GENERALIST",
];

const SENIORITIES: JobSeniority[] = ["JUNIOR", "MID", "SENIOR", "LEAD"];

const WEIGHTS: Weight[] = ["LOW", "MEDIUM", "HIGH"];

/** JD parser returns legacy buckets (DEVOPS, MOBILE, DATA) — map onto Prisma RoleType for confirm-requirements Zod. */
const PARSER_ROLE_TO_SCHEMA: Record<string, JobRoleType> = {
  BACKEND: "BACKEND",
  FRONTEND: "FRONTEND",
  FULLSTACK: "FULLSTACK",
  DEVOPS: "INFRASTRUCTURE",
  MOBILE: "GENERALIST",
  DATA: "DATA_ML",
};

function mapParserRoleToSchema(raw: unknown): JobRoleType {
  const key = String(raw ?? "")
    .trim()
    .toUpperCase();
  return PARSER_ROLE_TO_SCHEMA[key] ?? "BACKEND";
}

function mapSeniority(raw: unknown): JobSeniority {
  const u = String(raw ?? "").toUpperCase();
  if (u.includes("JUNIOR")) return "JUNIOR";
  if (u.includes("SENIOR")) return "SENIOR";
  if (u.includes("LEAD")) return "LEAD";
  return "MID";
}

function clamp01(n: unknown): number {
  const x = typeof n === "number" && !Number.isNaN(n) ? n : 0.5;
  return Math.min(1, Math.max(0, x));
}

function isWeight(v: unknown): v is Weight {
  return v === "LOW" || v === "MEDIUM" || v === "HIGH";
}

function normalizeParsed(raw: Record<string, unknown>): ParsedPreview {
  const skillsRaw = raw.requiredSkills;
  const requiredSkills = Array.isArray(skillsRaw)
    ? skillsRaw.map((s) => String(s)).filter(Boolean)
    : [];

  return {
    requiredSkills,
    requiredRoleType: mapParserRoleToSchema(raw.requiredRoleType),
    seniorityLevel: mapSeniority(raw.seniorityLevel),
    collaborationWeight: isWeight(raw.collaborationWeight)
      ? raw.collaborationWeight
      : "MEDIUM",
    ownershipWeight: isWeight(raw.ownershipWeight)
      ? raw.ownershipWeight
      : "MEDIUM",
    innovationWeight: isWeight(raw.innovationWeight)
      ? raw.innovationWeight
      : "MEDIUM",
    isWeb3Role: Boolean(raw.isWeb3Role),
    parserConfidence: clamp01(raw.parserConfidence),
  };
}

function unwrapEnvelope<T>(response: unknown): T {
  if (
    response &&
    typeof response === "object" &&
    "success" in response &&
    (response as { success?: boolean }).success === true &&
    "data" in response
  ) {
    return (response as { data: T }).data;
  }
  return response as T;
}

function formatApiError(error: unknown): string {
  if (error instanceof ApiError) {
    const b = error.body;
    if (typeof b === "string" && b.trim()) return b;
    if (b && typeof b === "object" && "message" in b) {
      const msg = (b as { message?: unknown }).message;
      if (typeof msg === "string") return msg;
    }
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

const createJobSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters").max(200),
    description: z
      .string()
      .min(50, "Description must be at least 50 characters"),
    location: z.string().optional(),
    employmentType: z.string().optional(),
    bonusAmount: z.number().min(0).optional(),
    currency: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const hasBonus =
      data.bonusAmount !== undefined &&
      data.bonusAmount !== null &&
      data.bonusAmount > 0;
    if (!hasBonus) return;
    const c = data.currency?.trim();
    if (!c || c.length !== 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a 3-letter currency code (e.g. USD) when setting a bonus.",
        path: ["currency"],
      });
    }
  });

type CreateJobFormValues = z.infer<typeof createJobSchema>;

function toCreateJobDto(values: CreateJobFormValues): components["schemas"]["CreateJobDto"] {
  const payload: components["schemas"]["CreateJobDto"] = {
    title: values.title.trim(),
    description: values.description.trim(),
  };
  const loc = values.location?.trim();
  if (loc) payload.location = loc;
  const emp = values.employmentType?.trim();
  if (emp) payload.employmentType = emp;

  const bonus =
    values.bonusAmount !== undefined &&
    values.bonusAmount !== null &&
    !Number.isNaN(values.bonusAmount)
      ? values.bonusAmount
      : undefined;
  if (bonus !== undefined && bonus > 0) {
    payload.bonusAmount = bonus;
    const cur = values.currency?.trim().toUpperCase();
    if (cur && cur.length === 3) payload.currency = cur;
  }

  return payload;
}

function phaseIndex(step: WizardStep): number {
  if (step === "basic" || step === "escrow") return 0;
  if (step === "analyzing" || step === "requirements") return 1;
  return 2;
}

export default function CreateJobPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.token);

  const [step, setStep] = useState<WizardStep>("basic");
  const [jobId, setJobId] = useState<string | null>(null);
  const [parseMeta, setParseMeta] = useState<{
    requiresReview: boolean;
    diff: unknown;
  } | null>(null);
  const [requirementsDraft, setRequirementsDraft] =
    useState<ParsedPreview | null>(null);

  const form = useForm<CreateJobFormValues>({
    resolver: zodResolver(createJobSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "Remote",
      employmentType: "Full-time",
      bonusAmount: undefined,
      currency: "USD",
    },
  });

  const draftAndParseMutation = useMutation({
    mutationFn: async (values: CreateJobFormValues) => {
      const createdRaw = await JobsController_create({
        body: toCreateJobDto(values),
      } as JobsController_createRequest);
      const job = unwrapEnvelope<components["schemas"]["JobResponseDto"]>(
        createdRaw,
      );
      if (!job?.id) {
        throw new Error("Create draft succeeded but no job id was returned.");
      }

      const parseRaw = await JobsController_parseJd({
        path: { id: job.id },
        body: { jdText: values.description.trim() },
      } as JobsController_parseJdRequest);
      const envelope = unwrapEnvelope<{
        parsed: Record<string, unknown>;
        requiresReview: boolean;
        diff: unknown;
      }>(parseRaw);

      const normalized = normalizeParsed(envelope.parsed ?? {});
      return {
        jobId: job.id,
        requiresReview: Boolean(envelope.requiresReview),
        diff: envelope.diff,
        requirements: normalized,
      };
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      setParseMeta({ requiresReview: data.requiresReview, diff: data.diff });
      setRequirementsDraft(data.requirements);
      queryClient.invalidateQueries({ queryKey: ["jobs", "me"] });
      setStep("requirements");
    },
    onError: (error) => {
      console.error("Draft / parse failed:", error);
      form.setError("root", { message: formatApiError(error) });
      setStep("escrow");
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!jobId || !requirementsDraft) {
        throw new Error("Missing job or requirements.");
      }
      return JobsController_confirmRequirements({
        path: { id: jobId },
        body: requirementsDraft,
      } as JobsController_confirmRequirementsRequest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs", "me"] });
      setStep("review");
    },
    onError: (error) => {
      console.error("Confirm requirements failed:", error);
      form.setError("root", { message: formatApiError(error) });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!jobId) throw new Error("Missing job id.");
      return JobsController_publish({
        path: { id: jobId },
      } as JobsController_publishRequest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs", "me"] });
      setStep("published");
    },
    onError: (error) => {
      console.error("Publish failed:", error);
      form.setError("root", { message: formatApiError(error) });
    },
  });

  const busy =
    draftAndParseMutation.isPending ||
    confirmMutation.isPending ||
    publishMutation.isPending;

  const phaseLabels = useMemo(
    () => ["Draft", "AI analysis", "Review & publish"],
    [],
  );

  const resetWizard = () => {
    setStep("basic");
    setJobId(null);
    setParseMeta(null);
    setRequirementsDraft(null);
    form.reset({
      title: "",
      description: "",
      location: "Remote",
      employmentType: "Full-time",
      bonusAmount: undefined,
      currency: "USD",
    });
  };

  if (step === "published") {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <Sparkles className="h-8 w-8 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl">Job published</CardTitle>
            <CardDescription>
              Your job post is live and candidates can apply.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={() => router.push("/hr/jobs")}>
                View all jobs
              </Button>
              <Button onClick={resetWizard}>Create another job</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Create new job</h1>
          <p className="text-muted-foreground">
            {step === "basic" && "Role basics"}
            {step === "escrow" &&
              "Optional escrow bonus (saved when the draft is created)"}
            {(step === "analyzing" || step === "requirements") &&
              "Review AI-extracted requirements"}
            {step === "review" && "Final check before publishing"}
          </p>
        </div>
      </div>

      {!token ? (
        <p className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          You are not signed in as an employer. Log in so requests include{" "}
          <code className="rounded bg-muted px-1">Authorization: Bearer …</code>
          .
        </p>
      ) : null}

      <div className="mb-8 flex items-center gap-2">
        {phaseLabels.map((label, i) => (
          <React.Fragment key={label}>
            <div
              className={`flex items-center gap-2 ${phaseIndex(step) === i ? "text-primary" : "text-muted-foreground"}`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  phaseIndex(step) === i
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {i + 1}
              </div>
              <span className="text-sm">{label}</span>
            </div>
            {i < phaseLabels.length - 1 ? (
              <div className="h-px w-8 bg-muted" />
            ) : null}
          </React.Fragment>
        ))}
      </div>

      {step === "basic" ? (
        <Card>
          <CardHeader>
            <CardTitle>Job details</CardTitle>
            <CardDescription>
              Title and description are required. You will add an optional escrow
              bonus on the next screen, then we create the draft and run AI
              analysis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job title</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Senior frontend engineer"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Role, responsibilities, stack, and requirements…"
                          className="min-h-[200px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Used for{" "}
                        <code className="rounded bg-muted px-1">POST /jobs/:id/parse-jd</code>{" "}
                        as{" "}
                        <code className="rounded bg-muted px-1">jdText</code>.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input placeholder="Remote, city, etc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="employmentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employment type</FormLabel>
                        <FormControl>
                          <Input placeholder="Full-time, contract…" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={async () => {
                      const ok = await form.trigger([
                        "title",
                        "description",
                        "location",
                        "employmentType",
                      ]);
                      if (ok) setStep("escrow");
                    }}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </Form>
          </CardContent>
        </Card>
      ) : null}

      {step === "escrow" ? (
        <Card>
          <CardHeader>
            <CardTitle>Optional escrow bonus</CardTitle>
            <CardDescription>
              Bonus and currency are optional fields on{" "}
              <code className="rounded bg-muted px-1">CreateJobDto</code>. They are
              sent together with the draft in one request.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                className="space-y-6"
                onSubmit={form.handleSubmit((values) => {
                  form.clearErrors("root");
                  setStep("analyzing");
                  draftAndParseMutation.mutate(values);
                })}
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="bonusAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bonus amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            placeholder="e.g. 1000"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === ""
                                  ? undefined
                                  : Number(e.target.value),
                              )
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          Escrow-backed bonus (optional).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency</FormLabel>
                        <FormControl>
                          <Input placeholder="USD" maxLength={3} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {form.formState.errors.root ? (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.root.message}
                  </p>
                ) : null}

                <div className="flex justify-between gap-3 pt-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setStep("basic")}
                  >
                    Back
                  </Button>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() => router.back()}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={busy || !token}>
                      {draftAndParseMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Create draft &amp; analyze with AI
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : null}

      {step === "analyzing" ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
            <h3 className="mb-2 font-medium">Creating draft &amp; analyzing</h3>
            <p className="text-sm text-muted-foreground">
              Calling{" "}
              <code className="rounded bg-muted px-1">POST /jobs/draft</code> then{" "}
              <code className="rounded bg-muted px-1">POST /jobs/:id/parse-jd</code>
              …
            </p>
          </CardContent>
        </Card>
      ) : null}

      {step === "requirements" && requirementsDraft ? (
        <Card>
          <CardHeader>
            <CardTitle>AI analysis</CardTitle>
            <CardDescription>
              Confirm or adjust structured requirements before publishing.
              Low-confidence parses are flagged for manual review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {parseMeta?.requiresReview ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-50">
                Parser confidence is below the suggested threshold. Please verify
                skills and role type.
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                Confidence {(requirementsDraft.parserConfidence * 100).toFixed(0)}
                %
              </Badge>
              <Badge variant="outline">
                Role {requirementsDraft.requiredRoleType}
              </Badge>
              <Badge variant="outline">
                Seniority {requirementsDraft.seniorityLevel}
              </Badge>
            </div>

            <div>
              <Label className="mb-2 block">Required skills</Label>
              <div className="flex flex-wrap gap-2">
                {requirementsDraft.requiredSkills.length ? (
                  requirementsDraft.requiredSkills.map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No skills extracted — adjust role type or edit the job
                    description and try again later.
                  </span>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Role type</Label>
                <Select
                  value={requirementsDraft.requiredRoleType}
                  onValueChange={(v) =>
                    setRequirementsDraft((d) =>
                      d ? { ...d, requiredRoleType: v as JobRoleType } : d,
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_TYPES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Seniority</Label>
                <Select
                  value={requirementsDraft.seniorityLevel}
                  onValueChange={(v) =>
                    setRequirementsDraft((d) =>
                      d ? { ...d, seniorityLevel: v as JobSeniority } : d,
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SENIORITIES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {(
                [
                  ["collaborationWeight", "Collaboration"],
                  ["ownershipWeight", "Ownership"],
                  ["innovationWeight", "Innovation"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label>{label} weight</Label>
                  <Select
                    value={requirementsDraft[key]}
                    onValueChange={(v) =>
                      setRequirementsDraft((d) =>
                        d ? { ...d, [key]: v as Weight } : d,
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEIGHTS.map((w) => (
                        <SelectItem key={w} value={w}>
                          {w}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="web3"
                checked={requirementsDraft.isWeb3Role}
                onCheckedChange={(c) =>
                  setRequirementsDraft((d) =>
                    d ? { ...d, isWeb3Role: Boolean(c) } : d,
                  )
                }
              />
              <Label htmlFor="web3" className="font-normal">
                Web3-related role
              </Label>
            </div>

            {form.formState.errors.root ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
            ) : null}

            <div className="flex justify-end gap-3 pt-2">
              <Button
                variant="outline"
                type="button"
                disabled={busy}
                onClick={() => {
                  setStep("escrow");
                  form.clearErrors("root");
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={busy || !jobId}
                onClick={() => {
                  form.clearErrors("root");
                  confirmMutation.mutate();
                }}
              >
                {confirmMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Confirm requirements
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "review" ? (
        <Card>
          <CardHeader>
            <CardTitle>Review &amp; publish</CardTitle>
            <CardDescription>
              Publishing calls{" "}
              <code className="rounded bg-muted px-1">POST /jobs/:id/publish</code>
              . Escrow amounts were saved with the draft.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3 rounded-lg bg-muted/50 p-4">
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Title
                </span>
                <p className="font-medium">{form.getValues("title")}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Description
                </span>
                <p className="whitespace-pre-wrap text-sm">
                  {form.getValues("description")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.getValues("location")?.trim() ? (
                  <Badge variant="secondary">{form.getValues("location")}</Badge>
                ) : null}
                {form.getValues("employmentType")?.trim() ? (
                  <Badge variant="secondary">
                    {form.getValues("employmentType")}
                  </Badge>
                ) : null}
                {requirementsDraft ? (
                  <>
                    <Badge variant="outline">{requirementsDraft.requiredRoleType}</Badge>
                    <Badge variant="outline">{requirementsDraft.seniorityLevel}</Badge>
                  </>
                ) : null}
              </div>
              {form.getValues("bonusAmount") != null &&
              form.getValues("bonusAmount")! > 0 ? (
                <Badge variant="secondary">
                  Escrow bonus{" "}
                  {(form.getValues("currency") || "USD").toUpperCase()}{" "}
                  {form.getValues("bonusAmount")}
                </Badge>
              ) : (
                <p className="text-sm text-muted-foreground">No escrow bonus set.</p>
              )}
            </div>

            {form.formState.errors.root ? (
              <p className="text-sm text-destructive">
                {form.formState.errors.root.message}
              </p>
            ) : null}

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                type="button"
                disabled={busy}
                onClick={() => {
                  setStep("requirements");
                  form.clearErrors("root");
                }}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={busy || !jobId}
                onClick={() => {
                  form.clearErrors("root");
                  publishMutation.mutate();
                }}
              >
                {publishMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Publish job
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
