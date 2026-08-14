#!/usr/bin/env bash
# Runs the unit/integration/regression suites headlessly and prints a pass/fail summary.
# No Node/npm required — just a Chrome/Chromium binary and python3 (both used only for
# test tooling; the app itself still ships as plain HTML/CSS/JS with zero build step).
#
# Usage: ./run-tests.sh [unit|integration|regression]   (default: all three)

set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CHROME_BIN="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)"
if [ -z "$CHROME_BIN" ]; then
  echo "No Chrome/Chromium binary found on PATH. Install one, or open tests/*.html directly in a browser instead." >&2
  exit 2
fi

SUITES=("$@")
if [ ${#SUITES[@]} -eq 0 ]; then
  SUITES=(unit integration regression)
fi

OVERALL_FAIL=0

for suite in "${SUITES[@]}"; do
  HTML_FILE="$DIR/$suite.html"
  if [ ! -f "$HTML_FILE" ]; then
    echo "Unknown suite: $suite (expected $HTML_FILE)" >&2
    OVERALL_FAIL=1
    continue
  fi

  DOM_OUT="$(mktemp)"
  "$CHROME_BIN" --headless=new --disable-gpu --no-sandbox \
    --virtual-time-budget=6000 --run-all-compositor-stages-before-draw \
    --dump-dom "file://$HTML_FILE" > "$DOM_OUT" 2>/dev/null

  RC=0
  python3 - "$DOM_OUT" "$suite" <<'PYEOF' || RC=$?
import re, sys, json

dom_path, suite = sys.argv[1], sys.argv[2]
html = open(dom_path, encoding="utf-8").read()

m = re.search(r'id="machine-summary"[^>]*>(.*?)</pre>', html, re.S)
if not m or not m.group(1).strip():
    print(f"\033[31m✗ {suite}: no results captured (tests did not finish running)\033[0m")
    sys.exit(1)

summary = json.loads(m.group(1).strip())
color = "\033[32m" if summary["failed"] == 0 else "\033[31m"
print(f"{color}{summary['suite']}: {summary['passed']}/{summary['total']} passed\033[0m")
for f in summary["failures"]:
    print(f"  \033[31m✗ {f['name']}\033[0m")
    print(f"    {f['message']}")

sys.exit(1 if summary["failed"] else 0)
PYEOF
  rm -f "$DOM_OUT"
  if [ "$RC" -ne 0 ]; then OVERALL_FAIL=1; fi
done

exit $OVERALL_FAIL
