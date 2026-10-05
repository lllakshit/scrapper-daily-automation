"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Radar, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ScanButton() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  async function scan() {
    setScanning(true);
    try {
      const response = await fetch("/api/scans", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Scan could not start");
      router.refresh();
      toast.success("Scan complete", { description: "Your review queue has been refreshed." });
    } catch (error) {
      toast.error("Scan unavailable", { description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setScanning(false);
    }
  }
  return <Button size="lg" className="min-h-11 gap-2 px-4" onClick={scan} disabled={scanning}>{scanning ? <RotateCw className="animate-spin" /> : <Radar />}{scanning ? "Scanning…" : "Scan now"}</Button>;
}
