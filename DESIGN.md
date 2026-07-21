# VECK Design System

The system as it exists in code, inferred from `app/globals.css`, `tailwind.config.js`, and the 14
primitives in `components/ui/`. This is a description of current practice, not an aspiration — if a
rule here and the code disagree, the code is right and this file needs updating.

VECK is an internal operations tool used all day by sales, purchase and marketing staff. The visual
language follows from that: dense, quiet, and legible over long sessions, with colour reserved for
status rather than decoration.

## Colour tokens

Every colour is an HSL triplet on a CSS custom property, consumed through Tailwind as
`bg-primary`, `text-muted-foreground`, and so on. **Never hard-code a hex value in a component** —
that is what breaks dark mode.

Each token is a `--x` / `--x-foreground` pair: the second is the guaranteed-legible text colour on
top of the first. Use them together.

| Token | Light | Role |
|---|---|---|
| `--background` / `--foreground` | Arctic White `#FBFCFE` / Slate Charcoal `#1F2D3D` | Page surface and body text |
| `--card` / `--card-foreground` | `#FFFFFF` / Slate Charcoal | Raised panels — every `Card` |
| `--border` | Cloud Gray `#E3E8EF` | Hairlines, input borders, dividers |
| `--muted` / `--muted-foreground` | `210 40% 96%` / `215 16% 47%` | Secondary surfaces, labels, placeholder text |
| `--primary` / `--primary-foreground` | Refined Navy `#0F4C81` / white | Primary actions, active nav, brand |
| `--secondary` / `--secondary-foreground` | `210 40% 94%` / Slate | Lower-emphasis buttons |
| `--accent` | Pacific Edge `#3C82D9` | Interactive accents |
| `--highlight` | Electric Azure `#4BA4F0` | Emphasis; becomes `--primary` in dark mode |
| `--success` / `--success-foreground` | `160 84% 30%` / white | Completion, won deals, healthy SLA |
| `--warning` / `--warning-foreground` | `38 92% 40%` / white | Caution that is not an error — SLA nearing breach, sequence skipped |
| `--destructive` / `--destructive-foreground` | `0 72% 51%` / white | Deletion, breach, validation failure |
| `--ring` | `212 68% 54%` | Focus ring |
| `--radius` | `0.5rem` | Corner radius for cards, inputs, buttons |

### Semantic discipline

`--warning` and `--destructive` are not interchangeable. Warning means *proceed with awareness*
(a stage skip, an SLA at 80%). Destructive means *something failed or will be lost* (a breach, a
delete). Using destructive for a merely unusual action trains people to ignore red.

## Dark mode

A `.dark` class on `<html>` redefines the same token names — components never branch on theme.
`components/theme-toggle.tsx` toggles the class and persists to `localStorage` under `veck-theme`;
`suppressHydrationWarning` on `<html>` covers the pre-hydration flash.

Dark is not an inversion. Two deliberate differences:

- **`--primary` becomes Electric Azure**, because Refined Navy has too little contrast on a dark
  surface.
- **`--success` and `--warning` invert their foregrounds** to dark text on a lighter chip, since the
  light-mode white-on-saturated pairing is unreadable at dark-mode luminance.

Anything written against the token pairs inherits all of this for free.

## Typography

| Role | Family | Set by |
|---|---|---|
| Body / UI | **Geist Sans** (`--font-geist-sans`) | `font-sans`, applied on `<body>` |
| Display / headings | **Space Grotesk** (`--font-display`) | `font-display` |

Base size is `text-sm` on `<body>` with `antialiased` — deliberate for a data-dense tool. Prefer
weight and colour over size for hierarchy: `text-sm font-semibold` for a section title,
`text-xs text-muted-foreground` for labels and helper text. Numbers in tables sit at `text-sm`; do
not shrink below `text-xs` anywhere.

## Component standards

The 14 primitives in `components/ui/` are the vocabulary: `badge`, `button`, `card`, `empty-state`,
`input`, `label`, `metric-card`, `modal`, `select`, `separator`, `skeleton`, `status-pill`,
`textarea`, `toast`. Compose these before writing new markup.

### Buttons

Variants `default` (primary action), `secondary`, `outline`, `ghost` (toolbar/icon), `destructive`.
Sizes `default` (h-9), `sm` (h-8), `lg` (h-11), `icon` (9×9). Hover is a uniform `hover:opacity-90`
on filled variants and `hover:bg-muted` on transparent ones.

**One `default` button per view.** Everything secondary is `outline` or `ghost`. Where an action
needs input first, the button stays `disabled` until the form is valid rather than failing on submit
— see the stage control, which disables Confirm until a reason is supplied.

### Status pills

`status-pill.tsx` maps each lead stage to a fixed colour, and the mapping is the single source of
truth — a stage's colour must mean the same thing on the table, the kanban and the detail page.
Pills are `bg-<hue>/15` with a darker text hue, and a `dark:` variant for legibility:

`New Lead` muted · `Contacted` sky · `Qualified` primary · `Quote Sent` amber ·
`Order Confirmed` emerald · `Order Closed` teal

### Inline notices

Contextual warnings render as a bordered tinted block directly beneath the control they concern —
not as a toast, which disappears before it is read:

```tsx
<p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
```

The `/40` border and `/10` fill over a `--warning` base is the established recipe; swap the token for
`destructive` when the message is an error. Two live examples are in
`components/lead-stage-control.tsx` (sequence skip, flagged disqualification).

### Forms

Labels are `text-xs uppercase text-muted-foreground`. Required-but-empty state is communicated by
disabling the submit control, with an `aria-label` naming the requirement (e.g.
`"Reason for skipping the usual sequence (required)"`) so it reaches screen readers. Validation
errors surface as `text-sm text-destructive` beneath the field. Zod schemas in `lib/validation.ts`
are shared with the API, so client and server never disagree about what is valid.

### Permission-aware UI

Wrap any control the user may not be allowed to use in `PermissionGate`:

```tsx
<PermissionGate permission="leads:edit">…</PermissionGate>
```

It hides rather than disables, so users are not shown affordances they cannot use. This is a UX
convenience only — the API enforces the same permission independently, and the gate is never the
security boundary.

### Loading and empty states

Use `skeleton` for content whose shape is known, and `empty-state` for a genuinely empty collection —
an empty table body reads as a bug. Never leave a bare "Loading…" string where a skeleton fits.

## Layout

Persistent left sidebar (collapsible) plus a top bar with search, notifications, theme toggle and
profile menu. Content is a single column of `Card`s; related pairs sit in
`grid grid-cols-1 gap-6 lg:grid-cols-2`, stacking on small screens.

Spacing uses the Tailwind scale in even steps — `gap-2` within a control group, `gap-6` between
cards. Pages that own their scroll (the lead detail panel) must set a bounded height so the inner
`min-h-0` flex child scrolls instead of collapsing; see the comment in
`app/(app)/leads/[id]/page.tsx`.

## Accessibility

Non-negotiable, and cheap if done as you go:

- Every icon-only button carries an `aria-label`; every `select` that lacks a visible label carries one.
- Focus is visible via `focus:ring-2 focus:ring-primary` — never remove the outline without replacing it.
- Colour is never the only signal: the skipped-sequence timeline entry is prefixed `⚠` as well as tinted.
- Both themes must be checked; the dark-mode foreground inversions above exist because they were not,
  once.
