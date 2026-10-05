import { PageHeading } from "@/components/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  return <><PageHeading eyebrow="Control" title="Settings" description="Tune scanning and reminders without changing the core safety rules." /><div className="grid gap-6 lg:grid-cols-2"><Card className="shadow-sm"><CardHeader><CardTitle>Scan schedule</CardTitle><CardDescription>Vercel Cron runs the same safe pipeline as Scan now.</CardDescription></CardHeader><CardContent className="space-y-5"><label className="flex min-h-12 items-center justify-between gap-4 rounded-lg border px-4"><span><span className="block text-sm font-medium">Daily scan</span><span className="text-xs text-muted-foreground">Run every morning</span></span><Switch defaultChecked /></label><div className="space-y-2"><Label htmlFor="scan-time">Preferred time</Label><Input id="scan-time" type="time" defaultValue="08:00" className="h-11 max-w-xs" /></div></CardContent></Card><Card className="shadow-sm"><CardHeader><CardTitle>Follow-ups</CardTitle><CardDescription>Draft a reminder after an application has had no response.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="space-y-2"><Label htmlFor="follow-up-days">Days after applying</Label><Input id="follow-up-days" type="number" min="1" defaultValue="7" className="h-11 max-w-xs" /></div><p className="text-sm leading-6 text-muted-foreground">Career Autopilot will prepare a draft. It will never send a message without your approval.</p></CardContent></Card></div><div className="mt-6 flex justify-end"><Button size="lg" className="min-h-11">Save settings</Button></div></>;
}
