import Image from "next/image";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { devSignInAction } from "./dev-actions";

export const metadata = { title: "Sign in" };

async function signInAction() {
  "use server";
  await signIn("google", { redirectTo: "/dashboard" });
}

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="border-b-0 pb-0">
          <div className="flex items-center gap-3">
            <div className="logo-neon-glow-soft relative size-12 shrink-0 overflow-hidden rounded-md">
              <Image
                src="/logo.png?v=2"
                alt="MF Superior Products"
                fill
                sizes="48px"
                className="object-contain p-1.5"
                priority
              />
            </div>
            <div>
              <CardTitle className="text-lg">MF Superior</CardTitle>
              <CardDescription>Freight delivery · CRM</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <p className="mb-6 text-sm text-muted-foreground">
            Sign in with the Google account that will send and store outreach
            email. You will be asked for Gmail and Drive permissions on first
            sign-in.
          </p>
          <form action={signInAction}>
            <Button type="submit" className="w-full" size="lg">
              Continue with Google
            </Button>
          </form>

          {isDev && (
            <details className="mt-6 rounded-md border border-dashed border-border bg-secondary/30 p-4">
              <summary className="cursor-pointer text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Developer sign-in (local only)
              </summary>
              <p className="mt-3 text-xs text-muted-foreground">
                Bypasses Google OAuth for local development. Creates a real
                session in your local Postgres so the rest of the app works.
                Disabled automatically in production.
              </p>
              <form
                action={devSignInAction}
                className="mt-3 grid gap-2"
              >
                <div className="grid gap-1">
                  <Label htmlFor="dev-email" className="text-xs">
                    Email
                  </Label>
                  <Input
                    id="dev-email"
                    name="email"
                    type="email"
                    required
                    defaultValue="tylerdevries22@gmail.com"
                  />
                </div>
                <div className="grid gap-1">
                  <Label htmlFor="dev-name" className="text-xs">
                    Display name
                  </Label>
                  <Input
                    id="dev-name"
                    name="name"
                    defaultValue="Tyler DeVries"
                  />
                </div>
                <Button type="submit" variant="secondary" size="sm">
                  Sign in (dev)
                </Button>
              </form>
            </details>
          )}

          <p className="mt-6 text-xs text-muted-foreground">
            By signing in, you grant MF Superior CRM access to your Gmail and
            the configured Drive folder. Tokens are encrypted at rest. You can
            revoke access in your Google Account settings at any time.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
