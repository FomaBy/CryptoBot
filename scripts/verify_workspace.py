#!/usr/bin/env python3
"""Offline checks for this preparation PR; does not read ignored credentials."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]
errors = []
lock = json.loads((ROOT / "skills.lock.json").read_text())
expected = set()
for skill in lock["skills"]:
    directory = ROOT / ".agents" / "skills" / skill["name"]
    entrypoint = directory / "SKILL.md"
    if not entrypoint.is_file():
        errors.append(f"Missing skill: {skill['name']}")
        continue
    text = entrypoint.read_text()
    if not text.startswith("---\n") or "\n---\n" not in text[4:]:
        errors.append(f"Missing frontmatter: {skill['name']}")
    else:
        frontmatter = text.split("---", 2)[1]
        for field in ("name", "description"):
            if not re.search(rf"^{field}:\s*\S", frontmatter, re.MULTILINE):
                errors.append(f"Missing {field}: {skill['name']}")
    for relative, digest in skill["files"].items():
        file = directory / relative
        if not file.resolve().is_relative_to(directory.resolve()):
            errors.append(f"Unsafe lock path: {relative}")
            continue
        expected.add(file)
        if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest() != digest:
            errors.append(f"Skill integrity mismatch: {file.relative_to(ROOT)}")
actual = {p for p in (ROOT / ".agents" / "skills").rglob("*") if p.is_file()}
for extra in sorted(actual - expected):
    errors.append(f"Unrecorded skill file: {extra.relative_to(ROOT)}")

# Only tracked paths are inspected; private root files are never opened.
tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=ROOT).decode().split("\0")
private_names = {"auth.json", "aistat-login.txt", "aistat-oauth-setup.txt"}
for name in filter(None, tracked):
    path = Path(name)
    if (path.name in private_names or path.suffix in {".pem", ".key", ".docx"}
            or (path.name.startswith(".env") and path.name != ".env.example")
            or path.parts[0] in {"secrets", "credentials", "data", "logs", "artifacts"}):
        errors.append(f"Forbidden tracked private path: {name}")

# Validate file destinations in authored Markdown, not upstream manuals.
docs = [ROOT / "README.md", ROOT / "PLAN.md", ROOT / "AGENTS.md"]
docs += list((ROOT / "docs").rglob("*.md"))
for doc in docs:
    if not doc.is_file():
        errors.append(f"Missing document: {doc.name}")
        continue
    for target in re.findall(r"\[[^\]]*\]\(([^)]+)\)", doc.read_text()):
        if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith("#"):
            continue
        target = unquote(target.split("#", 1)[0])
        if target and not (doc.parent / target).exists():
            errors.append(f"Broken link in {doc.relative_to(ROOT)}: {target}")
if errors:
    raise SystemExit("\n".join(errors))
print(f"OK: {len(lock['skills'])} skills, {len(expected)} hashed files, {len(docs)} documents, tracked-path guard")
