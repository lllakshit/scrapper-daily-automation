import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ExternalLink } from "lucide-react";
import { applicationRepository } from "@/lib/applications";
import { ApplicationActions } from "@/components/application-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await applicationRepository.findById(id);
  if (!record) notFound();
  const application = record.value;
  const preparation = application.preparation;
  return <><Link href="/applications" className="mb-5 inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground hover:text-foreground">Back to applications</Link><div className="mb-6 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-start sm:justify-between"><div><Badge className="mb-3 capitalize">{application.status.replace("_", "-")}</Badge><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{application.role}</h1><p className="mt-2 text-muted-foreground">{application.company}</p></div><div className="flex flex-wrap gap-3"><Button asChild variant="outline" size="lg" className="min-h-11"><a href={application.url} target="_blank" rel="noreferrer">Original listing<ExternalLink /></a></Button><ApplicationActions id={application.id} status={application.status} revision={record.revision} /></div></div>{preparation ? <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>Resume strategy</CardTitle></CardHeader><CardContent className="space-y-4">{preparation.resumeRecommendations.length ? preparation.resumeRecommendations.map((item) => <div key={`${item.content}-${item.reason}`}><p className="flex gap-2 text-sm font-medium"><Check className="mt-0.5 size-4 shrink-0 text-success" />{item.content}</p><p className="mt-1 pl-6 text-sm leading-6 text-muted-foreground">{item.reason}</p></div>) : <p className="text-sm text-muted-foreground">Add approved profile evidence to receive tailored recommendations.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Cover letter draft</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{preparation.coverLetter.content}</p></CardContent></Card><Card><CardHeader><CardTitle>Key experience</CardTitle></CardHeader><CardContent className="space-y-3">{preparation.keyExperience.map((item) => <p key={item.content} className="flex gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-success" />{item.content}</p>)}</CardContent></Card><Card><CardHeader><CardTitle>Follow-up draft</CardTitle></CardHeader><CardContent><p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{preparation.followUpDraft?.content ?? "Available after preparation."}</p></CardContent></Card></div> : <Card className="border-dashed"><CardContent className="flex min-h-56 flex-col items-center justify-center p-6 text-center"><h2 className="font-semibold">Application material is not prepared yet</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Preparation uses only evidence from your approved profile. Review every draft before using it.</p></CardContent></Card>}</>;
}
