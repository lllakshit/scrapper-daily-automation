import { Building2, CircleCheckBig, CircleDashed } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const sources = [
  { name: "Remotive", detail: "Public remote-jobs feed", enabled: true, note: "No key required." },
  { name: "Arbeitnow", detail: "Public jobs feed with bounded pagination", enabled: true, note: "No key required." },
  { name: "RemoteOK", detail: "Popular remote jobs feed", enabled: true, note: "No key required." },
  { name: "LinkedIn", detail: "RapidAPI jobs query for LinkedIn postings", enabled: Boolean(process.env.RAPIDAPI_KEY), note: "Set RAPIDAPI_KEY to enable." },
  { name: "Indeed", detail: "RapidAPI jobs query for Indeed postings", enabled: Boolean(process.env.RAPIDAPI_KEY), note: "Set RAPIDAPI_KEY to enable." },
  { name: "Glassdoor", detail: "RapidAPI jobs query for Glassdoor postings", enabled: Boolean(process.env.RAPIDAPI_KEY), note: "Set RAPIDAPI_KEY to enable." },
  { name: "Workday", detail: "RapidAPI jobs query for Workday career pages", enabled: Boolean(process.env.RAPIDAPI_KEY), note: "Set RAPIDAPI_KEY to enable." },
  { name: "Ashby", detail: "RapidAPI jobs query for Ashby-hosted roles", enabled: Boolean(process.env.RAPIDAPI_KEY), note: "Set RAPIDAPI_KEY to enable." },
  { name: "Greenhouse", detail: "Popular ATS source added through RapidAPI", enabled: Boolean(process.env.RAPIDAPI_KEY), note: "Set RAPIDAPI_KEY to enable." },
  { name: "Lever", detail: "Popular ATS source added through RapidAPI", enabled: Boolean(process.env.RAPIDAPI_KEY), note: "Set RAPIDAPI_KEY to enable." },
  { name: "Wellfound", detail: "Startup jobs source added through RapidAPI", enabled: Boolean(process.env.RAPIDAPI_KEY), note: "Set RAPIDAPI_KEY to enable." },
];

export default function SourcesPage() {
  return <><PageHeading eyebrow="Discovery" title="Sources" description="Remote India scans use active, deduped feeds plus optional RapidAPI platform searches." /><div className="grid gap-4 md:grid-cols-2">{sources.map((source) => <Card key={source.name} className="shadow-sm"><CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2"><Building2 className="size-5 text-primary" />{source.name}</CardTitle><CardDescription className="mt-2">{source.detail}</CardDescription></div><Badge variant={source.enabled ? "secondary" : "outline"}>{source.enabled ? <CircleCheckBig /> : <CircleDashed />}{source.enabled ? "Enabled" : "Setup needed"}</Badge></CardHeader><CardContent className="text-sm text-muted-foreground">{source.enabled ? "Checked independently. A source failure will not stop other sources." : source.note}</CardContent></Card>)}</div></>;
}
