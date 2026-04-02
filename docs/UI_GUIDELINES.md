# UI Guidelines

## Purpose

This document defines the current UI baseline for the project so future work can continue in a new conversation without re-discovering the same design decisions.

It is not a generic brand guide. It is an implementation-facing spec for this codebase.

## Current Direction

The product should feel like one platform, not several unrelated interfaces.

The visual direction is:

- Calm, editorial, slightly scientific
- Clean Chinese-first typography
- Soft surfaces with restrained depth
- Clear information hierarchy before decoration
- Mobile-first structure, but not mobile-only styling

What we are explicitly avoiding:

- Random one-off gradients and novelty styles per page
- Different navigation metaphors on every route
- Overloaded cards with too many badges, metrics, and controls
- Mixed language UI like `Project Detail`, `Overview`, `Step 1` inside otherwise Chinese pages
- “Design system” pages that do not match the actual product

## Source Of Truth

These files currently define the baseline and should be treated as the first reference before adding new UI:

- `app/layout.tsx`
- `app/globals.css`
- `tailwind.config.ts`
- `components/conditional-app-shell.tsx`
- `components/main-nav.tsx`
- `components/header-search.tsx`
- `components/bottom-nav.tsx`
- `components/ui/mobile-page-header.tsx`
- `components/features/project-card.tsx`
- `app/community/page.tsx`
- `components/community/mobile-community-page.tsx`
- `app/settings/page.tsx`
- `components/features/design-system-content.tsx`

## Typography

### Fonts

- Body font: `Noto Sans SC`
- Heading font: `Noto Serif SC`

### Rules

- Use body font for all interactive controls, labels, lists, and dense content.
- Use heading font for `h1`, `h2`, `h3`, hero titles, and major section titles.
- Do not introduce a third decorative font unless there is a very strong reason.
- Chinese copy is the default. English should only appear for technical or external product names.

### Tone

- Headings should feel stable and content-led.
- Body copy should be direct and readable.
- Avoid exaggerated “future-tech” slogans unless the page truly needs them.

## Color And Surface System

### Base Palette

Use the HSL token system already defined in `app/globals.css`.

- `--background`, `--foreground`
- `--card`, `--card-foreground`
- `--primary`, `--secondary`, `--accent`
- `--muted`, `--muted-foreground`
- `--border`, `--ring`

### Surface Rules

Use the shared utility classes introduced in `app/globals.css`:

- `.page-shell`
- `.surface-panel`
- `.surface-subtle`
- `.section-kicker`
- `.segmented-control`
- `.segmented-option`
- `.segmented-option-active`
- `.mobile-subnav`

### Rules

- Default surface style should be soft and layered, not flat and not glassy everywhere.
- Use `surface-panel` for major content blocks.
- Use `surface-subtle` for secondary blocks, tips, and support content.
- Keep shadows soft and low-contrast.
- Gradients should support hierarchy, not become the main content.

## Layout Rules

### Containers

- Main content should prefer `.page-shell` or an equivalent max-width container.
- Avoid route-specific container widths unless the content truly needs it.

### Spacing

- Desktop pages should usually breathe with larger top spacing and grouped sections.
- Mobile pages should prefer consistent 16px side padding and clear vertical rhythm.

### Sticky Elements

- Mobile should not stack multiple unrelated sticky bars unless the structure clearly requires it.
- If a route has a page-specific mobile header, it must work with the global shell instead of fighting it.
- Prefer:
  - global header
  - one page header or subnav
  - bottom nav

Not:

- global header
- custom header
- another sticky tab bar
- floating CTA

all at once by default

## Navigation Rules

### Desktop

- Main nav should use the shared pill/segmented treatment.
- Search should visually belong to the nav, not look like a separate legacy input.

### Mobile

- Bottom nav is the persistent primary navigation.
- Mobile page headers should use `MobilePageHeader`.
- If a page needs tabs, they should visually match the segmented control style.

### Route Consistency

- Home, Explore, Community, Project, Settings should feel like siblings in one product.
- Do not create a route-specific header style unless it becomes reusable.

## Card Rules

### Project Card

The current `ProjectCard` is the baseline for dense list content.

Its hierarchy should remain:

1. Visual and category context
2. Title
3. Short description
4. One light metadata tag
5. Metrics row

### Card Do

- Show category and subcategory on the image layer when useful
- Keep one short summary line block under the title
- Put metrics in a dedicated bottom row
- Prefer one supporting tag over many repeated tags

### Card Don’t

- Do not place three metrics beside the title on small screens
- Do not dump category, subcategory, multiple tags, difficulty, likes, comments, and coins in one visual cluster
- Do not use hover-only information as the main signal

### Other Cards

`ChallengeCard`, discussion cards, settings item groups, and showcase blocks should gradually converge toward the same surface, radius, and hierarchy system.

## Copy Rules

- UI language should be Simplified Chinese by default.
- Keep section titles and metadata labels in Chinese unless there is a strong external requirement.
- Avoid mixed naming like:
  - `Overview`
  - `Process`
  - `More`
  - `Step 1`

inside otherwise Chinese product pages.

- Metadata and SEO names should also align with `STEAM 探索`.

## Page-Specific Rules

### Home

- Keep homepage more expressive than inner pages.
- Expression comes from composition and pacing, not from random extra colors.
- Desktop hero can be more atmospheric.
- Mobile home must still read as the same product as Explore and Community.

### Explore

- This is a utility page.
- Filters, search, and card scanning speed are more important than decoration.
- Avoid adding visual noise above the fold.

### Project Detail

- This is one of the strongest pages and should be used as a quality benchmark.
- Keep the large hero + structured sections model.
- Continue removing mixed-language remnants.
- Supporting blocks should stay readable before becoming decorative.

### Community

- Community should feel integrated with Explore, not like a different app.
- Use the same page shell, segmented controls, and surface styles.
- Mobile community should always have an explicit page header.

### Settings

- Settings should feel like a real account center, not a placeholder list.
- Use strong grouping and short supporting descriptions.
- Side support panels are acceptable on desktop when they add clarity.

### Design System

- This page exists to document the real product system.
- It must only show components, surfaces, hierarchy, and examples that belong to the actual platform.
- Never let it drift into an unrelated visual experiment.

## Implementation Rules

- Prefer reusable component-level fixes over route-only overrides.
- If a new style pattern appears in more than one place, move it into shared utilities or a shared component.
- Use token-driven colors instead of hard-coded colors when possible.
- Avoid introducing one-off magic numbers for spacing, radius, and shadow unless there is a real layout need.

## Review Checklist

Before merging UI work, check:

- Does this look like the same product as Home, Project, Community, and Settings?
- Is the typography consistent with the current font system?
- Is the page Chinese-first in copy and labels?
- Is the information hierarchy readable on mobile without hover?
- Did we add a new style that should actually be shared?
- Did we create another sticky layer that could have been avoided?

## Current Follow-Up Work

These areas still need continuation:

- Align `ChallengeCard` with the newer card system
- Continue rolling the new surface/navigation rules into `profile`, `messages`, and settings subpages
- Audit older pages for mixed Chinese/English UI labels
- Reduce remaining one-off gradients and custom shadows where they do not support hierarchy
- Verify authenticated pages visually after login flows

## Suggested Prompt For The Next Conversation

Use this when starting a new chat:

> Continue the UI unification work using `docs/UI_GUIDELINES.md` as the baseline. Do not redesign from scratch. Extend the existing system to the next highest-impact pages/components, preserve the current typography/surface/navigation rules, and avoid introducing new one-off visual languages.
