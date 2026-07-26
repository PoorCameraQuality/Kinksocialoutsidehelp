# AI Agent Masterclass: Large Project Design and Complex Systems

You are building a large, complex UI system. This document teaches you how to compartmentalize, structure, and progress through a massive project without the design falling apart. This is about maintaining visual consistency, managing complexity, and building systems that scale.

---

## 1. THE CORE PROBLEM WITH LARGE PROJECTS

AI agents fail at large projects because they:
- Generate each component in isolation with no shared DNA
- Drift from the design language as the project grows
- Create inconsistent spacing, colors, and typography across files
- Can't hold the full system in context at once
- Don't establish constraints before building
- Skip the architecture and jump to pixels

The fix: **Design Tokens first. Components second. Pages last.**

---

## 2. THE DESIGN TOKEN SYSTEM

Before writing ANY component, establish your token system. This is your single source of truth. Every color, spacing value, font size, shadow, radius, and animation timing comes from tokens. Nothing is hardcoded.

### Token Architecture: Three Layers

**Layer 1: Primitive Tokens (Raw Values)**
These are context-free. They describe WHAT a value is.
```css
:root {
  /* Colors - raw palette */
  --color-gray-50: #f9fafb;
  --color-gray-100: #f3f4f6;
  --color-gray-200: #e5e7eb;
  --color-gray-300: #d1d5db;
  --color-gray-400: #9ca3af;
  --color-gray-500: #6b7280;
  --color-gray-600: #4b5563;
  --color-gray-700: #374151;
  --color-gray-800: #1f2937;
  --color-gray-900: #111827;
  --color-gray-950: #030712;

  --color-blue-50: #eff6ff;
  --color-blue-100: #dbeafe;
  --color-blue-500: #3b82f6;
  --color-blue-600: #2563eb;
  --color-blue-700: #1d4ed8;

  --color-red-500: #ef4444;
  --color-green-500: #22c55e;
  --color-amber-500: #f59e0b;

  /* Spacing - raw scale */
  --space-0: 0;
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-20: 5rem;     /* 80px */
  --space-24: 6rem;     /* 96px */
  --space-32: 8rem;     /* 128px */

  /* Typography - raw values */
  --font-family-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-family-mono: 'JetBrains Mono', 'Fira Code', monospace;
  --font-family-display: 'Cabinet Grotesk', var(--font-family-sans);

  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 1.875rem;
  --font-size-4xl: 2.25rem;
  --font-size-5xl: 3rem;

  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --line-height-tight: 1.15;
  --line-height-snug: 1.3;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.65;

  /* Shadows - raw values */
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05);
  --shadow-xl: 0 20px 25px rgba(0,0,0,0.1), 0 8px 10px rgba(0,0,0,0.04);

  /* Radius */
  --radius-none: 0;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;

  /* Timing */
  --duration-instant: 100ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 350ms;
  --duration-slower: 500ms;

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-spring: cubic-bezier(0.22, 1.5, 0.36, 1);
}
```

**Layer 2: Semantic Tokens (Contextual Meaning)**
These describe WHERE and WHY a value is used.
```css
:root {
  /* Surfaces */
  --surface-page: var(--color-gray-50);
  --surface-card: #ffffff;
  --surface-raised: #ffffff;
  --surface-overlay: rgba(0,0,0,0.5);
  --surface-sunken: var(--color-gray-100);

  /* Text */
  --text-primary: var(--color-gray-900);
  --text-secondary: var(--color-gray-500);
  --text-tertiary: var(--color-gray-400);
  --text-inverse: #ffffff;
  --text-link: var(--color-blue-600);
  --text-link-hover: var(--color-blue-700);

  /* Borders */
  --border-default: var(--color-gray-200);
  --border-muted: var(--color-gray-100);
  --border-emphasis: var(--color-gray-300);
  --border-focus: var(--color-blue-500);

  /* Interactive */
  --interactive-primary: var(--color-blue-600);
  --interactive-primary-hover: var(--color-blue-700);
  --interactive-primary-active: var(--color-blue-800);
  --interactive-secondary: var(--color-gray-100);
  --interactive-secondary-hover: var(--color-gray-200);

  /* Feedback */
  --feedback-success: var(--color-green-500);
  --feedback-warning: var(--color-amber-500);
  --feedback-error: var(--color-red-500);
  --feedback-info: var(--color-blue-500);

  /* Spacing semantic */
  --spacing-page-x: var(--space-6);
  --spacing-page-y: var(--space-8);
  --spacing-section: var(--space-16);
  --spacing-card-padding: var(--space-6);
  --spacing-inline: var(--space-2);
  --spacing-stack-sm: var(--space-2);
  --spacing-stack-md: var(--space-4);
  --spacing-stack-lg: var(--space-8);

  /* Typography semantic */
  --type-display: var(--font-size-4xl);
  --type-heading-1: var(--font-size-3xl);
  --type-heading-2: var(--font-size-2xl);
  --type-heading-3: var(--font-size-xl);
  --type-body: var(--font-size-base);
  --type-body-sm: var(--font-size-sm);
  --type-caption: var(--font-size-xs);

  /* Elevation */
  --elevation-card: var(--shadow-sm);
  --elevation-dropdown: var(--shadow-lg);
  --elevation-modal: var(--shadow-xl);
  --elevation-tooltip: var(--shadow-md);

  /* Radius semantic */
  --radius-button: var(--radius-md);
  --radius-card: var(--radius-lg);
  --radius-input: var(--radius-md);
  --radius-modal: var(--radius-xl);
  --radius-badge: var(--radius-full);

  /* Transition semantic */
  --transition-button: var(--duration-fast) var(--ease-out);
  --transition-card: var(--duration-normal) var(--ease-out);
  --transition-modal: var(--duration-slow) var(--ease-out);
}
```

**Layer 3: Component Tokens (Specific to Components)**
```css
:root {
  /* Button */
  --button-height-sm: 32px;
  --button-height-md: 40px;
  --button-height-lg: 48px;
  --button-padding-x: var(--space-4);
  --button-font-size: var(--font-size-sm);
  --button-font-weight: var(--font-weight-medium);
  --button-radius: var(--radius-button);

  /* Input */
  --input-height: 40px;
  --input-padding-x: var(--space-3);
  --input-font-size: var(--font-size-base);
  --input-border-color: var(--border-default);
  --input-border-color-focus: var(--border-focus);
  --input-radius: var(--radius-input);

  /* Card */
  --card-padding: var(--spacing-card-padding);
  --card-radius: var(--radius-card);
  --card-shadow: var(--elevation-card);
  --card-border: 1px solid var(--border-default);
}
```

### Dark Mode via Token Swap
```css
[data-theme="dark"] {
  --surface-page: var(--color-gray-950);
  --surface-card: var(--color-gray-900);
  --surface-raised: var(--color-gray-800);
  --surface-sunken: #000000;

  --text-primary: var(--color-gray-100);
  --text-secondary: var(--color-gray-400);
  --text-tertiary: var(--color-gray-500);

  --border-default: var(--color-gray-700);
  --border-muted: var(--color-gray-800);

  --interactive-primary: var(--color-blue-500);
  --interactive-primary-hover: var(--color-blue-400);

  --elevation-card: none; /* use borders instead in dark mode */
  --card-border: 1px solid var(--color-gray-700);
}
```

---

## 3. COMPONENT ARCHITECTURE

### Component Hierarchy
Build in this order. Each layer depends only on layers below it.

```
┌─────────────────────────────────────────────┐
│  PAGE TEMPLATES                             │  <- Assembled from composites
│  (Dashboard, Settings, Profile, etc.)       │
├─────────────────────────────────────────────┤
│  COMPOSITE COMPONENTS                       │  <- Assembled from base
│  (Header, Sidebar, Forms, Cards, Tables)    │
├─────────────────────────────────────────────┤
│  BASE COMPONENTS                            │  <- Atomic, reusable
│  (Button, Input, Badge, Avatar, Tooltip)    │
├─────────────────────────────────────────────┤
│  DESIGN TOKENS                              │  <- Foundation
│  (Colors, Spacing, Typography, Shadows)     │
└─────────────────────────────────────────────┘
```

### Base Component Inventory
Every large project needs these base components built first:

**Inputs:**
- Button (primary, secondary, ghost, destructive, icon-only)
- Text Input (with label, helper text, error state)
- Textarea
- Select / Dropdown
- Checkbox
- Radio
- Toggle/Switch
- Slider

**Display:**
- Badge / Tag
- Avatar (image, initials, fallback icon)
- Card
- Tooltip
- Divider/Separator

**Feedback:**
- Toast / Notification
- Alert / Banner
- Progress Bar
- Spinner / Loading
- Skeleton

**Overlay:**
- Modal / Dialog
- Dropdown Menu
- Popover
- Command Palette

**Navigation:**
- Tabs
- Breadcrumbs
- Sidebar Nav
- Pagination

### Component API Pattern
Every component should accept:
- `variant` (visual style: primary, secondary, ghost, etc.)
- `size` (sm, md, lg)
- `disabled` (boolean)
- `className` (for overrides, use sparingly)
- Component-specific props

Example button contract:
```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: ReactNode;
  onClick?: () => void;
}
```

---

## 4. FILE AND FOLDER ORGANIZATION

### For a React/Next.js Project
```
src/
├── tokens/
│   ├── colors.css          # Primitive color tokens
│   ├── spacing.css         # Primitive spacing tokens
│   ├── typography.css      # Primitive type tokens
│   ├── shadows.css         # Primitive shadow tokens
│   ├── semantic.css        # Semantic token mappings
│   └── index.css           # Imports all token files
│
├── components/
│   ├── base/               # Atomic components
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.module.css (or styled)
│   │   │   └── index.ts
│   │   ├── Input/
│   │   ├── Badge/
│   │   ├── Avatar/
│   │   ├── Card/
│   │   ├── Modal/
│   │   ├── Toast/
│   │   ├── Tooltip/
│   │   └── Skeleton/
│   │
│   ├── composite/          # Assembled from base
│   │   ├── Header/
│   │   ├── Sidebar/
│   │   ├── DataTable/
│   │   ├── Form/
│   │   ├── SearchBar/
│   │   └── UserMenu/
│   │
│   └── layout/             # Page structure
│       ├── AppShell/        # Main app wrapper (sidebar + content)
│       ├── PageHeader/
│       └── Section/
│
├── pages/ (or app/)        # Route-level pages
│   ├── dashboard/
│   ├── settings/
│   └── profile/
│
├── hooks/                  # Shared React hooks
├── utils/                  # Shared utilities
├── types/                  # TypeScript types
└── styles/
    └── globals.css         # Reset, token imports, global styles
```

### Key Rules
- Every component gets its own folder
- Every component folder has an index.ts barrel export
- Tokens are NEVER defined inside components. Always imported from tokens/
- Components import from base/, never from each other's internals
- No circular dependencies

---

## 5. PROGRESSIVE DISCLOSURE FOR COMPLEX UIs

Complex systems have too much information for one screen. Use progressive disclosure to manage density.

### Levels of Disclosure

**Level 1: Overview** -- Show summary data. Cards, KPIs, charts.
```
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│ $42K │ │ 1.2K │ │ 89%  │ │ 24   │
│ Rev  │ │Users │ │ NPS  │ │Tasks │
└──────┘ └──────┘ └──────┘ └──────┘
```

**Level 2: Drill-down** -- Click a card to see the detail table, chart, or list.

**Level 3: Detail** -- Click a row to see full record with all fields.

**Level 4: Edit/Action** -- Modal or inline editing for specific fields.

### Patterns for Managing Density

**Collapsible sections:**
```
▼ General Settings
    Field 1: value
    Field 2: value

▶ Advanced Settings (collapsed by default)

▶ Danger Zone (collapsed, red header)
```

**Tabs for parallel content:**
```
[Overview] [Activity] [Settings] [Members]
```

**Side panel for detail:**
Click a row in a table, detail opens in a right panel without leaving the list.

**Filters and search:**
For tables with 50+ rows, always provide filtering and search at the top.

---

## 6. DASHBOARD DESIGN

### Dashboard Layout Principles
- Most important metric: top-left (largest card)
- Use a bento grid for visual variety
- Every chart needs a title, value, and trend indicator
- Don't show more than 6-8 KPI cards. Prioritize.
- Charts should have clear labels, not require a legend to decode.
- Use consistent chart colors across the dashboard.

### KPI Card Anatomy
```
┌───────────────────────────┐
│  Revenue         ↗ +12%  │  <- title + trend
│  $42,580                  │  <- primary value (large)
│  vs $38,100 last month    │  <- comparison (small, muted)
│  ▁▂▃▅▆▇█▇▅▃▂             │  <- sparkline (optional)
└───────────────────────────┘
```

### Chart Color Palettes (Use in Order)
```
Single metric: use accent color
Two metrics: accent + muted accent
Multi-series (use these in order):
  #3b82f6  (blue)
  #8b5cf6  (purple)
  #ec4899  (pink)
  #f59e0b  (amber)
  #10b981  (emerald)
  #6366f1  (indigo)
```

---

## 7. MULTI-STEP WORKFLOWS AND WIZARDS

### Wizard Pattern
```
Step 1          Step 2          Step 3          Step 4
  ●───────────────○───────────────○───────────────○
 Setup          Configure       Review          Complete
```

Rules:
- Show progress (step indicator at top)
- Maximum 5-7 steps. If more, break into sub-sections.
- Each step validates before proceeding (don't let users skip ahead to broken states)
- Back button always available
- Summary/review step before final submit
- Save progress so users can return later
- Show what's next (step names visible, not just numbers)

### Step Indicator Component
```
┌──────────────────────────────────────────────────┐
│  ● Setup  ─────  ● Configure  ─────  ○ Review   │
│  (done)            (current)          (pending)  │
└──────────────────────────────────────────────────┘
```
- Completed steps: filled circle, accent color
- Current step: filled circle, accent color, bold label
- Pending steps: outlined circle, muted color
- Connecting lines: solid for completed, dashed or muted for pending

---

## 8. TABLE DESIGN FOR COMPLEX DATA

### Table Anatomy
```
┌─────────────────────────────────────────────────────────┐
│ [☐]  Name ▲       Status      Role        Last Active  │ <- header
├─────────────────────────────────────────────────────────┤
│ [☐]  Alice Chen   ● Active    Admin       2 min ago    │ <- row
│ [☐]  Bob Kim      ● Active    Editor      1 hour ago   │
│ [☐]  Carol Lee    ○ Invited   Viewer      --           │
├─────────────────────────────────────────────────────────┤
│ Showing 1-10 of 247          [◀ 1 2 3 4 5 ... 25 ▶]   │ <- footer
└─────────────────────────────────────────────────────────┘
```

### Table Rules
- Header row: sticky, slightly darker background, font-weight 500-600
- Row height: 40-52px
- Hover state: subtle background tint
- Selected rows: accent background tint
- Sortable columns: show sort indicator (▲/▼)
- Resizable columns: drag handle between header cells
- Checkbox column: 40px wide, aligned with row checkbox
- Action column: right-aligned, shows on row hover or always visible
- Zebra striping: optional (alternating row backgrounds)
- Cell padding: 12-16px horizontal, 8-12px vertical
- Border: bottom border on rows, or full grid for dense data
- Empty table: show empty state with helpful message and CTA

### Responsive Table Strategies
- Horizontal scroll with frozen first column
- Card view on mobile (each row becomes a card)
- Priority columns: hide less important columns first

---

## 9. MAINTAINING CONSISTENCY AT SCALE

### The Consistency Audit
When working on a large project, periodically check:

1. **Color drift**: Are any hardcoded hex values outside the token system?
2. **Spacing inconsistency**: Are components using arbitrary px values instead of the spacing scale?
3. **Typography variance**: Are there font-sizes that don't match the type scale?
4. **Component duplication**: Are there two different button styles that should be one?
5. **Animation inconsistency**: Are transitions using different durations/easings?
6. **Border radius mismatch**: Are some elements rounded 8px and others 10px with no semantic reason?

### Rules for AI Agents Working on Large Codebases
1. **Read the token file before writing any component.** If tokens exist, use them. If they don't, create them first.
2. **Never hardcode a value that exists as a token.** Not `#3b82f6`, use `var(--interactive-primary)`.
3. **Match existing patterns.** If the project uses 8px card padding, don't introduce 12px.
4. **Check 3 existing components before designing a new one.** Understand the project's visual language.
5. **When in doubt, use the SMALLER spacing value.** AI agents consistently over-space elements.
6. **Every new color needs justification.** Can it be an existing token? A shade of an existing palette color?

---

## 10. HOW TO COMPARTMENTALIZE AND PROGRESS

### Phase 1: Foundation (Do This First, No Exceptions)
- [ ] Define design tokens (colors, spacing, typography, shadows, radius, timing)
- [ ] Set up the token CSS file and import it globally
- [ ] Establish dark mode token overrides
- [ ] Choose fonts and load them
- [ ] Write the CSS reset / base styles
- [ ] Build the AppShell layout (sidebar + content area + header)

### Phase 2: Base Components
- [ ] Button (all variants and sizes)
- [ ] Input (text, with label/error states)
- [ ] Card (basic container)
- [ ] Badge
- [ ] Avatar
- [ ] Modal
- [ ] Toast
- [ ] Skeleton loader
- [ ] Divider

### Phase 3: Composite Components
- [ ] Header / Navigation
- [ ] Sidebar with nav items
- [ ] Data Table (sortable, selectable)
- [ ] Form layouts
- [ ] Search bar
- [ ] Dropdown / Select

### Phase 4: Page Templates
- [ ] Dashboard
- [ ] List/Index page
- [ ] Detail page
- [ ] Settings page
- [ ] Empty states for each page
- [ ] Loading states for each page
- [ ] Error states for each page

### Phase 5: Polish
- [ ] Animations and transitions
- [ ] Responsive breakpoints
- [ ] Accessibility audit (contrast, focus states, screen reader)
- [ ] Performance audit (bundle size, render performance)
- [ ] Dark mode visual QA
- [ ] Cross-browser testing

### Working in Chunks
When an AI agent receives a task in a large project:

1. **Identify the phase.** Is the token system set up? Are base components built? If not, do that first.
2. **Read existing code.** Before building, read 2-3 existing components to match patterns.
3. **Build the smallest complete thing.** Don't half-build 5 components. Fully build 1 component with all states and variants.
4. **Test at boundaries.** Check: empty state, overflowing text, dark mode, smallest screen, keyboard navigation.
5. **Document what you built.** Leave a comment or note about what tokens/patterns this component uses.

---

## 11. THEMING ARCHITECTURE

If the project supports multiple brands or themes:

```
tokens/
├── primitives/
│   ├── colors.css        # Shared primitive palette
│   └── spacing.css       # Shared spacing (usually same across themes)
├── themes/
│   ├── default/
│   │   ├── light.css     # Default light theme semantic tokens
│   │   └── dark.css      # Default dark theme semantic tokens
│   ├── brand-b/
│   │   ├── light.css     # Brand B overrides
│   │   └── dark.css
│   └── high-contrast/
│       ├── light.css     # Accessibility theme
│       └── dark.css
└── index.css             # Imports primitives + default theme
```

Theme switching:
```css
/* Applied via data attribute on <html> or <body> */
[data-theme="brand-b"][data-mode="dark"] {
  --interactive-primary: #e040fb;
  --surface-page: #120318;
  /* ... override only what differs */
}
```

---

## 12. LARGE PROJECT DESIGN CHECKLIST

### Foundation
- [ ] Token system defined (primitives, semantic, component tokens)
- [ ] CSS variables used everywhere, zero hardcoded values
- [ ] Dark mode supported via token swap
- [ ] Font files loaded and font stacks defined
- [ ] CSS reset applied
- [ ] Spacing uses the 4/8px base scale exclusively

### Components
- [ ] All base components built before any pages
- [ ] Components use tokens, never raw values
- [ ] Each component handles: default, hover, focus, active, disabled, loading, error states
- [ ] Components are responsive without media queries where possible (flex/grid)
- [ ] All components work in both light and dark mode

### Consistency
- [ ] No hardcoded colors anywhere in component files
- [ ] No arbitrary spacing values (everything from the scale)
- [ ] No one-off font sizes (everything from the type scale)
- [ ] Animation timing is consistent (uses timing tokens)
- [ ] Border radius is consistent (uses radius tokens)
- [ ] Shadows are consistent (uses elevation tokens)

### Architecture
- [ ] Components organized in base/composite/layout hierarchy
- [ ] No circular dependencies between components
- [ ] Barrel exports (index.ts) for clean imports
- [ ] Types defined for all component props

### Quality
- [ ] All text meets WCAG AA contrast (4.5:1 body, 3:1 large)
- [ ] Focus states visible on all interactive elements
- [ ] Loading, empty, and error states for every data-dependent view
- [ ] Responsive at 360px, 768px, 1024px, 1440px minimum
- [ ] Animations respect prefers-reduced-motion
