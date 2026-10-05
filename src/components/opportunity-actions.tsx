"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, FilePenLine, LoaderCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface OpportunityActionsProps {
  readonly job: { id: string; company: string; title: string; canonicalUrl: string };
}

type Action = "save" | "prepare" | "reject";

async function responseData(response: Response) {
  const body = await response.json();
  if (!response.ok) {
    const message = typeof body.error === "string" ? body.error : body.error?.message;
    throw new Error(message || "The action could not be completed");
  }
  return body.data;
}

export function OpportunityActions({ job }: OpportunityActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);

  async function dismiss(action: Action) {
    await responseData(await fetch(`/api/opportunities/${encodeURIComponent(job.id)}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    }));
  }

  async function act(action: Action) {
    setPending(action);
    try {
      if (action === "reject") {
        await dismiss(action);
        toast.success("Opportunity rejected", { description: "It will not return in a future scan." });
        router.replace("/opportunities");
        router.refresh();
        return;
      }

      const list = await responseData(await fetch("/api/applications"));
      let application = list.value.applications.find((item: { jobId: string }) => item.jobId === job.id);
      let revision = list.revision as number;
      if (!application) {
        const created = await responseData(await fetch("/api/applications", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ expectedRevision: revision, jobId: job.id, company: job.company, role: job.title, url: job.canonicalUrl }),
        }));
        revision = created.revision;
        application = created.value.applications.find((item: { jobId: string }) => item.jobId === job.id);
      }
      if (action === "prepare") {
        if (application.status === "saved") {
          const transitioned = await responseData(await fetch(`/api/applications/${application.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ expectedRevision: revision, status: "preparing" }),
          }));
          revision = transitioned.revision;
          application = transitioned.value.applications.find((item: { jobId: string }) => item.jobId === job.id);
        }
        const prepared = await responseData(await fetch(`/api/applications/${application.id}/prepare`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ expectedRevision: revision, approve: false }),
        }));
        revision = prepared.revision;
      }
      await dismiss(action);
      toast.success(action === "prepare" ? "Application workspace prepared" : "Opportunity saved");
      router.push(action === "prepare" ? `/applications/${application.id}` : "/applications");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The action could not be completed");
    } finally {
      setPending(null);
    }
  }

  const loading = pending !== null;
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:justify-end">
    <Button variant="ghost" size="lg" className="min-h-11" disabled={loading} onClick={() => act("reject")}>{pending === "reject" ? <LoaderCircle className="animate-spin" /> : <X />}Reject</Button>
    <Button variant="outline" size="lg" className="min-h-11" disabled={loading} onClick={() => act("save")}>{pending === "save" ? <LoaderCircle className="animate-spin" /> : <Bookmark />}Save</Button>
    <Button size="lg" className="col-span-2 min-h-11 sm:col-span-1" disabled={loading} onClick={() => act("prepare")}>{pending === "prepare" ? <LoaderCircle className="animate-spin" /> : <FilePenLine />}Prepare application</Button>
  </div>;
}
