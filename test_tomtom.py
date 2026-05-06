"""
Quick TomTom connectivity diagnostic.
Run this on any machine that is showing errors:
    python test_tomtom.py
It will tell you EXACTLY why the connection is failing.
"""
import urllib.request
import urllib.error
import json
import ssl
import socket

TOMTOM_KEY = "quMDWPqrTCCd5Mbleyy3rTlJFkQaHYoH"
HOST = "api.tomtom.com"

print("=" * 55)
print("  SmartTraffic AI — TomTom Connectivity Diagnostic")
print("=" * 55)

# ── Step 1: DNS resolution ───────────────────────────────────
print(f"\n[1] Resolving DNS for '{HOST}'...")
try:
    ip = socket.gethostbyname(HOST)
    print(f"    ✓ DNS OK  →  {ip}")
except socket.gaierror as e:
    print(f"    ✗ DNS FAILED: {e}")
    print("    → No internet connection OR DNS is blocked.")
    exit(1)

# ── Step 2: TCP connection on port 443 ───────────────────────
print(f"\n[2] Checking TCP connection to {HOST}:443 ...")
try:
    with socket.create_connection((HOST, 443), timeout=5):
        print("    ✓ TCP connection OK")
except OSError as e:
    print(f"    ✗ TCP FAILED: {e}")
    print("    → Firewall or proxy is blocking outbound HTTPS.")
    exit(1)

# ── Step 3: HTTPS with auto SSL fallback ────────────────────
print(f"\n[3] Testing HTTPS (with auto SSL fallback for college networks) ...")

test_url = (
    f"https://{HOST}/routing/1/calculateRoute/"
    f"13.3409,74.7421:13.3450,74.7450/json"
    f"?key={TOMTOM_KEY}&maxAlternatives=0&computeTravelTimeFor=all&traffic=true"
)

def make_ssl_ctx(verified=True):
    if verified:
        ctx = ssl.create_default_context()
        try:
            ctx.load_default_certs(ssl.Purpose.SERVER_AUTH)
        except Exception:
            pass
        return ctx
    else:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        return ctx

try:
    req = urllib.request.Request(test_url)
    ssl_mode = "verified SSL"

    # Try with verified SSL first
    try:
        response = urllib.request.urlopen(req, context=make_ssl_ctx(verified=True))
    except urllib.error.URLError as e:
        reason = str(getattr(e, "reason", e))
        if "CERTIFICATE_VERIFY_FAILED" in reason or "SSL" in reason.upper():
            print("    ⚠  SSL check failed — retrying without SSL verification")
            print("       (college/corporate network SSL inspection detected)")
            ssl_mode = "UNVERIFIED (college network bypass)"
            response = urllib.request.urlopen(req, context=make_ssl_ctx(verified=False))
        else:
            raise

    with response:
        data = json.loads(response.read().decode("utf-8"))

    if "error" in data:
        err = data["error"]
        print(f"    ✗ TomTom API ERROR: {err.get('description', err)}")
        print("    → API key may be invalid, expired, or rate-limited.")
    else:
        routes = data.get("routes", [])
        if routes:
            s = routes[0]["summary"]
            print(f"    ✓ SUCCESS! [{ssl_mode}]")
            print(f"      Routes   : {len(routes)}")
            print(f"      Distance : {s.get('lengthInMeters')} m")
            print(f"      Duration : {s.get('travelTimeInSeconds')} s")
            print(f"\n  ✅ TomTom is working! Restart the backend server now.")
        else:
            print("    ✗ No routes returned (unusual).")

except urllib.error.HTTPError as e:
    body = e.read().decode("utf-8", errors="replace")
    print(f"    ✗ HTTP {e.code}: {body}")
    if e.code == 403:
        print("    → API key is invalid or has no permissions.")
    elif e.code == 429:
        print("    → Rate limit exceeded. Wait a few minutes.")
except urllib.error.URLError as e:
    print(f"    ✗ URL ERROR (even without SSL check): {e.reason}")
    print("    → Try switching to phone hotspot.")
except Exception as e:
    print(f"    ✗ UNEXPECTED: {type(e).__name__}: {e}")

print("\n" + "=" * 55)
