import { PageHeading } from "@/components/page-heading";
import { ProfileSetup } from "@/components/profile-setup";

export default function ProfilePage() {
  return <><PageHeading eyebrow="Your foundation" title="Profile & preferences" description="Everything the system recommends must be grounded in the career information you approve here." /><ProfileSetup /></>;
}
