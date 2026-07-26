# AI Agent Masterclass: Web Design (Desktop + Mobile-First)

You are building a website. This document teaches you to produce visually exceptional, non-template web interfaces. Follow these rules and you will surpass 95% of AI-generated websites.

---

## 1. MOBILE-FIRST IS NOT OPTIONAL

Design for 360px width FIRST. Then scale up. Never shrink a desktop layout down.

### The Mobile-First Workflow
1. Start with a single-column layout at 360px
2. Place critical CTAs above the fold
3. Make all touch targets minimum 44x44px
4. Place frequently-used elements in the bottom two-thirds of the screen (thumb reach)
5. THEN add complexity at wider breakpoints

### Breakpoint Strategy
Do NOT use device-specific breakpoints. Use content-driven breakpoints -- change the layout when it starts looking bad.

```css
/* Base: mobile (360px+) */
.container { padding: 1rem; }

/* When single-column gets too wide and content looks stretched */
@media (min-width: 640px) {
  .container { padding: 2rem; max-width: 640px; margin: 0 auto; }
}

/* When there's room for a two-column layout */
@media (min-width: 900px) {
  .grid { grid-template-columns: 1fr 1fr; gap: 2rem; }
}

/* Full desktop with sidebar potential */
@media (min-width: 1200px) {
  .grid { grid-template-columns: 1fr 1fr 1fr; }
  .container { max-width: 1200px; }
}
```

### Common Mobile-First Mistakes AI Agents Make
- Stacking three desktop columns vertically and calling it "responsive" -- this creates endless scrolling
- Using hover-only interactions with no touch alternative
- Ignoring safe areas (notch, home indicator, rounded corners)
- Making text too small on mobile (minimum 16px body text to prevent iOS zoom)
- Not testing one-handed use patterns

---

## 2. LAYOUT SYSTEMS THAT DON'T LOOK LIKE TEMPLATES

The #1 way AI-generated sites look generic: predictable symmetric grid layouts. Here's how to break that.

### Layout Vocabulary (Pick One Per Section)

**Bento Grid**: Unequal grid cells creating visual interest. Mix 1x1, 2x1, 1x2, and 2x2 cells.
```css
.bento {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: auto;
  gap: 1rem;
}
.bento-featured {
  grid-column: span 2;
  grid-row: span 2;
}
.bento-tall { grid-row: span 2; }
.bento-wide { grid-column: span 2; }
```

**Editorial/Magazine Layout**: Asymmetric columns with large whitespace.
```css
.editorial {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 4rem;
  align-items: start;
}
/* Stagger vertical alignment */
.editorial-sidebar { padding-top: 8rem; }
```

**Overlap Layout**: Elements deliberately overlapping for depth.
```css
.overlap-container { position: relative; }
.overlap-image {
  width: 60%;
  position: relative;
  z-index: 1;
}
.overlap-text {
  position: relative;
  z-index: 2;
  margin-top: -4rem;
  margin-left: 30%;
  background: var(--surface);
  padding: 2rem;
}
```

**Split Screen**: Two contrasting halves.
```css
.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
}
.split-dark { background: var(--color-dark); color: white; }
.split-light { background: var(--color-light); }
```

**Full-Bleed with Contained Content**: Content max-width inside full-width color blocks.
```css
.full-bleed {
  width: 100%;
  background: var(--accent);
}
.full-bleed-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 6rem 2rem;
}
```

### Layout Anti-Patterns to AVOID
- Three equal cards in a row (the most template-looking pattern on the internet)
- Centered everything with no visual tension
- Uniform spacing between all elements
- Hero with stock photo background + centered white text + gradient overlay
- Symmetrical feature grids

### Better Hero Section Patterns
Instead of the cliche hero, try:
- **Text-dominant hero**: Giant typography (clamp(3rem, 8vw, 8rem)) with no image, just a bold statement
- **Split hero**: Text on one side, interactive element or illustration on the other
- **Scrolling hero**: Content reveals as you scroll, with parallax layers
- **Video background hero**: Muted, looped, with overlay and minimal text
- **Asymmetric hero**: Image offset to one side with text overlapping the edge

---

## 3. COLOR THAT DOESN'T LOOK AI-GENERATED

### Stop Using These Palettes
- Purple gradient on white (the most overused AI palette)
- Blue primary + gray secondary (corporate default)
- All pastels with no contrast anchor
- Rainbow gradients

### How to Build a Real Palette

**Step 1: Choose a dominant color.** This is 60% of your visual surface area.

**Step 2: Choose an accent.** This is 10% -- buttons, links, highlights. It should contrast sharply with the dominant.

**Step 3: Fill neutral space (30%).** Warm grays (mix a tiny bit of your dominant into gray) or cool grays, never pure #808080.

**The 60-30-10 Rule in Practice:**
```css
:root {
  /* 60% - Dominant surfaces */
  --surface-primary: #0a0a0a;
  --surface-secondary: #141414;

  /* 30% - Neutral/supporting */
  --text-primary: #e8e6e3;
  --text-secondary: #a09c97;
  --border: #2a2725;

  /* 10% - Accent (the pop) */
  --accent: #ff6b35;
  --accent-hover: #ff8555;
  --accent-subtle: rgba(255, 107, 53, 0.1);
}
```

### Palette Recipes That Actually Work

**Dark Editorial** (for portfolios, agencies, luxury):
```css
--bg: #0c0c0c; --surface: #1a1a1a; --text: #e0ddd8;
--accent: #c9a96e; --accent-secondary: #8b7355;
```

**Warm Minimal** (for SaaS, tools, productivity):
```css
--bg: #faf8f5; --surface: #ffffff; --text: #2d2a26;
--accent: #e85d3a; --border: #e8e4df;
```

**Cool Professional** (for fintech, enterprise):
```css
--bg: #f0f4f8; --surface: #ffffff; --text: #1a2332;
--accent: #2563eb; --accent-secondary: #0ea5e9;
```

**Dark Tech** (for dev tools, gaming, dashboards):
```css
--bg: #0d1117; --surface: #161b22; --text: #c9d1d9;
--accent: #58a6ff; --border: #30363d;
```

**Nature/Organic** (for wellness, food, sustainability):
```css
--bg: #f5f0eb; --surface: #ffffff; --text: #2c3e2d;
--accent: #4a7c59; --accent-warm: #d4a574;
```

### Dark Mode Done Right
- Never use pure black (#000000) as a background. Use #0a0a0a to #141414.
- Never use pure white (#ffffff) text on dark backgrounds. Use #e0e0e0 to #f0f0f0.
- Reduce opacity of images slightly (opacity: 0.85) in dark mode.
- Borders should be lighter than the surface: rgba(255,255,255,0.08) to 0.12.
- Shadows in dark mode should use darker values or be replaced with subtle borders/glows.
- Accent colors may need to be slightly lighter/more saturated to maintain contrast.

### Contrast and Accessibility
- Body text: minimum 4.5:1 contrast ratio (WCAG AA)
- Large text (18px+ bold or 24px+ regular): minimum 3:1
- Interactive elements: 3:1 against adjacent colors
- Never rely on color alone to convey information
- Test with a contrast checker before shipping

---

## 4. TYPOGRAPHY THAT ELEVATES

### The Font Pairing Formula
Pick ONE display/heading font and ONE body font. That's it.

**Display + Body Pairings That Work:**
- Playfair Display + Source Sans 3 (editorial, luxury)
- Space Grotesk + DM Sans (tech, modern) -- note: use sparingly, becoming overused
- Fraunces + Inter (warm, approachable)
- Clash Display + Satoshi (bold, contemporary)
- Instrument Serif + Instrument Sans (elegant, paired family)
- Syne + General Sans (geometric, distinctive)
- Cabinet Grotesk + Switzer (clean, professional)

### Type Scale System
Use a modular scale. The 1.25 ratio (Major Third) is versatile:
```css
:root {
  --text-xs: 0.75rem;    /* 12px */
  --text-sm: 0.875rem;   /* 14px */
  --text-base: 1rem;     /* 16px */
  --text-lg: 1.25rem;    /* 20px */
  --text-xl: 1.563rem;   /* 25px */
  --text-2xl: 1.953rem;  /* 31px */
  --text-3xl: 2.441rem;  /* 39px */
  --text-4xl: 3.052rem;  /* 49px */
  --text-5xl: 3.815rem;  /* 61px */
}
```

### Fluid Typography with clamp()
Stop using fixed font sizes for headings. Use clamp() so they scale fluidly:
```css
h1 { font-size: clamp(2.5rem, 5vw + 1rem, 5rem); }
h2 { font-size: clamp(1.8rem, 3vw + 0.5rem, 3rem); }
h3 { font-size: clamp(1.3rem, 2vw + 0.5rem, 2rem); }
body { font-size: clamp(1rem, 0.5vw + 0.875rem, 1.125rem); }
```

### Line Height Rules
- Body text: 1.5 to 1.7
- Headings: 1.1 to 1.3 (tighter is more impactful)
- Large display text: 0.9 to 1.1 (negative leading for dramatic effect)
- Captions/small text: 1.4 to 1.6

### Letter Spacing
- Body text: 0 (leave default)
- ALL CAPS text: 0.05em to 0.1em (always add tracking to uppercase)
- Large headings: -0.02em to -0.03em (slight negative tracking tightens display text)
- Small text labels: 0.02em to 0.05em

### Typography Anti-Patterns
- Using more than 2 font families
- Not adjusting line-height for different sizes
- Centered body text longer than 2-3 lines
- Paragraphs wider than 65-75 characters (use max-width: 65ch)
- Using light font weights (300) for body text on screens

---

## 5. SPACING SYSTEM

Use a base-8 spacing scale. Every spacing value should be a multiple of 4 or 8:

```css
:root {
  --space-1: 0.25rem;  /* 4px */
  --space-2: 0.5rem;   /* 8px */
  --space-3: 0.75rem;  /* 12px */
  --space-4: 1rem;     /* 16px */
  --space-5: 1.5rem;   /* 24px */
  --space-6: 2rem;     /* 32px */
  --space-7: 2.5rem;   /* 40px */
  --space-8: 3rem;     /* 48px */
  --space-9: 4rem;     /* 64px */
  --space-10: 5rem;    /* 80px */
  --space-11: 6rem;    /* 96px */
  --space-12: 8rem;    /* 128px */
}
```

### Spacing Principles
- Section padding should be generous: 4rem to 8rem vertical on desktop, 2rem to 4rem on mobile
- Related elements get tighter spacing (0.5rem to 1rem)
- Unrelated groups get wider spacing (2rem to 4rem)
- Card internal padding: 1.5rem to 2rem
- Asymmetric padding creates visual interest (e.g., padding: 6rem 2rem 4rem 2rem)

---

## 6. ANIMATIONS AND TRANSITIONS

### The Golden Rules
- Keep UI transitions under 300ms
- Use ease-out for elements entering (fast start, gentle landing)
- Use ease-in for elements leaving (gentle start, fast exit)
- Only animate transform and opacity for 60fps performance
- NEVER animate width, height, top, left, margin, or padding
- Always respect prefers-reduced-motion

### Animation Timing Tokens
```css
:root {
  --duration-instant: 100ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 350ms;
  --duration-slower: 500ms;

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);       /* Snappy exit */
  --ease-in: cubic-bezier(0.55, 0, 1, 0.45);        /* Accelerate */
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);    /* Symmetric */
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1); /* Energetic overshoot */
  --ease-spring: cubic-bezier(0.22, 1.5, 0.36, 1);  /* Subtle spring */
}
```

### Micro-Interactions Library

**Button hover/press:**
```css
.btn {
  transition: transform var(--duration-fast) var(--ease-out),
              box-shadow var(--duration-fast) var(--ease-out),
              background-color var(--duration-fast) var(--ease-out);
}
.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.btn:active {
  transform: translateY(0) scale(0.98);
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
}
```

**Card hover lift:**
```css
.card {
  transition: transform 180ms ease-out, box-shadow 180ms ease-out;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}
```

**Link underline reveal:**
```css
.link {
  position: relative;
  text-decoration: none;
}
.link::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 0;
  height: 2px;
  background: var(--accent);
  transition: width var(--duration-normal) var(--ease-out);
}
.link:hover::after { width: 100%; }
```

**Fade-in on scroll (use IntersectionObserver):**
```css
.reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity var(--duration-slow) var(--ease-out),
              transform var(--duration-slow) var(--ease-out);
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
```

**Staggered entrance (children animate in sequence):**
```css
.stagger-list > * {
  opacity: 0;
  transform: translateY(16px);
  animation: stagger-in var(--duration-slow) var(--ease-out) forwards;
}
.stagger-list > *:nth-child(1) { animation-delay: 0ms; }
.stagger-list > *:nth-child(2) { animation-delay: 80ms; }
.stagger-list > *:nth-child(3) { animation-delay: 160ms; }
.stagger-list > *:nth-child(4) { animation-delay: 240ms; }
.stagger-list > *:nth-child(5) { animation-delay: 320ms; }

@keyframes stagger-in {
  to { opacity: 1; transform: translateY(0); }
}
```

**Notification pulse:**
```css
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.08); opacity: 0.85; }
}
.badge-pulse { animation: pulse 2s ease-in-out infinite; }
```

### Page Transitions
- Fade: 200-300ms crossfade between pages
- Slide: old page exits left, new enters right (300-400ms)
- Scale: zoom out old, zoom in new (250-350ms)
- Never exceed 500ms for page transitions

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 7. NAVIGATION PATTERNS

### Mobile Navigation (Beyond the Hamburger)
- **Bottom tab bar**: Best for 3-5 primary destinations. Icons + short labels. 48px minimum height.
- **Full-screen overlay**: Hamburger opens a full-screen nav with large, tappable links.
- **Slide-out drawer**: Classic side panel, but ensure it's swipeable, not just tappable.
- **Progressive disclosure**: Show top-level nav, reveal sub-nav on interaction.

### Desktop Navigation
- **Sticky nav with scroll-aware behavior**: shrink on scroll, show/hide based on scroll direction
```css
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  transition: transform 200ms ease-out, box-shadow 200ms ease-out;
}
.nav--hidden { transform: translateY(-100%); }
.nav--scrolled { box-shadow: 0 1px 0 rgba(0,0,0,0.08); }
```

- **Mega menu**: For complex sites with many categories. Show a panel with organized links on hover/click.
- **Command palette (Cmd+K)**: For power users. Search-based navigation.

---

## 8. SHADOWS AND ELEVATION

### Shadow Scale
```css
:root {
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05);
  --shadow-xl: 0 20px 25px rgba(0,0,0,0.1), 0 8px 10px rgba(0,0,0,0.04);
  --shadow-2xl: 0 25px 50px rgba(0,0,0,0.25);
}
```

### Shadow Rules
- Resting cards: shadow-sm
- Hovered cards: shadow-lg (transition the change)
- Modals/dialogs: shadow-xl or shadow-2xl
- Dropdowns: shadow-lg
- Buttons: shadow-xs resting, shadow-sm on hover
- Dark mode: use borders or subtle glows instead of shadows (shadows are invisible on dark)

---

## 9. BORDERS AND RADIUS

### Border Radius Scale
```css
:root {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;
}
```

### Rules
- Pick ONE radius and use it consistently for cards, buttons, inputs
- Buttons: 6px to 8px for professional, 9999px for pill-shaped
- Cards: 8px to 16px
- Avatars: 9999px (full circle)
- Nested elements need smaller radius than parent (if card is 12px, inner image is 8px)

---

## 10. RESPONSIVE IMAGES AND MEDIA

```html
<picture>
  <source media="(min-width: 900px)" srcset="hero-large.webp">
  <source media="(min-width: 600px)" srcset="hero-medium.webp">
  <img src="hero-small.webp" alt="Description" loading="lazy">
</picture>
```

- Use WebP or AVIF formats
- Always set explicit width and height to prevent CLS
- Lazy load below-fold images
- Use aspect-ratio CSS for responsive containers:
```css
.media-container {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: var(--radius-lg);
}
.media-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

---

## 11. MODERN CSS TECHNIQUES TO USE

### Container Queries (93%+ browser support)
```css
.card-container { container-type: inline-size; }

@container (min-width: 400px) {
  .card { flex-direction: row; }
}
```

### CSS clamp() for Everything
```css
/* Fluid padding */
section { padding: clamp(2rem, 5vw, 6rem) clamp(1rem, 3vw, 3rem); }

/* Fluid gap */
.grid { gap: clamp(1rem, 2vw, 2rem); }
```

### Scroll-Driven Animations (progressive enhancement)
```css
@supports (animation-timeline: scroll()) {
  .parallax-element {
    animation: parallax linear;
    animation-timeline: scroll();
  }
  @keyframes parallax {
    from { transform: translateY(0); }
    to { transform: translateY(-100px); }
  }
}
```

### View Transitions API
```css
@view-transition { navigation: auto; }

::view-transition-old(root) {
  animation: fade-out 200ms ease-out;
}
::view-transition-new(root) {
  animation: fade-in 200ms ease-in;
}
```

---

## 12. CHECKLIST BEFORE SHIPPING

- [ ] Does it look good at 360px?
- [ ] Does it look good at 1440px?
- [ ] Are all touch targets 44x44px minimum?
- [ ] Does body text meet 4.5:1 contrast?
- [ ] Are animations under 300ms for UI, under 500ms for decorative?
- [ ] Is prefers-reduced-motion handled?
- [ ] Are images lazy-loaded with explicit dimensions?
- [ ] Is there a clear visual hierarchy (one thing draws the eye first)?
- [ ] Does the layout use at least ONE non-symmetric element?
- [ ] Is the color palette limited to 2-3 hues max?
- [ ] Are font families limited to 2?
- [ ] Does the spacing feel intentional, not uniform?
