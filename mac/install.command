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

NEW_INSTALL=0
if [ ! -d "$TARGET" ]; then
  NEW_INSTALL=1
  say 'Downloading your Office HQ application from GitHub...'
  curl -fL --retry 3 --connect-timeout 20 \
    'https://codeload.github.com/Hostkris/Office-HQ/zip/refs/heads/main' \
    -o "$TEMP/Office-HQ.zip" || failed 'GitHub download failed.'
  unzip -q "$TEMP/Office-HQ.zip" -d "$TEMP" || failed 'Cannot unpack Office HQ.'
  [ -f "$TEMP/Office-HQ-main/agent-office-hq/server.mjs" ] || failed 'GitHub archive is incomplete.'
  mv "$TEMP/Office-HQ-main" "$TARGET"
fi
[ -f "$WEB/server.mjs" ] || failed "Existing ~/Office-HQ folder is not compatible. Nothing was overwritten."

# Refresh the application code from the owner's GitHub repository on repeat
# installs, but only after consent, and back up prior working files.
if [ "$NEW_INSTALL" -eq 0 ] && [ -f "$WEB/server.mjs" ] && [ -f "$WEB/openmaus/bridge.mjs" ]; then
  if /usr/bin/osascript -e 'display dialog "Office HQ will update its app code from your own GitHub repository. Existing application files will be backed up and company records preserved. Continue?" buttons {"Keep Current", "Update Office HQ"} default button "Update Office HQ" with title "Office HQ · Mac Update"' >/dev/null 2>&1; then
    curl -fL --retry 3 --connect-timeout 20 \
      'https://codeload.github.com/Hostkris/Office-HQ/zip/refs/heads/main' \
      -o "$TEMP/Office-HQ-latest.zip" || failed 'Could not get latest Mac sync code.'
    mkdir -p "$TEMP/latest"
    unzip -q "$TEMP/Office-HQ-latest.zip" -d "$TEMP/latest" || failed 'Mac update archive cannot be unpacked.'
    SOURCE="$TEMP/latest/Office-HQ-main/agent-office-hq"
    [ -f "$SOURCE/native-engine/bridge.mjs" ] || failed 'Latest package has no independent Ollama engine.'
    STAMP="$(date +%Y%m%d-%H%M%S)"
    BACKUP="$TARGET/.native-engine-backups/$STAMP-mac-sync"
    mkdir -p "$BACKUP"
    for item in server.mjs index.html app.js office-features.js officehq-voice.js \
      officehq-voice.css officehq-device-sync.js officehq-sync.css sw.js styles.css \
      refresh.js cloud.html cloud.js; do
      if [ -f "$SOURCE/$item" ]; then
        if [ -f "$WEB/$item" ]; then cp "$WEB/$item" "$BACKUP/$item"; fi
        cp "$SOURCE/$item" "$WEB/$item"
      fi
    done
    mkdir -p "$WEB/native-engine" "$WEB/device-sync"
    cp "$SOURCE/native-engine/bridge.mjs" "$WEB/native-engine/bridge.mjs"
    cp "$SOURCE/device-sync/mac-worker.mjs" "$WEB/device-sync/mac-worker.mjs"
    say "Application code updated. Previous versions saved in $BACKUP"
  fi
fi
[ -f "$WEB/native-engine/bridge.mjs" ] || failed 'The independent Ollama agent engine was not installed.'
[ -f "$WEB/device-sync/mac-worker.mjs" ] || failed 'The secure device sync worker was not installed.'

# Full independent local Ollama, using the original Office HQ Mac installer plan.
# Ollama is downloaded from its official site, and the model stays on the Mac.
MODEL='llama3.2:3b'
OLLAMA=''
for BIN in /Applications/Ollama.app/Contents/Resources/ollama \
  "$HOME/Applications/Ollama.app/Contents/Resources/ollama" \
  "$BASE/vendor/Ollama.app/Contents/Resources/ollama"; do
  if [ -x "$BIN" ]; then OLLAMA="$BIN"; break; fi
done
if [ -z "$OLLAMA" ] && command -v ollama >/dev/null 2>&1; then
  OLLAMA="$(command -v ollama)"
fi
if [ -z "$OLLAMA" ]; then
  say 'Downloading official Ollama for Mac and the local llama3.2:3b model.'
  if /usr/bin/osascript -e 'display dialog "The independent Ollama AI engine and its model need several gigabytes of storage. Download from Ollama.com for local draft-only AI?" buttons {"Cancel", "Install Ollama"} default button "Install Ollama" with title "Office HQ · Local Ollama"' >/dev/null 2>&1; then
    mkdir -p "$BASE/vendor"
    curl -fL --retry 3 --connect-timeout 30 \
      'https://ollama.com/download/Ollama-darwin.zip' \
      -o "$TEMP/Ollama-darwin.zip" || failed 'Official Ollama download failed.'
    mkdir -p "$TEMP/ollama-app"
    unzip -q "$TEMP/Ollama-darwin.zip" -d "$TEMP/ollama-app" || failed 'Cannot unpack Ollama.'
    [ -x "$TEMP/ollama-app/Ollama.app/Contents/Resources/ollama" ] || failed 'Mac Ollama bundle layout has changed.'
    mv "$TEMP/ollama-app/Ollama.app" "$BASE/vendor/Ollama.app"
    OLLAMA="$BASE/vendor/Ollama.app/Contents/Resources/ollama"
  else
    failed 'Ollama installation was declined. The local AI engine is disabled until it is installed.'
  fi
fi
if ! curl -fsS --connect-timeout 2 --max-time 4 'http://127.0.0.1:11434/api/tags' >/dev/null 2>&1; then
  say 'Starting the independent local Ollama service...'
  nohup "$OLLAMA" serve >> "$LOG/ollama.log" 2>&1 </dev/null &
  for i in $(seq 1 30); do
    if curl -fsS --connect-timeout 2 --max-time 3 'http://127.0.0.1:11434/api/tags' >/dev/null 2>&1; then break; fi
    sleep 1
  done
fi
curl -fsS --max-time 4 'http://127.0.0.1:11434/api/tags' >/dev/null || failed 'Local Ollama service failed to start.'
say 'Verifying the llama3.2:3b local AI model...'
if ! "$OLLAMA" list 2>/dev/null | grep -Fq "$MODEL"; then
  "$OLLAMA" pull "$MODEL" || failed 'Ollama model download failed. Relaunch to retry.'
else
  say 'Local AI model is already installed. No download needed.'
fi


if curl -fsS --connect-timeout 2 --max-time 3 "$URL" 2>/dev/null | grep -q 'Agent Office HQ'; then
  if ! curl -fsS --max-time 4 'http://127.0.0.1:3000/api/device-sync/status' 2>/dev/null | grep -q '"paired"'; then
    failed 'An older Office HQ server is still running on port 3000. Quit that Mac server and reopen Office HQ.app to activate the updated Ollama and sync engine.'
  fi
  say 'Your synced Office HQ Mac server is already running.'
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
