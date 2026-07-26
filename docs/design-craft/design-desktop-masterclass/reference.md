# AI Agent Masterclass: Desktop App Design (Electron / Tauri / Native)

You are building a desktop application. Desktop apps are NOT websites and NOT phone apps. They occupy a unique design space where users expect power, density, keyboard control, and multi-panel layouts. This document teaches you to build desktop apps that feel like Figma, VS Code, Discord, and Slack -- not like a web page in a window.

---

## 1. WHAT MAKES A DESKTOP APP FEEL NATIVE

A desktop app feels like a "real" app (not a website in a frame) when it has:
- A title bar / window chrome that matches the OS (or a convincing custom one)
- Keyboard shortcuts for every common action
- Multi-panel layout that uses the full window
- Resize behavior that intelligently reflows content
- Context menus (right-click)
- Drag and drop support
- Native window controls (minimize, maximize, close)
- Status bar or footer with contextual info
- Responsive to window size changes without breakpoints (fluid, not snapping)

### The Desktop Advantage Over Web
Users have:
- Large screens (1920x1080 to 3840x2160)
- Precise input (mouse, not finger)
- Physical keyboard always available
- Multiple windows possible
- File system access
- System tray / menu bar presence

Design for DENSITY and POWER. Desktop users want to see more, do more, without extra clicks.

---

## 2. CORE LAYOUT PATTERNS

### The Three-Panel Layout (Most Common)
Used by: VS Code, Slack, Discord, Figma, Notion, email clients.

```
┌─────────────────────────────────────────────────────┐
│  [≡] App Name          [Search...]        [─][□][×] │ <- Title bar
├────────┬────────────────────────┬───────────────────┤
│        │                        │                   │
│  Nav   │    Main Content        │   Detail/         │
│  Rail  │    Area                │   Properties      │
│  or    │                        │   Panel           │
│  Side  │                        │   (collapsible)   │
│  bar   │                        │                   │
│        │                        │                   │
│  48-   │                        │   240-360px       │
│  240px │                        │                   │
│        │                        │                   │
├────────┴────────────────────────┴───────────────────┤
│  Status Bar: context info, notifications, progress  │ <- 24-28px
└─────────────────────────────────────────────────────┘
```

### Navigation Sidebar Variants

**Icon Rail (collapsed sidebar):** 48-64px wide. Icons only, tooltip on hover.
```
┌────┐
│ 🏠 │
│ 📁 │
│ 🔍 │
│ ⚙️ │
│    │
│    │
│ 👤 │ <- bottom-aligned
└────┘
```

**Expanded Sidebar:** 200-280px wide. Icons + labels. May include tree views.
```
┌──────────────┐
│ 📁 Projects  │
│   ├ Website  │
│   ├ API      │
│   └ Mobile   │
│ 🔍 Search    │
│ ⚙️ Settings  │
│              │
│ ─────────── │
│ 👤 User Name │
└──────────────┘
```

**Resizable sidebar:** User can drag the edge to resize. Store preference.
- Min width: 180px
- Max width: 400px
- Collapse threshold: if dragged below 120px, collapse to icon rail
- Cursor: col-resize on the drag handle

### Split Pane Layout
Used by: code editors, diff viewers, email (list + preview).
```
┌──────────────────┬──────────────────────────────┐
│                  │                              │
│  List / Tree     │    Content / Preview         │
│  Panel           │                              │
│                  │                              │
│  (resizable) ◄──►│                              │
│                  │                              │
└──────────────────┴──────────────────────────────┘
```

Rules:
- Drag handle: 4-6px wide, cursor: col-resize
- Double-click handle to reset to default split
- Store split ratio in user preferences
- Minimum pane width: 200px (prevent content from being crushed)

### Tab-Based Content Area
```
┌─────┬──────┬──────┬───────────────────────────────┐
│ Tab1│ Tab2 │ Tab3 │                         [+]   │
├─────┴──────┴──────┴───────────────────────────────┤
│                                                    │
│  Tab Content                                       │
│                                                    │
└────────────────────────────────────────────────────┘
```

- Tabs: 28-36px height
- Active tab: contrasting background or bottom border accent
- Close button (×) appears on hover per tab, always visible on active tab
- Tab overflow: scroll horizontally or show dropdown of hidden tabs
- Draggable tab reordering
- Middle-click to close

---

## 3. THE COMMAND PALETTE (Cmd+K / Ctrl+K)

Every serious desktop app needs a command palette. It is the power-user's best friend.

```
┌──────────────────────────────────────────────┐
│  🔍 Type a command or search...              │
├──────────────────────────────────────────────┤
│  Recently Used                               │
│  ┌──────────────────────────────────────────┐│
│  │ 📄 Open File                    Ctrl+O   ││
│  │ 🔍 Find in Files               Ctrl+F   ││
│  │ ⚙️ Open Settings               Ctrl+,   ││
│  │ 🎨 Change Theme                          ││
│  │ 📋 Toggle Sidebar              Ctrl+B   ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

Design rules:
- Width: 500-600px, centered horizontally, positioned ~20% from top
- Backdrop: dimmed overlay (rgba(0,0,0,0.5))
- Instant open (no animation delay, or max 100ms fade)
- Fuzzy search: typing "opf" matches "Open File"
- Show keyboard shortcuts on the right side of each result
- Arrow keys to navigate, Enter to execute, Escape to close
- Categorized results with section headers
- Max visible results: 8-10, then scroll

---

## 4. KEYBOARD SHORTCUTS

### Standard Shortcuts (Never Override These)
```
Ctrl/Cmd + S    Save
Ctrl/Cmd + Z    Undo
Ctrl/Cmd + Y    Redo (or Ctrl+Shift+Z)
Ctrl/Cmd + X    Cut
Ctrl/Cmd + C    Copy
Ctrl/Cmd + V    Paste
Ctrl/Cmd + A    Select All
Ctrl/Cmd + F    Find
Ctrl/Cmd + W    Close Tab/Window
Ctrl/Cmd + Q    Quit (Mac)
Ctrl/Cmd + N    New
Ctrl/Cmd + O    Open
Ctrl/Cmd + P    Print (or Quick Open in dev tools)
Ctrl/Cmd + ,    Settings/Preferences
```

### App-Specific Shortcuts
```
Ctrl/Cmd + K           Command Palette
Ctrl/Cmd + B           Toggle Sidebar
Ctrl/Cmd + \           Toggle Side Panel
Ctrl/Cmd + Shift + P   Extended Command Palette
Ctrl/Cmd + 1/2/3       Switch tabs by position
Ctrl/Cmd + Tab         Cycle tabs
Ctrl/Cmd + Shift + N   New Window
```

### Shortcut Display Convention
- Mac: ⌘⇧⌥⌃ (Cmd, Shift, Option, Control). Use actual symbols.
- Windows/Linux: Ctrl+Shift+Alt. Use text with + separator.
- Detect OS and show the right modifier

---

## 5. CONTEXT MENUS (RIGHT-CLICK)

Every interactive element should have a context menu with relevant actions.

```
┌─────────────────────────┐
│ Cut              Ctrl+X │
│ Copy             Ctrl+C │
│ Paste            Ctrl+V │
│─────────────────────────│ <- separator
│ Select All       Ctrl+A │
│─────────────────────────│
│ Delete                  │
│ Rename            F2    │
│─────────────────────────│
│ Properties              │
└─────────────────────────┘
```

Design rules:
- Width: 180-240px
- Item height: 28-32px
- Padding: 8px horizontal, 4px vertical
- Separator: 1px line with 8px vertical margin
- Keyboard shortcut right-aligned, muted color
- Hover state: accent background color
- Disabled items: 40% opacity, no hover effect
- Sub-menus: arrow indicator (▸) on right side, reveal on hover
- Appears at cursor position, adjusts if too close to screen edge
- Shadow: strong (shadow-lg to shadow-xl)

---

## 6. DESKTOP APP COLOR SCHEMES

### Dark Theme (The Default for Productivity Apps)
Dark themes reduce eye strain during long sessions and make content (especially media) pop.

**GitHub Dark Inspired:**
```css
:root {
  --bg-canvas: #0d1117;
  --bg-default: #161b22;
  --bg-subtle: #1c2128;
  --bg-muted: #21262d;
  --bg-emphasis: #30363d;

  --border-default: #30363d;
  --border-muted: #21262d;
  --border-subtle: rgba(240,246,252,0.1);

  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-tertiary: #6e7681;
  --text-placeholder: #484f58;

  --accent-primary: #58a6ff;
  --accent-hover: #79c0ff;
  --accent-muted: rgba(56,139,253,0.15);

  --success: #3fb950;
  --warning: #d29922;
  --danger: #f85149;
  --info: #58a6ff;
}
```

**VS Code Inspired:**
```css
:root {
  --bg-editor: #1e1e1e;
  --bg-sidebar: #252526;
  --bg-title-bar: #323233;
  --bg-panel: #1e1e1e;
  --bg-input: #3c3c3c;
  --bg-dropdown: #252526;

  --border: #474747;
  --text: #cccccc;
  --text-inactive: #969696;

  --accent: #0078d4;
  --accent-text: #ffffff;
  --active-tab-border: #0078d4;
  --activity-bar-badge: #0078d4;
}
```

**Discord Inspired:**
```css
:root {
  --bg-primary: #313338;
  --bg-secondary: #2b2d31;
  --bg-tertiary: #1e1f22;
  --bg-floating: #111214;

  --text-normal: #dbdee1;
  --text-muted: #949ba4;
  --text-faint: #6d6f78;

  --accent-brand: #5865f2;
  --accent-positive: #23a55a;
  --accent-warning: #f0b232;
  --accent-danger: #da373c;
}
```

### Light Theme
Offer this as an option, never as the only option for a desktop tool.
```css
[data-theme="light"] {
  --bg-canvas: #ffffff;
  --bg-default: #f6f8fa;
  --bg-subtle: #f0f2f5;
  --bg-muted: #e8eaed;

  --border-default: #d1d5db;
  --border-muted: #e5e7eb;

  --text-primary: #1f2328;
  --text-secondary: #656d76;
  --text-tertiary: #8b949e;

  --accent-primary: #0969da;
}
```

### Color Anti-Patterns for Desktop Apps
- Pure black (#000000) backgrounds. Use #0d1117 to #1e1e1e range.
- Bright accent colors on dark backgrounds without a muted variant
- Not having a separate "elevated surface" color for floating panels, menus, dropdowns
- Using the same background color for sidebar and main content (they should differ by 1-2 steps)

---

## 7. TYPOGRAPHY FOR DESKTOP APPS

### Font Choices
- **UI text**: System font stack or Inter/Segoe UI/SF Pro (13-14px)
- **Code/monospace**: JetBrains Mono, Fira Code, Cascadia Code, SF Mono (12-14px)
- **Display headings** (rare in desktop apps): use sparingly for welcome screens or empty states

### Desktop Type Scale (Denser Than Web or Mobile)
```css
:root {
  --text-xs: 11px;     /* badges, status bar */
  --text-sm: 12px;     /* secondary labels, metadata */
  --text-base: 13px;   /* default UI text */
  --text-md: 14px;     /* emphasized text, titles */
  --text-lg: 16px;     /* section headers */
  --text-xl: 20px;     /* page titles */
  --text-2xl: 24px;    /* rarely used */
}
```

Note: desktop apps use SMALLER text than web. 13px is the standard body size for desktop UI, not 16px. This is because desktop users sit closer to larger, higher-DPI screens.

### Line Heights for Desktop
- UI labels and menus: 1.2 to 1.3
- Body text in panels: 1.4 to 1.5
- Code: 1.5 to 1.6

---

## 8. TITLE BAR AND WINDOW CHROME

### Custom Title Bar (Electron/Tauri)
When using frameless windows with custom title bars:

```
┌─────────────────────────────────────────────────────┐
│ [icon] App Name    [File] [Edit] [View]    [─][□][×]│
└─────────────────────────────────────────────────────┘
       ↑                    ↑                     ↑
    App branding      Menu bar (optional)    Window controls
```

- Height: 32-38px
- Make the entire title bar draggable (-webkit-app-region: drag)
- Buttons and interactive elements: -webkit-app-region: no-drag
- Window control buttons position:
  - macOS: LEFT side (close, minimize, fullscreen) -- 12px circles
  - Windows/Linux: RIGHT side (minimize, maximize, close)
- Close button hover: red background (#e81123 on Windows)
- Title bar background: slightly different shade than sidebar (darker or lighter by 1 step)
- Title bar text: centered or left-aligned, 13px, semibold

### Status Bar (Bottom)
```
┌─────────────────────────────────────────────────────┐
│ ● Connected   │  main branch  │  UTF-8  │  Ln 42  │
└─────────────────────────────────────────────────────┘
```

- Height: 22-28px
- Font size: 11-12px
- Background: same as title bar or slightly different
- Info items separated by subtle dividers
- Clickable items get hover states
- Good for: connection status, git branch, file encoding, cursor position, notifications count

---

## 9. TOOLBARS

```
┌──────────────────────────────────────────────────────┐
│ [←][→][↻]  │ [📄][📁]  │  [B][I][U]  │    [⚙️]   │
└──────────────────────────────────────────────────────┘
```

- Height: 36-44px
- Icon size: 16-20px
- Button size: 28-32px (with padding around icon)
- Group related tools with separators (1px vertical line, 16px horizontal margin)
- Tooltip on hover (after 500ms delay) showing action name + shortcut
- Toggle buttons: accent background when active
- Overflow: when window too narrow, collapse to a "..." dropdown

---

## 10. NOTIFICATIONS AND TOASTS

### Toast Notification
```
┌──────────────────────────────────────┐
│ ✓  File saved successfully     [×]   │
└──────────────────────────────────────┘
```

- Position: bottom-right or top-right of the app window
- Width: 300-400px
- Duration: 3-5 seconds, then auto-dismiss with fade
- Types: info (blue/accent), success (green), warning (amber), error (red)
- Stack multiple toasts with 8px gap
- Allow dismissal via close button or click

### System Notifications (OS-level)
- Use sparingly. Only for events that matter when the app is not focused.
- Include: app icon, title (short), body (1-2 lines)
- Click notification to focus the app and navigate to relevant content

---

## 11. DRAG AND DROP

- Drag cursor: change to "grabbing" cursor during drag
- Drop zones: highlight with accent border and subtle accent background when drag enters
- Ghost image: semi-transparent copy of the dragged element following cursor
- Invalid drop zone: show "not allowed" cursor
- Drop animation: element snaps to position with 150ms ease-out
- For list reordering: show insertion indicator (line) between items

---

## 12. DESKTOP-SPECIFIC INTERACTION PATTERNS

### Double-Click
- Rename items (files, folders, list entries)
- Open items in their default view
- Select a word in text

### Hover States
Desktop has hover. USE IT. Unlike mobile, you can preview actions on hover.
- Show action buttons on row hover (delete, edit, duplicate)
- Preview content on hover (tooltips, link previews)
- Highlight interactive areas

### Focus States
Tab-navigable keyboard focus is critical on desktop.
- Visible focus ring: 2px solid accent color, 2px offset
- Focus order follows visual layout
- Escape key closes modals, menus, panels

### Multi-Select
- Click to select one
- Ctrl/Cmd + Click to toggle individual items
- Shift + Click to select a range
- Ctrl/Cmd + A to select all
- Visual: selected items get accent background tint

---

## 13. DESKTOP APP DESIGN CHECKLIST

- [ ] Dark theme is the default (with light theme option)
- [ ] Custom title bar with proper drag regions and OS-appropriate window controls
- [ ] Sidebar or navigation rail (collapsible)
- [ ] Command palette (Cmd/Ctrl+K)
- [ ] Standard keyboard shortcuts work (Cmd+S, Cmd+Z, etc.)
- [ ] Context menus on right-click for all interactive elements
- [ ] Resizable panels with drag handles
- [ ] Status bar with contextual information
- [ ] Tooltips on icon-only buttons (500ms hover delay)
- [ ] Focus ring visible for keyboard navigation
- [ ] UI text is 13-14px (not 16px like web)
- [ ] Toasts/notifications for user feedback
- [ ] Drag and drop where appropriate
- [ ] Multiple selection support (Ctrl+Click, Shift+Click)
- [ ] Window remembers size and position on reopen
- [ ] Sidebar widths and panel splits persist in preferences
