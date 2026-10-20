#!/bin/bash
# Office HQ Mac local launcher. Does not connect to or control external accounts.
set -Eeuo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
BASE="$HOME/Library/Application Support/Office HQ"
TARGET="$HOME/Office-HQ"
WEB="$TARGET/agent-office-hq"
LOG="$BASE/logs"
URL="http://127.0.0.1:3000/"
mkdir -p "$LOG"
chmod 700 "$BASE" "$LOG" 2>/dev/null || true
say(){ printf '\n[OFFICE HQ] %s\n' "$*"; }
failed(){
  trap - ERR
  printf '\nOffice HQ could not start: %s\n' "$*" >&2
  printf 'Logs: %s\n' "$LOG"
  read -r -p 'Press Return to close this window… ' _ || true
  exit 1
}
trap 'failed "Setup stopped near line $LINENO."' ERR
[ "$(uname -s)" = "Darwin" ] || failed "This application requires a Mac."
command -v sw_vers >/dev/null || failed "Cannot detect macOS."
major="$(sw_vers -productVersion | cut -d. -f1)"
[ "$major" -ge 14 ] || failed "macOS 14 (Sonoma) or newer is required."
for tool in curl unzip shasum tar; do command -v "$tool" >/dev/null || failed "Missing $tool"; done
say 'Office HQ · Mac launcher from your GitHub repository'
say 'Existing Office HQ data and optional AI engine files will be preserved.'
say 'No accounts will be connected or authorized by the installer.'

if [ ! -f "$BASE/mac-launcher-approved" ]; then
  if ! /usr/bin/osascript -e 'display dialog "Office HQ will download your GitHub code and may install a private Node.js runtime. It will not access outside accounts. Continue?" buttons {"Cancel", "Install and Open"} default button "Install and Open" with title "Office HQ · Mac Setup"' >/dev/null 2>&1; then
    say 'Setup cancelled.'
    exit 0
  fi
  /bin/date > "$BASE/mac-launcher-approved"
fi
TEMP="$(mktemp -d /tmp/officehqmac.XXXXXXXX)"
trap 'rm -rf "$TEMP"' EXIT

if command -v node >/dev/null 2>&1 && node -e 'process.exit(Number(process.versions.node.split(".")[0])>=22?0:1)' >/dev/null 2>&1; then
  NODE="$(command -v node)"
else
  VERSION='v22.22.3'
  case "$(uname -m)" in
    arm64) ARCH='arm64' ;;
    x86_64) ARCH='x64' ;;
    *) failed 'Unsupported processor.' ;;
  esac
  INSTALL="$BASE/node/$VERSION-$ARCH"
  NODE="$INSTALL/bin/node"
  if [ ! -x "$NODE" ]; then
    say 'Downloading SHA-256 verified official Node.js privately...'
    F="node-$VERSION-darwin-$ARCH.tar.gz"
    ROOT="https://nodejs.org/download/release/$VERSION"
    curl -fLsS --retry 3 "$ROOT/SHASUMS256.txt" -o "$TEMP/SHA256SUMS" || failed 'Cannot read Node checksums.'
    curl -fL --retry 3 "$ROOT/$F" -o "$TEMP/$F" || failed 'Cannot download Node.'
    expected="$(awk -v f="$F" '$2==f{print $1}' "$TEMP/SHA256SUMS")"
    actual="$(shasum -a 256 "$TEMP/$F" | awk '{print $1}')"
    [ -n "$expected" ] && [ "$expected" = "$actual" ] || failed 'Node.js checksum verification failed.'
    mkdir -p "$INSTALL"
    tar -xzf "$TEMP/$F" -C "$INSTALL" --strip-components 1 || failed 'Cannot unpack Node.'
  fi
fi
[ -x "$NODE" ] || failed 'Node runtime missing.'
say "Using Node.js $("$NODE" --version)"

if [ ! -d "$TARGET" ]; then
  say 'Downloading your Office HQ application from GitHub...'
  curl -fL --retry 3 --connect-timeout 20 \
    'https://codeload.github.com/Hostkris/Office-HQ/zip/refs/heads/main' \
    -o "$TEMP/Office-HQ.zip" || failed 'GitHub download failed.'
  unzip -q "$TEMP/Office-HQ.zip" -d "$TEMP" || failed 'Cannot unpack Office HQ.'
  [ -f "$TEMP/Office-HQ-main/agent-office-hq/server.mjs" ] || failed 'GitHub archive is incomplete.'
  mv "$TEMP/Office-HQ-main" "$TARGET"
fi
[ -f "$WEB/server.mjs" ] || failed "Existing ~/Office-HQ folder is not compatible. Nothing was overwritten."

if curl -fsS --connect-timeout 2 --max-time 3 "$URL" 2>/dev/null | grep -q 'Agent Office HQ'; then
  say 'Your Office HQ server is already running.'
else
  if curl -fsS --connect-timeout 2 --max-time 3 "$URL" >/dev/null 2>&1; then
    failed 'Another app uses port 3000. It was not interrupted.'
  fi
  say 'Starting Office HQ locally on this Mac...'
  (
    cd "$WEB"
    export HOST=127.0.0.1 PORT=3000
    if [ -f "$WEB/tools/officehq.mjs" ]; then
      nohup "$NODE" "$WEB/tools/officehq.mjs" start >> "$LOG/officehq.log" 2>&1 </dev/null &
    else
      nohup "$NODE" "$WEB/server.mjs" >> "$LOG/officehq.log" 2>&1 </dev/null &
    fi
  )
  OK=0
  for i in $(seq 1 35); do
    if curl -fsS --connect-timeout 1 --max-time 2 "$URL" 2>/dev/null | grep -q 'Agent Office HQ'; then OK=1; break; fi
    sleep 1
  done
  [ "$OK" = 1 ] || failed "Mac server did not start. See $LOG/officehq.log"
fi
say 'Success. Opening Office HQ on this Mac.'
say 'This installs the web app server. Optional local AI runtime requires separate consent/setup.'
say 'Mac and iOS records will not sync without a separate secure connection.'
open "http://127.0.0.1:3000/#/thread"
printf '\nYou may close Terminal; Office HQ stays running while the Mac is on.\n'
