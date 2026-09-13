# developing

Everything the README leaves out.

## Layout

| path | what it is |
|---|---|
| `templates/youtube.user.css` | **Source of truth.** A pywal template — every literal CSS brace is doubled (`{{`/`}}`) so `str.format()` can substitute the palette. Not installable as-is. |
| `dist/youtube-pywal.snapshot.user.css` | Rendered snapshot for people who don't use pywal. |
| `dist/flavours/*.user.css` | Eight fixed palettes, generated. |
| `assets/` | Banner and flavour previews, generated. |
| `userscripts/` | Hover-preview sync, and the player tint. |
| `tools/` | Build, flavour and preview generators, plus the screenshot helper. |

## Editing the template

Two rules, both easy to forget:

1. **Double every literal CSS brace.** The template goes through Python's
   `str.format()`, so `{` and `}` must be written `{{` and `}}`. Only palette
   placeholders like `{color4}` stay single.
2. **Bump `@version` on every change.** Stylus will not reload a style whose
   version hasn't moved, and a stale cache looks exactly like a broken
   selector. A fix that "doesn't work" twice running is a cache smell before
   it's a selector smell.

## Build

```bash
python3 tools/build.py           # validate + write dist/
python3 tools/build.py --check   # validate only, write nothing
python3 tools/flavours.py        # regenerate dist/flavours/
python3 tools/preview.py         # regenerate assets/ (needs rsvg-convert)
```

`build.py` checks brace balance, renders through `.format()`, parses the result
with tinycss2 if present, and appends `@updateURL` — **to `dist/` only.**

That asymmetry is deliberate and load-bearing. Stylus auto-updates from
`@updateURL`, so a pywal user whose local copy carried one would have their
wallpaper palette periodically overwritten by the published snapshot. The
template has no such line; pywal is what updates the local copy.

Adding a flavour is six hex values in `tools/flavours.py` — the template only
consumes `background`, `color0`, `foreground`, `color4`, `color5`, `color6`.
Each flavour needs a distinct `@name`: Stylus keys style identity on
`@name` + `@namespace`, so same-named builds overwrite each other on install
instead of sitting side by side.

## Working on the live theme

The author's pywal template path is a symlink into this repo:

```bash
ln -sfn ~/yt-system24/templates/youtube.user.css ~/.config/wal/templates/youtube.user.css
```

so there is exactly one file and the repo can't drift from what's installed.
Drift is how a two-month-old copy of this theme ended up in a dotfiles repo.

## Screenshots

`tools/demo-mode.js` replaces titles, channel names and thumbnails with
generated placeholders, so the theme can be photographed without publishing a
real feed or watch history. Open the file, copy its **contents**, paste into
the console — browsers make you type `allow pasting` the first time. Call
`s24demo()` again after scrolling; YouTube re-renders as you go.

For pages that exist logged out, a private window is simpler and shows real
content. The script is for pages that need a session: history, Watch Later,
subscriptions, playlists.

## Debugging

**Measure, don't guess.** Nearly every fix in this project that stuck came
after a `getBoundingClientRect()` / `getComputedStyle()` dump from a live page;
nearly every one that failed came from a plausible guess about YouTube's DOM.
A selector that matches nothing fails *silently* — it looks like working code
forever.

Traps this theme has already fallen into:

- **Stylus injects with user-origin `!important`**, which beats an
  author-origin `!important` from a `<style>` injected via the console. Live
  tests that try to override the theme silently do nothing. Setting an
  inherited custom property inline on the element *does* win — and always
  print a verification in the same snippet before trusting a result.
- **DevTools docked to the side** drops the viewport below the 900px
  breakpoint, where the whole panel grammar deliberately stands down. Measure
  with DevTools in a separate window, or you are measuring the wrong layout.
- **Outlines paint below descendants.** A card ring is a positioned `::after`
  overlay, not an `outline`, because an opaque thumbnail would cover an
  outline. This cost about twenty versions before it was understood.
- **Never `!important` a `position`** on anything YouTube moves at runtime.
  Drag-and-drop, hover previews and sticky columns all set inline positions,
  and a stylesheet `!important` beats inline.
- **"Only border in the stack" is not "the thing that's painting."** A stale
  line was blamed on the card ring across two sessions; it was a JS-positioned
  `<div>` from the userscript, which appears in no CSS audit of the row. When
  something paints and you can't find it, list every element *and pseudo* with
  a border, outline **or background** — and check whether zeroing your suspect
  actually removes it.
- **`:hover` is never re-evaluated on layout change**, only on the next mouse
  event. Anything that resizes under a stationary cursor can show a stale
  frame, and no stylesheet can revoke it.
- **Attribute matching is case-sensitive.** `[class*="ShortsLockupViewModel"]`
  matched nothing for months; the real class starts lowercase.

## Known open

- Notification bell paints a dark box on light palettes; both obvious elements
  compute transparent backgrounds, so the source is still unidentified.
- The exhaustive dead-selector sweep was only run on the home feed.
- Chromium and Windows are untested — everything here was measured in Firefox
  on Linux.
- **YouTube Music is unfinished and unmatched.** `music.youtube.com` was
  removed from `@-moz-document` in 2.6.64: the theme applied, but shelf
  thumbnails failed to render and card positioning was wrong throughout. §14 of
  the template still holds ~250 lines of `ytmusic-*` rules — inert while the
  domain is unmatched, and kept as the starting point rather than deleted.
  Re-add the domain when they work.
- `m.youtube.com` is still matched but has never been looked at.
