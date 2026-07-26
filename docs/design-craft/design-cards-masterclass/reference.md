# AI Agent Masterclass: Card Components (Deep Dive)

You are building cards for a website. Cards are the most-used UI component on the web. They group related content into a self-contained, scannable unit. AI agents default to the same card every time: image on top, title, text, button. This document gives you the full card vocabulary with exact code, hover effects, responsive grid behavior, and accessibility.

---

## CARD ANATOMY (Universal)

```
┌──────────────────────────────────┐
│  ┌──────────────────────────┐    │  <- Media area (optional)
│  │        Image / Video     │    │
│  └──────────────────────────┘    │
│                                  │
│  Eyebrow / Category              │  <- Optional metadata
│  Card Title                      │  <- Required
│  Description text that provides  │  <- Optional
│  context about the content.      │
│                                  │
│  [Action]  [Secondary]           │  <- Optional actions
│  Meta info · timestamp           │  <- Optional footer
└──────────────────────────────────┘
```

### Base Card Styles (Every Card Type Inherits This)
```css
.card {
  display: flex;
  flex-direction: column;
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: box-shadow 200ms ease-out, transform 200ms ease-out;
}

.card-media {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  flex-shrink: 0;
}

.card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 400ms ease-out;
}

.card:hover .card-media img {
  transform: scale(1.03);          /* Subtle zoom, not 1.1 */
}

.card-body {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;                         /* Fill remaining height */
}

.card-eyebrow {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--interactive-primary);
}

.card-title {
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--text-primary);
}

/* Clamp title to 2 lines */
.card-title--clamp {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-description {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  padding: 0.875rem 1.25rem;
  border-top: 1px solid var(--border-muted);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  margin-top: auto;               /* Push footer to bottom */
}
```

### Making an Entire Card Clickable
```html
<article class="card card--clickable">
  <div class="card-media">
    <img src="..." alt="..." />
  </div>
  <div class="card-body">
    <span class="card-eyebrow">Category</span>
    <h3 class="card-title">
      <a href="/article/slug" class="card-link">Card Title Here</a>
    </h3>
    <p class="card-description">Description text.</p>
  </div>
</article>
```

```css
.card--clickable {
  cursor: pointer;
  position: relative;
}

/* Stretch the link to cover the entire card */
.card-link {
  text-decoration: none;
  color: inherit;
}

.card-link::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
}

/* Other interactive elements inside the card need higher z-index */
.card--clickable .btn,
.card--clickable .card-tag {
  position: relative;
  z-index: 2;
}
```

---

## CARD HOVER EFFECTS

### Effect 1: Lift (Most Common, Works Everywhere)
```css
.card--lift:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.08);
}
```

### Effect 2: Border Accent
```css
.card--border-accent {
  border: 1px solid var(--border-default);
  transition: border-color 200ms ease-out;
}
.card--border-accent:hover {
  border-color: var(--interactive-primary);
}
```

### Effect 3: Shadow Grow
```css
.card--shadow-grow {
  box-shadow: var(--shadow-sm);
  transition: box-shadow 300ms ease-out;
}
.card--shadow-grow:hover {
  box-shadow: var(--shadow-lg);
}
```

### Effect 4: Background Tint
```css
.card--tint:hover {
  background: var(--interactive-secondary);
}
```

### Effect 5: Glow (Dark Themes)
```css
.card--glow:hover {
  box-shadow: 0 0 0 1px var(--interactive-primary),
              0 0 20px rgba(88, 166, 255, 0.15);
}
```

### Effect 6: Content Slide-Up Reveal
```css
.card--reveal .card-reveal-content {
  transform: translateY(100%);
  transition: transform 300ms ease-out;
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  padding: 2rem 1.25rem 1.25rem;
  color: white;
}

.card--reveal:hover .card-reveal-content {
  transform: translateY(0);
}
```

### Choosing the Right Effect
| Context | Best Effect | Why |
|---------|------------|-----|
| Blog/article cards | Lift | Familiar, doesn't distract |
| Dashboard/admin | Border accent or tint | Subtle, professional |
| Portfolio/creative | Shadow grow or reveal | More expressive |
| Dark theme UI | Glow | Shadows invisible on dark |
| E-commerce products | Lift + image zoom | Industry standard |

---

## CARD TYPES

### 1. BLOG / ARTICLE CARD
```
┌──────────────────────────────────┐
│  [────── Featured Image ──────] │
│                                  │
│  Technology · 5 min read         │
│  Article Title That Wraps to     │
│  Two Lines Maximum               │
│  First two lines of the article  │
│  body text appear here...        │
│                                  │
│  ┌───┐ Author Name · Jan 15     │
│  │ 👤│                           │
│  └───┘                           │
└──────────────────────────────────┘
```

```css
.card-blog .card-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  margin-top: auto;
  padding-top: 1rem;
}

.card-blog .card-meta img {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}

/* Tag/category badge */
.card-tag {
  display: inline-flex;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 500;
  background: var(--accent-muted);
  color: var(--interactive-primary);
  border-radius: var(--radius-full);
}
```

### 2. PRODUCT CARD
```
┌──────────────────────────────────┐
│  [────── Product Photo ────────] │
│                          [♡]     │  <- Wishlist button (absolute)
│                                  │
│  Brand Name                      │
│  Product Title                   │
│  ★★★★☆ (4.2) · 128 reviews     │
│                                  │
│  $99.99  $129.99                 │  <- Sale + original price
│  [Add to Cart]                   │
└──────────────────────────────────┘
```

```css
.card-product .card-media {
  aspect-ratio: 1 / 1;            /* Square for products */
  background: var(--surface-sunken);
  position: relative;
}

.card-product .wishlist-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: 50%;
  cursor: pointer;
  z-index: 2;
  opacity: 0;
  transition: opacity 200ms ease-out;
}

.card-product:hover .wishlist-btn {
  opacity: 1;
}

.card-product .product-brand {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.card-product .product-price {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.card-product .price-current {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--text-primary);
}

.card-product .price-original {
  font-size: 0.875rem;
  color: var(--text-tertiary);
  text-decoration: line-through;
}

.card-product .price-sale {
  color: var(--feedback-error);
}

/* Rating stars */
.rating {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: var(--text-tertiary);
}

.rating-stars {
  color: #f59e0b;
  letter-spacing: 1px;
}
```

### 3. PRICING CARD
```
┌──────────────────────────────────┐
│            Starter               │
│         $9 /month                │
│                                  │
│  For individuals and small       │
│  teams getting started.          │
│                                  │
│  ✓ 5 projects                   │
│  ✓ 10GB storage                 │
│  ✓ Email support                │
│  ✗ Custom domains               │
│  ✗ Priority support             │
│                                  │
│  [Get Started]                   │
└──────────────────────────────────┘
```

```css
.card-pricing {
  padding: 2rem;
  text-align: center;
  position: relative;
}

/* Highlighted/recommended tier */
.card-pricing--featured {
  border: 2px solid var(--interactive-primary);
  box-shadow: 0 0 0 1px var(--interactive-primary);
  transform: scale(1.02);
}

.card-pricing--featured::before {
  content: 'Most Popular';
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--interactive-primary);
  color: white;
  padding: 0.25rem 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: var(--radius-full);
}

.pricing-plan-name {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.pricing-price {
  font-size: 3rem;
  font-weight: 800;
  line-height: 1;
  margin-bottom: 0.25rem;
}

.pricing-price span {
  font-size: 1rem;
  font-weight: 400;
  color: var(--text-tertiary);
}

.pricing-description {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 2rem;
}

.pricing-features {
  list-style: none;
  padding: 0;
  text-align: left;
  margin-bottom: 2rem;
}

.pricing-features li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.pricing-features .check {
  color: var(--feedback-success);
  flex-shrink: 0;
}

.pricing-features .cross {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.pricing-features .unavailable {
  color: var(--text-tertiary);
  text-decoration: line-through;
  opacity: 0.6;
}
```

### 4. TEAM MEMBER CARD
```
┌──────────────────────────────────┐
│         ┌──────────┐            │
│         │  Avatar  │            │
│         │  (circle)│            │
│         └──────────┘            │
│                                  │
│         Jane Smith               │
│         Lead Designer            │
│                                  │
│  A brief bio that describes      │
│  the person's role and expertise.│
│                                  │
│   [🐦] [💼] [📧]                │  <- Social links
└──────────────────────────────────┘
```

```css
.card-team {
  text-align: center;
  padding: 2rem 1.5rem;
}

.card-team .avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
  margin: 0 auto 1rem;
  border: 3px solid var(--border-default);
}

.card-team .member-name {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.card-team .member-role {
  font-size: 0.8125rem;
  color: var(--interactive-primary);
  font-weight: 500;
  margin-bottom: 1rem;
}

.card-team .member-bio {
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-secondary);
  margin-bottom: 1.25rem;
}

.card-team .social-links {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
}

.card-team .social-link {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--text-tertiary);
  transition: color 150ms ease-out, background-color 150ms ease-out;
}

.card-team .social-link:hover {
  color: var(--interactive-primary);
  background: var(--accent-muted);
}
```

### 5. TESTIMONIAL CARD
```css
.card-testimonial {
  padding: 1.5rem;
}

.card-testimonial .testimonial-text {
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--text-primary);
  font-style: italic;
  margin-bottom: 1.5rem;
}

.card-testimonial .testimonial-author {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.card-testimonial .author-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.card-testimonial .author-name {
  font-weight: 600;
  font-size: 0.875rem;
}

.card-testimonial .author-title {
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

/* Star rating */
.card-testimonial .stars {
  color: #f59e0b;
  font-size: 0.875rem;
  letter-spacing: 2px;
  margin-bottom: 1rem;
}
```

### 6. HORIZONTAL CARD
```
┌──────────────────────────────────────────────────┐
│  ┌──────────┐                                    │
│  │          │  Category · 5 min                  │
│  │  Image   │  Title of the Article              │
│  │          │  Brief description text here...    │
│  └──────────┘                                    │
└──────────────────────────────────────────────────┘
```

```css
.card-horizontal {
  flex-direction: row;
}

.card-horizontal .card-media {
  width: 240px;
  min-width: 240px;
  aspect-ratio: auto;
  height: auto;
}

.card-horizontal .card-body {
  justify-content: center;
}

@media (max-width: 600px) {
  .card-horizontal {
    flex-direction: column;
  }
  .card-horizontal .card-media {
    width: 100%;
    min-width: auto;
    aspect-ratio: 16 / 9;
  }
}
```

### 7. PORTFOLIO / PROJECT CARD
```css
.card-portfolio .card-media {
  aspect-ratio: 4 / 3;
}

/* Overlay with project info on hover */
.card-portfolio .card-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 1.5rem;
  opacity: 0;
  transition: opacity 300ms ease-out;
  color: white;
}

.card-portfolio:hover .card-overlay {
  opacity: 1;
}

.card-portfolio .card-overlay .project-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.375rem;
}

.card-portfolio .card-overlay .project-tags {
  display: flex;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.card-portfolio .card-overlay .project-tag {
  padding: 0.25rem 0.5rem;
  background: rgba(255,255,255,0.15);
  border-radius: var(--radius-sm);
}
```

---

## CARD GRID LAYOUTS

### Standard Equal Grid
```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: clamp(1rem, 2vw, 1.5rem);
}
```

### Fixed Column Counts
```css
.card-grid-2 { grid-template-columns: repeat(2, 1fr); }
.card-grid-3 { grid-template-columns: repeat(3, 1fr); }
.card-grid-4 { grid-template-columns: repeat(4, 1fr); }

@media (max-width: 900px) {
  .card-grid-3, .card-grid-4 { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 600px) {
  .card-grid-2, .card-grid-3, .card-grid-4 { grid-template-columns: 1fr; }
}
```

### Featured + Grid (1 Large + 2-3 Small)
```css
.card-grid-featured {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: auto auto;
  gap: 1.5rem;
}

.card-grid-featured .card:first-child {
  grid-row: span 2;
}

.card-grid-featured .card:first-child .card-media {
  aspect-ratio: 3 / 4;            /* Taller for featured */
}

@media (max-width: 768px) {
  .card-grid-featured {
    grid-template-columns: 1fr;
  }
  .card-grid-featured .card:first-child {
    grid-row: span 1;
  }
}
```

### Masonry Layout (CSS Columns)
```css
.card-masonry {
  columns: 3;
  column-gap: 1.5rem;
}

.card-masonry .card {
  break-inside: avoid;
  margin-bottom: 1.5rem;
}

@media (max-width: 900px) { .card-masonry { columns: 2; } }
@media (max-width: 600px) { .card-masonry { columns: 1; } }
```

### Scrollable Horizontal Row (Mobile)
```css
.card-scroll {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 1rem;            /* Space for scrollbar */
}

.card-scroll .card {
  min-width: 280px;
  max-width: 320px;
  flex-shrink: 0;
  scroll-snap-align: start;
}

/* Hide scrollbar visually */
.card-scroll::-webkit-scrollbar { display: none; }
.card-scroll { -ms-overflow-style: none; scrollbar-width: none; }
```

---

## CARD EQUAL HEIGHT

The most common card layout bug: cards in a grid have different heights because content varies.

```css
/* Grid already handles this with stretch alignment */
.card-grid { align-items: stretch; }

/* Inside the card, use flex to push footer to bottom */
.card {
  display: flex;
  flex-direction: column;
}
.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.card-footer,
.card .btn:last-child {
  margin-top: auto;
}
```

---

## CARD ACCESSIBILITY

### Semantic Structure
```html
<article class="card">           <!-- article or div, not span/section -->
  <div class="card-media">
    <img src="..." alt="Descriptive alt text" />  <!-- Never empty alt for meaningful images -->
  </div>
  <div class="card-body">
    <h3 class="card-title">        <!-- Use proper heading level -->
      <a href="/path">Title</a>    <!-- Link wraps the title text -->
    </h3>
  </div>
</article>
```

### Rules
- Use `<article>` if the card is self-contained content (blog post, product)
- Use proper heading hierarchy (h2, h3, h4 depending on context)
- Image `alt` must be descriptive (not "image" or empty for meaningful images)
- Decorative images: `alt=""` and `aria-hidden="true"`
- Clickable cards: use the stretched link pattern (link::after covers the card)
- Focus state must be visible: outline on the link, not hidden
- Card actions (buttons, secondary links) must be keyboard accessible
- Avoid putting too many interactive elements in one card (one primary action is best)

### Focus Styles for Clickable Cards
```css
.card-link:focus-visible {
  outline: none;
}

.card:has(.card-link:focus-visible) {
  outline: 2px solid var(--interactive-primary);
  outline-offset: 2px;
  border-radius: var(--radius-lg);
}
```

---

## CARD LOADING STATE (Skeleton)

```css
.card-skeleton .card-media {
  background: var(--surface-sunken);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-line {
  height: 1rem;
  background: var(--surface-sunken);
  border-radius: var(--radius-sm);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-line--short { width: 60%; }
.skeleton-line--medium { width: 80%; }
.skeleton-line--full { width: 100%; }

@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
}
```

```html
<article class="card card-skeleton" aria-hidden="true">
  <div class="card-media"></div>
  <div class="card-body" style="gap: 0.75rem;">
    <div class="skeleton-line skeleton-line--short"></div>
    <div class="skeleton-line skeleton-line--full"></div>
    <div class="skeleton-line skeleton-line--medium"></div>
  </div>
</article>
```

---

## CARD ANTI-PATTERNS

1. **Every card is identical**: Mix card types. Use a featured card (larger) with regular cards.
2. **Too much content in one card**: A card is a preview. Title, 1-2 lines of text, one action. That's it.
3. **No hover effect at all**: Cards should signal interactivity. Even a subtle border-color change helps.
4. **Image aspect ratios inconsistent across cards in a grid**: Set a fixed aspect-ratio on card-media.
5. **Cards without equal height in a grid**: Use flexbox with flex: 1 on card-body and margin-top: auto on footer.
6. **Using `<div>` for everything**: Use `<article>` for cards, `<h3>` for titles, `<a>` for links.
7. **Hover effects that are too aggressive**: scale(1.1) is too much. Use translateY(-4px) or scale(1.02).
8. **No skeleton/loading state**: Cards that pop in fully formed after a delay feel janky.
9. **Fixed heights on cards**: Never set a fixed height. Let content determine height with flex.
10. **Ignoring the image zoom hover**: On image cards, the slight zoom (scale 1.03) on hover is industry standard. Include it.
11. **Not testing with long titles**: Test with a 2-line and a 5-word title. Both should look good.
12. **Actions inside the card AND the card is clickable**: One or the other. If the whole card is clickable, don't add separate buttons that compete.

---

## QUICK REFERENCE: CARD DIMENSIONS

| Property | Value | Notes |
|----------|-------|-------|
| Border radius | 8-16px | Match your design system |
| Image aspect ratio | 16:9 (blog), 1:1 (product), 4:3 (portfolio) | Consistent within a grid |
| Card padding | 1.25rem - 1.5rem | Internal body padding |
| Min card width | 280px (in auto-fill grid) | Prevents too-narrow cards |
| Max card width | 400px (in scroll layout) | Prevents too-wide single cards |
| Title font size | 1rem - 1.25rem | Depending on card type |
| Description line clamp | 2-3 lines | -webkit-line-clamp |
| Hover lift | translateY(-4px) | 200ms ease-out |
| Image zoom on hover | scale(1.03) | 400ms ease-out |
| Grid gap | 1rem - 1.5rem | clamp(1rem, 2vw, 1.5rem) |
| Skeleton pulse | 1.5s ease-in-out infinite | Opacity 0.4 to 0.7 |
