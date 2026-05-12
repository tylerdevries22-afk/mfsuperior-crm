"use client";

import { useFormStatus } from "react-dom";
import { Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Submit button for the Quick-add form on /leads. Uses
 * `useFormStatus()` to render an "<spinner> Adding…" state while
 * the server action runs, so the operator can see something is
 * happening — the previous plain submit button gave no signal
 * and the click felt broken.
 *
 * Must live inside a `<form action={...}>` ancestor (React tree,
 * not just HTML form= attribute) for useFormStatus to receive
 * the pending context.
 */
export function QuickAddSubmit({ title }: { title?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="secondary"
      size="sm"
      disabled={pending}
      title={title}
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Adding…
        </>
      ) : (
        <>
          <Zap /> Quick-add
        </>
      )}
    </Button>
  );
}
