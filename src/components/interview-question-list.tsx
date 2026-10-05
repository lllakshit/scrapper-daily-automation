"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { InterviewQuestion, PracticeStatus } from "@/lib/interviews";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const statuses: readonly PracticeStatus[] = ["not_practiced", "practicing", "confident"];
const labels: Record<PracticeStatus, string> = { not_practiced: "Not practiced", practicing: "Practicing", confident: "Confident" };

export function InterviewQuestionList({ interviewId, revision, questions }: { interviewId: string; revision: number; questions: readonly InterviewQuestion[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  async function update(question: InterviewQuestion, status: PracticeStatus) {
    setPending(question.id);
    try {
      const response = await fetch(`/api/interviews/${interviewId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: revision, questionId: question.id, practiceStatus: status }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Practice status could not be updated");
      toast.success("Practice status updated");
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Practice status could not be updated"); }
    finally { setPending(null); }
  }
  return <div className="space-y-4">{questions.map((question, index) => <div key={question.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><p className="font-medium leading-6"><span className="mr-2 text-muted-foreground">{index + 1}.</span>{question.prompt}</p><Badge variant="outline" className="shrink-0">{labels[question.practiceStatus]}</Badge></div><p className="mt-3 text-sm leading-6 text-muted-foreground">{question.guidance}</p><div className="mt-4 flex flex-wrap gap-2">{statuses.map((status) => <Button key={status} variant={question.practiceStatus === status ? "secondary" : "ghost"} size="sm" disabled={pending === question.id} onClick={() => update(question, status)}>{labels[status]}</Button>)}</div></div>)}</div>;
}
