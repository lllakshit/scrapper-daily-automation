import Link from "next/link";
import { BriefcaseBusiness, CalendarClock } from "lucide-react";
import { applicationRepository } from "@/lib/applications";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  saved: "Saved", preparing: "Preparing", ready: "Ready", applied: "Applied", follow_up: "Follow-up",
  interview: "Interview", offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn",
};

export default async function ApplicationsPage() {
  const record = await applicationRepository.list();
  const applications = [...record.value.applications].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const applied = applications.filter((item) => item.status === "applied").length;
  const interviews = applications.filter((item) => item.status === "interview").length;
  const followUps = applications.filter((item) => item.status === "follow_up").length;
  const offers = applications.filter((item) => item.status === "offer").length;
  return <><PageHeading eyebrow="Your pipeline" title="Applications" description="Prepare, approve, and track every application without maintaining a spreadsheet." />
    {applications.length === 0 ? <EmptyState icon={BriefcaseBusiness} title="No applications yet" description="When you choose Prepare application on an opportunity, its workspace and status will appear here." /> : <><div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{[["Applied", applied], ["Interviews", interviews], ["Follow-ups", followUps], ["Offers", offers]].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-sm text-muted-foreground">{label}</p></CardContent></Card>)}</div><div className="grid gap-4">{applications.map((application) => <Card key={application.id} className="shadow-sm"><CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="mb-2 flex items-center gap-2"><Badge variant="secondary">{labels[application.status]}</Badge>{application.followUpDueAt ? <span className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3.5" />{new Date(application.followUpDueAt).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" })}</span> : null}</div><h2 className="text-lg font-semibold">{application.role}</h2><p className="mt-1 text-sm text-muted-foreground">{application.company}</p></div><Button asChild variant="outline" size="lg" className="min-h-11"><Link href={`/applications/${application.id}`}>Open workspace</Link></Button></CardContent></Card>)}</div></>}
  </>;
}
