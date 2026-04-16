

# Design Modernization: Gradient Accents + Bold Style

Applies the "Gradient Accents + Bold" design system across the app with animated interactions, gradient backgrounds, colorful card accents, and hover reveals.

## Changes

### 1. Global styles (`src/styles.css`)
- Add CSS keyframes for `fade-up`, `glow-pulse`, and `float` animations
- Add utility classes: `.animate-fade-up`, `.card-glow`, `.hover-lift`
- Deepen background to `#0a0e1a`, adjust card surfaces for gradient-friendly tones
- Add a subtle radial gradient glow behind hero sections via a utility class

### 2. NavHeader (`src/components/NavHeader.tsx`)
- Gradient logo text: "Grid" white + "Arena" emerald-to-cyan gradient
- Active nav link gets a gradient underline indicator instead of background highlight
- Subtle backdrop-blur glass effect on the header bar
- Hover: nav items slide-up slightly with color transition

### 3. Homepage (`src/routes/index.tsx`)
- Hero badge: gradient background (emerald-to-teal) with border glow
- Title: "Grid" in white + "Arena" as gradient text (emerald → teal → cyan)
- Decorative gradient accent line below the title
- CTA button: gradient background (emerald → teal) with animated glow shadow on hover
- Feature cards: each card gets a unique accent color (emerald, purple, amber, cyan)
  - Gradient icon backgrounds
  - On hover: border changes to accent color, "Explore →" text fades in
  - Subtle translate-y lift on hover
- Staggered fade-up entrance animation on cards (CSS animation-delay)

### 4. Runs list (`src/routes/_authenticated/runs.index.tsx`)
- Run cards: gradient left-border accent on hover
- Hover lift effect (`translate-y-[-2px]`)
- Status badge gets a subtle glow matching its color

### 5. Batches list (`src/routes/_authenticated/batches.index.tsx`)
- Same card hover treatment as Runs
- Batch icon gets gradient coloring

### 6. StatusBadge (`src/components/StatusBadge.tsx`)
- Add a small animated dot (pulse) for "running" status
- Slightly bolder styling with gradient-tinted borders

### 7. Run detail header (`src/components/run-details/RunHeader.tsx`)
- Gradient accent on the run title
- Subtle background gradient behind the header area

### 8. Card component (`src/components/ui/card.tsx`)
- Add `transition-all duration-300` to base card class for smooth hover effects across the app

## Files touched
| File | Type |
|------|------|
| `src/styles.css` | Add animations + utility classes + darker bg |
| `src/components/NavHeader.tsx` | Gradient logo, active indicator, glass header |
| `src/routes/index.tsx` | Full hero redesign with gradients + animated cards |
| `src/routes/_authenticated/runs.index.tsx` | Card hover effects |
| `src/routes/_authenticated/batches.index.tsx` | Card hover effects |
| `src/components/StatusBadge.tsx` | Running pulse dot |
| `src/components/run-details/RunHeader.tsx` | Gradient title accent |
| `src/components/ui/card.tsx` | Base transition class |

No database changes. No new dependencies needed (recharts already installed for charts).

