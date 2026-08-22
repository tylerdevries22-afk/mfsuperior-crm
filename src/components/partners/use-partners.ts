"use client";

import { useEffect, useState } from "react";
import { PARTNERS, type Partner } from "@/data/partners";

/**
 * Partner directory for client components.
 *
 * Server components call `listPartners()`; client pages can't touch the
 * filesystem, so they read `/api/partners`. The committed seed is the initial
 * value, which means logos render on first paint and the fetch only fills in
 * operator edits (status flips, uploaded partners). A failed fetch therefore
 * degrades to the seed rather than to an empty list.
 */
export function usePartners(): readonly Partner[] {
  const [partners, setPartners] = useState<readonly Partner[]>(PARTNERS);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    fetch("/api/partners", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: unknown) => {
        if (!active || !body || typeof body !== "object") return;
        const data = (body as { data?: unknown }).data;
        if (Array.isArray(data) && data.length > 0) {
          setPartners(data as Partner[]);
        }
      })
      .catch(() => {
        // Seed data is already on screen; a transient failure changes nothing.
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return partners;
}
