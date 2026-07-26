# AI Agent Masterclass: Navigation Components (Deep Dive)

You are building navigation for a website. Navigation is the backbone of any site. Get it wrong and nothing else matters. This document covers every navigation pattern, exact code, accessibility requirements, responsive behavior, animation timing, and common mistakes AI agents make.

---

## TABLE OF CONTENTS

1. Navbar / Header (Desktop)
2. Mobile Navigation (Hamburger, Drawer, Full-Screen Overlay)
3. Mega Menu
4. Dropdown Menu
5. Sticky / Scroll-Aware Navigation
6. Breadcrumbs
7. Sidebar Navigation
8. Tab Navigation (Page-Level)
9. Pagination
10. Footer Navigation
11. Back to Top Button
12. Command Palette (Cmd+K)
13. Skip to Content Link
14. Scroll Progress Bar
15. Accessibility Rules (Apply to ALL Navigation)
16. Anti-Patterns and Common AI Mistakes

---

## 1. NAVBAR / HEADER (Desktop)

The primary horizontal navigation bar at the top of every page.

### Anatomy
```
┌──────────────────────────────────────────────────────────────┐
│  [Logo]     Home   About   Services   Blog   Contact   [CTA]│
│                                                              │
│  ← Brand ──────── Nav Links ─────────────── Actions →        │
└──────────────────────────────────────────────────────────────┘
```

### Structure
Three zones, always in this order:
1. **Brand zone** (left): Logo or wordmark. Links to homepage.
2. **Navigation zone** (center or left-of-center): Primary page links. 5-7 items max.
3. **Action zone** (right): CTA button, search icon, user avatar, theme toggle.

### Semantic HTML
```html
<header class="site-header">
  <nav aria-label="Primary">
    <a href="/" class="logo" aria-label="Homepage">
      <img src="/logo.svg" alt="Brand Name" width="120" height="32" />
    </a>

    <ul class="nav-links" role="list">
      <li><a href="/about" class="nav-link">About</a></li>
      <li><a href="/services" class="nav-link">Services</a></li>
      <li><a href="/blog" class="nav-link">Blog</a></li>
      <li><a href="/contact" class="nav-link">Contact</a></li>
    </ul>

    <div class="nav-actions">
      <button class="btn-search" aria-label="Search">
        <svg><!-- search icon --></svg>
      </button>
      <a href="/get-started" class="btn-cta">Get Started</a>
    </div>
  </nav>
</header>
```

### Critical Rules
- Use `<nav>` with `aria-label="Primary"` (not "Navigation" -- screen readers already announce "navigation")
- Navigation links go inside a `<ul>` list so screen readers announce "list, 5 items"
- Logo MUST link to homepage
- Logo needs `alt` text with the brand name
- CTA button should be visually distinct (filled/colored, while nav links are text-only)
- If there are multiple `<nav>` elements on the page, each MUST have a unique `aria-label`

### Sizing and Spacing
```css
.site-header {
  height: 64px;                    /* Standard: 56-80px */
  padding: 0 clamp(1rem, 3vw, 3rem);
  display: flex;
  align-items: center;
  background: var(--surface-card);
  border-bottom: 1px solid var(--border-default);
  z-index: 100;
}

.nav-links {
  display: flex;
  gap: 0.25rem;                    /* Tight gap, padding handles spacing */
  list-style: none;
  margin: 0;
  padding: 0;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 0.875rem;       /* Touch-friendly even on desktop */
  font-size: 0.9375rem;           /* 15px - slightly smaller than body */
  font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: var(--radius-md);
  transition: color 150ms ease-out, background-color 150ms ease-out;
}

.nav-link:hover {
  color: var(--text-primary);
  background-color: var(--interactive-secondary);
}

.nav-link[aria-current="page"] {
  color: var(--text-primary);
  font-weight: 600;
}
```

### Active Page Indicator Styles (Pick One)
```css
/* Option A: Bold text + subtle background */
.nav-link[aria-current="page"] {
  color: var(--text-primary);
  font-weight: 600;
  background-color: var(--interactive-secondary);
}

/* Option B: Bottom border accent */
.nav-link[aria-current="page"] {
  color: var(--interactive-primary);
  box-shadow: inset 0 -2px 0 var(--interactive-primary);
}

/* Option C: Pill background with accent */
.nav-link[aria-current="page"] {
  color: var(--interactive-primary);
  background-color: var(--accent-muted);
}
```

**Important**: Use `aria-current="page"` on the link for the current page. This tells screen readers which page is active. Do NOT just use a CSS class.

### Responsive Behavior
- At 768px or when links overflow: collapse nav links into a mobile menu (hamburger)
- Never let nav links wrap to a second line
- Never shrink nav link text to make it fit

---

## 2. MOBILE NAVIGATION

When the viewport is too narrow for horizontal nav links, collapse into a mobile menu.

### 2A. Hamburger Button

```html
<button
  class="mobile-menu-toggle"
  aria-expanded="false"
  aria-controls="mobile-menu"
  aria-label="Menu"
>
  <span class="hamburger-line"></span>
  <span class="hamburger-line"></span>
  <span class="hamburger-line"></span>
</button>
```

```css
.mobile-menu-toggle {
  display: none;                   /* Hidden on desktop */
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 44px;                    /* 44px minimum touch target */
  height: 44px;
  padding: 10px;
  background: none;
  border: none;
  cursor: pointer;
}

@media (max-width: 768px) {
  .mobile-menu-toggle { display: flex; }
  .nav-links { display: none; }
}

.hamburger-line {
  display: block;
  width: 22px;
  height: 2px;
  background-color: var(--text-primary);
  border-radius: 2px;
  transition: transform 250ms ease-out, opacity 250ms ease-out;
}

/* Animated X state */
.mobile-menu-toggle[aria-expanded="true"] .hamburger-line:nth-child(1) {
  transform: translateY(7px) rotate(45deg);
}
.mobile-menu-toggle[aria-expanded="true"] .hamburger-line:nth-child(2) {
  opacity: 0;
}
.mobile-menu-toggle[aria-expanded="true"] .hamburger-line:nth-child(3) {
  transform: translateY(-7px) rotate(-45deg);
}
```

### 2B. Slide-Out Drawer (Most Common Mobile Pattern)

```html
<div
  id="mobile-menu"
  class="mobile-drawer"
  role="dialog"
  aria-modal="true"
  aria-label="Navigation menu"
  hidden
>
  <nav aria-label="Primary">
    <ul role="list">
      <li><a href="/about">About</a></li>
      <li><a href="/services">Services</a></li>
      <li><a href="/blog">Blog</a></li>
      <li><a href="/contact">Contact</a></li>
    </ul>
  </nav>
</div>
<div class="mobile-overlay" hidden></div>
```

```css
.mobile-drawer {
  position: fixed;
  top: 0;
  right: 0;                       /* Slide from right. Use left: 0 for left slide. */
  width: min(320px, 85vw);        /* Never wider than 85% viewport */
  height: 100vh;
  height: 100dvh;                 /* Dynamic viewport height for mobile browsers */
  background: var(--surface-card);
  z-index: 200;
  padding: 5rem 1.5rem 2rem;
  overflow-y: auto;
  transform: translateX(100%);
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
}

.mobile-drawer[hidden] {
  display: block !important;      /* Override hidden to allow CSS transition */
  pointer-events: none;
  visibility: hidden;
}

.mobile-drawer:not([hidden]) {
  transform: translateX(0);
  pointer-events: auto;
  visibility: visible;
}

.mobile-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 199;
  opacity: 0;
  transition: opacity 300ms ease-out;
  pointer-events: none;
}

.mobile-overlay:not([hidden]) {
  opacity: 1;
  pointer-events: auto;
}

/* Mobile nav link styling */
.mobile-drawer a {
  display: block;
  padding: 0.875rem 0;
  font-size: 1.125rem;           /* Larger than desktop nav links */
  font-weight: 500;
  color: var(--text-primary);
  text-decoration: none;
  border-bottom: 1px solid var(--border-muted);
}
```

### 2C. Full-Screen Overlay (For Minimal/Portfolio Sites)

```css
.fullscreen-nav {
  position: fixed;
  inset: 0;
  background: var(--surface-page);
  z-index: 200;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 300ms ease-out;
}

.fullscreen-nav.active {
  opacity: 1;
  pointer-events: auto;
}

.fullscreen-nav a {
  display: block;
  font-size: clamp(1.5rem, 5vw, 3rem);  /* Large, tappable links */
  font-weight: 700;
  padding: 0.75rem 0;
  color: var(--text-primary);
  text-decoration: none;
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 300ms ease-out, transform 300ms ease-out;
}

/* Stagger link entrance */
.fullscreen-nav.active a:nth-child(1) { transition-delay: 100ms; opacity: 1; transform: translateY(0); }
.fullscreen-nav.active a:nth-child(2) { transition-delay: 150ms; opacity: 1; transform: translateY(0); }
.fullscreen-nav.active a:nth-child(3) { transition-delay: 200ms; opacity: 1; transform: translateY(0); }
.fullscreen-nav.active a:nth-child(4) { transition-delay: 250ms; opacity: 1; transform: translateY(0); }
.fullscreen-nav.active a:nth-child(5) { transition-delay: 300ms; opacity: 1; transform: translateY(0); }
```

### Mobile Navigation JavaScript Requirements
```javascript
const toggle = document.querySelector('.mobile-menu-toggle');
const drawer = document.querySelector('.mobile-drawer');
const overlay = document.querySelector('.mobile-overlay');

function openMenu() {
  toggle.setAttribute('aria-expanded', 'true');
  drawer.removeAttribute('hidden');
  overlay.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';   // Prevent background scroll

  // Trap focus inside the drawer
  const focusableElements = drawer.querySelectorAll('a, button');
  if (focusableElements.length) focusableElements[0].focus();
}

function closeMenu() {
  toggle.setAttribute('aria-expanded', 'false');
  drawer.setAttribute('hidden', '');
  overlay.setAttribute('hidden', '');
  document.body.style.overflow = '';
  toggle.focus();                            // Return focus to toggle button
}

toggle.addEventListener('click', () => {
  const isOpen = toggle.getAttribute('aria-expanded') === 'true';
  isOpen ? closeMenu() : openMenu();
});

overlay.addEventListener('click', closeMenu);

// Close on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
    closeMenu();
  }
});
```

### Mobile Nav Checklist
- [ ] `aria-expanded` toggles on the button
- [ ] Focus moves into the menu on open
- [ ] Focus returns to the toggle button on close
- [ ] Escape key closes the menu
- [ ] Background scroll is locked when menu is open
- [ ] Clicking the overlay/backdrop closes the menu
- [ ] Links are minimum 44px tall touch targets
- [ ] Body overflow is restored on close
- [ ] Menu is `hidden` by default (not rendered then hidden with CSS)

---

## 3. MEGA MENU

For sites with many categories (e-commerce, enterprise, SaaS with many products).

### Anatomy
```
┌──────────────────────────────────────────────────────────────┐
│  [Logo]     Products ▾    Solutions    Resources    [CTA]    │
├──────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Category 1        Category 2       Category 3        │  │
│  │  ─────────         ─────────        ─────────         │  │
│  │  Link A            Link E           Link I            │  │
│  │  Link B            Link F           Link J            │  │
│  │  Link C            Link G           Link K            │  │
│  │  Link D            Link H           Link L            │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │ 🔥 Featured: New product announcement   →      │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Structure
```html
<nav aria-label="Primary">
  <ul class="nav-links" role="list">
    <li class="has-megamenu">
      <button
        class="nav-link"
        aria-expanded="false"
        aria-controls="megamenu-products"
      >
        Products
        <svg class="chevron" aria-hidden="true"><!-- down chevron --></svg>
      </button>

      <div
        id="megamenu-products"
        class="megamenu"
        role="region"
        aria-label="Products menu"
        hidden
      >
        <div class="megamenu-grid">
          <div class="megamenu-column">
            <h3 class="megamenu-heading">Category 1</h3>
            <ul role="list">
              <li><a href="/products/a">Product A</a></li>
              <li><a href="/products/b">Product B</a></li>
              <li><a href="/products/c">Product C</a></li>
            </ul>
          </div>
          <div class="megamenu-column">
            <h3 class="megamenu-heading">Category 2</h3>
            <ul role="list">
              <li><a href="/products/d">Product D</a></li>
              <li><a href="/products/e">Product E</a></li>
            </ul>
          </div>
        </div>

        <div class="megamenu-featured">
          <a href="/new-product" class="megamenu-promo">
            New product announcement →
          </a>
        </div>
      </div>
    </li>
  </ul>
</nav>
```

### Critical Design Decisions

**Trigger: Use a `<button>`, NOT a link.**
The mega menu trigger should be a button with `aria-expanded`. If "Products" is also a navigable page, provide TWO elements: a link to the page and a separate toggle button for the submenu. Do NOT make one element serve both purposes.

**Opening behavior:**
- Desktop: open on click (not hover). Hover-only menus fail keyboard users, touch users, and users with motor impairments.
- If using hover, add a 200-300ms delay before opening AND before closing to prevent flickering.
- The menu should also be openable via keyboard (Enter/Space on the button).

**Closing behavior:**
- Click outside closes the menu
- Escape key closes the menu and returns focus to the trigger button
- Clicking a link inside closes the menu (navigates)
- Opening a different mega menu closes the currently open one

```css
.megamenu {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;                       /* Full width of the navbar */
  max-width: 1200px;
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
  box-shadow: var(--shadow-xl);
  padding: 2rem;
  opacity: 0;
  transform: translateY(-8px);
  transition: opacity 200ms ease-out, transform 200ms ease-out;
  pointer-events: none;
}

.megamenu:not([hidden]) {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.megamenu-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 2rem;
}

.megamenu-heading {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-muted);
}

.megamenu a {
  display: block;
  padding: 0.5rem 0;
  font-size: 0.9375rem;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 150ms ease-out;
}

.megamenu a:hover {
  color: var(--text-primary);
}
```

### Mega Menu on Mobile
On mobile, mega menus become accordion-style expand/collapse sections:
```
Products  [+]
─────────────
  ▼ Category 1
     Product A
     Product B
  ▶ Category 2
  ▶ Category 3
```

- The top-level item becomes a button that expands its children
- Submenus slide down with a 200ms animation
- Indentation: 16px per level
- Only one section expanded at a time (accordion behavior)

---

## 4. DROPDOWN MENU (Simple)

For nav items with 3-7 sub-items (not enough for a mega menu).

```html
<li class="has-dropdown">
  <button
    class="nav-link"
    aria-expanded="false"
    aria-haspopup="true"
    aria-controls="dropdown-services"
  >
    Services <svg class="chevron" aria-hidden="true"></svg>
  </button>
  <ul id="dropdown-services" class="dropdown" role="list" hidden>
    <li><a href="/services/design">Design</a></li>
    <li><a href="/services/development">Development</a></li>
    <li><a href="/services/consulting">Consulting</a></li>
  </ul>
</li>
```

```css
.has-dropdown {
  position: relative;
}

.dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 200px;
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 0.375rem;
  opacity: 0;
  transform: translateY(-4px) scale(0.98);
  transition: opacity 150ms ease-out, transform 150ms ease-out;
  pointer-events: none;
  list-style: none;
}

.dropdown:not([hidden]) {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.dropdown a {
  display: block;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: var(--radius-sm);
  transition: background-color 100ms ease-out, color 100ms ease-out;
}

.dropdown a:hover {
  background-color: var(--interactive-secondary);
  color: var(--text-primary);
}
```

### Dropdown Keyboard Navigation
- Enter/Space on trigger: toggle dropdown
- Down Arrow from trigger: open dropdown and focus first item
- Down/Up Arrows: move focus between items
- Escape: close dropdown, return focus to trigger
- Tab: close dropdown, move to next focusable element
- Home/End: jump to first/last item

---

## 5. STICKY / SCROLL-AWARE NAVIGATION

### 5A. Always Sticky (Simple)
```css
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--surface-card);
  /* Add backdrop blur for translucent effect */
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.85);  /* Semi-transparent */
}

/* Dark mode */
[data-theme="dark"] .site-header {
  background: rgba(10, 10, 10, 0.85);
}
```

### 5B. Show on Scroll Up, Hide on Scroll Down
The most popular pattern. Saves screen space when reading, shows nav when user scrolls up to navigate.

```css
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 300ms ease-out;
}

.site-header--hidden {
  transform: translateY(-100%);
}

.site-header--scrolled {
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.08);
  /* Or a stronger shadow */
  /* box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); */
}
```

```javascript
let lastScroll = 0;
const header = document.querySelector('.site-header');
const scrollThreshold = 64; // Don't hide until scrolled past header height

window.addEventListener('scroll', () => {
  const currentScroll = window.scrollY;

  // Add shadow when scrolled
  header.classList.toggle('site-header--scrolled', currentScroll > 10);

  // Don't hide/show until past threshold
  if (currentScroll <= scrollThreshold) {
    header.classList.remove('site-header--hidden');
    lastScroll = currentScroll;
    return;
  }

  // Scrolling down: hide
  if (currentScroll > lastScroll) {
    header.classList.add('site-header--hidden');
  }
  // Scrolling up: show
  else {
    header.classList.remove('site-header--hidden');
  }

  lastScroll = currentScroll;
}, { passive: true });
```

### 5C. Shrink on Scroll
Header starts tall (96px), shrinks to compact (56px) when scrolled.

```css
.site-header {
  position: sticky;
  top: 0;
  height: 96px;
  transition: height 250ms ease-out, padding 250ms ease-out;
}

.site-header--compact {
  height: 56px;
}

.site-header--compact .logo img {
  height: 24px;  /* Smaller logo */
}
```

### scroll-padding
**Critical**: When using sticky headers with anchor links, add `scroll-padding-top` equal to the header height so anchored content doesn't hide behind the header:

```css
html {
  scroll-padding-top: 80px;       /* Match your header height + some breathing room */
  scroll-behavior: smooth;
}
```

---

## 6. BREADCRUMBS

Show the user's location in the site hierarchy. Essential for e-commerce and deep content sites.

### Anatomy
```
Home  >  Products  >  Electronics  >  Headphones
 ↑        ↑            ↑               ↑
link     link         link         current page (not a link)
```

### Semantic HTML
```html
<nav aria-label="Breadcrumb">
  <ol class="breadcrumb" role="list">
    <li><a href="/">Home</a></li>
    <li><a href="/products">Products</a></li>
    <li><a href="/products/electronics">Electronics</a></li>
    <li><span aria-current="page">Headphones</span></li>
  </ol>
</nav>
```

### Rules
- Use `<nav aria-label="Breadcrumb">` (not "Breadcrumbs")
- Use an `<ol>` (ordered list), not `<ul>`, because order matters
- Last item is the current page: use `aria-current="page"`, render as `<span>` not `<a>`
- Separator (> or /) is decorative: add via CSS `::before`, NOT as text content
- Never use breadcrumbs as the sole navigation

```css
.breadcrumb {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0;
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 0.875rem;
}

.breadcrumb li {
  display: flex;
  align-items: center;
}

/* Separator via CSS pseudo-element */
.breadcrumb li:not(:first-child)::before {
  content: '/';
  margin: 0 0.5rem;
  color: var(--text-tertiary);
  font-weight: 400;
}

.breadcrumb a {
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 150ms ease-out;
}

.breadcrumb a:hover {
  color: var(--text-primary);
  text-decoration: underline;
}

.breadcrumb [aria-current="page"] {
  color: var(--text-primary);
  font-weight: 500;
}
```

### Mobile Breadcrumbs
On narrow screens, truncate or show only the parent:
```css
@media (max-width: 640px) {
  /* Show only parent + current, hide intermediate crumbs */
  .breadcrumb li:not(:first-child):not(:last-child):not(:nth-last-child(2)) {
    display: none;
  }
  /* Or show ellipsis for hidden items */
}
```

### JSON-LD Structured Data (SEO)
Always include breadcrumb structured data for search engines:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://example.com" },
    { "@type": "ListItem", "position": 2, "name": "Products", "item": "https://example.com/products" },
    { "@type": "ListItem", "position": 3, "name": "Electronics", "item": "https://example.com/products/electronics" },
    { "@type": "ListItem", "position": 4, "name": "Headphones" }
  ]
}
</script>
```

---

## 7. SIDEBAR NAVIGATION

For dashboards, documentation sites, admin panels. A vertical nav on the left side.

### Structure
```html
<aside class="sidebar" aria-label="Sidebar navigation">
  <nav aria-label="Main">
    <ul role="list" class="sidebar-nav">
      <li>
        <a href="/dashboard" class="sidebar-link" aria-current="page">
          <svg aria-hidden="true"><!-- icon --></svg>
          Dashboard
        </a>
      </li>
      <li>
        <a href="/projects" class="sidebar-link">
          <svg aria-hidden="true"><!-- icon --></svg>
          Projects
          <span class="badge">12</span>
        </a>
      </li>

      <!-- Collapsible section -->
      <li class="sidebar-section">
        <button
          class="sidebar-section-toggle"
          aria-expanded="true"
          aria-controls="settings-subnav"
        >
          Settings
          <svg class="chevron" aria-hidden="true"></svg>
        </button>
        <ul id="settings-subnav" role="list" class="sidebar-subnav">
          <li><a href="/settings/general">General</a></li>
          <li><a href="/settings/billing">Billing</a></li>
          <li><a href="/settings/team">Team</a></li>
        </ul>
      </li>
    </ul>
  </nav>
</aside>
```

```css
.sidebar {
  width: 260px;
  min-width: 260px;
  height: 100vh;
  height: 100dvh;
  position: sticky;
  top: 0;
  overflow-y: auto;
  border-right: 1px solid var(--border-default);
  background: var(--surface-page);
  padding: 1rem 0.75rem;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 450;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: var(--radius-md);
  transition: background-color 120ms ease-out, color 120ms ease-out;
}

.sidebar-link:hover {
  background-color: var(--interactive-secondary);
  color: var(--text-primary);
}

.sidebar-link[aria-current="page"] {
  background-color: var(--interactive-secondary);
  color: var(--text-primary);
  font-weight: 600;
}

.sidebar-link svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.sidebar-link[aria-current="page"] svg {
  color: var(--interactive-primary);
}

.badge {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
  background: var(--interactive-primary);
  color: white;
}

/* Collapsible subnav */
.sidebar-subnav {
  list-style: none;
  padding: 0 0 0 2.25rem;        /* Indent under parent */
  margin: 0.25rem 0 0;
}

.sidebar-section-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-tertiary);
  background: none;
  border: none;
  cursor: pointer;
}

.sidebar-section-toggle .chevron {
  transition: transform 200ms ease-out;
}

.sidebar-section-toggle[aria-expanded="false"] .chevron {
  transform: rotate(-90deg);
}

.sidebar-section-toggle[aria-expanded="false"] + .sidebar-subnav {
  display: none;
}
```

### Collapsible Sidebar (Icon Rail)
```css
.sidebar--collapsed {
  width: 56px;
  min-width: 56px;
}

.sidebar--collapsed .sidebar-link span,
.sidebar--collapsed .sidebar-link .badge,
.sidebar--collapsed .sidebar-section-toggle,
.sidebar--collapsed .sidebar-subnav {
  display: none;
}

.sidebar--collapsed .sidebar-link {
  justify-content: center;
  padding: 0.75rem;
}

/* Show tooltip on hover when collapsed */
.sidebar--collapsed .sidebar-link:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  left: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
  background: var(--surface-raised);
  color: var(--text-primary);
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  white-space: nowrap;
  box-shadow: var(--shadow-md);
  z-index: 50;
}
```

---

## 8. TAB NAVIGATION (Page-Level Content Tabs)

Switching between content views within a single page. NOT the same as the browser tab bar or the navbar.

```html
<div class="tabs" role="tablist" aria-label="Account settings">
  <button role="tab" id="tab-general" aria-selected="true" aria-controls="panel-general">
    General
  </button>
  <button role="tab" id="tab-security" aria-selected="false" aria-controls="panel-security" tabindex="-1">
    Security
  </button>
  <button role="tab" id="tab-notifications" aria-selected="false" aria-controls="panel-notifications" tabindex="-1">
    Notifications
  </button>
</div>

<div role="tabpanel" id="panel-general" aria-labelledby="tab-general">
  <!-- General content -->
</div>
<div role="tabpanel" id="panel-security" aria-labelledby="tab-security" hidden>
  <!-- Security content -->
</div>
<div role="tabpanel" id="panel-notifications" aria-labelledby="tab-notifications" hidden>
  <!-- Notifications content -->
</div>
```

### Tab Keyboard Pattern
- Left/Right Arrow: move focus between tabs
- Home: focus first tab
- End: focus last tab
- Enter/Space: activate focused tab (if not auto-activated on focus)
- Only the active tab has `tabindex="0"`. Inactive tabs have `tabindex="-1"`.
- The active tab panel follows in tab order.

```css
[role="tablist"] {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--border-default);
}

[role="tab"] {
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 150ms ease-out, border-color 150ms ease-out;
  white-space: nowrap;
}

[role="tab"]:hover {
  color: var(--text-primary);
}

[role="tab"][aria-selected="true"] {
  color: var(--interactive-primary);
  border-bottom-color: var(--interactive-primary);
  font-weight: 600;
}

[role="tab"]:focus-visible {
  outline: 2px solid var(--interactive-primary);
  outline-offset: -2px;
  border-radius: var(--radius-sm);
}
```

---

## 9. PAGINATION

```html
<nav aria-label="Pagination">
  <ul class="pagination" role="list">
    <li>
      <a href="?page=2" class="page-link page-prev" aria-label="Previous page">
        ← Prev
      </a>
    </li>
    <li><a href="?page=1" class="page-link">1</a></li>
    <li><a href="?page=2" class="page-link">2</a></li>
    <li><a href="?page=3" class="page-link page-current" aria-current="page">3</a></li>
    <li><a href="?page=4" class="page-link">4</a></li>
    <li><span class="page-ellipsis">...</span></li>
    <li><a href="?page=12" class="page-link">12</a></li>
    <li>
      <a href="?page=4" class="page-link page-next" aria-label="Next page">
        Next →
      </a>
    </li>
  </ul>
</nav>
```

```css
.pagination {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  list-style: none;
  margin: 0;
  padding: 0;
}

.page-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  padding: 0 0.5rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-decoration: none;
  border-radius: var(--radius-md);
  transition: background-color 120ms ease-out, color 120ms ease-out;
}

.page-link:hover {
  background-color: var(--interactive-secondary);
  color: var(--text-primary);
}

.page-link[aria-current="page"] {
  background-color: var(--interactive-primary);
  color: white;
  font-weight: 600;
}

.page-ellipsis {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  color: var(--text-tertiary);
}
```

### Pagination Logic
Show: first page, last page, current page, 1-2 pages on either side of current, ellipsis for gaps.
```
[← Prev] [1] [2] [3] [...] [12] [Next →]     (page 2 of 12)
[← Prev] [1] [...] [5] [6] [7] [...] [12] [Next →]   (page 6 of 12)
[← Prev] [1] [...] [10] [11] [12] [Next →]    (page 11 of 12)
```

### Mobile Pagination
On mobile, simplify to: `← Prev  Page 3 of 12  Next →`

---

## 10. FOOTER NAVIGATION

### Anatomy
```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Brand Name          Product     Company     Resources       │
│  Brief tagline       Features    About       Documentation   │
│                      Pricing     Careers     Blog            │
│                      Changelog   Press       Support         │
│                      API         Contact     Status          │
│                                                              │
│  ────────────────────────────────────────────────────────────│
│  © 2026 Brand Name   Privacy · Terms · Cookies    [Social]  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

```html
<footer class="site-footer">
  <nav aria-label="Footer">
    <div class="footer-grid">
      <div class="footer-brand">
        <a href="/" aria-label="Homepage">Brand Name</a>
        <p>Brief description of what the brand does.</p>
      </div>
      <div class="footer-column">
        <h3>Product</h3>
        <ul role="list">
          <li><a href="/features">Features</a></li>
          <li><a href="/pricing">Pricing</a></li>
          <li><a href="/changelog">Changelog</a></li>
        </ul>
      </div>
      <div class="footer-column">
        <h3>Company</h3>
        <ul role="list">
          <li><a href="/about">About</a></li>
          <li><a href="/careers">Careers</a></li>
          <li><a href="/contact">Contact</a></li>
        </ul>
      </div>
    </div>
  </nav>

  <div class="footer-bottom">
    <p>&copy; 2026 Brand Name. All rights reserved.</p>
    <div class="footer-legal">
      <a href="/privacy">Privacy</a>
      <a href="/terms">Terms</a>
    </div>
  </div>
</footer>
```

```css
.site-footer {
  background: var(--surface-sunken);
  border-top: 1px solid var(--border-default);
  padding: 4rem clamp(1rem, 3vw, 3rem) 2rem;
  margin-top: auto;                 /* Push footer to bottom with flexbox body */
}

.footer-grid {
  display: grid;
  grid-template-columns: 2fr repeat(3, 1fr);
  gap: 3rem;
  margin-bottom: 3rem;
}

@media (max-width: 768px) {
  .footer-grid {
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
  }
}

@media (max-width: 480px) {
  .footer-grid {
    grid-template-columns: 1fr;
  }
}

.footer-column h3 {
  font-size: 0.8125rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.footer-column a {
  display: block;
  padding: 0.375rem 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 150ms ease-out;
}

.footer-column a:hover {
  color: var(--text-primary);
}

.footer-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 2rem;
  border-top: 1px solid var(--border-default);
  font-size: 0.8125rem;
  color: var(--text-tertiary);
}

.footer-legal {
  display: flex;
  gap: 1.5rem;
}

.footer-legal a {
  color: var(--text-tertiary);
  text-decoration: none;
}

.footer-legal a:hover {
  color: var(--text-primary);
}
```

---

## 11. BACK TO TOP BUTTON

```html
<button
  class="back-to-top"
  aria-label="Scroll to top"
  hidden
>
  <svg aria-hidden="true"><!-- up arrow --></svg>
</button>
```

```css
.back-to-top {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  box-shadow: var(--shadow-md);
  cursor: pointer;
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 250ms ease-out, transform 250ms ease-out;
  z-index: 50;
}

.back-to-top:not([hidden]) {
  opacity: 1;
  transform: translateY(0);
}

.back-to-top:hover {
  background: var(--interactive-secondary);
  box-shadow: var(--shadow-lg);
}
```

```javascript
const backToTop = document.querySelector('.back-to-top');

window.addEventListener('scroll', () => {
  if (window.scrollY > 500) {
    backToTop.removeAttribute('hidden');
  } else {
    backToTop.setAttribute('hidden', '');
  }
}, { passive: true });

backToTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
```

---

## 12. COMMAND PALETTE (Cmd+K)

Search-based navigation for power users. See the Desktop App masterclass for full implementation. For websites, the key additions:

- Trigger: Cmd+K (Mac) or Ctrl+K (Windows/Linux)
- Also accessible via a search button in the navbar
- Searches pages, blog posts, documentation, settings
- Shows keyboard shortcuts next to actions
- Fuzzy matching on query
- Recent searches shown on empty query
- Escape to close, Enter to select, arrows to navigate

---

## 13. SKIP TO CONTENT LINK

**Every site MUST have this.** It's the first focusable element on the page.

```html
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <header>...</header>
  <main id="main-content" tabindex="-1">...</main>
</body>
```

```css
.skip-link {
  position: absolute;
  top: -100%;
  left: 1rem;
  z-index: 9999;
  padding: 0.75rem 1.5rem;
  background: var(--interactive-primary);
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
  text-decoration: none;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  transition: top 150ms ease-out;
}

.skip-link:focus {
  top: 0;
}
```

**Why this matters**: keyboard and screen reader users would otherwise have to tab through every single nav link on every page load. The skip link lets them jump directly to content.

---

## 14. SCROLL PROGRESS BAR

Shows how far the user has scrolled through the page. Good for long articles.

```html
<div class="scroll-progress" aria-hidden="true">
  <div class="scroll-progress-bar"></div>
</div>
```

```css
.scroll-progress {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  z-index: 101;                   /* Above the header */
  background: transparent;
}

.scroll-progress-bar {
  height: 100%;
  width: 0%;
  background: var(--interactive-primary);
  transition: width 50ms linear;
}
```

```javascript
const progressBar = document.querySelector('.scroll-progress-bar');

window.addEventListener('scroll', () => {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = (scrollTop / docHeight) * 100;
  progressBar.style.width = `${progress}%`;
}, { passive: true });
```

---

## 15. ACCESSIBILITY RULES (Apply to ALL Navigation)

### Semantic HTML First, ARIA Second
- Use `<nav>` not `<div role="navigation">`
- Use `<button>` not `<div onclick>`
- Use `<a>` for links that navigate, `<button>` for actions that toggle/expand
- Use `<ul>` / `<ol>` for lists of links

### ARIA Attributes for Navigation
| Attribute | Where | Purpose |
|-----------|-------|---------|
| `aria-label="Primary"` | `<nav>` | Identifies the nav region |
| `aria-current="page"` | active link | Indicates current page |
| `aria-expanded="true/false"` | toggle buttons | Indicates menu open/closed |
| `aria-controls="id"` | toggle buttons | Points to the controlled element |
| `aria-haspopup="true"` | dropdown triggers | Indicates a popup will appear |
| `aria-hidden="true"` | decorative icons | Hides from screen readers |

### Keyboard Navigation Requirements
- Every link and button must be focusable via Tab
- Focus order follows visual order (left to right, top to bottom)
- Focus is VISIBLE: never `outline: none` without a replacement
- Escape closes any open menu/dropdown/overlay
- Focus is trapped inside open modals/drawers
- Focus returns to the trigger element when closing

### Focus Styles
```css
/* Remove default outline only if replacing */
:focus {
  outline: none;
}

/* Visible focus ring for keyboard users only */
:focus-visible {
  outline: 2px solid var(--interactive-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

### Contrast Requirements
- Nav link text on background: 4.5:1 minimum
- Active indicators (borders, backgrounds): 3:1 minimum against adjacent colors
- Focus ring: 3:1 against the background

### Screen Reader Announcements
- `<nav aria-label="Primary">` announced as "Primary navigation"
- `<nav aria-label="Breadcrumb">` announced as "Breadcrumb navigation"
- `<nav aria-label="Footer">` announced as "Footer navigation"
- Links inside `<ul>` announced as "list, 5 items" (gives user a count)
- `aria-current="page"` announced as "current page" after the link text

---

## 16. ANTI-PATTERNS AND COMMON AI MISTAKES

### Things AI Agents Get Wrong Every Time

1. **Using `<div>` instead of `<nav>`, `<button>`, `<ul>`**: Always use semantic HTML. No excuses.

2. **Forgetting `aria-expanded`**: Every toggle button that shows/hides a menu MUST have `aria-expanded`.

3. **No skip link**: The very first thing in `<body>` should be a skip-to-content link.

4. **Hover-only dropdowns**: Menus that open ONLY on hover are inaccessible. Always support click and keyboard.

5. **No focus management in mobile menu**: When the mobile menu opens, focus must move into it. When it closes, focus must return to the toggle button.

6. **No Escape key handling**: Every dropdown, mega menu, and drawer must close on Escape.

7. **Using `<a href="#">` for toggle buttons**: If it doesn't navigate, use `<button>`, not a link.

8. **No `aria-current="page"` on the active link**: AI agents just add a CSS class. Use the ARIA attribute.

9. **Separator characters in HTML**: Breadcrumb separators (>, /) should be CSS pseudo-elements, not text nodes. Text nodes get read by screen readers.

10. **Not locking body scroll when mobile menu is open**: Users will scroll the background behind the menu.

11. **Z-index wars**: Nav should be z-index 100. Mobile overlay 199. Mobile drawer 200. Nothing else should compete.

12. **Missing `{ passive: true }` on scroll listeners**: Scroll handlers without passive flag block rendering.

13. **Animating the wrong properties**: Animate `transform` and `opacity` only. Never `height`, `max-height`, `top`, `left`.

14. **Not adding `scroll-padding-top`**: When using sticky headers with anchor links, content hides behind the header without this.

15. **Inconsistent nav between pages**: The navigation must be identical on every page. Same links, same order, same structure. Only `aria-current` changes.

---

## NAVIGATION COMPONENT SELECTION GUIDE

| Site Type | Primary Nav | Secondary | Mobile |
|-----------|------------|-----------|--------|
| Marketing/Landing | Horizontal bar, 5-7 links | Footer | Hamburger drawer |
| Blog/Magazine | Horizontal bar + categories | Breadcrumbs, footer | Hamburger overlay |
| E-Commerce | Horizontal + mega menu | Breadcrumbs, sidebar filters | Full-screen overlay |
| SaaS Dashboard | Sidebar nav | Tabs, breadcrumbs | Collapsible sidebar or drawer |
| Documentation | Sidebar nav | Breadcrumbs, prev/next | Hamburger with sidebar |
| Portfolio | Minimal horizontal or hidden | Footer | Full-screen overlay |
| Single Page App | Tab bar or sidebar | Command palette | Bottom tab bar |

---

## QUICK REFERENCE: TIMING VALUES

| Component | Duration | Easing |
|-----------|----------|--------|
| Dropdown open | 150ms | ease-out |
| Dropdown close | 100ms | ease-in |
| Mega menu open | 200ms | ease-out |
| Mobile drawer open | 300ms | cubic-bezier(0.16, 1, 0.3, 1) |
| Mobile drawer close | 250ms | ease-in |
| Full-screen overlay | 300ms | ease-out |
| Sticky show/hide | 300ms | cubic-bezier(0.16, 1, 0.3, 1) |
| Hover effects | 150ms | ease-out |
| Active state | 100ms | ease-out |
| Link underline reveal | 250ms | ease-out |
| Back to top appear | 250ms | ease-out |
| Stagger per item | 50-80ms | -- |
