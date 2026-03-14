#!/usr/bin/env bash
# =============================================================================
# RoomVision GLB Asset Downloader (curl edition)
# =============================================================================
# Downloads 25 CC0 furniture GLB models from Poly Haven CDN.
# All assets are licensed CC0 (public domain): https://polyhaven.com/license
#
# Usage:  bash scripts/download_glb.sh
# =============================================================================

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS="$REPO_ROOT/assets"
API="https://api.polyhaven.com/files"
CDN="https://dl.polyhaven.org/file/ph-assets/Models"

# Colour helpers
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}    ✅  $*${NC}"; }
warn() { echo -e "${YELLOW}    ⚠️   $*${NC}"; }
fail() { echo -e "${RED}    ❌  $*${NC}"; }

# Counters
DOWNLOADED=0; SKIPPED=0; FAILED=0

# ---------------------------------------------------------------------------
# download_model  <slug>  <category>  <stem>
# Queries Poly Haven API, downloads the smallest available GLTF package,
# saves the main file as <stem>.gltf and all textures alongside it.
# ---------------------------------------------------------------------------
download_model() {
    local slug="$1"
    local category="$2"
    local stem="$3"
    local dest_dir="$ASSETS/$category"
    local dest_path="$dest_dir/${stem}.gltf"

    mkdir -p "$dest_dir"

    # Skip if already downloaded
    if [[ -f "$dest_path" && $(stat -f%z "$dest_path" 2>/dev/null || stat -c%s "$dest_path") -gt 1024 ]]; then
        warn "GLTF already exists — skipping"
        ((SKIPPED++)) || true
        return 0
    fi

    # Query Poly Haven API
    echo "    🔍 Querying API for '${slug}' …"
    local api_json
    api_json=$(curl -sf --max-time 20 "${API}/${slug}" 2>/dev/null || echo "")

    if [[ -z "$api_json" ]]; then
        fail "API returned no data for '$slug'"
        ((FAILED++)) || true
        return 0
    fi

    # Extract the 1k (or smallest) GLTF URL and all its include files
    local url
    url=$(echo "$api_json" | python3 -c "
import sys, json
d = json.load(sys.stdin)
gltf = d.get('gltf', {})
for res in ('1k','2k','4k','8k'):
    if res in gltf:
        inner = gltf[res].get('gltf', {})
        u = inner.get('url')
        if u:
            print(u)
            break
" 2>/dev/null || echo "")

    if [[ -z "$url" ]]; then
        fail "No GLTF URL found for '$slug'"
        ((FAILED++)) || true
        return 0
    fi

    echo "    📥 Downloading GLTF: $(basename "$url")"
    if curl -fL --progress-bar --max-time 300 -o "$dest_path" "$url"; then
        local size_mb; size_mb=$(echo "scale=1; $(stat -f%z "$dest_path" 2>/dev/null || stat -c%s "$dest_path") / 1048576" | bc 2>/dev/null || echo "?")
        ok "GLTF saved (${size_mb} MB)"

        # Download associated texture files (include list from API)
        echo "    📦 Downloading textures …"
        local includes
        includes=$(echo "$api_json" | python3 -c "
import sys, json
d = json.load(sys.stdin)
gltf = d.get('gltf', {})
for res in ('1k','2k','4k','8k'):
    if res in gltf:
        inner = gltf[res].get('gltf', {})
        for inc in inner.get('include', {}).values():
            u = inc.get('url','')
            if u: print(u)
        break
" 2>/dev/null || echo "")

        local tex_count=0
        while IFS= read -r tex_url; do
            [[ -z "$tex_url" ]] && continue
            local tex_name; tex_name=$(basename "$tex_url" | sed 's/?.*$//')
            local tex_path="$dest_dir/$tex_name"
            if [[ ! -f "$tex_path" ]]; then
                curl -sfL --max-time 120 -o "$tex_path" "$tex_url" && ((tex_count++)) || true
            else
                ((tex_count++)) || true
            fi
        done <<< "$includes"

        ok "Textures saved ($tex_count files)"
        ((DOWNLOADED++)) || true
    else
        fail "Download failed for $url"
        [[ -f "$dest_path" ]] && rm -f "$dest_path"
        ((FAILED++)) || true
    fi
}


# =============================================================================
# Manifest: (category  local_stem  poly_haven_slug)
# =============================================================================
declare -a MANIFEST=(
    # Seating
    "seating  sofa            Sofa_01"
    "seating  armchair        ArmChair_01"
    "seating  dining_chair    dining_chair_02"
    "seating  bar_stool       bar_chair_round_01"
    "seating  ottoman         Ottoman_01"
    # Tables
    "tables   coffee_table    CoffeeTable_01"
    "tables   round_table     coffee_table_round_01"
    "tables   dining_table    WoodenTable_01"
    "tables   side_table      WoodenTable_02"
    "tables   console_table   ClassicConsole_01"
    # Storage
    "storage  bookshelf       Shelf_01"
    "storage  tall_cabinet    GothicCabinet_01"
    "storage  drawer_cabinet  drawer_cabinet"
    "storage  commode         GothicCommode_01"
    "storage  display_cabinet chinese_cabinet"
    # Bedroom
    "bedroom  bed             GothicBed_01"
    "bedroom  nightstand      ClassicNightstand_01"
    "bedroom  room_divider    chinese_screen_panels"
    "bedroom  vanity_stool    chinese_stool"
    "bedroom  alarm_clock     alarm_clock_01"
    # Decor
    "decor    vase            ceramic_vase_01"
    "decor    picture_frame   fancy_picture_frame_01"
    "decor    wall_frame      hanging_picture_frame_02"
    "decor    chess_set       chess_set"
    "decor    chandelier      Chandelier_01"
)

echo "============================================================"
echo "  RoomVision GLB Asset Downloader"
echo "  Source: Poly Haven (CC0 licence)"
echo "============================================================"
echo ""

for entry in "${MANIFEST[@]}"; do
    read -r category stem slug <<< "$entry"
    echo "── ${category}/${stem}"
    download_model "$slug" "$category" "$stem"
    echo ""
done

echo "============================================================"
echo "  SUMMARY"
echo "  ✅  Downloaded : $DOWNLOADED"
echo "  ⏭️  Skipped    : $SKIPPED"
echo "  ❌  Failed     : $FAILED"
echo "============================================================"
