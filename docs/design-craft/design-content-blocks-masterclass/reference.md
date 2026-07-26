# AI Agent Masterclass: Content Blocks (Deep Dive)

You are building content sections for a website. These are the repeating blocks between the hero and the footer that make up the body of every page. AI agents default to the same three-card grid for everything. This document gives you a full vocabulary of content block patterns with exact code, layout variations, and rules for when to use each one.

---

## CONTENT BLOCK ANATOMY

Every content block follows this structure:
```html
<section class="section" aria-labelledby="section-heading-id">
  <div class="section-container">
    <!-- Optional: Section header -->
    <div class="section-header">
      <span class="section-eyebrow">Features</span>
      <h2 id="section-heading-id" class="section-title">Section headline</h2>
      <p class="section-description">Supporting text for the section.</p>
    </div>

    <!-- Section content (varies by block type) -->
    <div class="section-body">
      <!-- Content here -->
    </div>
  </div>
</section>
```

### Base Section Styles
```css
.section {
  padding: clamp(4rem, 8vh, 8rem) 0;
}

.section-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 clamp(1rem, 3vw, 3rem);
}

.section-header {
  max-width: 700px;
  margin-bottom: clamp(2.5rem, 4vw, 4rem);
}

/* Left-aligned header (default, more editorial) */
.section-header--left { text-align: left; }

/* Centered header (for centered layouts) */
.section-header--center {
  text-align: center;
  margin-left: auto;
  margin-right: auto;
}

.section-eyebrow {
  display: inline-block;
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--interactive-primary);
  margin-bottom: 0.75rem;
}

.section-title {
  font-size: clamp(1.75rem, 3vw, 2.75rem);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.section-description {
  font-size: clamp(1rem, 1.25vw, 1.125rem);
  line-height: 1.6;
  color: var(--text-secondary);
}
```

---

## 1. TEXT BLOCK / PROSE

Long-form text content. Articles, about pages, terms, policies.

```css
.prose {
  max-width: 65ch;                /* Optimal reading width */
  font-size: clamp(1rem, 1.25vw, 1.125rem);
  line-height: 1.7;
  color: var(--text-primary);
}

.prose h2 {
  font-size: 1.75rem;
  font-weight: 700;
  margin-top: 3rem;
  margin-bottom: 1rem;
  line-height: 1.2;
}

.prose h3 {
  font-size: 1.375rem;
  font-weight: 600;
  margin-top: 2.5rem;
  margin-bottom: 0.75rem;
}

.prose p {
  margin-bottom: 1.5rem;
}

.prose p + p {
  margin-top: 0;                  /* Only bottom margin needed */
}

.prose a {
  color: var(--text-link);
  text-decoration: underline;
  text-underline-offset: 2px;
  text-decoration-thickness: 1px;
  transition: color 150ms ease-out;
}

.prose a:hover {
  color: var(--text-link-hover);
}

.prose ul, .prose ol {
  padding-left: 1.5rem;
  margin-bottom: 1.5rem;
}

.prose li {
  margin-bottom: 0.5rem;
}

.prose blockquote {
  border-left: 3px solid var(--interactive-primary);
  padding-left: 1.25rem;
  margin: 2rem 0;
  font-style: italic;
  color: var(--text-secondary);
}

.prose img {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-md);
  margin: 2rem 0;
}

.prose hr {
  border: none;
  border-top: 1px solid var(--border-default);
  margin: 3rem 0;
}

.prose code {
  font-family: var(--font-family-mono);
  font-size: 0.875em;
  background: var(--surface-sunken);
  padding: 0.15em 0.4em;
  border-radius: var(--radius-sm);
}

.prose pre {
  background: var(--color-gray-900);
  color: var(--color-gray-100);
  padding: 1.5rem;
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin: 2rem 0;
  font-size: 0.875rem;
  line-height: 1.6;
}
```

---

## 2. IMAGE + TEXT (Side by Side)

Alternating layout: image left/text right on odd sections, reversed on even sections.

```css
.image-text {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: clamp(2rem, 5vw, 6rem);
  align-items: center;
}

/* Alternate direction on even sections */
.image-text--reversed {
  direction: rtl;
}
.image-text--reversed > * {
  direction: ltr;
}

/* Cleaner approach with order */
.image-text--reversed .image-text__visual { order: 2; }
.image-text--reversed .image-text__content { order: 1; }

.image-text__visual img {
  width: 100%;
  height: auto;
  border-radius: var(--radius-lg);
}

.image-text__content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.image-text__eyebrow {
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--interactive-primary);
}

.image-text__title {
  font-size: clamp(1.5rem, 2.5vw, 2.25rem);
  font-weight: 700;
  line-height: 1.15;
}

.image-text__body {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .image-text {
    grid-template-columns: 1fr;
  }
  .image-text--reversed .image-text__visual { order: 0; }
  .image-text--reversed .image-text__content { order: 0; }
}
```

### Variations
- **Staggered vertical offset**: Add `padding-top: 4rem` to the image side for asymmetry
- **Overlapping**: Image overlaps into the text zone with negative margin
- **Icon list with image**: Text side contains a list of features with icons

---

## 3. FEATURE GRID

A grid of features, each with an icon, title, and description.

### 3A. Standard Grid (3 or 4 columns)
```css
.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: clamp(1.5rem, 3vw, 2.5rem);
}

.feature-item {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.feature-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-muted);
  border-radius: var(--radius-md);
  color: var(--interactive-primary);
}

.feature-icon svg {
  width: 24px;
  height: 24px;
}

.feature-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.feature-description {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--text-secondary);
}
```

### 3B. Bento Grid (Unequal Cells)
```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 240px;
  gap: 1rem;
}

.bento-item {
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
  position: relative;
}

.bento-featured {
  grid-column: span 2;
  grid-row: span 2;
}

.bento-wide {
  grid-column: span 2;
}

.bento-tall {
  grid-row: span 2;
}

/* Bento item with image background */
.bento-item--image {
  background-size: cover;
  background-position: center;
}

.bento-item--image::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.7), transparent 60%);
  border-radius: inherit;
}

.bento-item--image .bento-content {
  position: relative;
  z-index: 1;
  color: white;
}

@media (max-width: 900px) {
  .bento-grid {
    grid-template-columns: repeat(2, 1fr);
    grid-auto-rows: 200px;
  }
}

@media (max-width: 480px) {
  .bento-grid {
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
  }
  .bento-featured,
  .bento-wide {
    grid-column: span 1;
  }
  .bento-tall {
    grid-row: span 1;
  }
}
```

---

## 4. STATS / NUMBERS ROW

A horizontal strip of key metrics.

```
┌──────────┬──────────┬──────────┬──────────┐
│   10M+   │   99.9%  │  4.9★    │  150+    │
│  Users   │  Uptime  │  Rating  │ Countries│
└──────────┴──────────┴──────────┴──────────┘
```

```css
.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 2rem;
  text-align: center;
  padding: clamp(2rem, 4vw, 4rem) 0;
  border-top: 1px solid var(--border-default);
  border-bottom: 1px solid var(--border-default);
}

.stat-item {}

.stat-value {
  font-size: clamp(2rem, 4vw, 3.5rem);
  font-weight: 800;
  line-height: 1;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

/* Optional: gradient text for the number */
.stat-value--accent {
  background: linear-gradient(135deg, var(--interactive-primary), var(--accent-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.stat-label {
  font-size: 0.875rem;
  color: var(--text-tertiary);
  font-weight: 500;
}
```

### Animated Counter (JavaScript)
```javascript
function animateCounter(element, target, duration = 2000) {
  let start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = Math.floor(eased * target);

    element.textContent = current.toLocaleString();

    if (progress < 1) requestAnimationFrame(update);
    else element.textContent = target.toLocaleString();
  }

  requestAnimationFrame(update);
}

// Trigger on scroll into view
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      animateCounter(el, parseInt(el.dataset.target));
      observer.unobserve(el);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('[data-target]').forEach(el => observer.observe(el));
```

---

## 5. TIMELINE

Vertical timeline for company history, process steps, or changelog.

```html
<div class="timeline">
  <div class="timeline-item">
    <div class="timeline-marker"></div>
    <div class="timeline-content">
      <time class="timeline-date">January 2024</time>
      <h3 class="timeline-title">Company Founded</h3>
      <p class="timeline-body">Description of the event.</p>
    </div>
  </div>
  <!-- More items -->
</div>
```

```css
.timeline {
  position: relative;
  padding-left: 2rem;
}

/* Vertical line */
.timeline::before {
  content: '';
  position: absolute;
  left: 7px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--border-default);
}

.timeline-item {
  position: relative;
  padding-bottom: 3rem;
  padding-left: 2rem;
}

.timeline-item:last-child {
  padding-bottom: 0;
}

.timeline-marker {
  position: absolute;
  left: -2rem;
  top: 4px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--surface-card);
  border: 3px solid var(--interactive-primary);
  z-index: 1;
}

/* Active/current marker */
.timeline-item--active .timeline-marker {
  background: var(--interactive-primary);
  box-shadow: 0 0 0 4px var(--accent-muted);
}

.timeline-date {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--text-tertiary);
  margin-bottom: 0.375rem;
}

.timeline-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.timeline-body {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--text-secondary);
}
```

### Alternating Timeline (Desktop)
```css
@media (min-width: 768px) {
  .timeline--alternating {
    padding-left: 0;
  }
  .timeline--alternating::before {
    left: 50%;
  }
  .timeline--alternating .timeline-item {
    width: 50%;
    padding-left: 0;
  }
  .timeline--alternating .timeline-item:nth-child(odd) {
    margin-left: 0;
    padding-right: 3rem;
    text-align: right;
  }
  .timeline--alternating .timeline-item:nth-child(even) {
    margin-left: 50%;
    padding-left: 3rem;
  }
  .timeline--alternating .timeline-item:nth-child(odd) .timeline-marker {
    right: -8px;
    left: auto;
  }
  .timeline--alternating .timeline-item:nth-child(even) .timeline-marker {
    left: -8px;
  }
}
```

---

## 6. COMPARISON TABLE

Side-by-side feature comparison. Common on pricing and "us vs them" pages.

```css
.comparison-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9375rem;
}

.comparison-table thead th {
  padding: 1rem;
  font-weight: 600;
  text-align: center;
  border-bottom: 2px solid var(--border-default);
  position: sticky;
  top: 0;
  background: var(--surface-page);
  z-index: 10;
}

/* Highlight "our" column */
.comparison-table .highlight-col {
  background: var(--accent-muted);
}

.comparison-table tbody td {
  padding: 0.875rem 1rem;
  text-align: center;
  border-bottom: 1px solid var(--border-muted);
  color: var(--text-secondary);
}

.comparison-table tbody td:first-child {
  text-align: left;
  font-weight: 500;
  color: var(--text-primary);
}

/* Check/X indicators */
.check { color: var(--feedback-success); font-weight: 700; }
.cross { color: var(--text-tertiary); }
```

```html
<td class="check" aria-label="Included">✓</td>
<td class="cross" aria-label="Not included">—</td>
```

### Mobile: Convert Table to Stacked Cards
```css
@media (max-width: 768px) {
  .comparison-table thead { display: none; }
  .comparison-table tbody tr {
    display: block;
    padding: 1rem;
    margin-bottom: 1rem;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
  }
  .comparison-table tbody td {
    display: flex;
    justify-content: space-between;
    text-align: right;
    border-bottom: 1px solid var(--border-muted);
  }
  .comparison-table tbody td::before {
    content: attr(data-label);
    font-weight: 500;
    text-align: left;
    color: var(--text-primary);
  }
}
```

---

## 7. ACCORDION / FAQ

```html
<div class="accordion">
  <details class="accordion-item">
    <summary class="accordion-trigger">
      <span>How does billing work?</span>
      <svg class="accordion-chevron" aria-hidden="true"><!-- chevron --></svg>
    </summary>
    <div class="accordion-content">
      <p>Answer text goes here with full detail.</p>
    </div>
  </details>
</div>
```

```css
.accordion {
  max-width: 700px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.accordion-item {
  border-bottom: 1px solid var(--border-default);
}

.accordion-trigger {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 1.25rem 0;
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  list-style: none;                /* Remove default marker */
}

.accordion-trigger::-webkit-details-marker { display: none; }

.accordion-chevron {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  transition: transform 200ms ease-out;
  color: var(--text-tertiary);
}

.accordion-item[open] .accordion-chevron {
  transform: rotate(180deg);
}

.accordion-content {
  padding: 0 0 1.25rem;
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--text-secondary);
}

/* Smooth open/close animation */
.accordion-content {
  overflow: hidden;
  animation: accordion-open 200ms ease-out;
}

@keyframes accordion-open {
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: 500px; }
}
```

### Accessibility Notes
- `<details>/<summary>` is natively accessible without ARIA
- Keyboard: Enter/Space toggles open/close
- Screen readers announce "collapsed" / "expanded" automatically
- No JavaScript required for basic functionality

---

## 8. TABS (Content Switching)

See the Navigation masterclass for full tab ARIA implementation. The visual styles for content tabs:

```css
.content-tabs {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border-default);
  margin-bottom: 2rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.content-tab {
  padding: 0.75rem 1.25rem;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--text-secondary);
  border: none;
  background: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  transition: color 150ms ease-out, border-color 150ms ease-out;
}

.content-tab:hover { color: var(--text-primary); }

.content-tab[aria-selected="true"] {
  color: var(--interactive-primary);
  border-bottom-color: var(--interactive-primary);
}
```

---

## 9. TESTIMONIAL / QUOTE BLOCK

### Single Testimonial (Large)
```css
.testimonial-large {
  text-align: center;
  max-width: 700px;
  margin: 0 auto;
}

.testimonial-quote {
  font-size: clamp(1.25rem, 2vw, 1.75rem);
  line-height: 1.5;
  font-style: italic;
  color: var(--text-primary);
  position: relative;
  margin-bottom: 2rem;
}

/* Decorative opening quote */
.testimonial-quote::before {
  content: '"';
  position: absolute;
  top: -1.5rem;
  left: -0.5rem;
  font-size: 4rem;
  font-style: normal;
  color: var(--interactive-primary);
  opacity: 0.2;
  line-height: 1;
}

.testimonial-author {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
}

.testimonial-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.testimonial-name {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.9375rem;
}

.testimonial-role {
  font-size: 0.8125rem;
  color: var(--text-tertiary);
}
```

---

## 10. CTA BANNER (Full-Width Call to Action)

```css
.cta-banner {
  background: var(--interactive-primary);
  color: white;
  padding: clamp(3rem, 6vw, 5rem) clamp(1.5rem, 3vw, 3rem);
  text-align: center;
  border-radius: var(--radius-xl);
  margin: 4rem 0;
}

.cta-banner-title {
  font-size: clamp(1.75rem, 3vw, 2.5rem);
  font-weight: 700;
  margin-bottom: 1rem;
}

.cta-banner-text {
  font-size: 1.0625rem;
  opacity: 0.85;
  max-width: 500px;
  margin: 0 auto 2rem;
  line-height: 1.5;
}

.cta-banner .btn {
  background: white;
  color: var(--interactive-primary);
  font-weight: 600;
}

.cta-banner .btn:hover {
  background: rgba(255,255,255,0.9);
}

/* Alternative: gradient background */
.cta-banner--gradient {
  background: linear-gradient(135deg, var(--interactive-primary), var(--accent-secondary, #7c3aed));
}
```

---

## 11. LOGO BAR (Client / Partner Logos)

```css
.logo-bar-section {
  padding: clamp(2rem, 4vw, 3rem) 0;
}

.logo-bar-label {
  text-align: center;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 1.5rem;
}

.logo-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: clamp(2rem, 4vw, 4rem);
}

.logo-bar img {
  height: 28px;
  width: auto;
  opacity: 0.4;
  filter: grayscale(100%);
  transition: opacity 300ms ease-out, filter 300ms ease-out;
}

.logo-bar img:hover {
  opacity: 0.8;
  filter: grayscale(0%);
}

/* Scrolling logo bar for many logos */
.logo-bar--scroll {
  flex-wrap: nowrap;
  overflow: hidden;
  gap: 4rem;
}

.logo-bar--scroll .logo-track {
  display: flex;
  gap: 4rem;
  animation: logo-scroll 30s linear infinite;
}

@keyframes logo-scroll {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
```

---

## 12. CODE BLOCK

```css
.code-block {
  position: relative;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: var(--radius-md);
  overflow: hidden;
  margin: 2rem 0;
}

.code-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  font-size: 0.8125rem;
  color: #8b949e;
}

.code-block-copy {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  background: transparent;
  border: 1px solid #30363d;
  border-radius: var(--radius-sm);
  color: #8b949e;
  cursor: pointer;
}

.code-block-copy:hover {
  background: #21262d;
  color: #e6edf3;
}

.code-block pre {
  padding: 1.25rem;
  overflow-x: auto;
  font-family: var(--font-family-mono);
  font-size: 0.875rem;
  line-height: 1.6;
  color: #e6edf3;
  margin: 0;
}
```

---

## 13. EMBED (Video, Map, Social)

```css
/* Responsive video embed (16:9) */
.embed-video {
  position: relative;
  aspect-ratio: 16 / 9;
  width: 100%;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: #000;
}

.embed-video iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: none;
}

/* Lazy video: show poster/play button, load iframe on click */
.embed-video--lazy {
  cursor: pointer;
  background-size: cover;
  background-position: center;
}

.embed-video--lazy .play-button {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 72px;
  height: 72px;
  background: rgba(0,0,0,0.7);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 200ms ease-out, transform 200ms ease-out;
}

.embed-video--lazy:hover .play-button {
  background: var(--interactive-primary);
  transform: translate(-50%, -50%) scale(1.05);
}
```

---

## SECTION BACKGROUNDS AND DIVIDERS

### Alternating Background Colors
```css
.section--alt { background: var(--surface-sunken); }
.section--dark { background: var(--color-gray-900); color: var(--color-gray-100); }
.section--accent { background: var(--interactive-primary); color: white; }
```

### Section Dividers
```css
/* Simple line */
.section + .section { border-top: 1px solid var(--border-default); }

/* Gradient fade divider */
.section-divider {
  height: 1px;
  background: linear-gradient(
    to right,
    transparent,
    var(--border-default) 20%,
    var(--border-default) 80%,
    transparent
  );
  max-width: 1200px;
  margin: 0 auto;
}
```

---

## SCROLL-REVEAL FOR CONTENT BLOCKS

Apply to all content blocks for a polished page feel:

```css
.reveal-on-scroll {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 600ms ease-out, transform 600ms ease-out;
}

.reveal-on-scroll.is-visible {
  opacity: 1;
  transform: translateY(0);
}
```

```javascript
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.1,
  rootMargin: '0px 0px -60px 0px'  /* Trigger slightly before element is fully visible */
});

document.querySelectorAll('.reveal-on-scroll').forEach(el => {
  revealObserver.observe(el);
});
```

---

## CONTENT BLOCK ANTI-PATTERNS

1. **Every section has the same layout**: Alternate between image-text, grid, stats, quote, etc.
2. **Uniform spacing everywhere**: Section padding should vary. Use larger spacing to separate major topics.
3. **No visual rhythm**: Dark section, light section, accent section creates rhythm. Same background for 5 sections in a row is monotonous.
4. **Section headers that all look the same**: Not every section needs an eyebrow + title + description. Some just need a title. Some need nothing.
5. **Feature grids always in 3 columns**: Use 2 columns with larger items, or 4 columns with icons only, or a bento layout.
6. **Ignoring scroll-reveal**: Content that appears all at once feels static. Staggered reveals feel designed.
7. **Not constraining prose width**: Body text wider than 65-75 characters (max-width: 65ch) is hard to read.
8. **Code blocks with no copy button**: Developers expect a copy button. Always include one.
