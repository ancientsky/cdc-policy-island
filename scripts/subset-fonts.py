"""Build the three self-hosted Traditional Chinese subsets.

Reads the current UI sources, keeps ASCII, the punctuation those files use,
and every CJK character in the Chinese copy. Hiragana, katakana, and Japanese
kanji stay out of the subset because Japanese loads Noto Sans JP and Noto
Serif JP on demand. A kana mark that actually appears in the Chinese copy is
kept. Translator notes in comments are not part of that copy.

Source OTFs stay in a user cache and are not part of this repo. The cache is
CDC_FONT_CACHE, otherwise LOCALAPPDATA/cdc-font-src, otherwise
XDG_CACHE_HOME or ~/.cache/cdc-font-src.

Requires fontTools and brotli on CPython (not the free-threaded build).
"""

from __future__ import annotations

import os
import re
import urllib.request
from pathlib import Path

import cffsubr
from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "fonts"
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
FILES = ("src/i18n.js", "src/data.js", "src/plain.js", "src/ui.js", "index.html")
EXTRA = "，。、；：？！「」『』（）【】—…・．‧～《》〈〉〔〕｛｝　"
KANA = ((0x3040, 0x309F), (0x30A0, 0x30FF), (0x31F0, 0x31FF), (0xFF65, 0xFF9F))
CJK = ((0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xF900, 0xFAFF))
CAP = 250 * 1024
TOTAL_CAP = 700 * 1024


class OverCap(Exception):
    pass


def cache_dir() -> Path:
    override = os.environ.get("CDC_FONT_CACHE")
    if override:
        return Path(override)
    local = os.environ.get("LOCALAPPDATA")
    if local:
        return Path(local) / "cdc-font-src"
    xdg = os.environ.get("XDG_CACHE_HOME")
    base = Path(xdg) if xdg else Path.home() / ".cache"
    return base / "cdc-font-src"


def in_ranges(ch: str, ranges: tuple[tuple[int, int], ...]) -> bool:
    code = ord(ch)
    return any(start <= code <= end for start, end in ranges)


def read_sources() -> dict[str, str]:
    return {rel: (ROOT / rel).read_text(encoding="utf-8") for rel in FILES}


def strip_comments(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    return re.sub(r"(^|[^:])//.*?$", r"\1", text, flags=re.M)


def drop_locale_blocks(text: str, codes: tuple[str, ...] = ("en", "ja")) -> str:
    """Keep Chinese blocks. Drop sibling en/ja objects indented at two spaces."""
    kept: list[str] = []
    skipping = False
    for line in text.splitlines(keepends=True):
        mark = re.match(r"^  (zh|en|ja):\s*", line)
        if mark:
            skipping = mark.group(1) in codes
            if skipping:
                continue
        elif skipping:
            if line.startswith(" ") or line.strip() == "":
                continue
            skipping = False
        kept.append(line)
    return "".join(kept)


def drop_locale_keys(text: str) -> str:
    """Drop one-line en/ja fields. Chinese copy in data.js is the other text."""
    return re.sub(
        r"(?m)^[ \t]*(?:en|ja)\s*:\s*(?:\"(?:\\.|[^\"\\])*\"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)\s*,?\s*\n",
        "",
        text,
    )


def zh_text(files: dict[str, str]) -> str:
    parts = [
        strip_comments(drop_locale_keys(drop_locale_blocks(files["src/i18n.js"]))),
        strip_comments(drop_locale_keys(drop_locale_blocks(files["src/plain.js"]))),
        strip_comments(drop_locale_keys(files["src/data.js"])),
        strip_comments(drop_locale_keys(files["src/ui.js"])),
        strip_comments(files["index.html"]),
    ]
    return "".join(parts)


def collect_chars(files: dict[str, str], zh: str, zh_cjk_only: bool, zh_symbols_only: bool = False) -> str:
    allowed_cjk = {ch for ch in zh if in_ranges(ch, CJK)}
    keep_kana = {ch for ch in zh if in_ranges(ch, KANA)}
    chars: set[str] = set()
    sources = (zh,) if zh_symbols_only else files.values()
    for text in sources:
        for ch in text:
            if ch in "\n\r\t":
                continue
            if in_ranges(ch, KANA) and ch not in keep_kana:
                continue
            if zh_cjk_only and in_ranges(ch, CJK) and ch not in allowed_cjk:
                continue
            chars.add(ch)
    chars.update(chr(code) for code in range(32, 127))
    chars.update(EXTRA)
    chars.difference_update("\n\r\t")
    return "".join(sorted(chars))


def fetch(name: str) -> Path:
    cache = cache_dir()
    cache.mkdir(parents=True, exist_ok=True)
    dest = cache / name
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
    font.close()
    size = dest.stat().st_size
    print(f"{dest.name} {size} bytes")
    if size > CAP:
        raise OverCap(f"{dest.name} is {size} bytes")


def write_all(text: str) -> int:
    total = 0
    for out_name, src_name in SOURCES.items():
        subset(fetch(src_name), OUT / out_name, text)
        total += (OUT / out_name).stat().st_size
    print(f"total {total} bytes")
    if total > TOTAL_CAP:
        raise OverCap(f"three subsets together are {total} bytes")
    return total


def cmap_chars(path: Path) -> set[str]:
    font = TTFont(path)
    found: set[str] = set()
    for table in font["cmap"].tables:
        found.update(chr(code) for code in table.cmap)
    font.close()
    return found


def verify(zh: str) -> None:
    needed = {ch for ch in zh if in_ranges(ch, CJK)}
    print(f"zh cjk {len(needed)}")
    maps = {name: cmap_chars(OUT / name) for name in SOURCES}
    missing: set[str] = set()
    for name, have in maps.items():
        gap = needed - have
        missing.update(gap)
        print(f"{name} missing {len(gap)}")
    ordered = "".join(sorted(missing))
    print(f"missing {len(missing)}")
    if missing:
        raise SystemExit(f"missing CJK {ordered}")
    sample = "瞭望塔島髒手怪頑固菌長輩"
    absent = "".join(ch for ch in sample if any(ch not in have for have in maps.values()))
    print(f"sample-absent {absent or '-'}")


def main() -> None:
    files = read_sources()
    zh = zh_text(files)
    text = collect_chars(files, zh, zh_cjk_only=True)
    print(f"chars {len(text)}")
    try:
        write_all(text)
    except OverCap as exc:
        print(f"over cap ({exc}); keep symbols from the Chinese copy")
        text = collect_chars(files, zh, zh_cjk_only=True, zh_symbols_only=True)
        print(f"chars {len(text)}")
        write_all(text)
    verify(zh)


if __name__ == "__main__":
    main()
