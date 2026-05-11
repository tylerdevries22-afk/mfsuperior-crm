import { desc } from "drizzle-orm";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/db/client";
import { suppressionList } from "@/lib/db/schema";
import { addSuppressionAction, removeSuppressionAction } from "../actions";

/**
 * Suppression list management. Pulls its own data so other tabs
 * don't pay the 100-row query when they don't need it.
 *
 * Add form on top, table below. Each row's remove button is its own
 * mini-form (the server action only needs the email).
 */
export async function SuppressionTab() {
  const suppressionRows = await db
    .select()
    .from(suppressionList)
    .orderBy(desc(suppressionList.createdAt))
    .limit(100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Suppression list</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form */}
        <form
          action={addSuppressionAction}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="grid gap-1 min-w-[220px]">
            <Label htmlFor="supp-email" className="text-xs">
              Email
            </Label>
            <Input
              id="supp-email"
              name="email"
              type="email"
              placeholder="contact@example.com"
              required
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="supp-reason" className="text-xs">
              Reason
            </Label>
            <select
              id="supp-reason"
              name="reason"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              defaultValue="manual"
            >
              <option value="manual">Manual</option>
              <option value="unsubscribed">Unsubscribed</option>
              <option value="bounced">Bounced</option>
              <option value="replied">Replied</option>
              <option value="invalid">Invalid</option>
            </select>
          </div>
          <Button type="submit" size="sm" variant="secondary">
            <Plus className="size-4" /> Add
          </Button>
        </form>

        {suppressionRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No suppressed addresses.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Reason</th>
                  <th className="pb-2 pr-4 font-medium">Added</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {suppressionRows.map((row) => (
                  <tr key={row.email}>
                    <td className="py-2 pr-4 font-mono text-xs">{row.email}</td>
                    <td className="py-2 pr-4 capitalize text-muted-foreground">
                      {row.reason}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                      {new Date(row.createdAt).toISOString().slice(0, 10)}
                    </td>
                    <td className="py-2">
                      <form action={removeSuppressionAction}>
                        <input type="hidden" name="email" value={row.email} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-destructive hover:text-destructive"
                        >
                          <X className="size-3" />
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
