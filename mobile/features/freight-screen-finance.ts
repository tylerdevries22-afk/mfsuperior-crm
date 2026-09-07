import type { FreightCollectionSpec } from "@/route-support/freight";

export const INVOICES_SPEC = {
  eyebrow: "ACCOUNTS RECEIVABLE",
  title: "Invoices",
  description: "Freight charges, supporting documents, delivery proof, and customer payment status.",
  metrics: [
    { label: "OUTSTANDING", value: "$18.7k", detail: "9 invoices", tone: "brand" },
    { label: "OVERDUE", value: "$2.1k", detail: "1 invoice", tone: "danger" },
    { label: "PAID MTD", value: "$44.2k", detail: "+12%", tone: "success" },
  ],
  segments: ["Open", "Overdue", "Paid"],
  records: [
    { id: "inv-1", title: "INV-2841 · Front Range Grocery", subtitle: "MF-2042 · POD attached", meta: "$2,480 · Due Sep 12", status: "sent", tone: "brand", icon: "file", route: "/invoices/inv-2841" },
    { id: "inv-2", title: "INV-2828 · Alpine Supply", subtitle: "MF-2024 · Net 30", meta: "$2,110 · 4 days overdue", status: "overdue", tone: "danger", icon: "alert-circle", route: "/invoices/inv-2828" },
    { id: "inv-3", title: "INV-2836 · Summit Retail", subtitle: "MF-2038 · ACH", meta: "$3,920 · Paid Aug 20", status: "paid", tone: "success", icon: "check", route: "/invoices/inv-2836" },
  ],
} satisfies FreightCollectionSpec;

export const SETTLEMENTS_SPEC = {
  eyebrow: "DRIVER PAY",
  title: "Settlements",
  description: "Driver compensation, reimbursable expenses, deductions, and approved payout records.",
  metrics: [
    { label: "READY", value: "$8.4k", detail: "6 drivers", tone: "success" },
    { label: "REVIEW", value: "3", detail: "Expense receipts", tone: "warning" },
    { label: "PAID MTD", value: "$31.2k", tone: "brand" },
  ],
  segments: ["Ready", "Review", "Paid"],
  records: [
    { id: "set-1", title: "ST-0921 · Brenna Lewis", subtitle: "8 loads · 2,146 miles", meta: "$2,948.20 · Ready Friday", status: "approved", tone: "success", icon: "credit-card", route: "/payments/st-0921" },
    { id: "set-2", title: "ST-0922 · Samuel Ortiz", subtitle: "6 loads · 1 lumper receipt", meta: "$2,116.75 · Review required", status: "review", tone: "warning", icon: "paperclip", route: "/payments/st-0922" },
  ],
} satisfies FreightCollectionSpec;
