# bulka.ai — landing page copy (draft v2)

> Working doc. Each section has copy + a short note on intent. Alternative
> headlines marked **[alt]** where called out.

---

## 0. Page metadata

- **Title:** Bulka.AI — AI co-pilot for payment operations
- **Meta description:** Payments-aware AI assistant for issuing, acquiring, and PSP teams. Pre-trained on Visa/Mastercard rules and scheme dispute mechanics. Calibrated to your runbooks in days.
- **OG image:** crop of the hero illustration (square 1200×1200) once generated

---

## 1. Hero

**Headline:**
AI co-pilot for payment operations

**Subhead:**
For fintechs in issuing, acquiring, and PSP. Pre-trained on Visa/Mastercard rules, scheme dispute mechanics, and the regulations that touch your stack. Calibrated to your runbooks in days — not quarters.

**Primary CTA:** Book a call → [calendly.com/denisstark/zoom](https://calendly.com/denisstark/zoom)
**Secondary:** See how it works *(anchor to §5)*

> *Intent: lead with what the product is and who it's for. "Calibrated in days, not quarters" is the speed wedge against horizontal AI tools and vendor-led consulting.*

---

## 2. The problem

**Heading:** Payment operations don't scale with headcount

Card operations sit between compliance, ops, and IT — and no single team owns the fix. Volume grows; the expert who knows Reg E timelines, scheme dispute codes, and your own runbooks doesn't.

- One or two SMEs become single points of failure
- Vendor and scheme documentation is fragmented across PDFs, portals, and tribal knowledge
- Horizontal AI tools (ChatGPT, Copilot) don't understand chargeback reason codes, BSA typologies, or your specific BIN configuration
- Hiring a payments expert takes 6–9 months — if you can find one

> *Intent: name the actual pain. Position horizontal AI as inadequate so we don't compete with it directly.*

---

## 3. What Bulka.AI does

**Heading:** A payments-aware assistant, embedded where your team already works

Bulka.AI plugs into Slack, Teams, and your ticketing system. It answers questions and drafts responses using your runbooks, scheme manuals, regional regulations, and ticket history — every answer cited to source.

Four core capabilities:

**Compliance Q&A**
Instant cited answers on scheme rules, regional regulations (Reg E/Z, BSA, PSD2, local equivalents), your internal procedures, and your team's historical interpretations. No more "let me get back to you tomorrow."

**Operations co-pilot**
Reject resolution, ticket triage, and routing. The AI drafts the response; your analyst approves and sends.

**Change-scope analysis**
Visa, Mastercard, and regulator bulletins triaged against your card products and BIN configuration — what applies to you, what doesn't, what action is required.

**Audit-ready trail**
Every question, every answer, every source — searchable, exportable, formatted for scheme audits or regulator review.

---

## 4. Use cases (by role)

**Heading:** Built for the people who actually do the work

- **Card Operations Analyst** — Reject resolution and ticket triage. AI drafts the response to Visa/Mastercard rejects, citing the relevant scheme rule.
- **Compliance / Disputes Analyst** — Reg E and scheme-rules Q&A. Dispute timelines, BSA typologies, chargeback reason codes — answered with citation, not opinion.
- **Compliance Officer** — Change-scope analysis. Scheme releases mapped to your products and BIN ranges.
- **Internal Audit** — Searchable, exportable audit trail of every AI-assisted decision.
- **Business Analyst** — Requirement analysis and effort estimation against existing platform capabilities.

---

## 5. See it in action

**Heading:** An example query

*Render as a styled card/conversation block. Content below uses only publicly documented Mastercard chargeback rules — no client or NDA data.*

**Analyst asks:**
> What should I do when a cardholder reports an unauthorized transaction under Mastercard reason code 4837 — No Cardholder Authorization?

**Bulka.AI replies:**

For Mastercard reason code **4837 (No Cardholder Authorization)**, here is what the issuer needs to process the chargeback:

**Required documentation** (one of):
- Cardholder letter, email, message, or completed Dispute Resolution Form stating the transaction was not authorized
- For corporate cards: a written complaint from a company or government-agency representative when the authorized cardholder is no longer employed there

**Time frame:**
- Chargeback must be filed **within 120 calendar days** of the Central Site Business Date of the transaction

**If the merchant submits a second presentment:**
- A pre-arbitration case may be filed if the original chargeback was valid, Identity Check (3-D Secure) was not used, and either the second-presentment documentation is not compelling or the cardholder reasserts fraud
- Pre-arbitration must be filed **within 45 calendar days** of the second presentment, and **at least 30 calendar days** before escalating to arbitration

**Important:** all supporting documentation must be legible and linked to the case filing. Any documentation required but not provided in the chargeback will not be considered if the dispute escalates to arbitration.

*Source: Mastercard Chargeback Guide — Reason Code 4837*

> *Intent: this section gives concrete proof of capability without exposing any client data. All facts here are from Mastercard's publicly documented chargeback rules. We can swap in a different reason code or scenario before launch if you prefer.*

---

## 6. Early validation

**Heading:** Three pilots, three segments

| Segment | Team | Platform | Annual hours freed | Annual value unlocked |
|---|---|---|---|---|
| PSP in the US | Merchant onboarding, customer support, Adyen integration | Cloud | ~2,000 | ~$120K |
| Acquiring processor in EU | Card ops team of 8 | OpenWay (Way4), cloud | ~4,000 | ~$180K |
| Issuing/Acquiring processor in ME | Card ops team of 10 | On-prem CMS + domestic scheme | ~10,000 | ~$150K |

*Hours are redirected to judgment work, exception handling, and higher-value tasks — same headcount, more done. Figures are from early pilots with small teams; outcomes scale with team size and use-case mix. We'll size yours during the discovery call.*

---

## 7. How we deliver — without the painful onboarding

**Heading:** We fit into your existing vendor stack

For fintechs, we contract directly — standard MSA, no surprises.

For banks and larger processors, new-vendor onboarding can take months: TPRM review, SIG questionnaires, MSA negotiation, security review. If you already have an MSA with a firm that can prime AI engagements, we deliver as their subcontractor — no new MSA, no net-new TPRM scope.

- **Cloud or on-premises** deployment — your choice
- **Pilots operate on documentation and anonymized samples** — no production cardholder data in scope
- **No data-science team required** on your side
- **Outcome-anchored fees** — we carry the build risk; you pay against measured productivity gains

---

## 8. The pilot

**Heading:** 60 days. One team. One use case. Measurable results.

**Lede:** A 60-day pilot with weekly progress readouts. Pricing for small teams starts at $5K/month. We need 2–3 SMEs for ~4 hours of calibration, one operational team as the test group, sandbox or read-only access to relevant systems, and your scheme manuals and runbooks.

**Subhead:** What you have at day 60

- **Working software** — A live AI co-pilot deployed in your environment, in daily use by your operational team. Integrated into Slack/Teams and your ticketing system, with a full audit log of every query, answer, and source citation.
- **Measured results** — A verified productivity delta against your own baseline: resolution time per ticket, escalation-to-SME rate, hours freed per week, end-user accuracy.
- **Decision-grade documentation** — A final ROI report with verified numbers, a scoped scaling plan, and a security, integration, and TPRM posture summary — everything you need to decide what's next.
- **Operational findings** — A current-state workflow map for the pilot team, a pain-point inventory ranked by impact, a use-case scoring matrix (effort vs. value), and a stakeholder readout with named owners.

**Closing line:** *Pilot outputs become inputs for what's next — no rework, no re-discovery. A decision, not a leap of faith.*

> *Intent: mirrors the Fiserv exec deck's "What You Have at Day 60" section. Same four artifact categories, language adapted for a fintech-CEO buyer (no "Phase 2" or "leadership commits" wording). The closing line is lifted directly from the deck for brand coherence across both audiences.*

---

## 9. Who we are

**Heading:** Built by people who've been in your seat

Four co-founders, 70+ years combined in payments — across issuing, acquiring, PSP, and every major card management platform.

**Denis Stark** *(Co-founder & CEO)*
28 years in payments. Issuing and acquiring at Shift4, Network International, Worldline. Built and led card-ops, implementation, and product teams across three continents.
[LinkedIn](https://www.linkedin.com/in/denisstark/)

**Konstantin Ryadov** *(Co-founder & CTO)*
Leads core AI development. 19 years in payments, with a focus on agentic AI and cybersecurity — building AI systems that hold up under regulated workloads.
[LinkedIn](https://www.linkedin.com/in/konstantin-ryadov/)

**Ivan Goncharov** *(Co-founder & Chief Platform Officer)*
Leads platform engineering, DevOps, and integrations — including the applied-AI components that connect Bulka.AI to client systems. 12 years at OpenWay and BPC building and operating the platforms your teams use today. 3 years at IBM.
[LinkedIn](https://www.linkedin.com/in/ivanvg/)

**Aleksandr Sovetov** *(Co-founder & Chief Delivery Officer)*
Issuing/acquiring implementations and platform migrations. 15 years in payments at Network International and Nexi. 30+ CMS implementations and 40+ portfolio migrations across the team.
[LinkedIn](http://www.linkedin.com/in/aleksandr-sovetov-9343a467)

---

## 10. Where our expertise is deepest

**Heading:** We know payments. We know your platform.

- **30+ CMS implementations** for banks and payment processors
- **40+ portfolio migrations** across teams
- **Visa, Mastercard, and UnionPay certifications** — issuing and acquiring
- **Deep working knowledge** of scheme rules and dispute mechanics
- **Hands-on across the major card management platforms** — OpenWay (Way4 — our deepest specialty), BPC SmartVista, VisionPlus, Base24
- **AI/ML deployment experience** in regulated environments

---

## 11. Closing CTA

**Heading:** Let's run a pilot

60 days. One team. One use case. Measurable results.

**Book a 30-minute call** → [calendly.com/denisstark/zoom](https://calendly.com/denisstark/zoom)
Or email **denis.stark@bulka.ai**

---

## Footer

- Bulka.AI · © 2026
- denis.stark@bulka.ai
- LinkedIn (company page, once it exists)

---

## Brand & Visual Identity

Translated from the master prompt used for the LinkedIn illustration series. The challenge: the master prompt produces *illustrations* — vivid, mosaic, geometric. For an enterprise-formal landing page that converts fintech CEOs, we can't paint the whole page in that style or it reads as decorative. Instead, we use it as a **disciplined visual layer** on top of a calm, structural page.

### Translation rules

| Master prompt principle | How it shows up on bulka.ai |
|---|---|
| Straight lines, no curves | No rounded corners anywhere. Buttons, cards, dividers — all sharp. `border-radius: 0`. |
| Flat solid colors, no gradients | All UI fills are single-color. No CSS gradients, no soft shadows. |
| Geometric figures from rectangles/triangles/trapezoids | Section dividers and decorative accents use angular polygon shapes (SVG). |
| "Clarity emerging from complexity" | Layout is generous, white space dominant. Heavy content density inside disciplined frames. |
| Calm, structured, alive | Tone of microcopy: confident, never breathless. |

### Color palette (restrained subset of the master prompt)

- **Background** — pure white (#FFFFFF) or near-white (#FAFAF7)
- **Foreground / type** — true black (#0A0A0A)
- **Primary brand** — **deep blue** (#1B3A8B). Trust color for finance + calm base from the master prompt. Used for the wordmark, headlines, and primary structural elements.
- **Accent #1 (energy / CTA)** — **warm orange** (#F26B1F). Buttons, key highlights.
- **Accent #2 (signal)** — **vivid green** (#1A8A3F). Verification ticks, "live" indicators.
- **Accent #3 (decoration only)** — **bright yellow** (#FFC400), **turquoise** (#1FC8C8), **pure red** (#E03131). Used sparingly in the hero illustration and SVG section dividers; never in body UI.

### Typography

**Confirmed:** Space Grotesk (display + headings) + Inter (body + UI). Both free via Google Fonts.

### Imagery

- **Hero illustration** — generated with the prompt in [`hero-prompt.md`](./hero-prompt.md). Scene: payment-ops analyst at faceted desk + geometric AI core + structured landscape representing a better world.
- **Section accents** — small SVG geometric motifs (triangles, trapezoids) in the brand palette. Custom SVG, not stock.
- **Founder photos** — square, hard-edged frames (no circles, no soft borders). Drop into `images/founders/` as `denis.jpg`, `konstantin.jpg`, `ivan.jpg`, `aleksandr.jpg`.

### Wordmark

**"Bulka.AI"** set in **Space Grotesk** (probably Medium or Semibold weight) in **deep blue (#1B3A8B)**. No icon mark for v1.

### Layout posture

- Single column on mobile, two- or three-column grids on desktop
- Generous vertical rhythm
- Hard-edged section dividers — a thin black or deep-blue rule, or a stepped polygon SVG — no soft fades
- No drop shadows. Depth comes from color contrast and overlapping geometric planes.
