import type { Metadata } from "next";
import { Habits } from "@/components/habits/Habits";

export const metadata: Metadata = { title: "Habits" };

export default function HabitsPage() {
  return <Habits />;
}
