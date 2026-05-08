import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Dashboard" };

const KPI = [
  { label: "Active enrollments", value: "0" },
  { label: "Drafts pending review", value: "0" },
  { label: "Replies (7d)", value: "0" },
  { label: "Opens (7d)", value: "0" },
] as const;

export default function DashboardPage() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of pipeline activity and outbound email engagement.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPI.map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="px-5 py-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {label}
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-foreground">
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-10">
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Configure your sender identity and Drive folder in Settings, then
              import leads.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ol className="list-inside list-decimal space-y-1.5">
              <li>Open Settings and complete the business identity form.</li>
              <li>Connect Google (Gmail + Drive) on first sign-in.</li>
              <li>
                Import the existing 50-lead spreadsheet from{" "}
                <span className="font-mono text-xs">01_Lead_List.xlsx</span>.
              </li>
              <li>Seed the Day 0 / Day 4 / Day 10 sequence templates.</li>
              <li>Enroll your first lead and review the draft in Gmail.</li>
            </ol>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
