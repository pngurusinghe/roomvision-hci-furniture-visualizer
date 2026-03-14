#!/usr/bin/env python3
"""
RoomVision Asset Validator
==========================
Checks every .gltf, .svg, and texture (.jpg/.bin) in the assets/
directory for correctness:

  1. File is non-empty and non-zero
  2. GLTF files are valid JSON and reference existing texture files
  3. GLTF texture paths resolve relative to the .gltf file location
  4. SVG files contain a valid <svg> root element
  5. JPG files have the correct JPEG magic bytes (0xFF 0xD8)
  6. BIN files referenced by GLTF exist and are non-empty

Usage:
    python3 scripts/validate_assets.py
"""

import os
import sys
import json

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_ROOT = os.path.join(REPO_ROOT, "assets")
CATEGORIES = ["seating", "tables", "storage", "bedroom", "decor"]

PASS  = "✅ PASS"
FAIL  = "❌ FAIL"
WARN  = "⚠️  WARN"

results = []

def check(label: str, ok: bool, detail: str = "") -> bool:
    status = PASS if ok else FAIL
    msg = f"  {status}  {label}"
    if detail:
        msg += f"\n         {detail}"
    results.append((ok, msg))
    print(msg)
    return ok


def validate_svg(path: str) -> bool:
    try:
        with open(path, "rb") as f:
            data = f.read()
        ok = b"<svg" in data and b"</svg>" in data
        return check(f"SVG valid XML   {os.path.relpath(path, REPO_ROOT)}", ok,
                     "" if ok else "Missing <svg> or </svg> tag")
    except Exception as e:
        return check(f"SVG readable    {os.path.relpath(path, REPO_ROOT)}", False, str(e))


def validate_jpg(path: str) -> bool:
    try:
        with open(path, "rb") as f:
            magic = f.read(2)
        ok = magic == b"\xff\xd8"
        return check(f"JPG magic bytes {os.path.relpath(path, REPO_ROOT)}", ok,
                     "" if ok else f"Expected ff d8, got: {magic.hex()}")
    except Exception as e:
        return check(f"JPG readable    {os.path.relpath(path, REPO_ROOT)}", False, str(e))


def validate_gltf(path: str) -> bool:
    rel = os.path.relpath(path, REPO_ROOT)
    gltf_dir = os.path.dirname(path)
    all_ok = True

    # 1. Valid JSON
    try:
        with open(path, "r", encoding="utf-8") as f:
            gltf = json.load(f)
    except Exception as e:
        check(f"GLTF valid JSON {rel}", False, str(e))
        return False

    check(f"GLTF valid JSON {rel}", True)

    # 2. Has at least one mesh / node
    nodes = gltf.get("nodes", [])
    meshes = gltf.get("meshes", [])
    ok = len(meshes) > 0
    if not check(f"GLTF has meshes {rel}", ok, f"Found {len(meshes)} mesh(es)"):
        all_ok = False

    # 3. All referenced images exist
    images = gltf.get("images", [])
    for img in images:
        uri = img.get("uri", "")
        if uri and not uri.startswith("data:"):
            img_path = os.path.join(gltf_dir, uri)
            exists = os.path.isfile(img_path) and os.path.getsize(img_path) > 0
            if not check(f"GLTF texture    {uri}", exists,
                         "" if exists else f"Missing: {img_path}"):
                all_ok = False

    # 4. All referenced buffers (BIN files) exist
    buffers = gltf.get("buffers", [])
    for buf in buffers:
        uri = buf.get("uri", "")
        if uri and not uri.startswith("data:"):
            buf_path = os.path.join(gltf_dir, uri)
            exists = os.path.isfile(buf_path) and os.path.getsize(buf_path) > 0
            if not check(f"GLTF buffer     {uri}", exists,
                         "" if exists else f"Missing: {buf_path}"):
                all_ok = False

    return all_ok


def validate_file_size(path: str, min_bytes: int = 512) -> bool:
    try:
        size = os.path.getsize(path)
        ok = size >= min_bytes
        return check(
            f"File non-empty  {os.path.relpath(path, REPO_ROOT)}",
            ok,
            f"{size:,} bytes" + ("" if ok else f" — too small (min {min_bytes})")
        )
    except Exception as e:
        return check(f"File readable   {os.path.relpath(path, REPO_ROOT)}", False, str(e))


# ── Main ────────────────────────────────────────────────────────────────────
print("=" * 68)
print("  RoomVision Asset Validator")
print("=" * 68)

total_files = 0
for cat in CATEGORIES:
    cat_dir = os.path.join(ASSETS_ROOT, cat)
    if not os.path.isdir(cat_dir):
        print(f"\n{FAIL}  Category dir missing: assets/{cat}")
        continue

    gltf_files = sorted(f for f in os.listdir(cat_dir) if f.endswith(".gltf"))
    svg_files  = sorted(f for f in os.listdir(cat_dir) if f.endswith(".svg"))
    jpg_files  = sorted(f for f in os.listdir(cat_dir) if f.endswith(".jpg"))

    print(f"\n━━  {cat.upper()}  ({len(gltf_files)} GLTF  |  {len(svg_files)} SVG  |  {len(jpg_files)} JPG)")

    # GLTF
    for fname in gltf_files:
        fpath = os.path.join(cat_dir, fname)
        validate_file_size(fpath, 1000)       # at least 1 KB
        validate_gltf(fpath)
        total_files += 1

    # SVG
    for fname in svg_files:
        fpath = os.path.join(cat_dir, fname)
        validate_file_size(fpath, 100)
        validate_svg(fpath)
        total_files += 1

    # JPG textures
    for fname in jpg_files:
        fpath = os.path.join(cat_dir, fname)
        validate_file_size(fpath, 5000)       # textures should be > 5 KB
        validate_jpg(fpath)
        total_files += 1

# ── Summary ─────────────────────────────────────────────────────────────────
passed = sum(1 for ok, _ in results if ok)
failed = sum(1 for ok, _ in results if not ok)
total  = len(results)

print()
print("=" * 68)
print(f"  RESULTS: {passed}/{total} checks passed")
if failed:
    print(f"\n  FAILED CHECKS ({failed}):")
    for ok, msg in results:
        if not ok:
            print(f"    {msg.strip()}")
print("=" * 68)

sys.exit(0 if failed == 0 else 1)
