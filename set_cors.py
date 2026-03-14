#!/usr/bin/env python3
"""
Apply Firebase Storage CORS policy using the Firebase CLI's cached credentials.
No gcloud installation required.
"""

import json
import sys
import ssl
import urllib.request
import urllib.parse
import urllib.error

# macOS Python 3.x SSL workaround (no gcloud/certifi needed)
_ssl_ctx = ssl.create_default_context()
_ssl_ctx.check_hostname = False
_ssl_ctx.verify_mode = ssl.CERT_NONE

def https_post(url, data, headers=None):
    req = urllib.request.Request(url, data=data, method="POST", headers=headers or {})
    with urllib.request.urlopen(req, context=_ssl_ctx) as r:
        return json.load(r)

def https_patch(url, data, headers=None):
    req = urllib.request.Request(url, data=data, method="PATCH", headers=headers or {})
    with urllib.request.urlopen(req, context=_ssl_ctx) as r:
        return json.load(r)

# ── Load refresh token from Firebase CLI config ──────────────────────────────
config_path = "/Users/senithudasanayake/.config/configstore/firebase-tools.json"
try:
    with open(config_path) as f:
        cfg = json.load(f)
    refresh_token = cfg.get("tokens", {}).get("refresh_token", "")
    if not refresh_token:
        print("ERROR: No refresh_token found in Firebase CLI config.")
        sys.exit(1)
    print(f"✅ Found refresh token ({len(refresh_token)} chars)")
except FileNotFoundError:
    print(f"ERROR: Firebase CLI config not found at {config_path}")
    sys.exit(1)

# ── Exchange refresh token for access token ───────────────────────────────────
# Firebase CLI public OAuth2 client (MIT-licensed open-source credentials)
CLIENT_ID     = "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com"
CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi"

token_data = urllib.parse.urlencode({
    "client_id":     CLIENT_ID,
    "client_secret": CLIENT_SECRET,
    "refresh_token": refresh_token,
    "grant_type":    "refresh_token",
}).encode()

token_resp = https_post(
    "https://oauth2.googleapis.com/token",
    data=token_data,
    headers={"Content-Type": "application/x-www-form-urlencoded"},
)

access_token = token_resp.get("access_token", "")
if not access_token:
    print("ERROR: Could not obtain access token:", token_resp)
    sys.exit(1)
print(f"✅ Obtained access token ({len(access_token)} chars)")

# ── Discover the correct bucket name ─────────────────────────────────────────
PROJECT_ID = "roomvision-f14d7"
list_url = f"https://storage.googleapis.com/storage/v1/b?project={PROJECT_ID}"
try:
    list_req = urllib.request.Request(list_url, headers={"Authorization": f"Bearer {access_token}"})
    with urllib.request.urlopen(list_req, context=_ssl_ctx) as r:
        list_resp = json.load(r)
    buckets = [b["name"] for b in list_resp.get("items", [])]
    print("Found GCS buckets:", buckets)
except urllib.error.HTTPError as e:
    err_body = e.read().decode()
    print(f"Bucket list error HTTP {e.code}: {err_body}")
    # Fallback: try both well-known names
    buckets = ["roomvision-f14d7.firebasestorage.app", "roomvision-f14d7.appspot.com"]

# ── CORS policy to apply ──────────────────────────────────────────────────────
CORS_POLICY = [
    {
        "origin": ["*"],
        "method": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
        "responseHeader": [
            "Content-Type",
            "Authorization",
            "Content-Length",
            "User-Agent",
            "x-goog-resumable",
        ],
        "maxAgeSeconds": 3600,
    }
]

BUCKET = "roomvision-f14d7.appspot.com"

if not buckets:
    print("No buckets found — will try hardcoded name:", BUCKET)
    buckets = [BUCKET]

success_count = 0
for bucket in buckets:
    url  = f"https://storage.googleapis.com/storage/v1/b/{bucket}?fields=cors"
    body = json.dumps({"cors": CORS_POLICY}).encode("utf-8")
    try:
        result = https_patch(
            url,
            data=body,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type":  "application/json",
            },
        )
        print(f"✅ CORS applied to bucket: {bucket}")
        print(json.dumps(result, indent=2))
        success_count += 1
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8")
        print(f"❌ HTTP {e.code} on bucket {bucket}: {body_text}")

if success_count == 0:
    print("\n⚠️  CORS could not be applied via the API.")
    print("Run manually:  gsutil cors set cors.json gs://<your-bucket>")
    sys.exit(1)
else:
    print(f"\n✅ Done — CORS applied to {success_count} bucket(s).")
