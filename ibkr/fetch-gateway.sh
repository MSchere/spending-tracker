#!/bin/bash
# Downloads the IBKR Client Portal Gateway and extracts it into this directory.
# Only needed for running the gateway locally in dev — the Docker image
# downloads it at build time. Safe to re-run (overwrites binaries).
#
# Our customized root/conf.yaml (committed in git) is preserved: the stock
# config from the zip is NOT extracted over it.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
URL="https://download2.interactivebrokers.com/portal/clientportal.gw.zip"
TMP_ZIP="$(mktemp /tmp/clientportal.gw.XXXXXX.zip)"
trap 'rm -f "$TMP_ZIP"' EXIT

echo "Downloading IBKR Client Portal Gateway..."
curl -fSL "$URL" -o "$TMP_ZIP"
unzip -q -o "$TMP_ZIP" -d "$DIR" -x "root/conf.yaml"
chmod +x "$DIR/bin/run.sh"

echo "Gateway installed in $DIR — start it with: bin/run.sh root/conf.yaml"
