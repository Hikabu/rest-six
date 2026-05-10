"use client";

import React, { useState } from "react";
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
import { JobsController_create } from "@/lib/api";

// ✅ Form validation schema (matches your CreateJobDto)
const createJobSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().min(50, "Description must be at least 50 characters"),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  bonusAmount: z.number().min(0).optional(),
  currency: z.string().length(3, "Currency must be 3 letters (e.g., USD)").optional(),
});

type CreateJobFormValues = z.infer<typeof createJobSchema>;

export default function CreateJobPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"form" | "parsing" | "confirm" | "published">("form");

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

  // ✅ Mutation to create job draft
  const createJobMutation = useMutation({
    mutationFn: async (data: CreateJobFormValues) => {
      const response = await JobsController_create({ body: data });
      return (response as any)?.data ?? response;
    },
    onSuccess: (data) => {
      // Invalidate jobs list to refresh dashboard
      queryClient.invalidateQueries({ queryKey: ["jobs", "me"] });
      
      // If backend returns job ID, proceed to next step
      if (data?.id) {
        setStep("parsing");
        // Auto-parse JD if endpoint available
        // parseJobDescription(data.id);
      }
    },
    onError: (error) => {
      console.error("Failed to create job:", error);
      form.setError("root", { message: "Failed to create job. Please try again." });
    },
  });

  const onSubmit = (values: CreateJobFormValues) => {
    createJobMutation.mutate(values);
  };

  // Optional: Parse job description to auto-extract requirements
  const parseJobDescription = async (jobId: string) => {
    try {
      // Call POST /jobs/{id}/parse-jd if available
      // await JobsController_parseJd({ path: { id: jobId } });
      setStep("confirm");
    } catch (error) {
      console.error("Parse failed, continuing to confirm step");
      setStep("confirm");
    }
  };

  const handlePublish = async (jobId: string) => {
    try {
      // Call POST /jobs/{id}/publish
      // await JobsController_publish({ path: { id: jobId } });
      setStep("published");
      queryClient.invalidateQueries({ queryKey: ["jobs", "me"] });
    } catch (error) {
      console.error("Publish failed:", error);
    }
  };

  // ✅ Published success state
  if (step === "published") {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl">Job Published!</CardTitle>
            <CardDescription>
              Your job post is now live and candidates can apply.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => router.push("/hr/jobs")}>
                View All Jobs
              </Button>
              <Button onClick={() => {
                setStep("form");
                form.reset();
              }}>
                Create Another Job
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Create New Job</h1>
          <p className="text-muted-foreground">
            {step === "form" && "Fill in the details for your new job posting"}
            {step === "parsing" && "Analyzing job description..."}
            {step === "confirm" && "Review and publish your job"}
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {["form", "parsing", "confirm"].map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 ${step === s ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                step === s ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}>
                {i + 1}
              </div>
              <span className="text-sm capitalize">{s}</span>
            </div>
            {i < 2 && <div className="w-8 h-px bg-muted" />}
          </React.Fragment>
        ))}
      </div>

      {/* Form Step */}
      {step === "form" && (
        <Card>
          <CardHeader>
            <CardTitle>Job Details</CardTitle>
            <CardDescription>
              Enter the basic information for your job posting. You can refine requirements in the next step.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Senior Frontend Engineer" {...field} />
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
                      <FormLabel>Job Description *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe the role, responsibilities, and requirements..." 
                          className="min-h-[200px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        Be specific about skills, experience, and what makes this role unique.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Remote, New York, London" {...field} />
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
                        <FormLabel>Employment Type</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Full-time, Contract, Part-time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="bonusAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bonus Amount (Optional)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="e.g., 1000" 
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormDescription>
                          Escrow-backed bonus to attract serious candidates.
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

                {form.formState.errors.root && (
                  <div className="text-sm text-red-500">{form.formState.errors.root.message}</div>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <Button variant="outline" type="button" onClick={() => router.back()}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createJobMutation.isPending}>
                    {createJobMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save as Draft
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Parsing Step (Optional - if you have parse-jd endpoint) */}
      {step === "parsing" && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <h3 className="font-medium mb-2">Analyzing Job Description</h3>
            <p className="text-muted-foreground text-sm">
              We're extracting key requirements and skills to help you find the best matches.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Confirm Step */}
      {step === "confirm" && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Publish</CardTitle>
            <CardDescription>
              Confirm your job details before publishing to candidates.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Preview of job */}
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div>
                <span className="text-sm font-medium text-muted-foreground">Title</span>
                <p className="font-medium">{form.getValues("title")}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Description</span>
                <p className="text-sm whitespace-pre-wrap">{form.getValues("description")}</p>
              </div>
              <div className="flex gap-4 text-sm">
                {form.getValues("location") && (
                  <Badge variant="secondary">{form.getValues("location")}</Badge>
                )}
                {form.getValues("employmentType") && (
                  <Badge variant="secondary">{form.getValues("employmentType")}</Badge>
                )}
                {form.getValues("bonusAmount") && (
                  <Badge variant="secondary">
                    {form.getValues("currency") || "USD"} {form.getValues("bonusAmount")} bonus
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStep("form")}>
                Edit
              </Button>
              <Button onClick={() => handlePublish("JOB_ID_FROM_RESPONSE")}>
                Publish Job
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}