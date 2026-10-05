import { Building2, CircleCheckBig, CircleDashed } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const sources = [
  { name: "Remotive", detail: "Public remote-jobs feed", enabled: true },
  { name: "Arbeitnow", detail: "Public European jobs feed", enabled: true },
  { name: "Company career pages", detail: "Greenhouse and Lever boards you choose", enabled: false },
];

export default function SourcesPage() {
  return <><PageHeading eyebrow="Discovery" title="Sources" description="A small set of reliable, legitimate feeds is more useful than a huge unreliable scraper." /><div className="grid gap-4">{sources.map((source) => <Card key={source.name} className="shadow-sm"><CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2"><Building2 className="size-5 text-primary" />{source.name}</CardTitle><CardDescription className="mt-2">{source.detail}</CardDescription></div><Badge variant={source.enabled ? "secondary" : "outline"}>{source.enabled ? <CircleCheckBig /> : <CircleDashed />}{source.enabled ? "Enabled" : "Setup needed"}</Badge></CardHeader><CardContent className="text-sm text-muted-foreground">{source.enabled ? "Checked independently. A source failure will not stop other sources." : "Add selected company board identifiers in Settings."}</CardContent></Card>)}</div></>;
}
