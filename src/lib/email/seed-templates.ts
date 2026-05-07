/**
 * Seed templates derived directly from `02_Email_Template.md`.
 *
 * The kit's bracketed placeholders are translated to our {{variable}} syntax:
 *   [COMPANY NAME]   → {{company_name}}
 *   [FIRST NAME]     → {{first_name}}
 *   [YOUR NAME]      → {{sender_name}}
 *   [TITLE]          → {{sender_title}}
 *   [PHONE]          → {{sender_phone}}
 *   [EMAIL]          → {{sender_email}}
 *   [MC#]            → {{mc_number}}
 *   [USDOT#]         → {{usdot_number}}
 *   [DAY/TIME]       → {{call_time}}
 *   [INSERT ONE SPECIFIC OBSERVATION] → {{personalization}}  (auto from vertical)
 */

export type SeedTemplate = {
  step: number;
  delayDays: number;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
};

export const SEED_TEMPLATES: SeedTemplate[] = [
  {
    step: 1,
    delayDays: 0,
    name: "Day 0 — Initial outreach",
    subject:
      "Box-truck capacity for {{company_name}} — Denver-based, liftgate-equipped",
    bodyHtml: `<p>Hi {{first_name}},</p>
<p>I run a small box-truck fleet here in Denver — five trucks, liftgate-equipped, fully DOT and insured, currently moving freight seven days a week with overnight and evening capacity.</p>
<p>I'm reaching out because {{company_name}} is exactly the kind of shipper we're built for: {{personalization}}.</p>
<p>I'm not asking to displace your primary carrier. I want to be on your overflow / backup carrier list for peak periods, vacation coverage, or capacity gaps when your usual fleet is stretched. Most shippers your size keep one or two trusted overflow carriers warm — I'd like to be one of yours.</p>
<p>A few specifics on us:</p>
<ul>
  <li>5 box trucks, liftgate-equipped capacity, all DOT-compliant</li>
  <li>7-day operating window (overnight + evening shifts already running)</li>
  <li>Full COI, MC#, and DOT# available on request</li>
  <li>Denver-based ownership, no offshore dispatch — you call, we answer</li>
</ul>
<p>Capabilities one-pager attached. Two minutes on the phone is all I need — could I grab 10 minutes {{call_time}}?</p>
<p>Best,<br />
{{sender_name}}<br />
{{sender_title}} — {{sender_company}}<br />
{{sender_phone}} · {{sender_email}}<br />
MC# {{mc_number}} · USDOT# {{usdot_number}}</p>`,
    bodyText: `Hi {{first_name}},

I run a small box-truck fleet here in Denver — five trucks, liftgate-equipped, fully DOT and insured, currently moving freight seven days a week with overnight and evening capacity.

I'm reaching out because {{company_name}} is exactly the kind of shipper we're built for: {{personalization}}.

I'm not asking to displace your primary carrier. I want to be on your overflow / backup carrier list for peak periods, vacation coverage, or capacity gaps when your usual fleet is stretched. Most shippers your size keep one or two trusted overflow carriers warm — I'd like to be one of yours.

A few specifics on us:
• 5 box trucks, liftgate-equipped capacity, all DOT-compliant
• 7-day operating window (overnight + evening shifts already running)
• Full COI, MC#, and DOT# available on request
• Denver-based ownership, no offshore dispatch — you call, we answer

Capabilities one-pager attached. Two minutes on the phone is all I need — could I grab 10 minutes {{call_time}}?

Best,
{{sender_name}}
{{sender_title}} — {{sender_company}}
{{sender_phone}} · {{sender_email}}
MC# {{mc_number}} · USDOT# {{usdot_number}}`,
  },
  {
    step: 2,
    delayDays: 4,
    name: "Day 4 — Follow-up",
    subject: "Re: Box-truck capacity for {{company_name}}",
    bodyHtml: `<p>Hi {{first_name}} — bumping this in case it got buried.</p>
<p>Quick ask: who on your team handles carrier onboarding? I just need a name and email so I can put our packet directly in their hands. Three sentences from you saves both of us a phone tag loop.</p>
<p>Thanks,<br />
{{sender_name}}</p>`,
    bodyText: `Hi {{first_name}} — bumping this in case it got buried.

Quick ask: who on your team handles carrier onboarding? I just need a name and email so I can put our packet directly in their hands. Three sentences from you saves both of us a phone tag loop.

Thanks,
{{sender_name}}`,
  },
  {
    step: 3,
    delayDays: 10,
    name: "Day 10 — Closing the loop",
    subject: "Closing the loop — {{company_name}}",
    bodyHtml: `<p>Hi {{first_name}},</p>
<p>I haven't heard back, so I'll assume the timing isn't right — totally understood.</p>
<p>If anything changes (peak season, primary carrier capacity issue, new lane), my number is {{sender_phone}}. I'll plan to circle back next quarter.</p>
<p>Best,<br />
{{sender_name}}</p>`,
    bodyText: `Hi {{first_name}},

I haven't heard back, so I'll assume the timing isn't right — totally understood.

If anything changes (peak season, primary carrier capacity issue, new lane), my number is {{sender_phone}}. I'll plan to circle back next quarter.

Best,
{{sender_name}}`,
  },
];

export const SEED_SEQUENCE_NAME = "Denver kit · Day 0 / 4 / 10";
