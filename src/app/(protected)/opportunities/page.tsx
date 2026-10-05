import Link from "next/link";
import { BriefcaseBusiness, MapPin, SearchX, Sparkles } from "lucide-react";
import { readLatestScan } from "@/lib/discovery";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { ScanButton } from "@/components/scan-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const scan = await readLatestScan();
  const opportunities = scan?.opportunities ?? [];
  return <><PageHeading eyebrow="Review queue" title="Opportunities" description="Fresh, active jobs that strongly match your approved profile. Anything expired, duplicated, or shown before stays out." action={<ScanButton />} />
    {opportunities.length === 0 ? <EmptyState icon={SearchX} title="No new opportunities yet" description="Finish your profile and run a scan. When a strong unseen match is found, it will appear here once for your decision." /> : <div className="grid gap-4">{opportunities.map((match) => <Card key={match.job.id} className="shadow-sm transition-shadow hover:shadow-md"><CardContent className="p-5"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="mb-3 flex flex-wrap items-center gap-2"><Badge className={match.classification === "excellent" ? "bg-emerald-600 text-white" : ""}><Sparkles />{match.classification === "excellent" ? "Excellent" : "Strong"}</Badge><Badge variant="outline">{match.score}% match</Badge></div><h2 className="text-lg font-semibold">{match.job.title}</h2><p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><BriefcaseBusiness className="size-4" />{match.job.company}</p><p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="size-4" />{match.job.location} · {match.job.remoteType}</p></div><Button asChild size="lg" className="min-h-11 shrink-0"><Link href={`/opportunities/${encodeURIComponent(match.job.id)}`}>Review opportunity</Link></Button></div></CardContent></Card>)}</div>}
  </>;
}
