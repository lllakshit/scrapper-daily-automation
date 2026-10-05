"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-dvh place-items-center p-6"><div className="max-w-md text-center"><span className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive"><AlertTriangle /></span><h1 className="text-2xl font-semibold">This page could not load</h1><p className="mt-3 leading-7 text-muted-foreground">Your saved information is safe. Try loading the page again.</p><Button size="lg" className="mt-6 min-h-11" onClick={reset}>Try again</Button></div></main>;
}
