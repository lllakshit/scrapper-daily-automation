import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { allInterviewQuestions } from "@/lib/interviews";
import { interviewRepository } from "@/lib/interviews/repository";
import { InterviewQuestionList } from "@/components/interview-question-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await interviewRepository.findById(id);
  if (!record) notFound();
  const workspace = record.value;
  const questions = allInterviewQuestions(workspace.sections);
  return <><Link href="/interviews" className="mb-5 inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground hover:text-foreground">Back to interviews</Link><div className="mb-6 border-b pb-6"><Badge className="mb-3">Interview preparation</Badge><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{workspace.role}</h1><p className="mt-2 text-muted-foreground">{workspace.company}</p></div><div className="grid gap-6 lg:grid-cols-[.75fr_1.25fr]"><div className="space-y-6"><Card><CardHeader><CardTitle>Company research</CardTitle></CardHeader><CardContent className="space-y-3">{workspace.sections.companyResearch.map((item) => <p key={item} className="flex gap-2 text-sm leading-6"><Check className="mt-0.5 size-4 shrink-0 text-success" />{item}</p>)}</CardContent></Card><Card><CardHeader><CardTitle>Why you match</CardTitle></CardHeader><CardContent className="space-y-3">{workspace.sections.whyYouMatch.map((item) => <p key={item} className="flex gap-2 text-sm leading-6"><Check className="mt-0.5 size-4 shrink-0 text-success" />{item}</p>)}</CardContent></Card></div><Card><CardHeader><CardTitle>Practice questions</CardTitle></CardHeader><CardContent><InterviewQuestionList interviewId={workspace.id} revision={record.revision} questions={questions} /></CardContent></Card></div></>;
}
