import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <div className="mx-auto w-full max-w-6xl space-y-6 p-6"><Skeleton className="h-10 w-64" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36" />)}</div><Skeleton className="h-80 w-full" /></div>;
}
