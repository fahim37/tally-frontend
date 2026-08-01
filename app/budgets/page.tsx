import type { Metadata } from "next";
import { Budgets } from "@/components/budgets/Budgets";

export const metadata: Metadata = { title: "Budgets" };

export default function BudgetsPage() {
  return <Budgets />;
}
