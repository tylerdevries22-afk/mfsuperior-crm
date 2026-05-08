import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/nav/sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-screen w-full flex-col md:h-screen md:flex-row">
      <Sidebar />
      <main className="flex-1 bg-background md:overflow-y-auto">{children}</main>
    </div>
  );
}
