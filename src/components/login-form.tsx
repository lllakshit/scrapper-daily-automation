"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogIn } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email"), password: form.get("password") }) });
      if (!response.ok) throw new Error("The email or password is incorrect.");
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return <form className="space-y-5" onSubmit={submit}>
    {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
    <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="username" defaultValue="llakshitmathur239@gmail.com" required className="h-11" /></div>
    <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="password">Password</Label><span className="text-xs text-muted-foreground">Private account</span></div><Input id="password" name="password" type="password" autoComplete="current-password" required className="h-11" /></div>
    <Button type="submit" size="lg" className="min-h-11 w-full" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : <LogIn />}{pending ? "Signing in…" : "Sign in"}</Button>
  </form>;
}
