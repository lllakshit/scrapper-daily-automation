import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: React.ReactNode }) {
  return <Card className="border-dashed shadow-none"><CardContent className="flex min-h-64 flex-col items-center justify-center px-6 py-10 text-center"><span className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground"><Icon className="size-6" /></span><h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>{action ? <div className="mt-6">{action}</div> : null}</CardContent></Card>;
}
