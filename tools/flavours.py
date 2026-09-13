#!/usr/bin/env python3
"""Render templates/youtube.user.css into dist/flavours/ with fixed palettes.

For people who want the theme without setting pywal up. Each flavour is a
complete, installable UserCSS with the colours baked in.

The template only consumes six palette keys, so a flavour is just six hexes:

    bg      page background          -> {background}
    panel   raised surfaces          -> {color0}
    text    foreground               -> {foreground}
    hot     tier 1, primary accent   -> {color4}   (also borders, at 45%/20%)
    rose    tier 2, comments/sidebar -> {color5}
    lime    tier 3, queue/playlist   -> {color6}

Each file gets its own @name, because Stylus keys style identity on
@name + @namespace — flavours sharing a name would overwrite each other on
install rather than sitting side by side.

Usage:  python3 tools/flavours.py
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "templates" / "youtube.user.css"
OUT = ROOT / "dist" / "flavours"
RAW = "https://raw.githubusercontent.com/Ichika11/yt-system24/main/dist/flavours"

#            bg         panel      text       hot        rose       lime
FLAVOURS = {
    "catppuccin-mocha":  ("#1e1e2e", "#181825", "#cdd6f4", "#89b4fa", "#cba6f7", "#94e2d5"),
    "catppuccin-latte":  ("#eff1f5", "#e6e9ef", "#4c4f69", "#1e66f5", "#8839ef", "#179299"),
    "gruvbox-dark":      ("#282828", "#1d2021", "#ebdbb2", "#83a598", "#d3869b", "#8ec07c"),
    "gruvbox-light":     ("#fbf1c7", "#f2e5bc", "#3c3836", "#076678", "#8f3f71", "#427b58"),
    "nord":              ("#2e3440", "#3b4252", "#eceff4", "#88c0d0", "#b48ead", "#8fbcbb"),
    "tokyo-night":       ("#1a1b26", "#16161e", "#c0caf5", "#7aa2f7", "#bb9af7", "#7dcfff"),
    "dracula":           ("#282a36", "#21222c", "#f8f8f2", "#bd93f9", "#ff79c6", "#8be9fd"),
    "rose-pine":         ("#191724", "#1f1d2e", "#e0def4", "#c4a7e7", "#ebbcba", "#9ccfd8"),
}

TITLES = {
    "catppuccin-mocha": "Catppuccin Mocha", "catppuccin-latte": "Catppuccin Latte",
    "gruvbox-dark": "Gruvbox Dark", "gruvbox-light": "Gruvbox Light",
    "nord": "Nord", "tokyo-night": "Tokyo Night",
    "dracula": "Dracula", "rose-pine": "Rosé Pine",
}


class Hex(str):
    """Stands in for pywal's colour object — the template uses .rgb on some."""

    @property
    def rgb(self):
        h = self.lstrip("#")
        return ",".join(str(int(h[i:i + 2], 16)) for i in (0, 2, 4))


def main() -> int:
    src = TEMPLATE.read_text()
    OUT.mkdir(parents=True, exist_ok=True)

    for slug, (bg, panel, text, hot, rose, lime) in FLAVOURS.items():
        cols = {"background": Hex(bg), "foreground": Hex(text), "cursor": Hex(text),
                "color0": Hex(panel), "color4": Hex(hot), "color5": Hex(rose),
                "color6": Hex(lime)}
        # the template only reads the six above, but .format() needs every key
        # it might encounter, so fill the rest of the wal palette with the accent
        for i in range(16):
            cols.setdefault(f"color{i}", Hex(hot))

        out = src.format(**cols)
        if "{{" in out or out.count("{") != out.count("}"):
            print(f"FAIL {slug}: brace mismatch after render")
            return 1

        title = TITLES[slug]
        out = out.replace("@name           YouTube pywal",
                          f"@name           YouTube system24 — {title}")
        out = out.replace(
            "@supportURL     https://github.com/Ichika11/yt-system24/issues",
            "@supportURL     https://github.com/Ichika11/yt-system24/issues\n"
            f"@updateURL      {RAW}/{slug}.user.css")

        (OUT / f"{slug}.user.css").write_text(out)
        print(f"  {slug:<18} {bg} / {hot}")

    print(f"\n  {len(FLAVOURS)} flavours -> {OUT.relative_to(ROOT)}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
