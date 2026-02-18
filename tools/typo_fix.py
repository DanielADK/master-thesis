#!/usr/bin/env python3
"""Czech typography fixer for LaTeX thesis files.

Runs vlna (single-letter prepositions) + custom regex rules.
LaTeX-aware: skips comments, math mode, command arguments.

Usage:
    python3 tools/typo_fix.py           # dry-run
    python3 tools/typo_fix.py --apply   # write changes
"""

import argparse
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MASK = "\x00TYPOMASK{}\x00"

PROTECT = [
    re.compile(r"%[^\n]*"),
    re.compile(r"\\begin\{(verbatim|lstlisting|minted)\}.*?\\end\{\1\}", re.DOTALL),
    re.compile(r"\$\$.*?\$\$|\\\[.*?\\\]", re.DOTALL),
    re.compile(r"\$[^$\n]*\$|\\\(.*?\\\)", re.DOTALL),
    re.compile(r"\\(?:label|ref|eqref|autoref|nameref|cite|parencite|textcite|"
               r"input|include|includegraphics|url|href|addbibresource)"
               r"(?:\[[^\]]*\])?\{[^}]*\}"),
    re.compile(r"\\begin\{(abstractEN|keywordsEN)\}.*?\\end\{\1\}", re.DOTALL),
]

U = "A-ZÁČĎÉĚÍĹĽŇÓŔŘŠŤÚŮÝŽ"
RULES = [
    (re.compile(rf"\b(Ing|Mgr|Bc|MgA|JUDr|MUDr|PhDr|RNDr|Ph\.D|CSc|Dr|Doc|doc|Prof|prof|DiS)\.\s+([{U}])"), r"\1.~\2"),
    (re.compile(r"(?<![\w~])(č|čl|odst|str|obr|tab|kap|sv|roč|Sb)\.\s+(\d)"), r"\1.~\2"),
    (re.compile(r"(\d)\s+(kg|g|mg|t|m|cm|mm|km|ha|l|ml|hod|min|Kč|EUR|USD|GB|MB|\\?%)(?![\wá-ž])"), r"\1~\2"),
    (re.compile(r",\s+(\d{4})(?=[\s,.;:)\]}])"), r",~\1"),
    (re.compile(r",\s+(který|která|které|kteří|kterého|kterou|kterým|kterých|kterými|jenž|jež|jehož|jejíž|jejichž|což|přičemž)(?=[\s,.;:)\]}])"), r",~\1"),
]


def run_vlna(text: str) -> str:
    with tempfile.NamedTemporaryFile("w", suffix=".tex", delete=False, encoding="utf-8") as f:
        f.write(text)
        tmp = f.name
    try:
        subprocess.run(["vlna", "-f", tmp], capture_output=True)
        return Path(tmp).read_text(encoding="utf-8")
    except FileNotFoundError:
        return text
    finally:
        Path(tmp).unlink(missing_ok=True)


def fix(text: str) -> str:
    text = run_vlna(text)
    tokens: list[str] = []
    for pat in PROTECT:
        text = pat.sub(lambda m: (tokens.append(m.group(0)), MASK.format(len(tokens) - 1))[1], text)
    for pat, repl in RULES:
        text = pat.sub(repl, text)
    for i in range(len(tokens) - 1, -1, -1):
        text = text.replace(MASK.format(i), tokens[i])
    return text


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--apply", action="store_true", help="write changes to disk")
    args = p.parse_args()

    files = sorted(p for g in ("*.tex", "parts/*.tex") for p in ROOT.glob(g))
    total = 0
    for path in files:
        orig = path.read_text(encoding="utf-8")
        new = fix(orig)
        if new == orig:
            continue
        n = sum(1 for a, b in zip(orig, new) if a != b) + abs(len(new) - len(orig))
        total += n
        print(f"  {path.relative_to(ROOT)}: {n} char changes")
        if args.apply:
            path.write_text(new, encoding="utf-8")

    print(f"\n==> Total: {total} changes across {len(files)} files scanned.")
    if total and not args.apply:
        print("    Run with --apply to save.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
