# yt-system24

A TUI/terminal-styled YouTube userstyle in the **system24** grammar, re-themed
from your desktop wallpaper by [pywal](https://github.com/dylanaraps/pywal).

Inspired by [refact0r's system24](https://github.com/refact0r/system24) for
Discord — the box grammar, the `[ panel ]` labels and the two-tier colour
system come from there.

Covers `youtube.com`, `music.youtube.com` and `m.youtube.com`.
`studio.youtube.com` is deliberately **not** matched — the box grammar wrecks it.

---

## What's here

| path | what it is |
|---|---|
| `templates/youtube.user.css` | **Source of truth.** A pywal template — every literal CSS brace is doubled (`{{`/`}}`) so `str.format()` can substitute the palette. |
| `dist/youtube-pywal.snapshot.user.css` | A rendered snapshot, installable directly if you don't use pywal. Edit the `:root` block at the top to re-colour it. |
| `userscripts/yt-panel-scroll-sync.user.js` | Keeps YouTube's hover preview in step with the theme's fixed, internally-scrolling panels. |
| `userscripts/videotint.user.js` | Tints the player chrome to match the palette. |

---

## Install

### With pywal

Drop the template where pywal will render it, then point Stylus at the output:

```bash
cp templates/youtube.user.css ~/.config/wal/templates/
wal -n --theme <your-theme>        # renders every template in that directory
wl-copy < ~/.cache/wal/youtube.user.css
```

Then paste into a new Stylus UserCSS style (Ctrl+A, Ctrl+V, Ctrl+S). Stylus
keys style identity on `@name` + `@namespace`, so re-pasting updates the same
style rather than creating a second one.

**Do not install the pywal build from a URL.** `dist/…snapshot.user.css`
carries an `@updateURL`, so Stylus will auto-update it — which on a pywal setup
means periodically overwriting your wallpaper-derived palette with the
snapshot's. The template renders *without* that line for exactly this reason;
paste from `~/.cache/wal/` and let pywal be the thing that updates it.

### Without pywal — pick a flavour

Eight ready-made palettes in `dist/flavours/`. Open the raw URL and Stylus
offers to install it; no pywal, no terminal, no editing.

| flavour | | flavour | |
|---|---|---|---|
| `catppuccin-mocha` | dark | `catppuccin-latte` | light |
| `gruvbox-dark` | dark | `gruvbox-light` | light |
| `nord` | dark | `tokyo-night` | dark |
| `dracula` | dark | `rose-pine` | dark |

```
https://raw.githubusercontent.com/Ichika11/yt-system24/main/dist/flavours/<name>.user.css
```

Each carries its own `@name`, so you can install several and switch between
them in Stylus rather than reinstalling. Regenerate them after editing the
template with `python3 tools/flavours.py`; adding a palette is six hex values
in that file.

### Without pywal — your own colours

Install `dist/youtube-pywal.snapshot.user.css` in Stylus and edit the palette
variables at the top of `:root`:

```css
--yt-bg:    #0d0d0d;   /* page background       */
--yt-panel: #141414;   /* panel / raised surface */
--yt-hot:   #7aa2f7;   /* tier 1 — interactive  */
--yt-text:  #e8e8e8;
```

### Userscripts

Both go in Tampermonkey or Violentmonkey. They're optional — the stylesheet
works without them, but hover previews behave better with
`yt-panel-scroll-sync` installed.

---

## Light mode

There is no light/dark switch, and nothing consults the OS theme — the
stylesheet contains no `prefers-color-scheme` rule at all. **Light mode comes
from the wallpaper.** Point pywal at a light image and the whole theme goes
light; a dark system theme doesn't override it either way.

One deliberate exception: `videotint.user.js` sets `DARK_ONLY = true`, so the
player chrome stays dark even on a light palette. Chrome sitting directly on
video wants to be dark regardless of the page around it — YouTube's own player
behaves the same way. Flip that constant if you disagree.

## Tuning

Everything adjustable lives in one `--s24-*` block at the top of `:root`. Edit
those, not the rules:

| token | what it controls |
|---|---|
| `--s24-gap` | space between panels and the viewport edge |
| `--s24-border` / `--s24-hair` | structural vs. in-panel border weight |
| `--s24-ring` | hover/focus ring thickness — one value, everywhere |
| `--s24-pad` | panel inner padding |
| `--s24-bar` / `--s24-rail` / `--s24-drawer` | masthead height, mini-guide width, open drawer width |
| `--s24-motion` / `--s24-slide` | transition timing; set `0s` to kill animation |
| `--s24-labels` | `none` turns off the `[ feed ]` / `[ watch ]` panel labels |
| `--s24-halo` | `transparent` turns off the player legibility halo |

`--s24-inset`, `--s24-push`, `--s24-head`, `--s24-top` and `--s24-left` are
derived from those — leave them alone.

---

## Editing the template

Two rules, both easy to forget:

1. **Double every literal CSS brace.** The template is run through Python's
   `str.format()`, so `{` and `}` must be written `{{` and `}}`. Only palette
   placeholders like `{color4}` stay single.
2. **Bump `@version` on every change.** Stylus will not reload a style whose
   version hasn't moved, and a stale cache looks exactly like a broken
   selector.

Validate before shipping:

```python
out = open("templates/youtube.user.css").read().format(**colors)
assert "{{" not in out and out.count("{") == out.count("}")
```

---

## Development

`templates/youtube.user.css` in this repo is the real file. On the author's
machine the pywal template path is a symlink to it:

```bash
ln -sfn ~/yt-system24/templates/youtube.user.css ~/.config/wal/templates/youtube.user.css
```

so there is exactly one file and the repo cannot drift from what's installed.

To rebuild the published snapshot after editing the template:

```bash
python3 tools/build.py          # validate + write dist/
python3 tools/build.py --check  # validate only
```

The script checks brace balance, renders through `.format()`, parses the result
with tinycss2 if available, and adds `@updateURL` to `dist/` — **only** there.
See the docstring for why that line must never reach the local install.

## Screenshots

`tools/demo-mode.js` replaces video titles, channel names and thumbnails with
generated placeholders, so the theme can be photographed without publishing a
real feed, subscription list or watch history. Paste it into the console, then
screenshot; reload to restore. It rewrites only the DOM in front of you.

For pages that exist logged out, a private window is simpler — YouTube serves
generic trending content with nothing personal in it. The script is for the
pages that need a session: history, Watch Later, subscriptions, playlists.

## Contributing / debugging

The one rule that matters: **measure, don't guess.** Nearly every fix in this
project that stuck came after a `getBoundingClientRect()` / `getComputedStyle()`
dump from a live page; nearly every one that failed came from a plausible guess
about YouTube's DOM.

Traps worth knowing before you start:

- **Stylus injects with user-origin `!important`**, which beats an
  author-origin `!important` from a `<style>` injected via the console. Live
  tests that try to override the theme silently do nothing. Setting an
  inherited custom property inline on the element does win.
- **DevTools docked to the side** drops the viewport below the theme's 900px
  breakpoint, where the whole panel grammar deliberately stands down. Measure
  with DevTools in a separate window, or you're measuring the wrong layout.
- **Outlines paint below descendants.** A ring on a card is a positioned
  `::after` overlay, not an `outline`, because an opaque thumbnail would cover
  an outline.
- **Never `!important` a `position`** on anything YouTube moves at runtime —
  drag-and-drop, hover previews and sticky columns all set inline positions,
  and a stylesheet `!important` beats inline.

## Licence

MIT — see `LICENSE`.
