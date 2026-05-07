"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const KNOWN = [
  "first_name",
  "last_name",
  "full_name",
  "company_name",
  "city",
  "state",
  "vertical",
  "personalization",
  "sender_name",
  "sender_email",
  "sender_company",
  "sender_title",
  "sender_phone",
  "mc_number",
  "usdot_number",
  "call_time",
] as const;

type SampleVars = Record<string, string>;

const VAR_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

function render(source: string, vars: SampleVars) {
  const used = new Set<string>();
  const unknown = new Set<string>();
  const out = source.replace(VAR_PATTERN, (m, name: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      used.add(name);
      return vars[name];
    }
    unknown.add(name);
    return m;
  });
  return { out, used: [...used], unknown: [...unknown] };
}

export function TemplateEditor({
  initial,
  action,
  sampleVars,
}: {
  initial: {
    id?: string;
    name: string;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    sendMode: "draft" | "auto_send";
    isActive: boolean;
    sequenceStep: number | null;
  };
  action: (formData: FormData) => Promise<void>;
  sampleVars: SampleVars;
}) {
  const [subject, setSubject] = React.useState(initial.subject);
  const [bodyHtml, setBodyHtml] = React.useState(initial.bodyHtml);
  const [bodyText, setBodyText] = React.useState(initial.bodyText);
  const [activeTab, setActiveTab] = React.useState<"html" | "text">("html");
  const subjectRef = React.useRef<HTMLInputElement>(null);
  const htmlRef = React.useRef<HTMLTextAreaElement>(null);
  const textRef = React.useRef<HTMLTextAreaElement>(null);

  const subjectPreview = React.useMemo(
    () => render(subject, sampleVars),
    [subject, sampleVars],
  );
  const htmlPreview = React.useMemo(
    () => render(bodyHtml, sampleVars),
    [bodyHtml, sampleVars],
  );
  const textPreview = React.useMemo(
    () => render(bodyText, sampleVars),
    [bodyText, sampleVars],
  );

  const allUnknown = React.useMemo(
    () =>
      [
        ...new Set([
          ...subjectPreview.unknown,
          ...htmlPreview.unknown,
          ...textPreview.unknown,
        ]),
      ].sort(),
    [subjectPreview, htmlPreview, textPreview],
  );

  function insertVariable(name: string) {
    const placeholder = `{{${name}}}`;
    const focused =
      document.activeElement === subjectRef.current
        ? subjectRef.current
        : document.activeElement === htmlRef.current
          ? htmlRef.current
          : document.activeElement === textRef.current
            ? textRef.current
            : activeTab === "html"
              ? htmlRef.current
              : textRef.current;
    if (!focused) return;
    const el = focused as HTMLInputElement | HTMLTextAreaElement;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = el.value.slice(0, start) + placeholder + el.value.slice(end);
    if (el === subjectRef.current) setSubject(next);
    else if (el === htmlRef.current) setBodyHtml(next);
    else setBodyText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + placeholder.length, start + placeholder.length);
    });
  }

  return (
    <form
      action={action}
      className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]"
    >
      {/* Hidden id for upsert + body source-of-truth fields */}
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="bodyHtml" value={bodyHtml} />
      <input type="hidden" name="bodyText" value={bodyText} />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Template</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={initial.name}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_auto]">
              <div className="grid gap-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  ref={subjectRef}
                  id="subject"
                  name="subject"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sendMode">Send mode</Label>
                <Select
                  id="sendMode"
                  name="sendMode"
                  defaultValue={initial.sendMode}
                  className="w-32"
                >
                  <option value="draft">Draft</option>
                  <option value="auto_send">Auto-send</option>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="invisible">Active</Label>
                <label className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 text-sm">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={initial.isActive}
                    className="size-4 cursor-pointer rounded border-border accent-[--primary]"
                  />
                  Active
                </label>
              </div>
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("html")}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    activeTab === "html"
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  HTML body
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("text")}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    activeTab === "text"
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Plain-text body
                </button>
              </div>
              {activeTab === "html" ? (
                <Textarea
                  ref={htmlRef}
                  id="bodyHtml-editor"
                  rows={18}
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  className="font-mono text-xs leading-relaxed"
                />
              ) : (
                <Textarea
                  ref={textRef}
                  id="bodyText-editor"
                  rows={18}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  className="font-mono text-xs leading-relaxed"
                />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          {allUnknown.length > 0 && (
            <span className="mr-auto text-xs text-warning">
              {allUnknown.length} unknown variable{allUnknown.length === 1 ? "" : "s"}: {allUnknown.map((u) => `{{${u}}}`).join(", ")}
            </span>
          )}
          <Button type="submit">Save template</Button>
        </div>
      </div>

      {/* Right rail: variable picker + live preview */}
      <aside className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Variables</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              Click to insert at the cursor. Unknown variables stay in the
              source so the linter above flags them.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {KNOWN.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="inline-flex items-center rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-xs font-medium leading-none text-secondary-foreground ring-1 ring-inset ring-border transition-colors active:translate-y-[1px] hover:bg-brand-50 hover:ring-brand-200"
                >
                  {v}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Subject
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {subjectPreview.out || (
                  <span className="italic text-muted-foreground">
                    (empty)
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
                Rendered body
              </p>
              {activeTab === "html" ? (
                <div
                  className="prose prose-sm max-w-none rounded-md border border-border bg-background px-3 py-3 text-sm leading-relaxed text-foreground [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_li]:mb-1"
                  dangerouslySetInnerHTML={{ __html: htmlPreview.out }}
                />
              ) : (
                <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-background px-3 py-3 font-mono text-xs leading-relaxed text-foreground">
                  {textPreview.out}
                </pre>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Sample lead:{" "}
              <span className="font-mono text-foreground">
                {sampleVars.first_name} · {sampleVars.company_name} ·{" "}
                {sampleVars.vertical || "(no vertical)"}
              </span>
            </p>
          </CardContent>
        </Card>
      </aside>
    </form>
  );
}
