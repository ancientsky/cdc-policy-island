"""Build the three self-hosted Traditional Chinese subsets.

Reads src/i18n.js, src/data.js, and index.html, keeps ASCII plus the
fullwidth punctuation those files use, and writes woff2 files under src/fonts.
Source OTFs stay in the user cache and are not part of this repo.
Requires fontTools and brotli on CPython (not the free-threaded build).
"""

from __future__ import annotations

import urllib.request
from pathlib import Path

import cffsubr
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "fonts"
CACHE = Path.home() / "AppData" / "Local" / "cdc-font-src"
SOURCES = {
    "NotoSansTC-Regular.subset.woff2": "NotoSansTC-Regular.otf",
    "NotoSansTC-Bold.subset.woff2": "NotoSansTC-Bold.otf",
    "NotoSerifTC-Bold.subset.woff2": "NotoSerifTC-Bold.otf",
}
URLS = {
    "NotoSansTC-Regular.otf": "https://github.com/notofonts/noto-cjk/raw/refs/heads/main/Sans/SubsetOTF/TC/NotoSansTC-Regular.otf",
    "NotoSansTC-Bold.otf": "https://github.com/notofonts/noto-cjk/raw/refs/heads/main/Sans/SubsetOTF/TC/NotoSansTC-Bold.otf",
    "NotoSerifTC-Bold.otf": "https://github.com/notofonts/noto-cjk/raw/refs/heads/main/Serif/SubsetOTF/TC/NotoSerifTC-Bold.otf",
}
EXTRA = "，。、；：？！「」『』（）【】—…・．‧～《》〈〉〔〕｛｝　"


def charset() -> str:
    text = []
    for rel in ("src/i18n.js", "src/data.js", "index.html"):
        text.append((ROOT / rel).read_text(encoding="utf-8"))
    chars = set("".join(text))
    chars.update(chr(code) for code in range(32, 127))
    chars.update(EXTRA)
    chars.discard("\n")
    chars.discard("\r")
    chars.discard("\t")
    return "".join(sorted(chars))


def fetch(name: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    dest = CACHE / name
    if dest.exists() and dest.stat().st_size > 100_000:
        return dest
    url = URLS[name]
    print(f"download {name}")
    urllib.request.urlretrieve(url, dest)
    return dest


def subset(src: Path, dest: Path, text: str) -> None:
    font = TTFont(src)
    options = Options()
    options.hinting = False
    options.layout_features = []
    options.recommended_glyphs = False
    options.notdef_outline = False
    options.desubroutinize = True
    options.drop_tables += ["DSIG", "GSUB", "GPOS", "GDEF", "BASE", "meta", "MERG", "VORG", "vhea", "vmtx"]
    keeper = Subsetter(options=options)
    keeper.populate(text=text)
    keeper.subset(font)
    cffsubr.subroutinize(font)
    dest.parent.mkdir(parents=True, exist_ok=True)
    font.flavor = "woff2"
    font.save(dest)
    size = dest.stat().st_size
    print(f"{dest.name} {size} bytes")
    if size > 250 * 1024:
        raise SystemExit(f"{dest.name} is over 250KB")


def main() -> None:
    text = charset()
    print(f"chars {len(text)}")
    total = 0
    for out_name, src_name in SOURCES.items():
        subset(fetch(src_name), OUT / out_name, text)
        total += (OUT / out_name).stat().st_size
    print(f"total {total} bytes")
    if total > 700 * 1024:
        raise SystemExit("three subsets together are over 700KB")


if __name__ == "__main__":
    main()
