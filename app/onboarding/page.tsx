import type { Metadata } from "next";
import { Onboarding } from "@/components/auth/Onboarding";

export const metadata: Metadata = { title: "Get started" };

export default function OnboardingPage() {
  return <Onboarding />;
}
