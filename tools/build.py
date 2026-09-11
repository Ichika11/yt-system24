#!/usr/bin/env python3
"""Render templates/youtube.user.css into dist/ for publishing.

The published build is NOT the same as the one you install locally:

    local  (~/.cache/wal/…)  no @updateURL  — pywal is what updates it
    dist/  (this script)     @updateURL     — Stylus auto-updates it

That difference is the whole reason this script exists. If dist/ ever ships
without @updateURL, auto-update silently stops working for everyone who
installed from the URL. If the LOCAL copy ever gains one, Stylus will
periodically overwrite the user's wallpaper-derived palette with this
snapshot's colours.

Usage:  python3 tools/build.py [--check]
        --check  validate only, write nothing
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "templates" / "youtube.user.css"
DIST = ROOT / "dist" / "youtube-pywal.snapshot.user.css"
UPDATE_URL = (
    "@updateURL      https://raw.githubusercontent.com/"
    "Ichika11/yt-system24/main/dist/youtube-pywal.snapshot.user.css"
)
ANCHOR = "@supportURL     https://github.com/Ichika11/yt-system24/issues"


def palette():
    """Current pywal colours, or a neutral dark fallback if pywal isn't set up."""
    try:
        from pywal import colors as wcolors, export
        import os
        return export.flatten_colors(
            wcolors.file(os.path.expanduser("~/.cache/wal/colors.json"))
        )
    except Exception as exc:                                  # noqa: BLE001
        print(f"  pywal unavailable ({exc}); using fallback palette")

        class C(str):
            @property
            def rgb(self):
                return ",".join(str(int(self[i:i + 2], 16)) for i in (1, 3, 5))

        cols = {"background": C("#0d0d0d"), "foreground": C("#e8e8e8"),
                "cursor": C("#e8e8e8")}
        for i in range(16):
            cols[f"color{i}"] = C("#7aa2f7")
        return cols


def main() -> int:
    src = TEMPLATE.read_text()

    # 1. brace discipline — every literal CSS brace must be doubled
    if src.count("{") != src.count("}"):
        print("FAIL: unbalanced braces in the template")
        return 1

    # 2. survives pywal's formatter
    try:
        out = src.format(**palette())
    except (KeyError, IndexError, ValueError) as exc:
        print(f"FAIL: .format() rejected the template: {exc}")
        return 1
    if "{{" in out or "}}" in out or out.count("{") != out.count("}"):
        print("FAIL: doubled braces survived rendering")
        return 1

    # 3. real CSS parse, if tinycss2 is around
    try:
        import tinycss2
        i = out.index("{", out.index("@-moz-document"))
        rules = tinycss2.parse_stylesheet(out[i + 1:out.rindex("}")],
                                          skip_comments=True, skip_whitespace=True)
        errs = [r for r in rules if r.type == "error"]
        print(f"  {len(rules) - len(errs)} rules, {len(errs)} parse errors")
        if errs:
            for e in errs[:5]:
                print("   ", e)
            return 1
    except ImportError:
        print("  tinycss2 not installed — skipping the parser pass")

    if "--check" in sys.argv:
        print("OK (check only, nothing written)")
        return 0

    if ANCHOR not in out:
        print("FAIL: @supportURL anchor missing — cannot place @updateURL")
        return 1
    DIST.write_text(out.replace(ANCHOR, ANCHOR + "\n" + UPDATE_URL))
    print(f"  wrote {DIST.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
