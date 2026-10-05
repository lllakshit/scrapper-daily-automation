"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { ApplicationStatus } from "@/lib/applications";
import { Button } from "@/components/ui/button";

const nextAction: Partial<Record<ApplicationStatus, { label: string; status?: ApplicationStatus; prepare?: boolean; approve?: boolean }>> = {
  saved: { label: "Prepare application", status: "preparing", prepare: true },
  preparing: { label: "Approve & mark ready", approve: true },
  ready: { label: "Mark as applied", status: "applied" },
  applied: { label: "Move to interview", status: "interview" },
  follow_up: { label: "Move to interview", status: "interview" },
};

async function unwrap(response: Response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || body.error || "The application could not be updated");
  return body.data;
}

export function ApplicationActions({ id, status, revision }: { id: string; status: ApplicationStatus; revision: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const action = nextAction[status];
  if (!action) return null;

  async function run() {
    setPending(true);
    try {
      let currentRevision = revision;
      if (action?.status) {
        const updated = await unwrap(await fetch(`/api/applications/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: currentRevision, status: action.status, ...(action.status === "applied" ? { followUpIntervalDays: 7 } : {}) }) }));
        currentRevision = updated.revision;
      }
      if (action?.prepare || action?.approve) {
        const prepared = await unwrap(await fetch(`/api/applications/${id}/prepare`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: currentRevision, approve: Boolean(action.approve) }) }));
        currentRevision = prepared.revision;
      }
      if (action?.status === "interview") {
        const interviews = await unwrap(await fetch("/api/interviews"));
        await unwrap(await fetch("/api/interviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ applicationId: id, expectedRevision: interviews.revision }) }));
        router.push("/interviews");
      } else router.refresh();
      toast.success(action?.label || "Application updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The application could not be updated");
    } finally { setPending(false); }
  }

  const Icon = action.status === "applied" ? Send : action.approve ? CheckCircle2 : Sparkles;
  return <Button size="lg" className="min-h-11" disabled={pending} onClick={run}>{pending ? <LoaderCircle className="animate-spin" /> : <Icon />}{pending ? "Working…" : action.label}</Button>;
}
