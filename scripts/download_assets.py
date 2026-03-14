#!/usr/bin/env python3
"""
RoomVision Asset Downloader
============================
Downloads 25 CC0 furniture GLB models from Poly Haven and generates
matching 2D top-down SVG icons for the 2D editor.

Usage:
    python3 scripts/download_assets.py

All models are CC0 (public domain) from https://polyhaven.com
"""

import os
import json
import time
import urllib.request
import urllib.error

# ── Root paths ─────────────────────────────────────────────────────────────
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_ROOT = os.path.join(REPO_ROOT, "assets")

# ── Asset manifest ──────────────────────────────────────────────────────────
# Format: (local_filename_stem, poly_haven_slug, category)
MANIFEST = [
    # Seating ─────────────────────────────────────────────────────────────
    ("sofa",          "Sofa_01",          "seating"),
    ("armchair",      "ArmChair_01",      "seating"),
    ("dining_chair",  "dining_chair_02",  "seating"),
    ("bar_stool",     "bar_chair_round_01", "seating"),
    ("ottoman",       "Ottoman_01",       "seating"),
    # Tables ──────────────────────────────────────────────────────────────
    ("coffee_table",   "CoffeeTable_01",         "tables"),
    ("round_table",    "coffee_table_round_01",   "tables"),
    ("dining_table",   "WoodenTable_01",          "tables"),
    ("side_table",     "WoodenTable_02",          "tables"),
    ("console_table",  "ClassicConsole_01",       "tables"),
    # Storage ─────────────────────────────────────────────────────────────
    ("bookshelf",      "Shelf_01",          "storage"),
    ("tall_cabinet",   "GothicCabinet_01",  "storage"),
    ("drawer_cabinet", "drawer_cabinet",    "storage"),
    ("commode",        "GothicCommode_01",  "storage"),
    ("display_cabinet","chinese_cabinet",   "storage"),
    # Bedroom ─────────────────────────────────────────────────────────────
    ("bed",            "GothicBed_01",            "bedroom"),
    ("nightstand",     "ClassicNightstand_01",    "bedroom"),
    ("room_divider",   "chinese_screen_panels",   "bedroom"),
    ("vanity_stool",   "chinese_stool",           "bedroom"),
    ("alarm_clock",    "alarm_clock_01",           "bedroom"),
    # Decor ───────────────────────────────────────────────────────────────
    ("vase",            "ceramic_vase_01",         "decor"),
    ("picture_frame",   "fancy_picture_frame_01",  "decor"),
    ("wall_frame",      "hanging_picture_frame_02","decor"),
    ("chess_set",       "chess_set",               "decor"),
    ("chandelier",      "Chandelier_01",           "decor"),
]

# ── SVG top-down templates (one per item) ───────────────────────────────────
# Each is a standalone 120×120 SVG representing the top-down floor-plan view.
SVG_TEMPLATES = {
    # ── Seating ──────────────────────────────────────────────────────────
    "sofa": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80">
  <rect x="5" y="5" width="110" height="70" rx="8" fill="#8B7355" stroke="#5C4A2A" stroke-width="2"/>
  <rect x="5" y="5" width="110" height="22" rx="6" fill="#6B5A3E" stroke="#5C4A2A" stroke-width="1.5"/>
  <rect x="5" y="5" width="18" height="70" rx="6" fill="#6B5A3E" stroke="#5C4A2A" stroke-width="1.5"/>
  <rect x="97" y="5" width="18" height="70" rx="6" fill="#6B5A3E" stroke="#5C4A2A" stroke-width="1.5"/>
  <text x="60" y="52" font-family="Arial" font-size="9" fill="#FFF5E0" text-anchor="middle">Sofa</text>
</svg>""",

    "armchair": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90" width="90" height="90">
  <rect x="10" y="10" width="70" height="70" rx="8" fill="#A0855B" stroke="#6B5030" stroke-width="2"/>
  <rect x="10" y="10" width="70" height="20" rx="6" fill="#7A6040" stroke="#6B5030" stroke-width="1.5"/>
  <rect x="10" y="10" width="16" height="70" rx="6" fill="#7A6040" stroke="#6B5030" stroke-width="1.5"/>
  <rect x="64" y="10" width="16" height="70" rx="6" fill="#7A6040" stroke="#6B5030" stroke-width="1.5"/>
  <text x="45" y="62" font-family="Arial" font-size="8" fill="#FFF5E0" text-anchor="middle">Armchair</text>
</svg>""",

    "dining_chair": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 80" width="70" height="80">
  <rect x="10" y="25" width="50" height="45" rx="4" fill="#C8A882" stroke="#8B6914" stroke-width="2"/>
  <rect x="10" y="8" width="50" height="20" rx="3" fill="#8B6914" stroke="#5C4508" stroke-width="1.5"/>
  <circle cx="14" cy="72" r="3" fill="#5C4508"/>
  <circle cx="56" cy="72" r="3" fill="#5C4508"/>
  <text x="35" y="52" font-family="Arial" font-size="8" fill="#3D2B00" text-anchor="middle">Chair</text>
</svg>""",

    "bar_stool": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 70" width="70" height="70">
  <circle cx="35" cy="35" r="28" fill="#C8A882" stroke="#8B6914" stroke-width="2"/>
  <circle cx="35" cy="35" r="20" fill="#B8966E" stroke="#8B6914" stroke-width="1.5"/>
  <line x1="35" y1="35" x2="10" y2="60" stroke="#8B6914" stroke-width="2"/>
  <line x1="35" y1="35" x2="60" y2="60" stroke="#8B6914" stroke-width="2"/>
  <text x="35" y="38" font-family="Arial" font-size="8" fill="#3D2B00" text-anchor="middle">Stool</text>
</svg>""",

    "ottoman": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70" width="100" height="70">
  <rect x="5" y="5" width="90" height="60" rx="10" fill="#6B4C3B" stroke="#3D2416" stroke-width="2"/>
  <rect x="15" y="15" width="70" height="40" rx="6" fill="#7A5A47" stroke="#3D2416" stroke-width="1"/>
  <line x1="5" y1="35" x2="95" y2="35" stroke="#3D2416" stroke-width="1" stroke-dasharray="4,4"/>
  <line x1="50" y1="5" x2="50" y2="65" stroke="#3D2416" stroke-width="1" stroke-dasharray="4,4"/>
  <text x="50" y="39" font-family="Arial" font-size="8" fill="#FFF5E0" text-anchor="middle">Ottoman</text>
</svg>""",

    # ── Tables ────────────────────────────────────────────────────────────
    "coffee_table": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130 70" width="130" height="70">
  <rect x="5" y="5" width="120" height="60" rx="6" fill="#D4A96A" stroke="#8B6914" stroke-width="2"/>
  <rect x="12" y="12" width="106" height="46" rx="3" fill="#E8C48A" stroke="#8B6914" stroke-width="1"/>
  <circle cx="15" cy="15" r="5" fill="#8B6914"/>
  <circle cx="105" cy="15" r="5" fill="#8B6914"/>
  <circle cx="15" cy="55" r="5" fill="#8B6914"/>
  <circle cx="105" cy="55" r="5" fill="#8B6914"/>
  <text x="65" y="40" font-family="Arial" font-size="8" fill="#3D2B00" text-anchor="middle">Coffee Table</text>
</svg>""",

    "round_table": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <circle cx="50" cy="50" r="44" fill="#D4A96A" stroke="#8B6914" stroke-width="2"/>
  <circle cx="50" cy="50" r="36" fill="#E8C48A" stroke="#8B6914" stroke-width="1"/>
  <circle cx="50" cy="50" r="8" fill="#8B6914"/>
  <text x="50" y="54" font-family="Arial" font-size="8" fill="#3D2B00" text-anchor="middle">Round Table</text>
</svg>""",

    "dining_table": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 80" width="160" height="80">
  <rect x="5" y="5" width="150" height="70" rx="5" fill="#C8954A" stroke="#8B5A14" stroke-width="2"/>
  <rect x="14" y="14" width="132" height="52" rx="2" fill="#D4A96A" stroke="#8B5A14" stroke-width="1"/>
  <circle cx="14" cy="14" r="6" fill="#8B5A14"/>
  <circle cx="146" cy="14" r="6" fill="#8B5A14"/>
  <circle cx="14" cy="66" r="6" fill="#8B5A14"/>
  <circle cx="146" cy="66" r="6" fill="#8B5A14"/>
  <text x="80" y="44" font-family="Arial" font-size="9" fill="#3D2B00" text-anchor="middle">Dining Table</text>
</svg>""",

    "side_table": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 70" width="70" height="70">
  <rect x="8" y="8" width="54" height="54" rx="8" fill="#C8954A" stroke="#8B5A14" stroke-width="2"/>
  <rect x="16" y="16" width="38" height="38" rx="4" fill="#D4A96A" stroke="#8B5A14" stroke-width="1"/>
  <circle cx="16" cy="16" r="5" fill="#8B5A14"/>
  <circle cx="54" cy="16" r="5" fill="#8B5A14"/>
  <circle cx="16" cy="54" r="5" fill="#8B5A14"/>
  <circle cx="54" cy="54" r="5" fill="#8B5A14"/>
  <text x="35" y="40" font-family="Arial" font-size="8" fill="#3D2B00" text-anchor="middle">Side Table</text>
</svg>""",

    "console_table": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 50" width="140" height="50">
  <rect x="5" y="5" width="130" height="40" rx="5" fill="#C8954A" stroke="#8B5A14" stroke-width="2"/>
  <rect x="15" y="12" width="110" height="26" rx="2" fill="#D4A96A" stroke="#8B5A14" stroke-width="1"/>
  <circle cx="14" cy="14" r="5" fill="#8B5A14"/>
  <circle cx="126" cy="14" r="5" fill="#8B5A14"/>
  <circle cx="14" cy="36" r="5" fill="#8B5A14"/>
  <circle cx="126" cy="36" r="5" fill="#8B5A14"/>
  <text x="70" y="30" font-family="Arial" font-size="8" fill="#3D2B00" text-anchor="middle">Console Table</text>
</svg>""",

    # ── Storage ───────────────────────────────────────────────────────────
    "bookshelf": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 120" width="60" height="120">
  <rect x="4" y="4" width="52" height="112" rx="3" fill="#8B6914" stroke="#5C4508" stroke-width="2"/>
  <rect x="8" y="12" width="44" height="18" rx="1" fill="#C8A25A"/>
  <rect x="8" y="35" width="44" height="18" rx="1" fill="#B8922A"/>
  <rect x="8" y="58" width="44" height="18" rx="1" fill="#C8A25A"/>
  <rect x="8" y="81" width="44" height="18" rx="1" fill="#B8922A"/>
  <rect x="8" y="104" width="44" height="8" rx="1" fill="#C8A25A"/>
  <text x="30" y="66" font-family="Arial" font-size="7" fill="#FFF5E0" text-anchor="middle" transform="rotate(90,30,66)">Bookshelf</text>
</svg>""",

    "tall_cabinet": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 110" width="70" height="110">
  <rect x="4" y="4" width="62" height="102" rx="4" fill="#6B4C3B" stroke="#3D2416" stroke-width="2"/>
  <line x1="4" y1="55" x2="66" y2="55" stroke="#3D2416" stroke-width="1.5"/>
  <rect x="12" y="18" width="46" height="32" rx="2" fill="#7A5A47"/>
  <rect x="12" y="62" width="46" height="36" rx="2" fill="#7A5A47"/>
  <circle cx="35" cy="34" r="3" fill="#C8B040"/>
  <circle cx="35" cy="80" r="3" fill="#C8B040"/>
  <text x="35" y="58" font-family="Arial" font-size="7" fill="#FFF5E0" text-anchor="middle">Cabinet</text>
</svg>""",

    "drawer_cabinet": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 100" width="80" height="100">
  <rect x="4" y="4" width="72" height="92" rx="4" fill="#7A6040" stroke="#5C4A2A" stroke-width="2"/>
  <rect x="10" y="12" width="60" height="16" rx="2" fill="#9A8060"/>
  <rect x="10" y="32" width="60" height="16" rx="2" fill="#8A7050"/>
  <rect x="10" y="52" width="60" height="16" rx="2" fill="#9A8060"/>
  <rect x="10" y="72" width="60" height="16" rx="2" fill="#8A7050"/>
  <circle cx="40" cy="20" r="3" fill="#D4A96A"/>
  <circle cx="40" cy="40" r="3" fill="#D4A96A"/>
  <circle cx="40" cy="60" r="3" fill="#D4A96A"/>
  <circle cx="40" cy="80" r="3" fill="#D4A96A"/>
  <text x="40" y="96" font-family="Arial" font-size="7" fill="#FFF5E0" text-anchor="middle">Drawers</text>
</svg>""",

    "commode": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 70" width="90" height="70">
  <rect x="4" y="4" width="82" height="62" rx="4" fill="#6B4C3B" stroke="#3D2416" stroke-width="2"/>
  <line x1="45" y1="4" x2="45" y2="66" stroke="#3D2416" stroke-width="1.5"/>
  <circle cx="28" cy="35" r="4" fill="#C8B040"/>
  <circle cx="62" cy="35" r="4" fill="#C8B040"/>
  <text x="45" y="38" font-family="Arial" font-size="7" fill="#FFF5E0" text-anchor="middle">Commode</text>
</svg>""",

    "display_cabinet": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 120" width="70" height="120">
  <rect x="4" y="4" width="62" height="112" rx="4" fill="#5C3D1E" stroke="#3D2010" stroke-width="2"/>
  <line x1="4" y1="40" x2="66" y2="40" stroke="#3D2010" stroke-width="1.5"/>
  <line x1="4" y1="76" x2="66" y2="76" stroke="#3D2010" stroke-width="1.5"/>
  <rect x="12" y="10" width="46" height="26" rx="2" fill="#C8D8B8" opacity="0.5"/>
  <rect x="12" y="46" width="46" height="26" rx="2" fill="#C8D8B8" opacity="0.5"/>
  <rect x="12" y="82" width="46" height="26" rx="2" fill="#7A5A47"/>
  <circle cx="35" cy="112" r="4" fill="#C8B040"/>
  <text x="35" y="58" font-family="Arial" font-size="7" fill="#FFF5E0" text-anchor="middle">Display Cab.</text>
</svg>""",

    # ── Bedroom ───────────────────────────────────────────────────────────
    "bed": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 100" width="140" height="100">
  <rect x="4" y="4" width="132" height="92" rx="6" fill="#E8E0D0" stroke="#8B7355" stroke-width="2"/>
  <rect x="4" y="4" width="132" height="28" rx="6" fill="#8B7355" stroke="#5C4A2A" stroke-width="2"/>
  <rect x="10" y="36" width="55" height="55" rx="4" fill="#F0E8D8" stroke="#C8B090" stroke-width="1"/>
  <rect x="75" y="36" width="55" height="55" rx="4" fill="#F0E8D8" stroke="#C8B090" stroke-width="1"/>
  <text x="70" y="20" font-family="Arial" font-size="9" fill="#FFF5E0" text-anchor="middle">Bed</text>
</svg>""",

    "nightstand": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 65 70" width="65" height="70">
  <rect x="4" y="4" width="57" height="62" rx="4" fill="#8B7355" stroke="#5C4A2A" stroke-width="2"/>
  <rect x="10" y="12" width="45" height="22" rx="2" fill="#A08060"/>
  <rect x="10" y="38" width="45" height="20" rx="2" fill="#A08060"/>
  <circle cx="32" cy="23" r="3" fill="#D4A96A"/>
  <circle cx="32" cy="48" r="3" fill="#D4A96A"/>
  <text x="32" y="68" font-family="Arial" font-size="7" fill="#FFF5E0" text-anchor="middle">Nightstand</text>
</svg>""",

    "room_divider": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20" width="100" height="20">
  <rect x="2" y="2" width="96" height="16" rx="3" fill="#8B6914" stroke="#5C4508" stroke-width="1.5"/>
  <line x1="26" y1="2" x2="26" y2="18" stroke="#5C4508" stroke-width="1"/>
  <line x1="50" y1="2" x2="50" y2="18" stroke="#5C4508" stroke-width="1"/>
  <line x1="74" y1="2" x2="74" y2="18" stroke="#5C4508" stroke-width="1"/>
  <text x="50" y="13" font-family="Arial" font-size="6" fill="#FFF5E0" text-anchor="middle">Room Divider</text>
</svg>""",

    "vanity_stool": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 70" width="70" height="70">
  <rect x="8" y="8" width="54" height="54" rx="8" fill="#C8A882" stroke="#8B6914" stroke-width="2"/>
  <rect x="18" y="18" width="34" height="34" rx="4" fill="#D4B890" stroke="#8B6914" stroke-width="1"/>
  <circle cx="17" cy="17" r="5" fill="#8B6914"/>
  <circle cx="53" cy="17" r="5" fill="#8B6914"/>
  <circle cx="17" cy="53" r="5" fill="#8B6914"/>
  <circle cx="53" cy="53" r="5" fill="#8B6914"/>
  <text x="35" y="40" font-family="Arial" font-size="8" fill="#3D2B00" text-anchor="middle">Stool</text>
</svg>""",

    "alarm_clock": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="50" height="50">
  <circle cx="25" cy="25" r="20" fill="#4A90C8" stroke="#2A5A88" stroke-width="2"/>
  <circle cx="25" cy="25" r="14" fill="#E8F0F8" stroke="#2A5A88" stroke-width="1"/>
  <line x1="25" y1="25" x2="25" y2="14" stroke="#2A5A88" stroke-width="2" stroke-linecap="round"/>
  <line x1="25" y1="25" x2="33" y2="25" stroke="#2A5A88" stroke-width="2" stroke-linecap="round"/>
  <text x="25" y="45" font-family="Arial" font-size="7" fill="#2A5A88" text-anchor="middle">Clock</text>
</svg>""",

    # ── Decor ─────────────────────────────────────────────────────────────
    "vase": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 70" width="50" height="70">
  <ellipse cx="25" cy="55" rx="18" ry="10" fill="#B8A080" stroke="#8B7355" stroke-width="1.5"/>
  <ellipse cx="25" cy="20" rx="12" ry="8" fill="#D4B890" stroke="#8B7355" stroke-width="1.5"/>
  <path d="M13,20 Q7,35 7,55 Q7,62 25,65 Q43,62 43,55 Q43,35 37,20" fill="#C8A06A" stroke="#8B7355" stroke-width="1.5"/>
  <text x="25" y="58" font-family="Arial" font-size="7" fill="#3D2B00" text-anchor="middle">Vase</text>
</svg>""",

    "picture_frame": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 65" width="80" height="65">
  <rect x="3" y="3" width="74" height="59" rx="3" fill="#C8A06A" stroke="#8B5A14" stroke-width="3"/>
  <rect x="10" y="10" width="60" height="45" rx="1" fill="#F0E8D8" stroke="#8B5A14" stroke-width="1"/>
  <rect x="16" y="16" width="48" height="33" fill="#D4C8B0" rx="1"/>
  <text x="40" y="36" font-family="Arial" font-size="7" fill="#8B5A14" text-anchor="middle">Art Frame</text>
</svg>""",

    "wall_frame": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 65 80" width="65" height="80">
  <rect x="3" y="3" width="59" height="74" rx="3" fill="#5C4A2A" stroke="#3D2B00" stroke-width="3"/>
  <rect x="10" y="10" width="45" height="60" rx="1" fill="#F0E8D8" stroke="#3D2B00" stroke-width="1"/>
  <rect x="16" y="16" width="33" height="48" fill="#D4C8B0" rx="1"/>
  <text x="32" y="45" font-family="Arial" font-size="7" fill="#3D2B00" text-anchor="middle">Frame</text>
</svg>""",

    "chess_set": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
  <rect x="4" y="4" width="72" height="72" rx="3" fill="#C8B090" stroke="#5C4A2A" stroke-width="2"/>
  <!-- Chess board pattern -->
  <rect x="10" y="10" width="15" height="15" fill="#3D2B00"/>
  <rect x="40" y="10" width="15" height="15" fill="#3D2B00"/>
  <rect x="25" y="25" width="15" height="15" fill="#3D2B00"/>
  <rect x="55" y="25" width="15" height="15" fill="#3D2B00"/>
  <rect x="10" y="40" width="15" height="15" fill="#3D2B00"/>
  <rect x="40" y="40" width="15" height="15" fill="#3D2B00"/>
  <rect x="25" y="55" width="15" height="15" fill="#3D2B00"/>
  <rect x="55" y="55" width="15" height="15" fill="#3D2B00"/>
  <text x="40" y="76" font-family="Arial" font-size="7" fill="#3D2B00" text-anchor="middle">Chess</text>
</svg>""",

    "chandelier": """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
  <circle cx="40" cy="40" r="36" fill="none" stroke="#C8A06A" stroke-width="2" stroke-dasharray="6,4"/>
  <circle cx="40" cy="40" r="22" fill="#E8D090" stroke="#C8A06A" stroke-width="2"/>
  <circle cx="40" cy="40" r="10" fill="#C8B040" stroke="#8B8020" stroke-width="1.5"/>
  <line x1="40" y1="4" x2="40" y2="18" stroke="#C8A06A" stroke-width="2"/>
  <line x1="40" y1="62" x2="40" y2="76" stroke="#C8A06A" stroke-width="2"/>
  <line x1="4" y1="40" x2="18" y2="40" stroke="#C8A06A" stroke-width="2"/>
  <line x1="62" y1="40" x2="76" y2="40" stroke="#C8A06A" stroke-width="2"/>
  <text x="40" y="44" font-family="Arial" font-size="7" fill="#5C4508" text-anchor="middle">Chandelier</text>
</svg>""",
}


def fetch_glb_url(slug: str) -> str | None:
    """Query Poly Haven API to get the GLB download URL for a model slug."""
    api_url = f"https://api.polyhaven.com/files/{slug}"
    try:
        req = urllib.request.Request(api_url, headers={"User-Agent": "RoomVision-Asset-Downloader/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())

        # Navigate: data -> "Models" -> "glb" -> (resolution key) -> "url"
        models = data.get("Models") or data.get("models") or {}
        glb = models.get("glb") or {}

        # Pick the lowest resolution available (sufficient for web use)
        for res in ["1k", "2k", "4k", "8k"]:
            if res in glb:
                return glb[res].get("url")

        # Fallback: first key found
        for res_data in glb.values():
            if isinstance(res_data, dict) and "url" in res_data:
                return res_data["url"]

    except Exception as e:
        print(f"    ⚠️  Could not fetch API info for '{slug}': {e}")
    return None


def download_file(url: str, dest_path: str) -> bool:
    """Download a file with progress display."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "RoomVision-Asset-Downloader/1.0"})
        with urllib.request.urlopen(req, timeout=60) as resp, open(dest_path, "wb") as f:
            total = resp.headers.get("Content-Length")
            downloaded = 0
            while chunk := resp.read(65536):
                f.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = downloaded / int(total) * 100
                    print(f"\r    ↓ {downloaded/1024/1024:.1f} MB / {int(total)/1024/1024:.1f} MB ({pct:.0f}%)", end="", flush=True)
        print()
        return True
    except Exception as e:
        print(f"\n    ❌  Download failed: {e}")
        if os.path.exists(dest_path):
            os.remove(dest_path)
        return False


def write_svg(stem: str, category: str) -> None:
    """Write the SVG top-down icon for the given item."""
    svg_path = os.path.join(ASSETS_ROOT, category, f"{stem}.svg")
    template = SVG_TEMPLATES.get(stem)
    if template:
        with open(svg_path, "w", encoding="utf-8") as f:
            f.write(template.strip())
        print(f"    ✅  SVG written → {os.path.relpath(svg_path, REPO_ROOT)}")
    else:
        # Generic fallback SVG
        fallback = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
  <rect x="4" y="4" width="72" height="72" rx="6" fill="#8B7355" stroke="#5C4A2A" stroke-width="2"/>
  <text x="40" y="44" font-family="Arial" font-size="9" fill="#FFF5E0" text-anchor="middle">{stem.replace('_',' ').title()}</text>
</svg>"""
        with open(svg_path, "w", encoding="utf-8") as f:
            f.write(fallback.strip())
        print(f"    ✅  SVG (fallback) → {os.path.relpath(svg_path, REPO_ROOT)}")


def main():
    print("=" * 60)
    print("  RoomVision Asset Downloader")
    print("  Source: Poly Haven (CC0 / Public Domain)")
    print("=" * 60)
    print()

    results = {"success": [], "skipped": [], "failed": []}

    for stem, slug, category in MANIFEST:
        cat_dir = os.path.join(ASSETS_ROOT, category)
        glb_path = os.path.join(cat_dir, f"{stem}.glb")
        label = f"{category}/{stem}"

        print(f"── {label}")

        # Always (re)write the SVG
        write_svg(stem, category)

        # Skip GLB if already downloaded
        if os.path.exists(glb_path) and os.path.getsize(glb_path) > 1024:
            size_mb = os.path.getsize(glb_path) / 1024 / 1024
            print(f"    ⏭️  GLB already exists ({size_mb:.1f} MB) — skipping download")
            results["skipped"].append(label)
            print()
            continue

        # Fetch download URL
        print(f"    🔍 Fetching API info for '{slug}' …")
        url = fetch_glb_url(slug)
        if not url:
            print(f"    ❌  No GLB URL found — skipping")
            results["failed"].append(label)
            print()
            continue

        print(f"    📥 Downloading GLB …")
        if download_file(url, glb_path):
            size_mb = os.path.getsize(glb_path) / 1024 / 1024
            print(f"    ✅  GLB saved ({size_mb:.1f} MB) → {os.path.relpath(glb_path, REPO_ROOT)}")
            results["success"].append(label)
        else:
            results["failed"].append(label)

        time.sleep(0.5)   # Be polite to Poly Haven servers
        print()

    # ── Summary ──────────────────────────────────────────────────────────
    print("=" * 60)
    print("  SUMMARY")
    print(f"  ✅  Downloaded : {len(results['success'])}")
    print(f"  ⏭️  Skipped    : {len(results['skipped'])}")
    print(f"  ❌  Failed     : {len(results['failed'])}")
    if results["failed"]:
        print(f"\n  Failed items:")
        for item in results["failed"]:
            print(f"    • {item}")
    print("=" * 60)


if __name__ == "__main__":
    main()
