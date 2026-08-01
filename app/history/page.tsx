import type { Metadata } from "next";
import { History } from "@/components/history/History";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return <History />;
}
