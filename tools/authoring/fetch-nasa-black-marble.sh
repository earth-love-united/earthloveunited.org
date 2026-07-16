#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DESTINATION="$REPO_ROOT/assets/globe/runtime/earth-night.jpg"
SOURCE_URL="https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/79000/79765/dnb_land_ocean_ice.2012.3600x1800.jpg"
EXPECTED_SHA256="373e5a08c9f378a2ce6320214a613148e4b1e3946b3f39a516c9093b76cb7124"
EXPECTED_BYTES="794479"
EXPECTED_WIDTH="3600"
EXPECTED_HEIGHT="1800"
TEMP_FILE=""

cleanup() {
  if [ -n "$TEMP_FILE" ] && [ -e "$TEMP_FILE" ]; then
    rm -f "$TEMP_FILE"
  fi
}
trap cleanup EXIT

validate_jpeg() {
  node -e '
    const crypto = require("node:crypto");
    const fs = require("node:fs");
    const [file, expectedSha, expectedBytes, expectedWidth, expectedHeight] = process.argv.slice(1);
    const bytes = fs.readFileSync(file);
    const sha = crypto.createHash("sha256").update(bytes).digest("hex");
    if (sha !== expectedSha) throw new Error(`SHA-256 mismatch: ${sha}`);
    if (bytes.length !== Number(expectedBytes)) throw new Error(`byte-size mismatch: ${bytes.length}`);
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("not a JPEG");
    let offset = 2;
    let dimensions = null;
    while (offset + 8 < bytes.length) {
      while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
      while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
      if (offset >= bytes.length) break;
      const marker = bytes[offset++];
      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        dimensions = { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
        break;
      }
      offset += length;
    }
    if (!dimensions || dimensions.width !== Number(expectedWidth) || dimensions.height !== Number(expectedHeight)) {
      throw new Error(`dimension mismatch: ${JSON.stringify(dimensions)}`);
    }
  ' "$1" "$EXPECTED_SHA256" "$EXPECTED_BYTES" "$EXPECTED_WIDTH" "$EXPECTED_HEIGHT"
}

case "${1:-}" in
  --check)
    validate_jpeg "$DESTINATION"
    printf 'NASA Black Marble source pin: PASS (%s bytes; %sx%s; %s)\n' \
      "$EXPECTED_BYTES" "$EXPECTED_WIDTH" "$EXPECTED_HEIGHT" "$EXPECTED_SHA256"
    ;;
  --write)
    mkdir -p "$(dirname "$DESTINATION")"
    TEMP_FILE="$(mktemp "$(dirname "$DESTINATION")/.earth-night.jpg.tmp.XXXXXX")"
    EFFECTIVE_URL="$(curl --fail --location --silent --show-error \
      --proto '=https' --proto-redir '=https' --tlsv1.2 \
      --output "$TEMP_FILE" --write-out '%{url_effective}' "$SOURCE_URL")"
    case "$EFFECTIVE_URL" in
      https://*) ;;
      *) printf 'NASA Black Marble source pin: FAIL (non-HTTPS effective URL: %s)\n' "$EFFECTIVE_URL" >&2; exit 1 ;;
    esac
    validate_jpeg "$TEMP_FILE"
    mv -f "$TEMP_FILE" "$DESTINATION"
    TEMP_FILE=""
    printf 'NASA Black Marble source pin: WROTE byte-for-byte source (%s)\n' "$EXPECTED_SHA256"
    ;;
  *)
    printf 'Usage: %s --check|--write\n' "$0" >&2
    exit 2
    ;;
esac
