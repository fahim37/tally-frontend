import type { Metadata } from "next";
import { Insights } from "@/components/insights/Insights";

export const metadata: Metadata = { title: "Insights" };

export default function InsightsPage() {
  return <Insights />;
}
