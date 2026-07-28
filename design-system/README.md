# VUX

The signature interface system. One visual identity across every project, with
the parts that carry meaning held constant and only the product's own colour and
voice allowed to move.

Spec and live demo: the VUX artifact (draft 06).

## Files

| File | What it is |
| --- | --- |
| `vux.css` | Every token, plus the chip, button, rail, tab and wash components. Framework-agnostic — drop it into anything that serves CSS. |
| `vux.preset.js` | Tailwind preset mapping Tailwind's names onto the same custom properties, so there is one source of truth rather than two. |

React bindings (`VuxIcon.tsx`, `useVuxWash.ts`) live in the consuming app —
`web/components/vux/` in this repo. They have to: React resolves from the app's
own `node_modules`, and a file outside it cannot import React. They are about a
hundred lines; copy them per project.

A copy of `vux.css` also sits at `YEAR2_first/mavericks/vux.css`.

## Three layers of colour

1. **The mark** — the logo. Constant, and never used as a UI colour.
2. **The product** — accent and ground. The only thing that changes per app.
3. **The state** — five hues. Constant in every product, on every platform.

The rule that holds it together: **the accent and the success colour are never
the same decision.** Systems fall apart when they are, because a green-branded
app then cannot show a success state.

## Using it

```html
<html data-product="finance" class="dark">
```

```css
@import '../design-system/vux.css';   /* must precede the Tailwind layers */
```

```ts
// tailwind.config.ts
import vux from '../design-system/vux.preset.js';
export default { presets: [vux], content: [...] };
```

Dark mode is read from three places, in increasing priority:
`prefers-color-scheme`, then `html.dark`, then `html[data-theme="dark"]`. The
class hook exists so this drops into an app that already toggles `.dark`.

## The products

| `data-product` | Accent | Display face |
| --- | --- | --- |
| `house` | near-black / near-white | Zilla Slab |
| `agriculture` | `#2E6B2A` | Zilla Slab |
| `education` | `#5B3A8E` | Aleo — softer, for screens with real reading |
| `trading` | `#7A5518` | Roboto Slab — squarer, reads as a statement |
| `coding` | `#045B62` | Space Mono — the one product where a terminal voice is honest |
| `finance` | `#7B2D6B` | Zilla Slab |
| `health` | `#12558C` | Zilla Slab |

Slab House (Zilla Slab / Poppins / IBM Plex Mono) is the universal default.

## The grounds are computed

```
paper (light) = brand  6% -> #FFFFFF
paper (dark)  = brand  9% -> #0B0D10
```

House sets the tint to 3% / 0%, which is how it lands on a soft white and a soft
near-black without being a special case in the code.

**6% and 9% are the invention.** High enough that an agriculture app reads as
green and a finance app as plum; low enough that the ground never competes with
a state colour. Past roughly 12%, coloured text starts failing contrast — which
is exactly how tinted dark modes usually go wrong. Do not raise `--vux-tint-*`
without re-running the check below.

## Adding a product hue

Every colour in here was verified before it shipped, and a new hue has to earn
the same. For each of the five state text colours plus `--vux-ink` and
`--vux-muted`, compute the WCAG contrast ratio against the light paper and the
dark ground your hue produces. All must clear **4.5:1**; aim for 5+ so there is
margin.

Current worst case in the shipped set is `success` on the finance ground at
**5.16:1**. The one deliberate exception is a disabled control at 2.41:1 — WCAG
exempts inactive elements, and a disabled control that shouts is a bug.

## State

Five hues. The **glyph** carries the specific state, so denied and error stay
distinguishable without spending two colours on them.

| Family | States |
| --- | --- |
| success | `✓` approved · `⊙` validated · `◉` done |
| attention | `◌` pending · `△` warning · `⧗` overdue |
| danger | `✕` error · `⊘` denied · `⊠` blocked |
| info | `ⓘ` notice · `✦` new |
| neutral | `⊗` cancelled · `◇` draft · `○` disabled |
| loading | `◍` working — wears the **product's** colour |

**Cancelled is not red.** It is neutral. Alarming someone over a decision they
made themselves is the most common status-colour mistake in software.

Glyphs are text, never emoji: emoji are drawn by the operating system, so the
same character is a different picture on Windows, Android and iOS.

## Buttons

One button, two voices (mono caps, or `--sentence`), five border treatments.
The house default is **notch** for the action that commits and **plain** for
everything else — one notched button per screen. If two actions both look
primary, neither is.

The colour is the action's state, not decoration: a Deny wears `vux-danger`, an
Approve wears `vux-success`. Destructive actions take the tone but not the fill —
a red-outlined Deny is legible and calm, a solid red block is a threat.

## The wash

`vux-wash` floods the viewport; `vux-wash-local` floods one card. Page scope is
for events that change the user's situation — a payment refused, a session
expiring. Using it for a failed field validation is shouting at a typo.

One pass, 1.6s, never repeated: it rises over ~350ms, holds, then drains. Above
three flashes a second is a seizure risk, and red is the colour to be most
careful with. Under `prefers-reduced-motion` the wash is skipped entirely —
**so the result must always be written somewhere too, never signalled by colour
alone.**

## Fonts

Zilla Slab 500/600/700, Poppins 400/600, IBM Plex Mono 400/500. Five files.
Every extra weight is a real cost on a Rwandan mobile connection.

Base type size is **17px, not 16** — Poppins has a modest x-height and reads
small at 16.

`vux.css` declares full fallback stacks, so nothing breaks if the fonts fail to
load. This repo loads them with a `<link>` in `app/layout.tsx` rather than
`next/font` so the build never depends on the network; switch to `next/font` if
you would rather self-host.
