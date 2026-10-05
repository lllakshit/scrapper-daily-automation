import { Activity, DatabaseZap, HeartPulse, KeyRound, Radar } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const checks = [
  { name: "Authentication", detail: "Environment credentials and encrypted sessions", icon: KeyRound, status: "Configure on Vercel" },
  { name: "Persistent storage", detail: "Private Vercel Blob state and resume files", icon: DatabaseZap, status: "Configure on Vercel" },
  { name: "Job sources", detail: "Independent adapters with partial-failure handling", icon: Radar, status: "Ready for first scan" },
  { name: "AI matching", detail: "Evidence-backed structured analysis", icon: Activity, status: "Provider needed" },
];

export default function SystemHealthPage() {
  return <><PageHeading eyebrow="Reliability" title="System health" description="See what is working, what needs setup, and why a scan may be incomplete." /><div className="grid gap-4 sm:grid-cols-2">{checks.map(({ name, detail, icon: Icon, status }) => <Card key={name} className="shadow-sm"><CardContent className="flex items-start gap-4 p-5"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><Icon className="size-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{name}</h2><Badge variant="outline">{status}</Badge></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p></div></CardContent></Card>)}</div><Card className="mt-6 border-dashed shadow-none"><CardContent className="flex min-h-44 flex-col items-center justify-center p-6 text-center"><HeartPulse className="mb-3 size-7 text-muted-foreground" /><h2 className="font-semibold">No scan history yet</h2><p className="mt-2 text-sm text-muted-foreground">Source durations, filtered counts, AI cache hits, and errors will appear after your first scan.</p></CardContent></Card></>;
}
