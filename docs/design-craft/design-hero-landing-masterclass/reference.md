# AI Agent Masterclass: Hero / Landing Sections (Deep Dive)

You are building the hero section of a website. This is the single most important visual element on any page. Users decide to stay or bounce within seconds based on what they see here. This document covers every hero pattern, exact code, responsive behavior, performance considerations, and how to stop building the same generic hero every AI agent defaults to.

---

## THE PROBLEM WITH AI-GENERATED HEROES

Every AI agent builds the same hero: centered headline, subtitle, gradient overlay on a stock photo, two buttons. It looks like a template because it IS a template. This document gives you 10 distinct patterns with full code so you can match the hero to the brand and purpose.

---

## HERO ANATOMY (Universal Elements)

Every hero contains some combination of these elements. Not all are required.

```
┌──────────────────────────────────────────────────────────────┐
│  [Pre-headline badge/chip]                                   │  <- Optional trust signal
│                                                              │
│  Primary Headline                                            │  <- Required. 5-10 words.
│                                                              │
│  Supporting copy that expands on the                         │  <- Optional. 1-2 sentences max.
│  headline and builds confidence.                             │
│                                                              │
│  [Primary CTA]  [Secondary CTA]                              │  <- Required. 1-2 buttons.
│                                                              │
│  [Social proof strip]                                        │  <- Optional. Logos, avatars, stats.
│                                                              │
│  [Visual element: image, video, illustration, screenshot]    │  <- Depends on pattern.
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Semantic HTML (Use for ALL Hero Patterns)
```html
<section class="hero" aria-labelledby="hero-heading">
  <div class="hero-content">
    <!-- Optional pre-headline -->
    <div class="hero-badge" aria-label="Announcement">
      <span>🚀 New: Feature X just launched</span>
      <a href="/changelog">Learn more →</a>
    </div>

    <h1 id="hero-heading" class="hero-headline">
      Your primary value proposition
    </h1>

    <p class="hero-subheadline">
      One to two sentences that expand on the headline. Address a pain point
      or promise a specific outcome.
    </p>

    <div class="hero-actions">
      <a href="/signup" class="btn btn-primary">Get Started Free</a>
      <a href="/demo" class="btn btn-secondary">Watch Demo</a>
    </div>

    <!-- Optional social proof -->
    <div class="hero-proof">
      <div class="avatar-stack" aria-label="Trusted by 2,000+ companies">
        <!-- avatar images -->
      </div>
      <p>Trusted by 2,000+ teams worldwide</p>
    </div>
  </div>

  <!-- Visual element varies by pattern -->
  <div class="hero-visual">
    <!-- image, video, illustration, or interactive element -->
  </div>
</section>
```

---

## PATTERN 1: TEXT-DOMINANT HERO (No Image)

The headline IS the visual. Giant typography, lots of whitespace, bold statement.

**Best for**: agencies, luxury brands, portfolios, bold SaaS.

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                                                              │
│        We build things                                       │
│        that matter.                                          │
│                                                              │
│        Subtitle goes here with context.                      │
│                                                              │
│        [Get Started]  [Learn More]                           │
│                                                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

```css
.hero--text-dominant {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;          /* Left-aligned, NOT centered */
  min-height: 85vh;
  padding: clamp(4rem, 10vh, 8rem) clamp(1.5rem, 5vw, 6rem);
  max-width: 900px;
}

.hero--text-dominant .hero-headline {
  font-size: clamp(3rem, 8vw, 7rem);
  font-weight: 800;
  line-height: 0.95;               /* Tight leading for drama */
  letter-spacing: -0.03em;
  color: var(--text-primary);
  margin-bottom: 1.5rem;
}

.hero--text-dominant .hero-subheadline {
  font-size: clamp(1.125rem, 2vw, 1.5rem);
  line-height: 1.5;
  color: var(--text-secondary);
  max-width: 540px;
  margin-bottom: 2.5rem;
}
```

### Variations
- **Gradient text**: Apply a gradient clip to the headline for color pop
```css
.hero-headline span.gradient {
  background: linear-gradient(135deg, var(--accent), var(--accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```
- **Animated words**: Cycle through words using a typewriter or fade effect
- **Geometric background**: Subtle SVG patterns, grain textures, or mesh gradients behind the text

---

## PATTERN 2: SPLIT HERO (Text + Image Side by Side)

Most versatile pattern. Text on one side, image/screenshot/illustration on the other.

**Best for**: SaaS, apps, products with a UI to show off.

```
┌──────────────────────────────────────────────────────────────┐
│                              │                               │
│  Headline text that          │   ┌───────────────────────┐   │
│  describes value.            │   │                       │   │
│                              │   │   Product Screenshot  │   │
│  Supporting copy here.       │   │   or Illustration     │   │
│                              │   │                       │   │
│  [CTA] [Secondary]           │   └───────────────────────┘   │
│                              │                               │
└──────────────────────────────────────────────────────────────┘
```

```css
.hero--split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(2rem, 4vw, 6rem);
  align-items: center;
  min-height: 80vh;
  padding: clamp(4rem, 8vh, 8rem) clamp(1.5rem, 3vw, 3rem);
  max-width: 1400px;
  margin: 0 auto;
}

@media (max-width: 900px) {
  .hero--split {
    grid-template-columns: 1fr;
    text-align: center;
    min-height: auto;
    padding: 4rem 1.5rem;
  }
  .hero--split .hero-content {
    order: 1;                       /* Text first on mobile */
    align-items: center;
  }
  .hero--split .hero-visual {
    order: 2;
  }
}

.hero--split .hero-headline {
  font-size: clamp(2.25rem, 4vw, 4rem);
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin-bottom: 1.25rem;
}

.hero--split .hero-visual img {
  width: 100%;
  height: auto;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
}
```

### Visual Treatments for the Image Side
- **Screenshot with shadow/border**: Most common. Add border-radius + shadow.
- **Floating mockup**: Image slightly rotated (transform: perspective(1200px) rotateY(-8deg))
- **Browser frame mockup**: Wrap screenshot in a fake browser chrome
```css
.browser-frame {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-default);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}
.browser-frame-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 16px;
  background: var(--surface-sunken);
  border-bottom: 1px solid var(--border-default);
}
.browser-frame-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--border-emphasis);
}
```

---

## PATTERN 3: CENTERED HERO

Text centered, visual below or behind it. The most common pattern, so it needs the most work to not look generic.

**Best for**: landing pages, marketing sites, general purpose.

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                   [Badge / Announcement]                     │
│                                                              │
│              Primary Headline Centered                       │
│                                                              │
│         Supporting copy centered, max-width                  │
│         constrained so lines don't get too long.             │
│                                                              │
│              [Primary CTA]  [Secondary]                      │
│                                                              │
│         ┌──────────────────────────────────┐                 │
│         │         Product Image            │                 │
│         │         Below the fold           │                 │
│         └──────────────────────────────────┘                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

```css
.hero--centered {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: clamp(4rem, 10vh, 8rem) clamp(1.5rem, 3vw, 3rem) 0;
}

.hero--centered .hero-headline {
  font-size: clamp(2.5rem, 5vw, 5rem);
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.025em;
  max-width: 800px;
  margin-bottom: 1.5rem;
}

.hero--centered .hero-subheadline {
  font-size: clamp(1.0625rem, 1.5vw, 1.25rem);
  line-height: 1.6;
  color: var(--text-secondary);
  max-width: 600px;                /* Prevent lines from stretching */
  margin-bottom: 2rem;
}

.hero--centered .hero-visual {
  width: 100%;
  max-width: 1100px;
  margin-top: 3rem;
  position: relative;
}

/* Fade image at the bottom edge for seamless transition to next section */
.hero--centered .hero-visual::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120px;
  background: linear-gradient(to top, var(--surface-page), transparent);
  pointer-events: none;
}
```

### How to Make Centered Heroes NOT Look Generic
- Use asymmetric spacing (more padding top than bottom)
- Add a gradient mesh or noise texture to the background
- Stagger the entrance animation (badge, then headline, then subtitle, then CTAs, then image)
- Use an illustration instead of a screenshot
- Add floating decorative elements (blobs, dots, abstract shapes)

---

## PATTERN 4: VIDEO BACKGROUND HERO

Full-viewport video playing behind text. Cinematic and immersive.

**Best for**: creative agencies, travel, lifestyle, event sites.

```html
<section class="hero hero--video">
  <video
    class="hero-video"
    autoplay
    muted
    loop
    playsinline
    poster="/hero-poster.webp"
    aria-hidden="true"
  >
    <source src="/hero-video.mp4" type="video/mp4" />
  </video>
  <div class="hero-overlay"></div>
  <div class="hero-content">
    <h1>Experience the difference</h1>
    <p>Subheadline here</p>
    <a href="/explore" class="btn btn-primary">Explore</a>
  </div>
</section>
```

```css
.hero--video {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  overflow: hidden;
}

.hero-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);  /* Dark overlay for text legibility */
  z-index: 1;
}

.hero--video .hero-content {
  position: relative;
  z-index: 2;
  color: white;
  max-width: 700px;
  padding: 2rem;
}

.hero--video .hero-headline {
  font-size: clamp(2.5rem, 6vw, 5rem);
  font-weight: 700;
  line-height: 1.05;
  text-shadow: 0 2px 20px rgba(0,0,0,0.3);
}
```

### Performance Rules for Video Heroes
- Video file: max 5-8MB, compressed, 720p is usually sufficient
- Always provide a `poster` image (loads before video)
- `autoplay muted loop playsinline` are ALL required (browsers block autoplay with sound)
- `aria-hidden="true"` on the video (it's decorative)
- On mobile, consider replacing video with the poster image to save bandwidth
- Preload: `preload="metadata"` or `preload="none"` to avoid blocking LCP

---

## PATTERN 5: PRODUCT SCREENSHOT HERO

Screenshot/mockup dominates. Text is minimal and secondary to the visual.

**Best for**: SaaS, tools, apps where the UI is the selling point.

```css
.hero--screenshot {
  text-align: center;
  padding: clamp(3rem, 6vh, 6rem) clamp(1.5rem, 3vw, 3rem) 0;
}

.hero--screenshot .hero-headline {
  font-size: clamp(2rem, 4vw, 3.5rem);
  max-width: 700px;
  margin: 0 auto 1rem;
}

.hero--screenshot .hero-visual {
  margin-top: 3rem;
  width: 100%;
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
}

/* Perspective tilt for depth */
.hero--screenshot .hero-visual img {
  width: 100%;
  border-radius: var(--radius-xl);
  box-shadow:
    0 20px 60px rgba(0,0,0,0.15),
    0 0 0 1px rgba(0,0,0,0.05);
  transform: perspective(2000px) rotateX(4deg);
  transition: transform 500ms ease-out;
}

.hero--screenshot .hero-visual:hover img {
  transform: perspective(2000px) rotateX(0deg);
}
```

---

## PATTERN 6: ASYMMETRIC / EDITORIAL HERO

Deliberately unbalanced layout. Feels editorial and designed, not template-y.

**Best for**: creative agencies, portfolios, fashion, architecture.

```css
.hero--asymmetric {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 2rem;
  min-height: 90vh;
  align-items: end;                /* Content aligns to bottom */
  padding: 8rem 3rem 4rem;
}

.hero--asymmetric .hero-content {
  padding-bottom: 4rem;
}

.hero--asymmetric .hero-visual {
  position: relative;
  height: 70vh;
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.hero--asymmetric .hero-visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Overlapping element for depth */
.hero--asymmetric .hero-overlap {
  position: absolute;
  bottom: -2rem;
  left: -3rem;
  background: var(--accent);
  color: white;
  padding: 2rem;
  border-radius: var(--radius-md);
  font-size: 1.25rem;
  font-weight: 600;
  box-shadow: var(--shadow-xl);
  z-index: 2;
}

@media (max-width: 768px) {
  .hero--asymmetric {
    grid-template-columns: 1fr;
    min-height: auto;
    padding: 4rem 1.5rem;
    align-items: start;
  }
}
```

---

## PATTERN 7: FULL-BLEED IMAGE HERO

Full-viewport background image with text overlay.

```css
.hero--fullbleed {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  background-image: url('/hero-bg.webp');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

/* Gradient overlay instead of solid color for better readability */
.hero--fullbleed::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.7) 0%,
    rgba(0, 0, 0, 0.3) 60%,
    transparent 100%
  );
}

.hero--fullbleed .hero-content {
  position: relative;
  z-index: 1;
  color: white;
  max-width: 600px;
  padding: 2rem clamp(1.5rem, 5vw, 6rem);
}
```

---

## PATTERN 8: SCROLLING / PARALLAX HERO

Content reveals as the user scrolls. Creates depth and storytelling.

```css
.hero--parallax {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
}

.hero--parallax .hero-bg {
  position: absolute;
  inset: -20%;                     /* Extra size for parallax movement */
  background-image: url('/hero-bg.webp');
  background-size: cover;
  background-position: center;
  will-change: transform;
}

/* Use IntersectionObserver + scroll position to move .hero-bg */
```

```javascript
// Simple parallax effect
const heroBg = document.querySelector('.hero--parallax .hero-bg');
window.addEventListener('scroll', () => {
  const scrolled = window.scrollY;
  const rate = scrolled * 0.3;     /* 0.3 = parallax speed */
  heroBg.style.transform = `translateY(${rate}px)`;
}, { passive: true });
```

### CSS-Only Parallax (Modern)
```css
@supports (animation-timeline: scroll()) {
  .hero--parallax .hero-bg {
    animation: parallax-scroll linear;
    animation-timeline: scroll();
    animation-range: 0vh 100vh;
  }

  @keyframes parallax-scroll {
    from { transform: translateY(0); }
    to { transform: translateY(120px); }
  }
}
```

---

## PATTERN 9: INTERACTIVE / ANIMATED HERO

Features a canvas, particle effect, 3D element, or interactive component.

**Best for**: tech products, gaming, creative portfolios.

Keep the interactive element as the background layer. Text and CTAs must remain readable and accessible regardless of the animation state.

```css
.hero--interactive {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
}

.hero--interactive canvas,
.hero--interactive .interactive-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.hero--interactive .hero-content {
  position: relative;
  z-index: 1;
  /* Ensure text is always readable over dynamic backgrounds */
  text-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
```

### Performance Rules
- Use `requestAnimationFrame` for canvas animations
- Set `will-change: transform` on animated layers
- Provide a static fallback for `prefers-reduced-motion`
- Lazy-initialize heavy animations (don't block page load)
- Pause animations when the hero scrolls out of viewport

---

## PATTERN 10: SOCIAL PROOF HERO

Leads with trust signals. Numbers, logos, testimonials front and center.

```
┌──────────────────────────────────────────────────────────────┐
│         Trusted by 10,000+ companies worldwide               │
│                                                              │
│  [Logo] [Logo] [Logo] [Logo] [Logo] [Logo]                  │
│                                                              │
│         Main headline about your product                     │
│         Supporting copy goes here.                           │
│                                                              │
│         [Primary CTA]                                        │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │  10M+    │  │  99.9%   │  │  4.9★    │                   │
│  │  Users   │  │  Uptime  │  │  Rating  │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

---

## HERO ENTRANCE ANIMATIONS

### Staggered Reveal (Use on ALL Hero Patterns)
```css
.hero-badge,
.hero-headline,
.hero-subheadline,
.hero-actions,
.hero-proof,
.hero-visual {
  opacity: 0;
  transform: translateY(20px);
  animation: hero-enter 600ms ease-out forwards;
}

.hero-badge        { animation-delay: 0ms; }
.hero-headline     { animation-delay: 100ms; }
.hero-subheadline  { animation-delay: 200ms; }
.hero-actions      { animation-delay: 300ms; }
.hero-proof        { animation-delay: 400ms; }
.hero-visual       { animation-delay: 500ms; }

@keyframes hero-enter {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-badge, .hero-headline, .hero-subheadline,
  .hero-actions, .hero-proof, .hero-visual {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

---

## HERO TYPOGRAPHY RULES

| Element | Size | Weight | Line Height | Max Width |
|---------|------|--------|-------------|-----------|
| Pre-badge | 0.8125rem | 500 | 1.4 | -- |
| Headline | clamp(2.5rem, 5vw, 5rem) | 700-800 | 0.95-1.1 | 800px |
| Subheadline | clamp(1.0625rem, 1.5vw, 1.25rem) | 400 | 1.5-1.6 | 600px |
| CTA buttons | 0.9375rem-1rem | 500-600 | 1 | -- |
| Proof text | 0.875rem | 400 | 1.4 | -- |

---

## PRE-HEADLINE BADGE COMPONENT

The small chip/tag above the headline that signals news or credibility.

```css
.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.875rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--interactive-primary);
  background: var(--accent-muted);
  border: 1px solid rgba(var(--accent-rgb), 0.2);
  border-radius: var(--radius-full);
  margin-bottom: 1.5rem;
}

.hero-badge a {
  color: inherit;
  text-decoration: none;
  font-weight: 600;
}

.hero-badge a:hover {
  text-decoration: underline;
}
```

---

## SOCIAL PROOF STRIP

```css
.hero-proof {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 2rem;
  font-size: 0.875rem;
  color: var(--text-tertiary);
}

.avatar-stack {
  display: flex;
}

.avatar-stack img {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid var(--surface-page);
  margin-left: -8px;
  object-fit: cover;
}

.avatar-stack img:first-child {
  margin-left: 0;
}

/* Logo bar variant */
.logo-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: clamp(1.5rem, 3vw, 3rem);
  justify-content: center;
  opacity: 0.5;                    /* Muted so logos don't overpower */
  filter: grayscale(100%);
  transition: opacity 200ms ease-out, filter 200ms ease-out;
}

.logo-bar:hover {
  opacity: 0.8;
  filter: grayscale(0%);
}

.logo-bar img {
  height: 24px;
  width: auto;
}
```

---

## PERFORMANCE (HERO IS USUALLY YOUR LCP ELEMENT)

The hero section is almost always the Largest Contentful Paint element. Optimizing it directly improves Core Web Vitals.

- Hero images: `loading="eager"` (NOT lazy), `fetchpriority="high"`
- Use `<link rel="preload" as="image" href="/hero.webp">` in `<head>`
- Use WebP/AVIF, compress aggressively. Target < 200KB for hero images.
- Set explicit `width` and `height` on hero images to prevent CLS
- For video heroes, use `poster` attribute and `preload="metadata"`
- For background images, preload via CSS or `<link rel="preload">`
- Avoid render-blocking JS that delays hero rendering

```html
<!-- In <head> -->
<link rel="preload" as="image" href="/hero-image.webp" fetchpriority="high" />
```

```html
<!-- Hero image -->
<img
  src="/hero-image.webp"
  alt="Product dashboard showing analytics"
  width="1200"
  height="800"
  loading="eager"
  fetchpriority="high"
  decoding="async"
/>
```

---

## MOBILE HERO ADAPTATION

- Stack split layouts to single column (text first, image second)
- Reduce headline size via clamp() (already handled if using clamp)
- Center-align text on mobile for single-column layouts
- Scale down or hide decorative background elements
- Ensure CTA buttons are full-width on mobile
- Test that hero content is visible above the fold on a 667px-tall viewport (iPhone SE)
- Consider hiding video and showing poster image on screens < 768px

```css
@media (max-width: 768px) {
  .hero-actions {
    flex-direction: column;
    width: 100%;
  }
  .hero-actions .btn {
    width: 100%;
    justify-content: center;
  }
}
```

---

## HERO ANTI-PATTERNS

1. **Stock photo + gradient overlay + centered white text**: The #1 template look. Avoid.
2. **Too much text**: Hero headline should be 5-10 words. Supporting copy 1-2 sentences. That's it.
3. **Weak CTAs**: "Submit" or "Click Here" are useless. Use action-oriented text: "Start Free Trial", "See Pricing", "Watch Demo".
4. **Two identical-looking CTAs**: Primary should be filled/solid. Secondary should be outlined or ghost.
5. **No visual hierarchy**: Everything the same size and weight. One element must dominate.
6. **100vh hero on mobile**: Can push ALL content below the fold. Use min-height: 85vh or auto.
7. **Auto-playing carousel**: Kills accessibility and usability. Pick one hero, commit.
8. **Forgetting preload on hero image**: Causes slow LCP score.
9. **No social proof**: Adding even a small trust signal (logo bar, review count, user avatars) increases conversion.
10. **Same hero on every page**: Interior pages should have smaller, contextual headers, not a full hero.

---

## PATTERN SELECTION GUIDE

| Site Type | Recommended Pattern | Why |
|-----------|-------------------|-----|
| SaaS / App | Split or Screenshot | Shows the product |
| Agency / Creative | Text-Dominant or Asymmetric | Shows personality |
| E-Commerce | Full-Bleed Image or Split | Shows products |
| Portfolio | Text-Dominant or Interactive | Shows craft |
| Corporate / Enterprise | Centered or Social Proof | Shows credibility |
| Event / Travel | Video Background or Full-Bleed | Shows experience |
| Blog / Publication | Centered (simple) | Content is below |
| Landing Page (conversion) | Centered or Split + Social Proof | Drives action |
