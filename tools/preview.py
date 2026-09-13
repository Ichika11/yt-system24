#!/usr/bin/env python3
"""Generate the banner and per-flavour preview images.

Draws the theme's own layout — masthead, mini-guide rail, chip row, a bordered
panel with its [ feed ] label, and a card grid with one card showing its hover
ring — in each flavour's palette. Not screenshots: a wireframe of the grammar,
so the previews stay consistent, contain nothing personal, and regenerate the
moment a palette changes.

Needs rsvg-convert (librsvg) for PNG output; falls back to SVG if absent.

Usage:  python3 tools/preview.py
"""
import pathlib
import shutil
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from flavours import FLAVOURS, TITLES                      # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets"
W, H = 800, 450


def rgba(hex_colour: str, alpha: float) -> str:
    h = hex_colour.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return f"rgba({r},{g},{b},{alpha})"


def mockup(bg, panel, text, hot, rose, lime, *, wordmark=None, subtitle=None):
    line = rgba(hot, 0.45)
    dim = rgba(text, 0.45)
    body = rgba(text, 0.85)
    p = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
         f'<rect width="{W}" height="{H}" fill="{bg}"/>']

    # mini-guide rail
    p.append(f'<rect x="8" y="8" width="46" height="{H-16}" fill="none" stroke="{line}"/>')
    for i, y in enumerate((26, 66, 106, 146)):
        c = hot if i == 0 else dim
        p.append(f'<rect x="22" y="{y}" width="18" height="12" fill="{c}"/>')
        p.append(f'<rect x="18" y="{y+16}" width="26" height="3" fill="{dim}"/>')

    # masthead — open at the bottom where the chip row continues it
    p.append(f'<path d="M64 8 H792 V44 M64 44 V8" fill="none" stroke="{line}"/>')
    p.append(f'<rect x="78" y="20" width="16" height="12" fill="{dim}"/>')
    p.append(f'<rect x="104" y="19" width="20" height="14" fill="{hot}"/>')
    p.append(f'<text x="132" y="31" font-family="ui-monospace,monospace" font-size="14" '
             f'font-weight="700" fill="{text}">system24</text>')
    p.append(f'<rect x="300" y="16" width="240" height="20" fill="none" stroke="{line}"/>')
    p.append(f'<rect x="700" y="16" width="76" height="20" fill="none" stroke="{line}"/>')

    # chip row — the bottom half of the same box
    p.append(f'<path d="M64 44 H792 V80 H64 Z" fill="none" stroke="{line}"/>')
    for i, (x, w) in enumerate(((78, 34), (120, 48), (176, 62), (246, 44), (298, 70), (376, 52))):
        fill = hot if i == 0 else "none"
        tc = bg if i == 0 else dim
        p.append(f'<rect x="{x}" y="52" width="{w}" height="20" fill="{fill}" stroke="{line}"/>')
        p.append(f'<rect x="{x+8}" y="60" width="{w-16}" height="4" fill="{tc}"/>')

    # the panel, with its label notching the top border
    py = 96
    p.append(f'<path d="M76 {py} H64 V{H-8} H792 V{py} H150" fill="none" stroke="{line}"/>')
    p.append(f'<text x="82" y="{py+4}" font-family="ui-monospace,monospace" font-size="11" '
             f'fill="{dim}">[ feed ]</text>')

    # card grid — the middle card wears the hover ring
    for col in range(3):
        x = 84 + col * 236
        y = py + 28
        if col == 1:
            p.append(f'<rect x="{x-4}" y="{y-4}" width="216" height="176" fill="none" '
                     f'stroke="{hot}" stroke-width="2"/>')
        p.append(f'<rect x="{x}" y="{y}" width="208" height="118" fill="{panel}" stroke="{line}"/>')
        p.append(f'<rect x="{x+168}" y="{y+100}" width="34" height="12" fill="{bg}" stroke="{line}"/>')
        p.append(f'<rect x="{x}" y="{y+130}" width="180" height="7" fill="{body}"/>')
        p.append(f'<rect x="{x}" y="{y+143}" width="126" height="7" fill="{body}"/>')
        p.append(f'<rect x="{x}" y="{y+158}" width="92" height="5" fill="{dim}"/>')

    # a second shelf, hinting at depth, tinted with the other two tiers
    sy = py + 226
    p.append(f'<rect x="84" y="{sy}" width="62" height="7" fill="{rose}"/>')
    for col in range(5):
        x = 84 + col * 142
        p.append(f'<rect x="{x}" y="{sy+16}" width="126" height="72" fill="{panel}" stroke="{line}"/>')
        p.append(f'<rect x="{x}" y="{sy+96}" width="104" height="6" fill="{dim}"/>')
    p.append(f'<rect x="{84+4*142}" y="{sy+16}" width="126" height="72" fill="none" stroke="{lime}"/>')

    if wordmark:
        p.append(f'<rect x="0" y="0" width="{W}" height="{H}" fill="{rgba(bg, 0.72)}"/>')
        p.append(f'<text x="{W//2}" y="{H//2 - 6}" text-anchor="middle" '
                 f'font-family="ui-monospace,monospace" font-size="52" font-weight="700" '
                 f'fill="{text}">yt-<tspan fill="{hot}">system24</tspan></text>')
        p.append(f'<text x="{W//2}" y="{H//2 + 28}" text-anchor="middle" '
                 f'font-family="ui-monospace,monospace" font-size="15" fill="{dim}">{subtitle}</text>')

    p.append('</svg>')
    return '\n'.join(p)


def write(path: pathlib.Path, svg: str, width: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    svg_path = path.with_suffix('.svg')
    svg_path.write_text(svg)
    if shutil.which('rsvg-convert'):
        subprocess.run(['rsvg-convert', '-w', str(width), '-o', str(path), str(svg_path)],
                       check=True)
        svg_path.unlink()
        print(f"  {path.relative_to(ROOT)}")
    else:
        print(f"  {svg_path.relative_to(ROOT)}  (no rsvg-convert; SVG only)")


def main() -> int:
    hero = FLAVOURS["tokyo-night"]
    write(OUT / "banner.png",
          mockup(*hero, wordmark=True, subtitle="a tui-style youtube theme."), 1200)

    for slug, cols in FLAVOURS.items():
        write(OUT / "flavours" / f"{slug}.png", mockup(*cols), 600)

    print(f"\n  banner + {len(FLAVOURS)} flavour previews -> assets/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
