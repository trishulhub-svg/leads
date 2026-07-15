// src/lib/default-templates.ts
// Brand-neutral default outreach templates (shared by seed + runtime sync).
import type { schema } from "./db";
import { compileVisualEmailHtml, defaultVisual } from "./email-template-html";

type TemplateInsert = typeof schema.templates.$inferInsert;

export function defaultTemplates(): TemplateInsert[] {
  return [
    {
      name: "Cold Intro — Service",
      subject: "{{company}} — a quick idea from {{brand_name}}",
      ctaType: "landing",
      ctaUrl: "https://example.com",
      htmlBody: compileVisualEmailHtml(
        defaultVisual({
          preheader: "A short note for {{company}} about working together.",
          headline: "A thoughtful introduction",
          ctaLabel: "Book a 15-minute call",
          body: `Hi {{first_name}},

I came across {{company}} and wanted to introduce {{brand_name}}. We help teams run clearer outreach with better follow-up and less manual work.

If improving conversations this quarter matters, I’d welcome a brief call to see whether we’re a fit.

Would a 15-minute call this week work?`,
        })
      ),
    },
    {
      name: "Follow-up — Gentle Nudge",
      subject: "Re: {{company}} — following up from {{brand_name}}",
      ctaType: "whatsapp",
      ctaUrl: "https://wa.me/919662106793?text=" + encodeURIComponent("Hi, I wanted to follow up"),
      htmlBody: compileVisualEmailHtml(
        defaultVisual({
          preheader: "Just floating this back up in case my earlier note got buried.",
          headline: "Quick follow-up",
          ctaLabel: "Chat on WhatsApp",
          buttonColor: "#16a34a",
          body: `Hi {{first_name}},

I wanted to gently follow up on my earlier note to {{company}}. I know inboxes get busy.

If email isn’t convenient, I’m happy to answer a couple of questions on WhatsApp.

If the timing isn’t right, just say so and I’ll close the loop.`,
        })
      ),
    },
    {
      name: "Value Offer — Discount",
      subject: "{{first_name}}, a limited offer for {{company}}",
      ctaType: "landing",
      ctaUrl: "https://example.com",
      htmlBody: compileVisualEmailHtml(
        defaultVisual({
          preheader: "A limited offer for {{company}} — available for a short time.",
          headline: "A practical offer for {{company}}",
          ctaLabel: "Claim the offer",
          body: `Hi {{first_name}},

For a limited window we’re offering {{company}} priority onboarding with {{brand_name}}.

What’s included:
- Faster setup with guided onboarding
- Cleaner outreach workflows
- Clearer follow-up on replies

If helpful, I can walk you through it on a short call.`,
        })
      ),
    },
    {
      name: "Case Study — Social Proof",
      subject: "How teams like {{company}} improved results",
      ctaType: "landing",
      ctaUrl: "https://example.com",
      htmlBody: compileVisualEmailHtml(
        defaultVisual({
          preheader: "A short case study relevant to teams like {{company}}.",
          headline: "Results worth a closer look",
          ctaLabel: "Request the case study",
          body: `Hi {{first_name}},

Teams similar to {{company}} have used {{brand_name}} to move from inconsistent manual outreach to a clearer, repeatable system.

I put together a concise case study covering process and outcomes. Happy to share it if useful.

Would you like me to send it over?`,
        })
      ),
    },
  ];
}
