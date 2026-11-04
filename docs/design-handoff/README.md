# Handoff: Jacob Troutman personal site ("Decision log" direction)

## Overview
A personal site for Jacob Troutman, a senior full-stack .NET engineer (C#, Blazor, Azure, APIs, design systems) who is looking for his next role. It is a long-term home for his work and should read like an engineer's working notebook, not a template portfolio.

It is designed for three readers:
- **Recruiter, 30 seconds:** reads the Home pitch pane and the one-line proof rows. No paragraphs needed.
- **Hiring manager, 3 minutes:** expands a proof row (Problem / Decision / Outcome), or reads a case file's TL;DR card and section ledes.
- **Interviewer, full depth:** reads a complete case file.

There are four screens: Home, Case file, Company page (unlisted, one per application) and Pocket Log.

## About the design files
The files in this bundle are **design references built in HTML**. They are prototypes that show the intended look and behavior, not production code to copy. The job is to **recreate them in Astro**, the stack Jacob chose: mostly static pages, with the interactive parts as islands.

The `.dc.html` files open directly in a browser as long as `support.js` sits next to them. They use inline styles and a small runtime. Don't port that structure. Port the layout, type, color, copy and behavior described below.

## Fidelity
**High fidelity.** Colors, type, spacing, states and interactions are final. The exceptions are:
- **Copy.** Only the three Home proof lines are Jacob's own words, and they must stay verbatim. All other copy is draft text written to show the layout and needs Jacob's sign-off before launch. That includes the headline, the Problem/Decision/Outcome text, the statuses, read times, role, the case file prose and code sample, and the company page content.
- **Pocket Log app area.** It is a stand-in. The real Pocket Log app mounts in that frame.
- **Links.** Links set to `#` are placeholders: email, résumé PDF, the DR-01 and DR-03 case files, and "How I build with AI". LinkedIn (`https://www.linkedin.com/in/jacob-troutman`) and GitHub (`https://github.com/jetroutman`) are real.

---

## Recommended Astro structure

```
src/
  content/
    cases/            dr-01-pos-notifications.mdx, dr-02-money-orders.mdx, dr-03-pocket-log.mdx
    companies/        contoso.md   (one per application)
  pages/
    index.astro                    Home
    case/[slug].astro              Case file
    for/[slug].astro               Company page (noindex, not in sitemap, never linked)
    pocket-log.astro               Pocket Log (island)
    how-i-build-with-ai.astro      (not designed yet)
  components/
    SiteHeader.astro  SiteFooter.astro  ThemeToggle (tiny inline script)
    LogRow.astro (Home: <details>; Company: plain link)  StatusPill.astro  MonoLabel.astro
    case/ Lede, PartsList, Options + Option, Paths, CodeBlock, Callout, BeforeAfter, InterviewerNotes, SectionNav
    pocket/ ModeBanner + app mount (one island)
```

**Case file frontmatter (zod schema suggestion)**
```ts
id: string            // "DR-02"
title: string         // the Home proof line, verbatim
status: 'Adopted' | 'Shipped' | 'Live'
stack: string[]       // ["C#", ".NET", "APIs"]
readMinutes: number
role: string
tldr: { problem: string; decision: string; outcome: string }
order: number
```
The body is MDX. Sections are fixed: Context, Problem, Options, Decision, Outcome, "What I'd tell an interviewer". Home and the company page both read `title`, `status`, `stack`, `readMinutes` and `tldr` from this collection, so the summary text is written once.

**Company frontmatter**
```ts
company: string; role: string; date: string
summary: string
requirements: { need: string; cases: string[] }[]     // cases = ["DR-01","DR-02"]
evidence: { case: string; relevance: string }[]
plan: { days: string; title: string; items: string[] }[]
questions: string[]
```
Use unguessable slugs (for example `/for/contoso-7f3k`), `<meta name="robots" content="noindex, nofollow">`, and exclude `/for/*` from `@astrojs/sitemap` with `filter`.

**JavaScript budget**
- **Home:** the theme toggle only. Expanding rows are native `<details>/<summary>`.
- **Case file:** the theme toggle plus about 30 lines of IntersectionObserver for the active section, as progressive enhancement. The nav must work as plain anchor links without JS.
- **Company page:** the theme toggle only. Make the pitch pane sticky with a media query instead of JS.
- **Pocket Log:** one island that holds both the banner and the app, because the banner state drives the app's mode.

**Fonts:** self-host with Fontsource (`@fontsource-variable/instrument-sans` with the wdth and wght axes, and `@fontsource-variable/jetbrains-mono`). Preload both and use `font-display: swap`. Only add `@fontsource-variable/source-serif-4` if Jacob picks the serif reading face (see the Case file section).

---

## Global elements

### Page shell
- Page background is `bg`, text is `ink`. Base font is Instrument Sans 16px with `-webkit-font-smoothing: antialiased`.
- Content wrapper: `max-width: 1240px`, centered, side padding `clamp(16px, 4vw, 48px)`.
- The prototypes size things with container-query units (`cqw`) measured against the full-width page root. In production, `vw` is equivalent.

### Header (all pages)
- Flex row, `space-between`, centered vertically, gap 16px, padding `16px 0`, bottom border 1px `line`.
- Left: "Jacob Troutman", 15px/600, letter-spacing -0.005em, no underline. Links to Home.
- Right: the theme toggle. A pill with a 1px `line` border, `surface` background, radius 999px, padding `6px 12px`, JetBrains Mono 12px. Its label names the mode you would switch to: "Dark mode" while the page is light, "Light mode" while it is dark. Hover sets the border to `ink`. On touch, extend the hit area to at least 44px, for example with a `::before` at `inset: -8px -4px`.

### Footer (all pages)
- Flex-wrap row, `space-between`, gap `10px 24px`, margin-top `clamp(56px, 9vw, 112px)`, padding `20px 0 40px`, top border 1px `line`. JetBrains Mono 12px in `muted`.
- Links, gap `6px 20px`: Email · LinkedIn · GitHub · Résumé (PDF).
- Right side: "Updated Oct 2026". On the company page this side instead reads "Unlisted page for {Company}. Not linked from the rest of the site.", placed on the left.

### Links
Default `a` color inherits. Hover color is `amber-ink`. Most links are underline-free rows or buttons.

### Theme
- The modes are system, light and dark. The user's choice persists in `localStorage['jt-theme']` as `'light'` or `'dark'`. With no stored value, follow `prefers-color-scheme`.
- The prototypes use CSS `light-dark()` with `color-scheme`. For production, use CSS custom properties so older browsers work and there's no flash of the wrong theme:
  ```html
  <script is:inline>
    const t = localStorage.getItem('jt-theme');
    if (t) { document.documentElement.dataset.theme = t; document.documentElement.style.colorScheme = t; }
  </script>
  ```
  ```css
  :root { --bg: #F9FAFB; /* …light tokens… */ }
  [data-theme="dark"] { --bg: #0D1013; /* …dark tokens… */ }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #0D1013; /* … */ } }
  ```

### Shared components
- **Mono label:** JetBrains Mono 11px, uppercase, letter-spacing 0.08em, `muted`.
- **Status pill:** inline-flex, gap 6px, padding `2px 8px`, radius 999px, `amber-tint` background, `amber-ink` text, JetBrains Mono 12px, with a 6×6px `amber` dot. Values are "Adopted", "Shipped" and "Live".
- **Section header:** flex row, baseline-aligned, gap 14px, padding-top 14px, top border **1px `ink`**. A mono 12px `muted` number ("01") followed by the H2.
- **P/D/O block:** padding-top 10px, top border **2px `ink`**. Mono label, then the text with margin-top 6px.
- **Primary button:** min-height 44px, padding `0 16px` (Home uses `10px 16px`), radius 8px, `ink` background, `bg`-colored text, 15px/600. Hover sets opacity to 0.88.
- **Secondary button:** same size, 1px `line` border, `ink` text. Hover sets the border to `ink`.

---

## Screens

### 1. Home (`Home-1b-DecisionLog.dc.html`)
**Purpose:** gives the pitch in 30 seconds, with proof rows a reader can expand.

**Layout:** `main` is a flex-wrap row with `align-items: flex-start`, gap `clamp(40px, 6vw, 96px)` and padding-top `clamp(32px, 6vw, 80px)`.
- **Pitch pane:** `flex: 0 1 400px`.
  - Availability line: an 8px `amber` dot and "Open to new roles", mono 12px `muted`.
  - H1, margin-top 18px: "I design software for the moment something goes wrong." (draft). Instrument Sans `clamp(34px, 4vw, 52px)`, line-height 1.04, weight 500, `font-stretch: 92%`, letter-spacing -0.028em, `text-wrap: balance`.
  - Sub-line, margin-top 18px: "Senior full-stack .NET engineer." 18px/1.45 `muted`.
  - Facts list, margin-top 28px, top border 1px `line`. Each row is a 76px / 1fr grid with gap 12px, padding `10px 0` and a bottom border 1px `line`. The label is a mono label and the value is 15px. Rows: **Stack** "C#, .NET, Blazor"; **Cloud** "Azure"; **Focus** "APIs, design systems".
  - Buttons, margin-top 28px, gap 10px: primary "Résumé (PDF)" and secondary "Email me".
- **Decision log:** `flex: 999 1 480px`.
  - Header row: a grid of `clamp(44px, 6vw, 72px)` and 1fr, column gap `clamp(8px, 1.5vw, 16px)`, padding-bottom 10px, bottom border **1px `ink`**. Mono label "ID" in `muted`, then "Decision log" in `ink`.
  - **Log row** (one per case file, bottom border 1px `line`). Build it as `<details>` with the `<summary>` as the row.
    - The summary is a grid of the ID column, 1fr and 28px, padding `20px 0`. Hover background is `hover`.
    - ID: mono 12px `muted`, padding-top 4px ("DR-01").
    - Title: `clamp(17px, 1.6vw, 19px)`, line-height 1.4, weight 500, `text-wrap: pretty`.
    - Under the title (gap 10px): the status pill, then the stack ("C# · APIs · Azure") in mono 12px `muted`.
    - Toggle: a 28×28px circle with a 1px `line` border showing "+" when closed and "−" when open, mono 14px `muted`.
    - Open panel: the same columns with the ID cell empty, padding-bottom 24px. It holds a grid of `repeat(auto-fit, minmax(170px, 1fr))` with gap `16px 24px` containing three P/D/O blocks (text 15px/1.5). Below that, margin-top 20px with gap `10px 16px`: a primary "Open the case file →" (padding `9px 14px`, 14px/600), "Try the app" as a secondary button on DR-03 only, and the read time ("8 min read") in mono 12px `muted`.
  - **Rows. Titles are verbatim; everything else is draft.**
    - **DR-01:** "Designed a POS notification service with three urgency levels, adopted as the team's standard". Adopted · C# · APIs · Azure · 8 min.
      - Problem: "Every POS alert looked the same, so the urgent ones were easy to miss."
      - Decision: "One service with three urgency levels, each with its own delivery and acknowledgement rules."
      - Outcome: "The team adopted it as the standard for new notifications."
    - **DR-02:** "Redesigned money-order printing so a failed print refunds the customer automatically". Shipped · C# · .NET · APIs · 10 min.
      - Problem: "A money order is paid for before it prints. A failed print left the customer charged with nothing in hand."
      - Decision: "Treat printing as one step in a transaction, with the refund as its compensating action."
      - Outcome: "A failed print now refunds the customer automatically, with no manual step."
    - **DR-03:** "Shipped a user-facing LLM feature: Pocket Log, a bowling analytics app". Live · Blazor · Azure · LLM · 7 min.
      - Problem: "League bowlers record scores, but the patterns behind them stay buried."
      - Decision: "Use the model for questions about your own games. Keep scoring and stats in plain, tested code."
      - Outcome: "Live, running on my league's real data. You can try it yourself."
  - **Link cards:** margin-top 48px, a grid of `repeat(auto-fit, minmax(240px, 1fr))` with gap 16px. Each card is a whole link with padding 20px, a 1px `line` border, radius 12px and `surface` background, laid out as a flex column with gap 6px. Hover sets the border to `ink`.
    - Card contents: a top row of mono label plus "→" (space-between); a title with margin-top 18px at 21px/600, letter-spacing -0.01em; and a description at 15px/1.5 `muted`.
    - Card 1: "Live app" / **Pocket Log** / "My bowling analytics app, running on my league's real data. Browse it read-only, or try the sandbox." Links to Pocket Log.
    - Card 2: "Notes" / **How I build with AI** / "Where AI speeds me up, where I don't trust it, and how I check its work."
- **Responsive:** the two panes stack below about 980px. On a phone the pitch pane comes first, then the log.

### 2. Case file (`Case-File.dc.html`, built for DR-02)
**Purpose:** long-form reading that is still easy to skim. Every section opens with a one-sentence **lede**, so reading only the ledes still gives the argument.

**Title block** (max-width 1000px, padding-top `clamp(28px, 5vw, 64px)`):
- Breadcrumb, mono 12px `muted`: "← Decision log" (links Home) / "Case file DR-02".
- Meta row, margin-top `clamp(24px, 4vw, 40px)`: "Shipped" pill, then "C# · .NET · APIs" in mono 12px `muted`.
- H1, margin-top 14px, max-width 18em: the proof line, verbatim. Instrument Sans `clamp(30px, 4.2vw, 50px)`, line-height 1.06, weight 500, stretch 92%, letter-spacing -0.028em, balance.
- **TL;DR card**, margin-top `clamp(28px, 4vw, 44px)`: padding `clamp(18px, 2.4vw, 28px)`, 1px `line` border, radius 12px, `surface` background.
  - Header row (mono label style, in `ink`): "TL;DR" on the left, "10 min read" in `muted` on the right.
  - A three-column grid, `repeat(auto-fit, minmax(200px, 1fr))`, gap `16px 28px`, margin-top 16px. It holds three P/D/O blocks (text 16px/1.5) using the same text as the Home row.
  - Facts row: margin-top 20px, padding-top 14px, top border 1px `line`, 14px text, flex-wrap with gap `8px 32px`. **Role** "Lead developer" (draft) and **Stack** "C#, .NET, REST APIs".

**Body:** a flex row with gap 64px and margin-top `clamp(40px, 6vw, 72px)`.
- **Sticky section nav (desktop, 960px and up):** `aside` 200px wide, with the inner block `position: sticky; top: 24px`.
  - Heading "On this page": mono label in `ink`, padding-bottom 10px, bottom border 1px `ink`, margin-bottom 6px.
  - Items are full-width buttons or anchor links with padding `8px 10px`, radius 6px and Instrument Sans 14px/1.35. A mono 11px number sits in a 22px column.
  - Default item: `muted` text. Active item: `hover` background, `ink` text, weight 600, number in `amber-ink`, `aria-current="true"`.
  - Labels: 01 Context · 02 Problem · 03 Options · 04 Decision · 05 Outcome · 06 What I'd tell an interviewer.
  - "↑ Back to top": mono 12px `muted`, margin-top 14px.
- **Section chips (below 960px):** replace the aside with a sticky bar at the top of the article.
  - Bar: `position: sticky; top: 0; z-index: 5`, full-bleed (negative side margins equal to the page gutter), padding `6px` plus the gutter, `bg` background, bottom border 1px `line`, horizontal scroll with the scrollbar hidden, gap 8px, margin-bottom 28px.
  - Chips: min-height 44px, padding `0 14px`, radius 999px, 14px/500. Default is a 1px `line` border with `ink` text. Active is an `ink` background with `bg`-colored text.
  - Labels: Context, Problem, Options, Decision, Outcome, Interviewer notes.
- **Article:** `flex: 1`, max-width 720px.
  - Sections are spaced `clamp(56px, 7vw, 88px)` apart.
  - Each opens with the section header, then the lede and body:
    - H2: `clamp(24px, 2.4vw, 30px)`/1.2, weight 600, letter-spacing -0.015em.
    - Lede, margin-top 20px: Instrument Sans `clamp(19px, 1.8vw, 22px)`/1.45, weight 500, letter-spacing -0.005em.
    - Body paragraphs, margin-top 16px: 18px/1.65, `text-wrap: pretty`.
  - **Reading face:** body text inherits from the article wrapper. The default is Instrument Sans and the alternative is Source Serif 4, which Jacob is still deciding between. Headings, ledes, labels and code always keep their own faces.

**Section content (all draft):**
1. **Context.**
   - Lede: "Money orders are sold at the register and printed on a separate printer at the counter."
   - Body: "One sale touches three systems, and each can fail on its own. The register takes the payment, the provider's API issues the money order and its serial number, and the printer puts that serial on paper."
   - **Parts list**, margin-top 24px, top border 1px `line`. Rows are flex-wrap with gap `4px 16px`, padding `12px 0` and a bottom border 1px `line`. Terms are 120px wide in mono 13px; definitions are `flex: 1 1 240px`, 16px/1.5.
     - **Register:** "Point-of-sale app in C# and .NET. Takes the payment and runs the sale."
     - **Provider API:** "Issues the money order and its serial number. Requires payment first."
     - **Printer:** "Local device on the counter. Reports printed, failed, or nothing."
2. **Problem.**
   - Lede: "The old flow took the payment and issued the serial before printing, with no plan for a print that failed."
   - Body: "When the printer jammed or dropped offline mid-sale, the customer had paid and the serial was live, but nothing came out. The clerk called support, a manager voided the serial in the provider's portal, and someone refunded the customer by hand. Customers waited at the counter or came back later, and a missed void left a live serial with no paper behind it."
   - Mono label "Failure modes" at margin-top 24px, followed by a parts-style list:
     - **Failed:** "The printer reports a jam or misfeed."
     - **Offline:** "The printer can't be reached when the sale starts."
     - **Unknown:** "The print was sent and no status came back."
3. **Options.**
   - Lede: "I compared four approaches against one rule: the customer never leaves charged with nothing in hand."
   - Card grid: `repeat(auto-fit, minmax(280px, 1fr))`, gap 16px, margin-top 24px.
   - Card: padding 18px, 1px `line` border, radius 10px, `surface` background, flex column with gap 8px. It has a top row of mono labels ("Option A" on the left, the verdict on the right), a title in Instrument Sans 18px/600/1.3, and body text at 16px/1.55.
   - Cards:
     - **A. Retry the print** ("Kept, not enough"): "Clears a jam that fixes itself. It doesn't help when the printer stays down, and the customer is charged the whole time."
     - **B. Print before taking payment** ("Not possible"): "The provider only issues a serial after payment, so there is nothing to print yet."
     - **C. Keep the manual process, add a checklist** ("Rejected"): "Cheapest to ship. The customer still waits, and the void is still easy to miss."
     - **D. Undo each step when printing fails.** This is the chosen card: it has a **2px `ink` border** (padding 17px) and a "Chosen" status pill in place of the verdict. Body: "Treat the sale as a sequence of steps, each with an undo. If printing fails, void the serial, then refund the payment."
4. **Decision.**
   - Lede: "Each sale runs as a short saga: the register records every step, and every step after payment has an undo."
   - Body: "Before it calls anything, the register writes the sale to a local ledger and checks that the printer is ready, which removes the offline case before any money moves. Every call after that carries the sale's idempotency key, so a retry after a timeout can't issue a second serial or a second refund."
   - **Paths**, margin-top 28px, top border 1px `line`. Rows are flex-wrap with gap `8px 16px`, padding `12px 0` and a bottom border 1px `line`. Each row has a mono label in a 96px column, then a sequence of state chips joined by "→" in `muted`. Chips: mono 13px, padding `3px 8px`, 1px `line` border, radius 6px, `surface` background.
     - **Printed:** Started → Paid → Issued → Printed → Done
     - **Failed:** Started → Paid → Issued → **Voided** → **Refunded**. The bold chips use the amber treatment: `amber` border, `amber-tint` background, `amber-ink` text.
     - **No answer:** Started → Paid → Issued → Held → *Clerk decides*. "Clerk decides" has a 1px dashed `muted` border and no fill.
   - **Code block**, margin-top 28px.
     - Frame: 1px `line` border, radius 10px, `code-bg` background.
     - Title bar: padding `10px 16px`, bottom border 1px `line`, mono 12px `muted`. "SaleOrchestrator.cs" on the left, "simplified" on the right.
     - Body: padding `12px 0`, `overflow-x: auto`, JetBrains Mono 13px/1.75, ligatures off. Each line has padding `0 16px`. Line numbers are 2ch wide, right-aligned, `muted`, `user-select: none`, margin-right 20px. Indent is 4ch per level. Comments are `muted`.
     - **Lines 14–16 are highlighted** with an `amber-tint` background and `amber-ink` line numbers.
     - In Astro, use Shiki (`<Code>`) with a near-monochrome theme and a line-highlight transformer.
     ```csharp
     // One sale, one ledger entry. Every call reuses sale.Key.
     var sale = await ledger.StartAsync(request, ct);
     await printer.EnsureReadyAsync(ct);

     await tender.CaptureAsync(sale, ct);
     var order = await provider.IssueAsync(sale, ct);
     var print = await printer.PrintAsync(order, ct);

     switch (print.Status)
     {
         case PrintStatus.Printed:
             return await ledger.CompleteAsync(sale, ct);
         case PrintStatus.Failed:
             await provider.VoidAsync(order.Serial, sale.Key, ct);
             await tender.RefundAsync(sale, RefundReason.PrintFailed, ct);
             return await ledger.CloseAsync(sale, SaleOutcome.Refunded, ct);
         default: // no status came back
             return await ledger.HoldAsync(sale, HoldReason.AskClerk, ct);
     }
     ```
   - After the code: "The failure branch (lines 14–16) undoes the steps in reverse order. The serial is voided before the payment is refunded, so a refund never goes out for a money order that is still valid."
   - **Callout**, margin-top 32px, padding-top 14px, top border **2px `ink`**. Mono label "Edge case", then a title in Instrument Sans 19px/600, "No answer from the printer", then the body at 18px/1.65: "If the printer never reports back, the register can't tell whether paper came out. An automatic refund could hand out a valid money order for free, so the sale is held and the clerk answers one question on screen: “Did a money order print?” The answer is saved with the sale."
5. **Outcome.**
   - Lede: "A failed print now ends at the counter, with the customer refunded in the same transaction."
   - **Before/After**: a grid of `repeat(auto-fit, minmax(260px, 1fr))` with gap `20px 28px` and margin-top 24px. Each column has padding-top 12px and holds numbered items at 17px/1.5, with mono 12px numbers and gap 8px.
     - **Before:** top border 2px `line`, all text in `muted`.
       1. "Clerk calls support."
       2. "A manager voids the serial in the provider's portal."
       3. "Someone refunds the customer by hand."
     - **After:** top border 2px `ink`, numbers in `amber-ink`.
       1. "The register voids the serial."
       2. "The register refunds the payment."
       3. "The receipt shows the refund and the reason."
   - Closing body text: "The ledger also gives support a record of every failed print, with the printer's last reported status."
6. **What I'd tell an interviewer.** A card with padding `clamp(20px, 3vw, 32px)`, a 1px `line` border, radius 12px and `surface` background. Its section header has no top rule.
   - Items: a grid of 28px / 1fr with gap 12px, padding-top 16px and a top border 1px `line`. The number is mono 13px `amber-ink`. The point is Instrument Sans 19px/600/1.35, followed by a 17px/1.6 detail.
     1. "Most of the work was deciding what “failed” means." / "The refund itself is a few lines of code. The unknown print status took most of the design time, and it's the part I'd walk through on a whiteboard."
     2. "Idempotency keys mattered more than the saga." / "Double charges come from retries and timeouts. One key per sale, passed to every call, closed that off."
     3. "I'd design the ledger first next time." / "It started as a debugging log and became what support relies on. Designing it up front would have saved rework."

**Next case file link:** margin-top `clamp(56px, 7vw, 88px)`, padding `20px 0`, top border 1px `ink`, bottom border 1px `line`, a grid of 1fr and auto. It shows the mono label "Next case file · DR-01", the DR-01 title at 18px/500, and "→" in mono 18px `muted`. Hover background is `hover`.

### 3. Company page (`Company-Page.dc.html`; set the company through the `company` prop, default "Contoso")
**Purpose:** a page tailored to one application. Sections appear in this order: the 30-second summary, the evidence (linking to case files), the first 90 days, and Jacob's questions for the company.

**Layout:** same two-pane flex-wrap as Home, with gap `clamp(40px, 6vw, 96px)` and padding-top `clamp(32px, 6vw, 80px)`.
- **Pitch pane** (`flex: 0 1 380px`). At 1040px and wider, the inner block is `position: sticky; top: 32px`. Below that, it isn't sticky.
  - "Unlisted" chip (1px `line` border, radius 999px, padding `2px 8px`) followed by "Prepared for {Company} · Oct 2026", all mono 12px `muted`.
  - H1, margin-top 18px: "Why I fit {Company}", `clamp(36px, 4.4vw, 56px)`/1.02, weight 500, stretch 92%, letter-spacing -0.028em.
  - Role line, margin-top 16px: "For the Senior .NET Engineer role on your payments platform team." 18px/1.45 `muted`.
  - Buttons, margin-top 28px: primary "Email me" and secondary "Résumé (PDF)".
- **Content** (`flex: 999 1 480px`): four sections spaced `clamp(56px, 7vw, 88px)` apart. Each uses the section header with an H2 of `clamp(22px, 2.2vw, 28px)`.
  1. **The 30-second summary.**
     - Statement, margin-top 20px, max-width 34em, `clamp(20px, 2vw, 24px)`/1.4, weight 500: "You're hiring a senior .NET engineer to build payment services on Azure. That's the work I do now: C# services for point-of-sale software, designed around what happens when a step fails."
     - **Requirements matrix**, margin-top 28px. The header row is a 1.3fr / 1fr grid with mono labels "Your posting asks for" and "Where I've done it", and a bottom border 1px `ink`. Each row has padding `12px 0` and a bottom border 1px `line`; the requirement is 16px/1.4, and the case IDs are mono 12px chips (1px `line` border, radius 6px, padding `2px 8px`).
       - C# and .NET services → DR-01, DR-02
       - Blazor front ends → DR-03
       - Azure → DR-01, DR-03
       - API design → DR-01, DR-02
       - Shipping LLM features → DR-03
  2. **My evidence.** These are log rows as on Home, but each is a whole-row link that doesn't expand.
     - Row: a grid of `clamp(44px, 6vw, 64px)`, 1fr and auto, padding `20px 0`, bottom border 1px `line`, hover background `hover`.
     - Contents: the ID; the title; a relevance line at 16px/1.5 `muted` that starts with "For {Company}:" in 600 `ink`; a meta line ("Case file · 8 min · C# · APIs · Azure") in mono 12px `muted`; and "→".
     - Relevance lines (draft):
       - DR-01: "your platform sends alerts with very different stakes. This is how I made sure the urgent ones get seen."
       - DR-02: "payments fail halfway through. This is how I handle a step that fails after the customer has paid."
       - DR-03: "how I ship an LLM feature to real users, and what I keep out of the model."
  3. **First 90 days.**
     - A grid of `repeat(auto-fit, minmax(200px, 1fr))` with gap `24px 28px` and margin-top 24px.
     - Each column has padding-top 12px and a top border 2px `ink`. It shows a mono label for the days, a title at 19px/600 with margin-top 6px, and a list at 15px/1.5 with a mono "–" in `muted`, gap 10px.
     - Columns:
       - **Days 1–30 · Learn:** Ship a small fix to production in the first two weeks. · Read the incident history for the services I'll own. · Shadow on-call before joining the rotation.
       - **Days 31–60 · Contribute:** Take one feature from design review to release. · Write a decision record for it that the team can review.
       - **Days 61–90 · Own:** Join the on-call rotation for my services. · Propose one improvement, with the trade-offs written down.
  4. **My questions for you.**
     - An ordered list. Each item is a grid of the ID column and 1fr, padding `18px 0`, bottom border 1px `line`. "Q1" to "Q4" are mono 12px `amber-ink`; questions are `clamp(18px, 1.8vw, 21px)`/1.4, weight 500.
     - Questions:
       - What does a bad day look like for the services this role owns?
       - How does the team write down and review design decisions?
       - Where do you plan to use LLMs, and where have you decided not to?
       - Six months in, what would tell you this hire worked?

### 4. Pocket Log (`Pocket-Log.dc.html`)
**Purpose:** the live app, embedded under a mode banner.

**Intro:**
- Breadcrumb: "← Decision log" / "Pocket Log".
- Below it, margin-top `clamp(20px, 3vw, 32px)`, a flex-wrap row aligned to the bottom (`flex-end`), `space-between`, gap `16px 40px`.
  - Left side (`flex: 1 1 420px`):
    - Status row: "Live" pill, then "Blazor · Azure · LLM".
    - H1 "Pocket Log", margin-top 12px, `clamp(34px, 4.4vw, 52px)`/1.02, weight 500.
    - Description, margin-top 12px, max-width 36em, 17px/1.5 `muted`: "My bowling analytics app, running on my league's real data. Browse it read-only, or try the sandbox."
  - Right side: a secondary button "Read the case file" followed by "DR-03" in mono 12px `muted`.

**Mode banner** (the brief's copy, verbatim):
- Container: `position: sticky; top: 8px; z-index: 10`, margin-top `clamp(24px, 4vw, 40px)`, flex-wrap, centered vertically, `space-between`, gap `10px 16px`, padding `10px 10px 10px 16px`, radius 12px.
- **Read-only state:** 1px `line` border, `surface` background, an 8px `ink` dot, and the text **"Viewing Jacob's real league data (read-only)"** at 16px/500/1.4. The segmented control sits on the right.
- **Sandbox state:**
  - 1px `amber` border, `amber-tint` background, an 8px `amber` dot, and the text **"Sandbox: your changes stay in your browser"**.
  - Change count in mono 12px `amber-ink`: "No changes", "1 change" or "N changes". For 2.4 seconds after a reset it reads "Reset to Jacob's data".
  - **Reset** button: min-height 36px, padding `0 14px`, 1px `amber` border, radius 8px, `surface` background, 14px/600. Hover sets the border to `ink`.
  - The segmented control's container border becomes `amber`.
- **Segmented control** ("Real data" | "Sandbox"):
  - Container: inline-flex, padding 3px, 1px `line` border, radius 999px, `bg` background.
  - Segments: min-height 36px, with the touch area extended to 48px through a `::before` at `inset: -7px 0`. Padding `0 14px`, radius 999px, 14px/600.
  - Active segment: `ink` background, `bg`-colored text, `aria-pressed="true"`. Inactive segment: transparent, with a `hover` background on hover.
- Use one persistent `role="status"` element whose text changes, so screen readers announce the mode switch.

**App frame:**
- Frame: margin-top 12px, 1px `line` border, radius 12px, `surface` background, `overflow: hidden`.
- Top strip: padding `10px 16px`, bottom border 1px `line`, mono label style. Left: "Stand-in · the Pocket Log app mounts here". Right: the data source, "Data: league snapshot" in read-only and "Data: this browser" in sandbox.
- The real app replaces the stand-in content below the strip. The stand-in only demonstrates how the two modes behave:
  - A "Tuesday league" heading (22px/600).
  - Stats in mono 28px/500 with tabular numbers: Average (truncated, as bowling averages are), High game and High series.
  - A table of league nights with columns Night, G1, G2, G3 and Series. Rows are a grid of `minmax(56px, 1.3fr)`, `repeat(3, minmax(44px, 1fr))` and `minmax(52px, 1fr)`, with gap 8px.
  - In sandbox the score cells become inputs: 44px tall, mono 15px, right-aligned, digits only, 0–300. Edited cells get an `amber` border and `amber-tint` fill. There is also a "+ Add a night" button.
  - In read-only the cells are plain text, with the hint "Switch to Sandbox to edit scores or add a night."
- Footnote, mono 12px `muted`, margin-top 14px: "Sandbox data is saved in this browser's local storage and never sent anywhere. Reset restores my real data."

---

## Interactions & behavior
- **Theme toggle:** flips between light and dark and writes `jt-theme`. It applies site-wide on the next page load.
- **Home rows:** each row opens on its own, and several can be open at once. There is no animation in the prototype. If you add one, keep it to height and opacity at 150–200ms ease-out, and disable it under `prefers-reduced-motion`.
- **Hover states:** rows and the next-case link get a `hover` background; link cards and secondary buttons get an `ink` border; primary buttons drop to 0.88 opacity; text links turn `amber-ink`.
- **Case file scroll-spy:**
  - The active section is the last one whose top edge has passed 140px from the viewport top (160px on mobile, below the chips bar). At the bottom of the page, the last section is active.
  - Clicking a nav item smooth-scrolls with an offset of 24px on desktop and 76px on mobile, which clears the chips bar. Add `scroll-margin-top` to sections so plain anchor links also land correctly.
- **Pocket Log modes:**
  - Default mode is read-only. Consider `?mode=sandbox` for deep links.
  - Read-only never writes storage.
  - In sandbox, the first edit clones the snapshot into browser storage, and every edit saves. The prototype uses `localStorage['jt-pocketlog-sandbox']`; IndexedDB is fine for real data sizes.
  - Reset deletes the sandbox data and restores the snapshot. It needs no confirmation, because nothing of value is lost.
  - Switching back to read-only keeps the sandbox data for next time.

## State
| State | Where | Values / notes |
|---|---|---|
| `theme` | global | `system` \| `light` \| `dark`; persisted as `jt-theme` |
| row open/closed | Home | native `<details open>` |
| `activeSection` | Case file | section id; derived from scroll |
| `mode` | Pocket Log | `real` \| `sandbox` |
| `sandboxData` | Pocket Log | cloned snapshot plus edits; persisted in browser storage |
| `changeCount` | Pocket Log | derived from the diff between snapshot and sandbox (an added night counts as 1) |
| `resetFlash` | Pocket Log | boolean, 2.4s |

**Data:** the read-only snapshot of Jacob's league data can be a static JSON file generated at build time, or an API call from the island.

---

## Design tokens

### Colors (OKLCH source values, with sRGB hex)
| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | oklch(0.985 0.002 250) `#F9FAFB` | oklch(0.17 0.008 255) `#0D1013` | page background, text on ink buttons |
| `ink` | oklch(0.21 0.012 255) `#15191E` | oklch(0.95 0.004 255) `#EDEFF1` | text, primary buttons, strong rules |
| `muted` | oklch(0.5 0.012 255) `#5F646A` | oklch(0.7 0.01 255) `#9A9FA5` | secondary text, labels, line numbers |
| `line` | oklch(0.905 0.005 255) `#DDE0E3` | oklch(0.3 0.01 255) `#2A2E33` | hairlines and borders |
| `hover` | oklch(0.97 0.003 250) `#F4F5F7` | oklch(0.215 0.01 255) `#161A1E` | row hover, active nav item |
| `surface` | oklch(1 0 0) `#FFFFFF` | oklch(0.205 0.01 255) `#14171C` | cards, TL;DR, banner, app frame |
| `code-bg` | oklch(0.97 0.003 250) `#F4F5F7` | oklch(0.205 0.01 255) `#14171C` | code block |
| `amber` | oklch(0.7 0.15 60) `#E18528` | oklch(0.78 0.14 65) `#F4A34B` | dots, sandbox border, edited cells |
| `amber-tint` | oklch(0.95 0.035 70) `#FEEBD6` | oklch(0.3 0.05 60) `#402712` | pills, highlights, sandbox banner |
| `amber-ink` | oklch(0.5 0.12 55) `#964D09` | oklch(0.82 0.12 65) `#FAB36D` | pill text, link hover, accent numbers |

Measured contrast (WCAG):
- `ink` on `bg`: 16.97 light / 16.52 dark
- `muted` on `bg`: 5.74 / 7.16
- `muted` on `surface`: 5.99 / 6.71
- `amber-ink` on `amber-tint`: 5.39 / 7.73
- `amber-ink` on `bg`: 5.99 / 10.70

Amber is the only accent. Use it for status and change, never for decoration.

### Typography
- **Instrument Sans** (variable, wdth 75–100, wght 400–700) for headings, UI and the default body.
- **JetBrains Mono** (400, 500) for every label, ID, number, meta line and code sample.
- **Source Serif 4** (optional): the alternative reading face for case file body text only.

| Role | Size | Weight | Line height | Tracking | Notes |
|---|---|---|---|---|---|
| H1 Home | clamp(34px, 4vw, 52px) | 500 | 1.04 | -0.028em | stretch 92%, balance |
| H1 Case file | clamp(30px, 4.2vw, 50px) | 500 | 1.06 | -0.028em | max-width 18em |
| H1 Company / Pocket Log | clamp(36px, 4.4vw, 56px) / clamp(34px, 4.4vw, 52px) | 500 | 1.02 | -0.028em | stretch 92% |
| H2 Case file / Company | clamp(24px, 2.4vw, 30px) / clamp(22px, 2.2vw, 28px) | 600 | 1.2 | -0.015em | |
| Lede | clamp(19px, 1.8vw, 22px) | 500 | 1.45 | -0.005em | always sans |
| Case body | 18px | 400 | 1.65 | 0 | reading face |
| Log row title | clamp(17px, 1.6vw, 19px) | 500 | 1.4 | 0 | |
| Card title | 21px / 18px (option) | 600 | 1.3 | -0.01em | |
| UI text | 15–16px | 400 | 1.5 | 0 | |
| Mono label | 11px mono | 400 | — | 0.08em | uppercase |
| Mono meta | 12px mono | 400 | — | 0 | |
| Code | 13px mono | 400 | 1.75 | 0 | ligatures off |
| Stat value | 28px mono | 500 | — | 0 | tabular-nums |

Use `text-wrap: pretty` on paragraphs and `balance` on H1s.

### Spacing
- Base steps are 4px, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48 and 64.
- Fluid values:
  - Page gutter: clamp(16px, 4vw, 48px)
  - Section rhythm: clamp(56px, 7vw, 88px)
  - Pane gap: clamp(40px, 6vw, 96px)
  - Top of page: clamp(28–32px, 5–6vw, 56–80px)
- Maximum widths: page 1240px, case article 720px, case title block 1000px.

### Radii, borders, shadows
- **Radii:** 6px for chips, inputs and nav items; 8px for buttons; 10px for option cards and the code block; 12px for cards, the TL;DR, the banner and the app frame; 999px for pills, the theme toggle, the segmented control and mobile chips.
- **Borders:**
  - 1px `line` for hairlines.
  - 1px `ink` to start sections and list headers.
  - 2px `ink` on the top of P/D/O blocks, 90-day columns, stats and callouts, and around the chosen option.
  - 2px `line` on the top of the "Before" column.
- **Shadows:** none.

### Breakpoints
These were JS-measured in the prototype. Use media queries in production.
- **960px:** case file nav switches between the rail and the chips.
- **1040px:** the company pitch pane becomes sticky.
- **About 980px:** the Home and Company panes stack, which happens naturally through the flex bases.

## Accessibility
- Visible focus rings are required on every interactive element. The prototypes don't style focus, so use the browser default or a 2px `amber` outline with a 2px offset.
- Touch targets are at least 44px. Small pills and toggles extend their hit area with a pseudo-element.
- Use `aria-current` on the active nav item, `aria-pressed` on the segments, `aria-label` on each score input (for example "Oct 27, game 1"), and `aria-hidden` on decorative arrows.
- Honor `prefers-reduced-motion` for smooth scrolling.

## Assets
There are no images, icons or illustrations. The only glyphs are text (→ ← ↑ + − ·). The fonts come from Google Fonts in the prototype; self-host them in production.

## Files
| File | Screen |
|---|---|
| `Home-1b-DecisionLog.dc.html` | Home |
| `Case-File.dc.html` | Case file (DR-02); props: `theme`, `readingFace` (`sans` \| `serif`) |
| `Company-Page.dc.html` | Company page; props: `theme`, `company` |
| `Pocket-Log.dc.html` | Pocket Log; props: `theme`, `mode` (`real` \| `sandbox`) |
| `support.js` | runtime the `.dc.html` files need to open locally |

Not designed yet: the DR-01 and DR-03 case files (reuse the case file template) and the "How I build with AI" page.
