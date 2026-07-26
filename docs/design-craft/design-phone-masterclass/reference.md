# AI Agent Masterclass: Phone App Design (iOS + Android)

You are building a mobile application UI. This document teaches you to produce interfaces that feel native, polished, and professional rather than "web view wrapped in a shell." Follow these rules and your app will feel like it belongs on the device.

---

## 1. PLATFORM PHILOSOPHY

### iOS (Apple Human Interface Guidelines)
Core principles: **Clarity, Deference, Depth.**
- UI defers to content. Controls are translucent, minimal, and contextual.
- Depth is conveyed through layering, blur, shadows, and parallax.
- "Liquid Glass" (iOS 26+): translucent, refracting UI elements that float above content.
- System font: San Francisco (SF Pro). Default body size: 17pt.
- Navigation: bottom tab bar for primary destinations. Back button top-left. Swipe-right to go back.

### Android (Material Design 3 / Material You)
Core principles: **Adaptability, Personalization, Expressiveness.**
- Dynamic Color: UI colors derived from the user's wallpaper.
- Surfaces use tonal elevation (color tint changes with elevation, not just shadow).
- System fonts: Roboto / Google Sans.
- Navigation: bottom navigation bar (3-5 destinations), navigation rail for tablets, FAB for primary action.

### The Critical Difference
- iOS: floating, translucent controls with blur. Content shows through UI chrome.
- Android: opaque, tinted surfaces. Elevation expressed through color, not just shadow.

When building cross-platform, do NOT force one platform's patterns onto the other.

---

## 2. NAVIGATION PATTERNS

### Bottom Tab Bar (iOS + Android Primary Navigation)
```
┌─────────────────────────────────┐
│                                 │
│         CONTENT AREA            │
│                                 │
├─────┬─────┬─────┬─────┬────────┤
│ 🏠  │ 🔍  │ ➕  │ 💬  │ 👤    │
│Home │Find │New  │Chat │Profile │
└─────┴─────┴─────┴─────┴────────┘
```

Rules:
- 3 to 5 tabs maximum. If you need more, your information architecture is wrong.
- Each tab has an icon AND a short label (icon-only tabs fail accessibility).
- Active tab: filled icon + accent color. Inactive: outlined icon + muted color.
- Tab bar is ALWAYS visible except when keyboard is shown or in immersive content.
- Tab bar height: 49pt iOS, 80dp Android (with labels).
- Each tab remembers its scroll position and navigation state independently.

### Navigation Hierarchy
```
Tab Bar (global)
  └── Navigation Stack (per tab)
        ├── Root Screen
        ├── Detail Screen (pushed)
        └── Sub-detail (pushed deeper)
```

- Back navigation: top-left button (iOS), system back gesture/button (Android)
- Swipe from left edge to go back (iOS native gesture, do not override)
- Never hide the back button or override the system back gesture

### Modal Sheets / Bottom Sheets
Use for tasks that don't need full navigation context:
- **Half sheet**: covers bottom 50-60% of screen. User can swipe to dismiss.
- **Full sheet**: covers ~95% of screen. Shows previous context peeking at top.
- **Action sheet**: list of actions anchored to bottom.

```
┌────────────────────────────┐
│  ── (drag handle) ──       │
│                            │
│  Sheet Content             │
│  - Option 1                │
│  - Option 2                │
│  - Option 3                │
│                            │
│  [Primary Action Button]   │
│                            │
└────────────────────────────┘
```

Rules for sheets:
- Always include a drag handle (pill shape, centered, ~36px wide, 4px tall)
- Swipe down to dismiss
- Dim the background (overlay: rgba(0,0,0,0.4))
- Round top corners: 12-16px radius
- Sheet slides up with spring animation (200-300ms)

---

## 3. TOUCH TARGETS AND SPACING

### Minimum Touch Targets
- iOS: 44x44 points minimum
- Android: 48x48 dp minimum
- Space between adjacent tap targets: minimum 8dp/pt

### Safe Areas
```
┌──────────────────────────────┐
│▓▓▓▓▓ STATUS BAR ▓▓▓▓▓▓▓▓▓▓▓│ <- 44-59pt (varies by device)
│                              │
│   SAFE AREA                  │
│   (your content lives here)  │
│                              │
│                              │
│                              │
│                              │
│▓▓▓▓▓ HOME INDICATOR ▓▓▓▓▓▓▓│ <- 34pt (iPhone with Face ID)
└──────────────────────────────┘
```

- Never place interactive elements behind the status bar or home indicator
- Use env(safe-area-inset-top), env(safe-area-inset-bottom) in web views
- Dynamic Island / notch: don't place content that needs to be read in the top center

### Thumb Zone
```
┌──────────────────────────────┐
│     HARD TO REACH            │ <- Stretch zone
│                              │
│     OK TO REACH              │ <- Natural zone
│                              │
│     EASY TO REACH            │ <- Primary actions here
│                              │
│  [═══ TAB BAR ═══════════]   │ <- Perfect thumb zone
└──────────────────────────────┘
```

- Place primary actions (FAB, main buttons, tab bar) in the bottom third
- Secondary actions (search, settings, profile) can go in the top bar
- Pull-to-refresh and swipe gestures work with natural thumb motion

---

## 4. TYPOGRAPHY FOR MOBILE

### iOS Typography Scale
```
Large Title:  34pt  Bold     (main screen headers)
Title 1:      28pt  Bold     (section headers)
Title 2:      22pt  Bold     (sub-section headers)
Title 3:      20pt  Semibold (card titles)
Headline:     17pt  Semibold (emphasized body)
Body:         17pt  Regular  (default text)
Callout:      16pt  Regular  (secondary info)
Subheadline:  15pt  Regular  (supporting text)
Footnote:     13pt  Regular  (timestamps, metadata)
Caption 1:    12pt  Regular  (labels, badges)
Caption 2:    11pt  Regular  (smallest readable)
```

### Android Typography Scale (Material 3)
```
Display Large:   57sp  Regular
Display Medium:  45sp  Regular
Display Small:   36sp  Regular
Headline Large:  32sp  Regular
Headline Medium: 28sp  Regular
Headline Small:  24sp  Regular
Title Large:     22sp  Regular
Title Medium:    16sp  Medium
Title Small:     14sp  Medium
Body Large:      16sp  Regular  (default)
Body Medium:     14sp  Regular
Body Small:      12sp  Regular
Label Large:     14sp  Medium
Label Medium:    12sp  Medium
Label Small:     11sp  Medium
```

### Typography Rules for Mobile
- Minimum readable text: 11pt/11sp. Below this, text is illegible.
- Default body text: 16-17pt/sp. NEVER go smaller for primary content.
- Use system fonts (SF Pro on iOS, Roboto on Android) unless brand requires otherwise.
- Support Dynamic Type (iOS) / font scaling (Android). Never hard-code text sizes without considering system-level scaling.
- Line height for body: 1.4-1.5 (tighter than web because mobile reads in shorter bursts).
- Max line width: ~45-50 characters on mobile screens.

---

## 5. COLOR FOR MOBILE APPS

### System Colors (Use These First)
iOS provides semantic colors that automatically adapt to light/dark mode:
- label, secondaryLabel, tertiaryLabel, quaternaryLabel
- systemBackground, secondarySystemBackground, tertiarySystemBackground
- separator, opaqueSeparator
- systemBlue, systemGreen, systemRed, systemOrange, etc.

Android Material 3 surfaces:
- surface, surfaceVariant, surfaceContainerLowest through surfaceContainerHighest
- primary, onPrimary, primaryContainer, onPrimaryContainer
- secondary, tertiary (same pattern)

### Building an App Color Palette

**Light Mode:**
```
Background:       #FFFFFF or #F8F9FA
Surface (cards):   #FFFFFF with shadow, or #F2F3F5
Text Primary:      #1A1A1A to #2D2D2D
Text Secondary:    #6B7280 to #8E8E93
Text Tertiary:     #AEAEB2
Accent/Primary:    ONE brand color (saturated)
Accent Container:  Accent at 10-15% opacity
Destructive:       #FF3B30 (iOS) / #B3261E (Material)
Success:           #34C759 (iOS) / #146C2E (Material)
Warning:           #FF9500 (iOS) / #E8710A (Material)
Separator:         rgba(0,0,0,0.08)
```

**Dark Mode:**
```
Background:        #000000 (iOS OLED) or #121212 (Material)
Surface (cards):   #1C1C1E (iOS) or #1E1E1E (Material)
Elevated Surface:  #2C2C2E (iOS) or #2D2D2D (Material)
Text Primary:      #FFFFFF at 87% opacity
Text Secondary:    #EBEBF5 at 60% opacity
Text Tertiary:     #EBEBF5 at 30% opacity
Accent/Primary:    Slightly lighter/more saturated version of light mode accent
Separator:         rgba(255,255,255,0.08)
```

### Color Anti-Patterns
- Using the same blue as every other app (#007AFF or #2196F3)
- Pure white cards on a slightly-off-white background (the "floating napkin" look)
- Neon accent colors that hurt the eyes
- Not adjusting accent color between light and dark mode

---

## 6. ANIMATION PATTERNS FOR MOBILE

### Physics-Based Motion
Mobile animations should feel physical. Objects have mass, inertia, and respond to velocity.

**Spring Animation Parameters:**
- Quick settle (button press): damping 0.7, stiffness 400
- Medium (sheet appear): damping 0.8, stiffness 300
- Bouncy (playful element): damping 0.5, stiffness 200
- Gentle (page transition): damping 0.9, stiffness 250

### Standard Transition Durations
- Tap feedback: 50-100ms
- Toggle/switch: 150-200ms
- Sheet/modal appear: 250-350ms (spring)
- Page push transition: 300-350ms
- Page pop (back): 250-300ms
- Dismiss gesture (following finger): 0ms (matches touch exactly)
- Dismiss release animation: 200-300ms

### Essential Mobile Animations

**List item appearing (staggered):**
- Each item fades in + slides up 8-12dp
- Stagger delay: 30-50ms between items
- Duration: 200ms per item
- Easing: ease-out

**Pull to refresh:**
- Spinner appears at top, pulled down by finger
- Release triggers refresh animation
- Content pushes down, then returns when complete

**Swipe actions (delete, archive):**
- Background color reveals behind the cell as user swipes
- Icon appears at threshold
- Snap to action or snap back at release
- Haptic feedback at the action threshold

**Shared element transitions:**
- When tapping a list item to see detail, the thumbnail morphs into the full image
- Title text position animates from list to detail position
- Duration: 300-350ms with ease-in-out

### Haptic Feedback Points
(iOS UIFeedbackGenerator / Android HapticFeedbackConstants)
- Selection change (scrolling a picker): light
- Toggle switch: light
- Action completed (sent, saved): success notification
- Error: error notification
- Long press threshold reached: heavy impact
- Pull-to-refresh threshold: medium impact

---

## 7. STATES EVERY SCREEN NEEDS

Every screen in your app should handle ALL of these states. AI agents almost always forget 3-5 of them.

### The Seven States

**1. Loading (first load)**
- Skeleton screens (gray shimmer rectangles matching content shape)
- NOT a centered spinner. Skeleton screens feel faster and less jarring.
```
┌──────────────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓                │  <- skeleton title
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓       │  <- skeleton text line
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓            │  <- skeleton text line
│                              │
│ ┌──────────┐ ┌──────────┐   │
│ │ ▓▓▓▓▓▓▓▓ │ │ ▓▓▓▓▓▓▓▓ │   │  <- skeleton cards
│ │ ▓▓▓▓▓▓   │ │ ▓▓▓▓▓▓   │   │
│ └──────────┘ └──────────┘   │
└──────────────────────────────┘
```

**2. Empty State (no content yet)**
- Illustration or icon (not a blank screen)
- Short headline explaining the state
- Brief description of what will appear here
- CTA button to create first item
```
┌──────────────────────────────┐
│                              │
│         🗂️ (icon/illo)       │
│                              │
│    No projects yet           │
│    Create your first project │
│    to get started.           │
│                              │
│    [+ Create Project]        │
│                              │
└──────────────────────────────┘
```

**3. Content (normal, populated)**
- This is the happy path. Design this last since it depends on actual data.

**4. Error State**
- Clear error message (not a code or generic "something went wrong")
- Explain what happened in plain language
- Provide a retry button
- Don't wipe out existing content if possible (overlay error, don't replace screen)

**5. Partial Content / Partial Error**
- Some data loaded, some failed
- Show what you have, indicate what's missing
- Retry button for failed sections only

**6. Refreshing (subsequent loads)**
- Pull-to-refresh indicator at top
- Do NOT show skeleton screens again. Keep stale content visible while refreshing.
- Subtle inline loading indicator if updating a specific section.

**7. Offline**
- Show cached content if available with "offline" banner
- Disable actions that require network
- Queue actions for when connection returns

---

## 8. LISTS AND SCROLLING

### List Cell Anatomy
```
┌────────────────────────────────────────┐
│ [Avatar]  Title Text          [Chevron]│
│           Subtitle / Metadata     →    │
│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │  <- separator
│ [Avatar]  Title Text          [Badge]  │
│           Subtitle / Metadata          │
│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
└────────────────────────────────────────┘
```

- Minimum cell height: 44pt (iOS), 48dp (Android)
- Recommended cell height with subtitle: 60-72pt/dp
- Separator indentation: align with text start (not full width from edge to edge)
- Leading padding: 16pt/dp
- Trailing padding: 16pt/dp
- Between avatar and text: 12pt/dp

### Scroll Performance Rules
- Lists should scroll at 60fps minimum. No janky scrolling.
- Use virtualized/recycled lists for >20 items (FlatList in React Native, LazyColumn in Compose)
- Preload images before they scroll into view
- Avoid complex shadows or blur on list items (performance killer)

---

## 9. FORMS AND INPUT

### Text Input Design
```
┌──────────────────────────────┐
│  Label                       │
│  ┌──────────────────────────┐│
│  │ Placeholder text...      ││
│  └──────────────────────────┘│
│  Helper text or error        │
└──────────────────────────────┘
```

- Input height: 44-48pt/dp minimum
- Label: above the input, not inside it (floating labels are OK but add complexity)
- Placeholder: lighter color, disappears on focus
- Border: 1px, goes to accent color on focus
- Error state: border turns red, error message appears below in red text
- Use appropriate keyboard type: email, phone, number, url
- Auto-capitalize, auto-correct settings per field
- Show/hide toggle for password fields

### Form Spacing
- Between label and input: 4-8pt
- Between input and helper text: 4pt
- Between form fields: 16-24pt
- Between form sections: 32-40pt

---

## 10. ONBOARDING

### Patterns That Work
- **Progressive onboarding**: Teach features in context, not all upfront
- **3-4 screen walkthrough**: Maximum. Each screen: illustration + headline + one sentence. Skip button always visible.
- **Permission priming**: Explain WHY you need camera/location/notifications BEFORE the system prompt

### Patterns That Fail
- More than 5 onboarding screens
- Requiring sign-up before showing any value
- Explaining features the user hasn't encountered yet
- No skip option

---

## 11. WHAT SEPARATES A POLISHED APP FROM A WEB VIEW

A "web view in a shell" feels wrong because:
- Scroll physics feel different (no bounce, no velocity-based deceleration)
- Tap feedback is delayed or absent (native responds in <50ms)
- Navigation doesn't use native transitions (push/pop with shadow)
- Status bar doesn't adapt to content
- No haptic feedback
- Text selection behavior is wrong
- Keyboard doesn't push content up properly
- Pull-to-refresh feels janky
- Animations are linear instead of spring-based

To feel native when building with web tech:
- Use spring-based animation curves (not ease-in-out)
- Add haptic feedback at interaction thresholds
- Match platform navigation patterns exactly
- Use system fonts
- Implement proper keyboard avoidance
- Use native-feeling scroll with momentum and rubber-banding
- Tap feedback should be IMMEDIATE (highlight on touch-start, not touch-end)

---

## 12. MOBILE DESIGN CHECKLIST

- [ ] All touch targets are 44x44pt / 48x48dp minimum
- [ ] Content respects safe areas (notch, home indicator)
- [ ] Primary actions are in the bottom third of the screen
- [ ] Tab bar has 3-5 items with icons AND labels
- [ ] Every screen handles: loading, empty, content, error, offline states
- [ ] Text is minimum 11pt/sp, body text 16-17pt/sp
- [ ] Color palette adapts properly to dark mode
- [ ] Animations use spring curves, not linear or ease-in-out
- [ ] Forms use correct keyboard types
- [ ] Lists are virtualized for performance
- [ ] Skeleton screens used instead of spinners
- [ ] Swipe-to-dismiss works on sheets and modals
- [ ] prefers-reduced-motion is respected in web views
