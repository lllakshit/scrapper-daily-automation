"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, LoaderCircle, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const roles = ["AI Engineer", "AI Developer", "GenAI Engineer", "LLM Engineer", "Full Stack AI Engineer", "Automation Engineer"] as const;
const locations = ["Jaipur", "Remote", "India"] as const;
const workModeOptions = ["remote", "hybrid", "on-site"] as const;
const employmentTypeOptions = ["full-time", "contract", "part-time", "internship"] as const;

function toggleValue<T extends string>(values: readonly T[], value: T, checked: boolean): T[] {
  return checked ? [...new Set([...values, value])] : values.filter((item) => item !== value);
}

export function ProfileSetup() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [profileRevision, setProfileRevision] = useState(0);
  const [preferencesRevision, setPreferencesRevision] = useState(0);
  const [profileStatus, setProfileStatus] = useState<"draft" | "approved" | "empty">("empty");
  const [name, setName] = useState("Lakshit Mathur");
  const [email, setEmail] = useState("llakshitmathur239@gmail.com");
  const [title, setTitle] = useState("");
  const [years, setYears] = useState(0);
  const [summary, setSummary] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([...roles]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([...locations]);
  const [selectedWorkModes, setSelectedWorkModes] = useState<string[]>(["remote", "hybrid"]);
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState<string[]>(["full-time", "contract"]);
  const [salaryLpa, setSalaryLpa] = useState("10");

  useEffect(() => {
    Promise.all([fetch("/api/profile"), fetch("/api/preferences")]).then(async ([profileResponse, preferencesResponse]) => {
      if (profileResponse.ok) {
        const body = await profileResponse.json();
        const record = body.data;
        if (record) {
          setProfileRevision(record.revision);
          setProfileStatus(record.value.status);
          setName(record.value.personal.name || "Lakshit Mathur");
          setEmail(record.value.personal.email || "llakshitmathur239@gmail.com");
          setTitle(record.value.professional.currentTitle || "");
          setYears(record.value.professional.yearsOfExperience ?? 0);
          setSummary(record.value.professional.summary || "");
          setSkills(Object.values(record.value.skills).flat() as string[]);
        }
      }
      if (preferencesResponse.ok) {
        const body = await preferencesResponse.json();
        if (body.data) {
          const preferences = body.data.value;
          setPreferencesRevision(body.data.revision);
          setSelectedRoles([...preferences.targetRoles]);
          setSelectedLocations([...preferences.locations]);
          setSelectedWorkModes([...preferences.workModes]);
          setSelectedEmploymentTypes([...preferences.employmentTypes]);
          setSalaryLpa(preferences.preferredMinimumSalary === null ? "" : String(preferences.preferredMinimumSalary / 100_000));
        }
      }
    }).catch(() => undefined);
  }, []);

  async function upload() {
    if (!file) return;
    setUploading(true);
    try {
      const data = new FormData();
      data.set("resume", file);
      if (profileRevision > 0) data.set("expectedRevision", String(profileRevision));
      const response = await fetch("/api/resume", { method: "POST", body: data });
      if (!response.ok) throw new Error();
      const body = await response.json();
      const record = body.data;
      setProfileRevision(record.revision);
      setProfileStatus(record.value.status);
      setName(record.value.personal.name || name);
      setEmail(record.value.personal.email || email);
      setSkills(Object.values(record.value.skills).flat() as string[]);
      toast.success("Resume uploaded", { description: "Review the extracted profile before approving it." });
    } catch {
      toast.error("Upload unavailable", { description: "Check the file and your storage configuration, then try again." });
    } finally { setUploading(false); }
  }

  async function saveProfile(approve = false) {
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: profileRevision, patch: { personal: { name, email, location: "Jaipur, India" }, professional: { currentTitle: title, yearsOfExperience: years, summary, targetRoles: selectedRoles } } }) });
      if (!response.ok) throw new Error();
      const updated = (await response.json()).data;
      setProfileRevision(updated.revision);
      setProfileStatus(updated.value.status);
      if (approve) {
        const approval = await fetch("/api/profile/approve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: updated.revision }) });
        if (!approval.ok) throw new Error();
        const approved = (await approval.json()).data;
        setProfileRevision(approved.revision);
        setProfileStatus("approved");
        toast.success("Profile approved", { description: "Job matching can now use these verified details." });
      } else toast.success("Profile saved");
    } catch { toast.error("Profile could not be saved", { description: "Review the fields and try again." }); }
  }

  async function savePreferences() {
    if (!selectedRoles.length || !selectedLocations.length || !selectedWorkModes.length || !selectedEmploymentTypes.length) {
      toast.error("Complete your preferences", { description: "Choose at least one option in every group." });
      return;
    }
    const salary = salaryLpa.trim() === "" ? null : Number(salaryLpa) * 100_000;
    if (salary !== null && (!Number.isFinite(salary) || salary < 0)) {
      toast.error("Enter a valid salary");
      return;
    }
    try {
      const response = await fetch("/api/preferences", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ expectedRevision: preferencesRevision, preferences: { targetRoles: selectedRoles, locations: selectedLocations, workModes: selectedWorkModes, employmentTypes: selectedEmploymentTypes, preferredMinimumSalary: salary, salaryCurrency: "INR" } }) });
      if (!response.ok) throw new Error();
      const record = (await response.json()).data;
      setPreferencesRevision(record.revision);
      toast.success("Preferences saved");
    } catch { toast.error("Preferences could not be saved"); }
  }

  return <Tabs defaultValue="resume" className="w-full"><TabsList className="mb-5 grid h-auto min-h-11 w-full grid-cols-3 sm:w-fit"><TabsTrigger value="resume" className="min-h-10">Resume</TabsTrigger><TabsTrigger value="profile" className="min-h-10">Profile</TabsTrigger><TabsTrigger value="preferences" className="min-h-10">Preferences</TabsTrigger></TabsList>
    <TabsContent value="resume"><Card className="shadow-sm"><CardHeader><CardTitle>Resume source</CardTitle><CardDescription>PDF, DOCX, or TXT up to 5 MB. Extracted details remain a draft until you approve them.</CardDescription></CardHeader><CardContent><button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-52 w-full flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-6 text-center transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="mb-4 grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">{file ? <FileText className="size-6" /> : <UploadCloud className="size-6" />}</span><span className="font-medium">{file ? file.name : "Choose your resume"}</span><span className="mt-2 text-sm text-muted-foreground">{file ? `${Math.ceil(file.size / 1024)} KB · Ready to analyze` : "Tap to browse your device"}</span></button><input ref={inputRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><div className="mt-4 flex justify-end"><Button size="lg" className="min-h-11" disabled={!file || uploading} onClick={upload}>{uploading ? <LoaderCircle className="animate-spin" /> : <UploadCloud />}{uploading ? "Analyzing…" : "Upload & analyze"}</Button></div></CardContent></Card></TabsContent>
    <TabsContent value="profile"><Card className="shadow-sm"><CardHeader><CardTitle className="flex items-center justify-between gap-3"><span>Career profile</span>{profileStatus !== "empty" ? <span className="text-xs font-medium uppercase tracking-wide text-primary">{profileStatus}</span> : null}</CardTitle><CardDescription>Your resume populates this editor. Nothing is used for matching until you approve it.</CardDescription></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" value={name} onChange={(event) => setName(event.target.value)} className="h-11" /></div><div className="space-y-2"><Label htmlFor="email-profile">Email</Label><Input id="email-profile" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11" /></div><div className="space-y-2"><Label htmlFor="title">Current title</Label><Input id="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Your current professional title" className="h-11" /></div><div className="space-y-2"><Label htmlFor="years">Years of experience</Label><Input id="years" type="number" min="0" max="80" value={years} onChange={(event) => setYears(Number(event.target.value))} className="h-11" /></div><div className="space-y-2 sm:col-span-2"><Label htmlFor="summary">Professional summary</Label><textarea id="summary" value={summary} onChange={(event) => setSummary(event.target.value)} className="min-h-28 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Review or add your professional summary" /></div><div className="sm:col-span-2 rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">{skills.length ? <><span className="font-medium text-foreground">Extracted skills:</span> {skills.join(", ")}</> : "Upload your resume to extract evidence-backed skills. Experience and projects can be added after extraction."}</div><div className="flex flex-col-reverse gap-3 sm:col-span-2 sm:flex-row sm:justify-end"><Button variant="outline" size="lg" className="min-h-11" disabled={profileStatus === "empty"} onClick={() => saveProfile(false)}>Save draft</Button><Button size="lg" className="min-h-11" disabled={profileStatus === "empty" || profileStatus === "approved"} onClick={() => saveProfile(true)}><CheckCircle2 />{profileStatus === "approved" ? "Profile approved" : "Approve profile"}</Button></div></CardContent></Card></TabsContent>
    <TabsContent value="preferences"><Card className="shadow-sm"><CardHeader><CardTitle>Career preferences</CardTitle><CardDescription>These hard filters keep unsuitable jobs away before AI matching.</CardDescription></CardHeader><CardContent className="space-y-7"><fieldset><legend className="mb-3 text-sm font-semibold">Target roles</legend><div className="grid gap-3 sm:grid-cols-2">{roles.map((role) => <label key={role} className="flex min-h-11 items-center gap-3 rounded-lg border bg-background px-3 text-sm"><Checkbox checked={selectedRoles.includes(role)} onCheckedChange={(checked) => setSelectedRoles((current) => toggleValue(current, role, checked === true))} />{role}</label>)}</div></fieldset><fieldset><legend className="mb-3 text-sm font-semibold">Locations</legend><div className="grid gap-3 sm:grid-cols-3">{locations.map((location) => <label key={location} className="flex min-h-11 items-center gap-3 rounded-lg border bg-background px-3 text-sm"><Checkbox checked={selectedLocations.includes(location)} onCheckedChange={(checked) => setSelectedLocations((current) => toggleValue(current, location, checked === true))} />{location}</label>)}</div></fieldset><fieldset><legend className="mb-3 text-sm font-semibold">Work mode</legend><div className="grid gap-3 sm:grid-cols-3">{workModeOptions.map((mode) => <label key={mode} className="flex min-h-11 items-center gap-3 rounded-lg border bg-background px-3 text-sm capitalize"><Checkbox checked={selectedWorkModes.includes(mode)} onCheckedChange={(checked) => setSelectedWorkModes((current) => toggleValue(current, mode, checked === true))} />{mode}</label>)}</div></fieldset><fieldset><legend className="mb-3 text-sm font-semibold">Employment type</legend><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{employmentTypeOptions.map((type) => <label key={type} className="flex min-h-11 items-center gap-3 rounded-lg border bg-background px-3 text-sm capitalize"><Checkbox checked={selectedEmploymentTypes.includes(type)} onCheckedChange={(checked) => setSelectedEmploymentTypes((current) => toggleValue(current, type, checked === true))} />{type}</label>)}</div></fieldset><div className="space-y-2"><Label htmlFor="salary">Preferred minimum salary (₹ LPA)</Label><Input id="salary" type="number" min="0" step="0.5" value={salaryLpa} onChange={(event) => setSalaryLpa(event.target.value)} className="h-11 max-w-xs" /></div><div className="flex justify-end"><Button size="lg" className="min-h-11" onClick={savePreferences}>Save preferences</Button></div></CardContent></Card></TabsContent>
  </Tabs>;
}
