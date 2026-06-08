# Humaniser UI Improvement Prompt
## For: React + Tailwind CSS frontend developer

---

## Context

HumaniseAI is a SaaS tool that rewrites AI-generated text to sound human. It has three
core tools: Humaniser, AI Detector, and Paraphraser. The current UI works but lacks
visual consistency, a clear conversion funnel, and polished micro-interactions.

The target user is a student, content writer, or professional who wants to quickly
humanise text and verify it passes AI detection. They are outcome-focused — they
care about the score going down, not the technical details of how it works.

The aesthetic direction is: **dark, precise, trustworthy, professional** — like a
premium dev tool (Linear, Vercel, Raycast). Not playful. Not corporate. Sharp and
capable.

---

## Design System — Apply Consistently Across All Pages

### Colours
```css
--bg-base:        #0f1117;   /* page background */
--bg-surface:     #161b27;   /* card/panel background */
--bg-elevated:    #1e2535;   /* input areas, hover states */
--bg-highlight:   #252d3d;   /* selected/active states */

--border-subtle:  #1e2535;   /* panel borders */
--border-default: #2a3347;   /* visible dividers */
--border-focus:   #4f6ef7;   /* focus rings */

--text-primary:   #e8ecf4;   /* headings, labels */
--text-secondary: #8892a4;   /* subtext, metadata */
--text-muted:     #4a5568;   /* placeholders, disabled */

--accent-primary: #4f6ef7;   /* primary actions, active states */
--accent-hover:   #6b85f8;   /* button hover */

--human-green:    #22c55e;   /* human score, positive */
--mixed-amber:    #f59e0b;   /* mixed/uncertain */
--ai-red:         #ef4444;   /* AI score, warnings */

--highlight-ai:       rgba(239, 68, 68, 0.15);    /* sentence highlight — AI */
--highlight-ai-border: rgba(239, 68, 68, 0.4);
--highlight-mixed:     rgba(245, 158, 11, 0.12);  /* sentence highlight — mixed */
--highlight-mixed-border: rgba(245, 158, 11, 0.35);
```

### Typography
```css
--font-ui:   'DM Sans', sans-serif;       /* all UI chrome, labels, buttons */
--font-mono: 'JetBrains Mono', monospace; /* word counts, scores, metadata */
--font-text: 'Lora', serif;               /* text input and output content only */
```

The serif font for text content is deliberate — it signals "document" and "writing"
rather than "interface." QuillBot uses sans-serif throughout which makes the tool
feel like a form. A serif text area feels like a writing environment.

### Spacing
- Panel padding: 24px
- Section gaps: 16px
- Label to content: 8px
- Inter-element gaps within a section: 12px

### Border radius
- Cards/panels: 12px
- Buttons: 8px
- Tags/badges: 6px
- Input areas: 10px

---

## Shared Component Specifications

### ScoreBar (used in both Humaniser and Detector)
```
Definitely AI ←————————————→ Definitely Human
[████████░░░░░░░░░░░░░░░░░░░░░░░░░░░] 
 AI: 28%                    Human: 72%
```
- Height: 6px
- Background: linear-gradient(to right, #ef4444 0%, #f59e0b 40%, #22c55e 100%)
- Mask the gradient with a dark overlay, reveal based on score
- Animate on load: slide from left over 600ms ease-out
- Show AI% label left-aligned, Human% right-aligned in --font-mono size 12px
- Do NOT use two separate bars — one gradient bar with position indicator

### VerdictBadge
Score → colour → label mapping (standardise across both tools):
```
0–20% human   →  --ai-red     →  "AI Generated"
21–40% human  →  --ai-red     →  "Likely AI"
41–60% human  →  --mixed-amber →  "Mixed"
61–80% human  →  --human-green →  "Likely Human"
81–100% human →  --human-green →  "Human Written"
```

### SentenceCard (used in Detector sentence breakdown)
```
┌─────────────────────────────────────────────┬──────────┐
│ Sentence text here that may wrap to          │  35% AI  │
│ multiple lines naturally                     │  ───────  │
│                                              │ Consider  │
│                                              │ revising  │
└─────────────────────────────────────────────┴──────────┘
```
- On hover: subtle --bg-highlight background transition (150ms)
- On click: highlight the corresponding sentence in the input panel
  (add a 2px left border in the appropriate colour + background tint)
- Score label in --font-mono
- Action label:
  - < 30% AI → "Looks good" in --text-secondary
  - 30–50% AI → "Consider revising" in --mixed-amber
  - > 50% AI → "Rewrite this" in --ai-red

### CrossToolCTA (appears in results panel of every tool)
Used to convert detector users → humaniser and vice versa.
```
┌────────────────────────────────────────────────┐
│  ✦  28% of this text was flagged as AI         │
│     Humanise it to reduce your score           │
│                                                │
│     [  ✨ Humanise This Text  →  ]             │
└────────────────────────────────────────────────┘
```
- Show on Detector when AI score > 20%
- Show on Humaniser results panel always ("Check for AI Detection →")
- Button: --accent-primary background, full width, 44px height
- On click: navigate to the other tool with the text pre-populated
  (use localStorage or URL param: ?text=encoded)
- Hide when score < 15% on detector (user doesn't need it)

---

## Page 1: Humaniser (/app/humaniser)

### Layout
Split panel on desktop (≥ 1024px). Stacked on mobile.

```
┌─────────────────────────────────────────────────────────┐
│ [Level: ●●●●●○○○○○]  [Style: Casual | Professional |   ] │
│                       Academic | Conversational          │
├───────────────────────────────┬─────────────────────────┤
│  INPUT PANEL                  │  DETECTION SCORE        │
│  (left, 58%)                  │  (right, 42%)           │
│                               │                         │
│  [text area — Lora font]      │  [ScoreWidget]          │
│                               │                         │
│  word count · Clear · Paste   │  [CrossToolCTA]         │
│              [Humanise →]     │                         │
├───────────────────────────────┴─────────────────────────┤
│  OUTPUT PANEL (full width, appears after humanising)    │
│                                                         │
│  Humanised Result · 231 words · 7542ms  [Copy][DL.txt]  │
│  [output text — Lora font]                              │
│                                                         │
│  [Check for AI →]  [Humanise Again]                     │
├─────────────────────────────────────────────────────────┤
│  COMPARISON (collapsible, collapsed by default)         │
│  213 → 231 words  [▼ Show comparison]                   │
└─────────────────────────────────────────────────────────┘
```

### Level Control
Replace the current 1–10 number row with a dot-based slider:

```
Level  ●●●●●○○○○○  5 / 10  [Light ←——————→ Maximum]
```
- 10 clickable dots
- Filled dot: --accent-primary
- Empty dot: --border-default
- Hover on a dot: preview label ("Medium rewrite", "Strong rewrite")
- Store last-used level in localStorage

### Style Selector
```
[Casual]  [Professional]  [Academic]  [Conversational]
```
- Pill toggle group, not a dropdown
- Active pill: --accent-primary background
- Inactive: --bg-elevated background, --border-default border
- Hover: --bg-highlight transition 150ms

### Input Panel
- Background: --bg-surface
- Text area: --bg-elevated, --font-text (Lora), 16px, line-height 1.7
- Placeholder: "Paste your text here..."
- Min height: 280px, max height: 60vh, scrollable
- Bottom bar (always visible):
  - Left: word count in --font-mono --text-secondary
  - Left: usage counter "6,884 / 2,147,483,647" (keep, users like seeing this)
  - Right: [Clear] text button + [Paste] text button + [Humanise →] primary button

### Humanise Button
- Background: --accent-primary
- Height: 40px, padding: 0 20px
- Icon: ✨ or a wand icon left of text
- Loading state: replace text with spinner + "Humanising..." — disable during load
- Never say "Processing" — always say "Humanising..."

### Detection Score Widget (right panel, before humanising)
```
┌──────────────────────────────────┐
│  Detection Score                 │
│                                  │
│      [shield icon]               │
│   Paste text and humanise        │
│   to see your AI score           │
│                                  │
│  [○ Check for AI]                │
└──────────────────────────────────┘
```
After humanising, replace with live score:
```
┌──────────────────────────────────┐
│  Detection Score                 │
│                                  │
│  Before  ████░░░░  65% AI        │
│  After   █░░░░░░░  18% AI        │
│                                  │
│  ↓ 47 points improvement         │
│                                  │
│  [ScoreBar — After score]        │
│  [VerdictBadge]                  │
│                                  │
│  [CrossToolCTA if score > 20%]   │
└──────────────────────────────────┘
```
The before/after comparison is your most compelling product moment.
Make it visually prominent — this is what users screenshot and share.

### Output Panel
- Same visual treatment as input panel
- Header: "Humanised Result" · word count · processing time (show "7.5s" not "7542ms")
- Top-right: [Copy] + [Download .txt] icon buttons
- Text: --font-text (Lora), same size and line-height as input
- Bottom: [Check for AI →] secondary button + [Humanise Again] text link

### Comparison Panel
- Collapsed by default — "213 → 231 words · Show comparison ▼"
- On expand: two-column diff view
- In the Humanised column: highlight changed words in --accent-primary at 20% opacity
- Use the word diff data already computed by WordDiffService
- This is a power-user feature — don't make it prominent

---

## Page 2: AI Detector (/app/detector)

### Layout
Same split panel as Humaniser — consistency is the goal.

```
┌─────────────────────────────────────────────────────────┐
│  [History ▼]                           [Language ▼]     │
├───────────────────────────────┬─────────────────────────┤
│  INPUT PANEL (left, 58%)      │  RESULTS PANEL (right)  │
│                               │                         │
│  [text area — Lora font]      │  [ScoreCircle]          │
│  [inline sentence highlights] │  [VerdictBadge]         │
│                               │  [ScoreBar]             │
│                               │  "72% Human · 28% AI"   │
│  ● Human  ● Mixed  ● AI       │                         │
│  [word count]  [Re-check →]   │  [CrossToolCTA]         │
│                               │  ─────────────────────  │
│                               │  Sentence Breakdown     │
│                               │  [SentenceCard list]    │
│                               │  ─────────────────────  │
│                               │  [▼ Detailed Analysis]  │
│                               │  [▼ Layer Breakdown]    │
└─────────────────────────────────────────────────────────┘
```

### Inline Sentence Highlighting
This is the most important interaction on this page.

When detection completes:
- Sentences with AI score > 50%: apply --highlight-ai background + left border
- Sentences with AI score 30–50%: apply --highlight-mixed background + left border
- Sentences with AI score < 30%: no highlight (clean)
- Animate highlights in sequentially (50ms stagger per sentence) after results load

When user clicks a SentenceCard in the right panel:
- Scroll input panel to that sentence
- Add a 2px pulsing ring around the sentence for 2 seconds
- Use CSS animation: ring fades out after 2s

### Score Circle
- Large circular gauge: 120px diameter
- Use SVG stroke-dasharray animation (0 → final value over 800ms ease-out)
- Score number inside: 64px --font-mono bold
- Label below number: "Human" in --text-secondary 12px
- Circle colour: matches verdict (--human-green / --mixed-amber / --ai-red)

### Results Panel Structure
1. Score circle + verdict (top, most prominent)
2. ScoreBar with AI%/Human% labels
3. CrossToolCTA (if AI score > 20%)
4. Sentence Breakdown list (scrollable, shows all sentences)
5. Detailed Analysis (collapsible, collapsed by default)
6. Layer Breakdown: Statistical / Stylometric / Semantic (collapsible, for power users)

### Detailed Analysis
Keep this — it's your best differentiator vs QuillBot.
```
┌─── AI Signals Detected ────┬─── Human Signals Detected ───┐
│ ✗ Balanced binary contrast │ ✓ Colloquial language         │
│ ✗ Formulaic progression    │ ✓ Varied sentence rhythm      │
│ ✗ Academic citation in     │ ✓ Rhetorical questions        │
│   informal context         │ ✓ Strong personal opinions    │
│                            │ ✓ Conversational asides       │
└────────────────────────────┴──────────────────────────────┘
```
- Two-column, equal width
- AI signals: --ai-red ✗ icon
- Human signals: --human-green ✓ icon
- Max 5 items per column — truncate with "and 2 more..."

### Re-check Button
- Appears at bottom right of input panel
- Disabled until text is pasted
- Loading state: "Analysing..." with spinner
- After results load: changes to "Re-check" (for edits)

---

## Page 3: Paraphraser (/app/paraphraser) — Coming Soon state

Show a consistent "Soon" badge on the sidebar (already there).
When user clicks it: show a modal or inline banner:
```
┌─────────────────────────────────────────────────────┐
│  Paraphraser — Coming Soon                          │
│                                                     │
│  8 modes including Standard, Fluency, Formal,       │
│  Academic, Simple, Creative, Expand, and Shorten.   │
│  With synonym slider and click-to-swap suggestions. │
│                                                     │
│  [Join waitlist →]  (email capture)                 │
└─────────────────────────────────────────────────────┘
```
Don't just show a disabled page — capture emails.

---

## Shared Navigation (Sidebar)

### Current issues
- "Soon" badges are correct but the tools feel disconnected
- No visual hierarchy between active and inactive states

### Improvements
```
TOOLS
  ✦ Humaniser          ← active: --accent-primary left border + bg tint
  ◎ AI Detector
  ≋ Paraphraser        [Soon]
  ⊟ Plagiarism         [Soon]
  ∑ Summariser         [Soon]

ACCOUNT
  ⧖ History
  ⚙ Settings
  ◈ Billing
  → Log out
```
- Active item: 2px left border in --accent-primary + --bg-elevated background
- Inactive hover: --bg-elevated background 150ms transition
- "Soon" badges: --bg-elevated background, --text-muted text, 10px font
- Icons: use a consistent icon set (Lucide React recommended)

---

## Navigation Header

### Current state
The top nav shows "Humaniser" / "Detect AI" as toggle buttons in the centre.
This is redundant with the sidebar and creates confusion.

### Fix
Remove the centre toggle. Replace with:
```
[HumaniseAI logo]    [Page title — matches sidebar]    [word count chip] [Plan chip] [Avatar]
```
The sidebar is the navigation. The header should show context, not duplicate nav.

---

## Micro-interactions Checklist

All of these should be implemented:

### Buttons
- [ ] Hover: background lightens 10%, transform: translateY(-1px), transition 150ms
- [ ] Active/click: transform: translateY(0), slight darken
- [ ] Loading: spinner replaces icon, text changes, cursor: not-allowed
- [ ] Disabled: 40% opacity, cursor: not-allowed

### Input panels
- [ ] Focus: --border-focus ring (2px)
- [ ] Paste: brief flash of --bg-highlight background (300ms fade)
- [ ] Word count: updates on every keystroke, animates number change

### Score reveal (both tools)
- [ ] Circle: SVG stroke animation, 800ms ease-out
- [ ] Score bar: width animation from 0, 600ms ease-out, 200ms delay
- [ ] Verdict badge: fade in after bar animation completes
- [ ] Sentence highlights: staggered reveal, 50ms per sentence

### Page transitions
- [ ] Tool switch via sidebar: fade out content (150ms), fade in new content (150ms)
- [ ] Panel appearance (output panel after humanising): slide up + fade in (300ms)

---

## Responsive Behaviour

### Desktop (≥ 1024px)
- Split panel: input 58%, results 42%
- Both panels visible simultaneously
- Results panel scrolls independently

### Tablet (768px – 1023px)
- Collapse to stacked layout
- Input panel full width, results panel full width below
- Sidebar collapses to icon-only strip

### Mobile (< 768px)
- Input panel full width
- Floating "See Results" button appears after analysis
- Results slide up as a bottom sheet (80vh)
- Sentence highlights still work inline
- Level control: horizontal scroll, not wrapping

---

## Accessibility

- [ ] All interactive elements keyboard navigable
- [ ] Focus ring visible on all focusable elements (--border-focus)
- [ ] Score communicated via aria-label not just colour
- [ ] Sentence highlights have aria-description explaining the AI score
- [ ] Loading states have aria-live="polite" announcements
- [ ] Colour is never the only differentiator (always paired with icon or text)

---

## What NOT to do

- Do not use purple gradients on white — the current dark theme is correct, keep it
- Do not add more cards or data panels — less is more; the current version already has too much
- Do not use Inter or Roboto — use DM Sans for UI, Lora for text content
- Do not show the layer breakdown (Statistical/Stylometric/Semantic) by default
  — it's technical detail for power users, collapse it
- Do not use animated gradient backgrounds on the main panels — subtle depth only
- Do not add tooltips on every element — only where the label is genuinely unclear
- Do not make the sidebar wider — 180px is correct
- Do not show word count in multiple places simultaneously

---

## Priority Order for Implementation

1. **CrossToolCTA in Detector results panel** — revenue impact, 1 hour
2. **Inline sentence highlights in Detector input panel** — core interaction, 2 hours
3. **Before/after score comparison in Humaniser** — product's best moment, 2 hours
4. **Level control: dots instead of number row** — consistency, 1 hour
5. **Style selector: pills instead of text tabs** — consistency, 30 min
6. **Score circle SVG animation** — polish, 1 hour
7. **Comparison panel word diff highlighting** — differentiator, 2 hours
8. **Paraphraser waitlist modal** — email capture, 1 hour
9. **Responsive/mobile layout** — reach, 4 hours
10. **Micro-interactions (buttons, focus states, transitions)** — polish, 3 hours
