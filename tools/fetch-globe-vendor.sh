#!/usr/bin/env bash
# Fetch or verify the one gitignored browser dependency used by the live globe.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GLOBE_GL_VERSION='2.46.1'
GLOBE_GL_URL='https://cdn.jsdelivr.net/npm/globe.gl@2.46.1/dist/globe.gl.min.js'
GLOBE_GL_SHA256='2ab6767f47e2be0ac346cd7a5eb55d259ea3da06d479dc22f1820ddd698f496a'
GLOBE_GL_DESTINATION='js/vendor/globe.gl.js'
DEST_PATH="$REPO_ROOT/$GLOBE_GL_DESTINATION"
DEST_DIR="$(dirname "$DEST_PATH")"
TEMP_FILE=''

fail() {
  echo "globe.gl vendor integrity: ERROR: $*" >&2
  exit 1
}

cleanup() {
  if [ -n "$TEMP_FILE" ] && [ -e "$TEMP_FILE" ]; then
    rm -f "$TEMP_FILE"
  fi
}
trap cleanup EXIT

sha256_file() {
  local file="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$file" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$file" | awk '{print $1}'
  else
    fail 'sha256sum or shasum is required'
  fi
}

verify_digest() {
  local file="$1"
  local actual
  [ ! -L "$file" ] || fail "required file must not be a symbolic link: $GLOBE_GL_DESTINATION"
  [ -f "$file" ] || fail "required file is absent: $GLOBE_GL_DESTINATION"
  actual="$(sha256_file "$file")"
  if [ "$actual" != "$GLOBE_GL_SHA256" ]; then
    echo "globe.gl vendor integrity: expected $GLOBE_GL_SHA256" >&2
    echo "globe.gl vendor integrity: actual   $actual" >&2
    return 1
  fi
}

print_spec() {
  printf '{\n'
  printf '  "dependency": "globe.gl",\n'
  printf '  "version": "%s",\n' "$GLOBE_GL_VERSION"
  printf '  "url": "%s",\n' "$GLOBE_GL_URL"
  printf '  "sha256": "%s",\n' "$GLOBE_GL_SHA256"
  printf '  "destination": "%s",\n' "$GLOBE_GL_DESTINATION"
  printf '  "transport": "https-only",\n'
  printf '  "install": "atomic-same-directory-rename",\n'
  printf '  "existing_mismatch": "refuse"\n'
  printf '}\n'
}

case "${1:-ensure}" in
  --print-spec)
    print_spec
    exit 0
    ;;
  --verify-only)
    if verify_digest "$DEST_PATH"; then
      echo "globe.gl vendor integrity: verified $GLOBE_GL_DESTINATION ($GLOBE_GL_VERSION)"
      exit 0
    fi
    fail 'existing vendor file has the wrong digest; refusing to replace it'
    ;;
  ensure)
    ;;
  --help|-h)
    echo 'Usage: tools/fetch-globe-vendor.sh [--verify-only|--print-spec]'
    exit 0
    ;;
  *)
    fail "unknown argument: $1"
    ;;
esac

[ ! -L "$DEST_DIR" ] || fail "destination directory must not be a symbolic link: $(dirname "$GLOBE_GL_DESTINATION")"

if [ -e "$DEST_PATH" ] || [ -L "$DEST_PATH" ]; then
  [ -f "$DEST_PATH" ] || fail "destination exists but is not a regular file: $GLOBE_GL_DESTINATION"
  if verify_digest "$DEST_PATH"; then
    echo "globe.gl vendor integrity: verified existing $GLOBE_GL_DESTINATION ($GLOBE_GL_VERSION)"
    exit 0
  fi
  fail 'existing vendor file has the wrong digest; refusing to replace it'
fi

command -v curl >/dev/null 2>&1 || fail 'curl is required to fetch the browser dependency'
mkdir -p "$DEST_DIR"
TEMP_FILE="$(mktemp "$DEST_DIR/.globe.gl.js.download.XXXXXX")"

echo "globe.gl vendor integrity: fetching globe.gl@$GLOBE_GL_VERSION over HTTPS"
curl \
  --fail \
  --silent \
  --show-error \
  --location \
  --proto '=https' \
  --proto-redir '=https' \
  --tlsv1.2 \
  --retry 3 \
  --retry-delay 1 \
  --retry-connrefused \
  --connect-timeout 20 \
  --max-time 120 \
  --output "$TEMP_FILE" \
  "$GLOBE_GL_URL"

if ! verify_digest "$TEMP_FILE"; then
  fail 'downloaded bytes do not match the pinned digest; destination was not changed'
fi

chmod 0644 "$TEMP_FILE"
mv "$TEMP_FILE" "$DEST_PATH"
TEMP_FILE=''
verify_digest "$DEST_PATH" || fail 'installed vendor file failed its post-install digest check'
echo "globe.gl vendor integrity: installed verified $GLOBE_GL_DESTINATION ($GLOBE_GL_VERSION)"
