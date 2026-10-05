import Link from "next/link";
import { CalendarClock, MessagesSquare } from "lucide-react";
import { interviewRepository } from "@/lib/interviews/repository";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function InterviewsPage() {
  const record = await interviewRepository.list();
  const interviews = [...record.value.interviews].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return <><PageHeading eyebrow="Prepare with focus" title="Interviews" description="Company research, likely questions, project stories, and confidence tracking in one workspace." />{interviews.length === 0 ? <EmptyState icon={MessagesSquare} title="No interviews to prepare for" description="Move an application to Interview and a focused preparation workspace will be created automatically." /> : <div className="grid gap-4">{interviews.map((interview) => <Card key={interview.id} className="shadow-sm"><CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between"><div><Badge variant="secondary" className="mb-2"><CalendarClock />{interview.scheduledAt ? new Date(interview.scheduledAt).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }) : "Date not set"}</Badge><h2 className="text-lg font-semibold">{interview.role}</h2><p className="mt-1 text-sm text-muted-foreground">{interview.company}</p></div><Button asChild variant="outline" size="lg" className="min-h-11"><Link href={`/interviews/${interview.id}`}>Prepare</Link></Button></CardContent></Card>)}</div>}</>;
}
