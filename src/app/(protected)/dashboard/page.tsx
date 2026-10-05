import Link from "next/link";
import { BriefcaseBusiness, CalendarClock, CheckCircle2, Clock3, FileUp, Sparkles, Target } from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { ScanButton } from "@/components/scan-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { readLatestScan } from "@/lib/discovery";
import { applicationRepository, calculateFollowUpDueAt } from "@/lib/applications";
import { interviewRepository } from "@/lib/interviews/repository";
import { profileRepository } from "@/lib/profile/repository";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [scan, applicationRecord, interviewRecord, profileRecord, preferencesRecord] = await Promise.all([
    readLatestScan(), applicationRepository.list(), interviewRepository.list(), profileRepository.readProfile(), profileRepository.readPreferences(),
  ]);
  const opportunityCount = scan?.opportunities.length ?? 0;
  const applications = applicationRecord.value.applications;
  const applicationTasks = applications.filter((item) => ["saved", "preparing", "ready"].includes(item.status)).length;
  const followUps = applications.filter((item) => calculateFollowUpDueAt(item, new Date().toISOString())).length;
  const interviewCount = interviewRecord.value.interviews.length;
  const setupSteps = [true, profileRecord?.value.status === "approved", Boolean(preferencesRecord), Boolean(scan)];
  const completedSetupSteps = setupSteps.filter(Boolean).length;
  const actionItems = [
    { label: "Strong opportunities", value: opportunityCount, icon: Sparkles, color: "text-primary", bg: "bg-accent" },
    { label: "Application tasks", value: applicationTasks, icon: BriefcaseBusiness, color: "text-amber-700 dark:text-amber-300", bg: "bg-amber-100 dark:bg-amber-950/50" },
    { label: "Follow-ups due", value: followUps, icon: Clock3, color: "text-rose-700 dark:text-rose-300", bg: "bg-rose-100 dark:bg-rose-950/50" },
    { label: "Interview tasks", value: interviewCount, icon: Target, color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-950/50" },
  ];
  return (
    <>
      <PageHeading eyebrow="Today" title="Good morning, Lakshit" description="Here is what deserves your attention—not everything the internet found." action={<ScanButton />} />
      <section aria-labelledby="action-required">
        <div className="mb-3 flex items-center justify-between"><h2 id="action-required" className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Action required</h2><Badge variant="secondary">{opportunityCount ? `${opportunityCount} to review` : "All clear"}</Badge></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {actionItems.map(({ label, value, icon: Icon, color, bg }) => <Card key={label} className="shadow-sm"><CardContent className="p-4 sm:p-5"><span className={`mb-4 grid size-10 place-items-center rounded-xl ${bg} ${color}`}><Icon className="size-5" /></span><p className="text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{label}</p></CardContent></Card>)}
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <Card className="overflow-hidden shadow-sm">
          <CardHeader className="border-b bg-card/80"><div className="flex items-center justify-between"><div><CardTitle>Top opportunities</CardTitle><CardDescription className="mt-1">Only excellent and strong new matches appear here.</CardDescription></div><Link href="/opportunities" className="text-sm font-medium text-primary hover:underline">View all</Link></div></CardHeader>
          <CardContent className="flex min-h-72 flex-col items-center justify-center px-6 py-10 text-center"><span className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground"><Sparkles className="size-6" /></span><h3 className="text-lg font-semibold">{opportunityCount ? `${opportunityCount} strong ${opportunityCount === 1 ? "opportunity" : "opportunities"} ready` : "Your queue is ready for setup"}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{opportunityCount ? "Review each match once, then save, reject, or prepare an application." : "Approve your resume profile and preferences. Then your first scan can find relevant, active, unseen opportunities."}</p><Button asChild variant="outline" size="lg" className="mt-6 min-h-11"><Link href={opportunityCount ? "/opportunities" : "/profile"}>{opportunityCount ? <Sparkles /> : <FileUp />}{opportunityCount ? "Review opportunities" : "Set up your profile"}</Link></Button></CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="shadow-sm"><CardHeader><div className="flex items-center justify-between"><CardTitle>Setup progress</CardTitle><span className="font-mono text-sm text-muted-foreground">{completedSetupSteps}/4</span></div></CardHeader><CardContent><Progress value={completedSetupSteps * 25} className="mb-5" /><ol className="space-y-3 text-sm"><li className="flex items-center gap-3"><CheckCircle2 className="size-5 text-success" /><span>Your private workspace</span></li><li className="flex items-center gap-3">{profileRecord?.value.status === "approved" ? <CheckCircle2 className="size-5 text-success" /> : <span className="size-5 rounded-full border-2 border-primary" />}<Link href="/profile" className="font-medium hover:underline">Review your resume profile</Link></li><li className="flex items-center gap-3">{preferencesRecord ? <CheckCircle2 className="size-5 text-success" /> : <span className="size-5 rounded-full border-2" />}Set career preferences</li><li className="flex items-center gap-3">{scan ? <CheckCircle2 className="size-5 text-success" /> : <span className="size-5 rounded-full border-2" />}Run the first scan</li></ol></CardContent></Card>
          <Card className="shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="size-5 text-primary" />System</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4 text-sm"><div><p className="text-muted-foreground">Last scan</p><p className="mt-1 font-medium">{scan ? new Date(scan.completedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) : "Not run yet"}</p></div><div><p className="text-muted-foreground">Sources</p><p className="mt-1 font-medium">{scan ? `${scan.sourceResults.filter((source) => source.status === "healthy").length}/${scan.sourceResults.length} healthy` : "Not configured"}</p></div><div><p className="text-muted-foreground">Jobs analyzed</p><p className="mt-1 font-medium">{scan?.statistics.analyzed ?? 0}</p></div><div><p className="text-muted-foreground">Status</p><p className="mt-1 font-medium text-amber-700 dark:text-amber-300">{scan ? "Ready" : "Setup needed"}</p></div></CardContent></Card>
        </div>
      </div>
    </>
  );
}
