import type { Metadata } from "next";
import { SignIn } from "@/components/auth/SignIn";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return <SignIn />;
}
