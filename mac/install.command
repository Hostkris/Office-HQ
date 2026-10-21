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
UPDATED_CODE=0
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
if [ "$NEW_INSTALL" -eq 0 ] && [ -f "$WEB/server.mjs" ]; then
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
    # Update the COMPLETE approved browser app and local engine modules, not
    # only the pre-chat assets. Never copy .env, credentials or local records.
    FILES=(
      server.mjs index.html cloud.html cloud.js mac.html mac-share.js \
      assignment-library.js workforce-lean.js app.js office-features.js \
      officehq-voice.js officehq-voice.css ceo-secure-chat.js ceo-secure-chat.css \
      officehq-device-sync.js officehq-sync.css project-floor.js office-life.js \
      department-offices.js deliverables.js integration-center.js \
      department-access.js department-projects.js department-ui.css agent-health.js \
      website-access.js website-access.css coding-tasks.js coding-tasks.css desktop/runner.mjs desktop/permissions.mjs \
      desktop-workstations.js openmausbot.js workforce-runtime.js research-center.js \
      ios-workstations.js refresh.js theme.js styles.css sw.js icon.svg \
      manifest.webmanifest \
      native-engine/bridge.mjs native-engine/coding-worker.mjs device-sync/mac-worker.mjs \
      native-engine/office-brain.mjs native-engine/web-research.mjs \
      openmaus/bridge.mjs openmaus/workforce-engine.mjs openmaus/team.mjs \
      research/reach-bridge.mjs research/public-tools.mjs openmaus/essential-workforce.json
    )
    # Verify all update assets BEFORE overwriting a single existing file.
    for item in "${FILES[@]}"; do
      [ -f "$SOURCE/$item" ] || failed "Latest GitHub release is missing $item. Existing files were not modified."
    done
    for item in "${FILES[@]}"; do
      mkdir -p "$BACKUP/$(dirname "$item")" "$WEB/$(dirname "$item")"
      if [ -f "$WEB/$item" ]; then cp -p "$WEB/$item" "$BACKUP/$item"; fi
      cp "$SOURCE/$item" "$WEB/$item"
    done
    # Archive the retired cloud adapter so the updated app cannot load it.
    if [ -f "$WEB/native-engine/openrouter-provider.mjs" ]; then
      mkdir -p "$BACKUP/native-engine"
      mv "$WEB/native-engine/openrouter-provider.mjs" "$BACKUP/native-engine/openrouter-provider.mjs"
    fi
    UPDATED_CODE=1
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


# Browser control is a separate opt-in from the smaller text-only draft engine.
# No browser profile or website account is authorized by this setup step.
if [ ! -f "$BASE/browser-access-setup-decided" ]; then
  if /usr/bin/osascript -e 'display dialog "Enable agent browser tasks? This installs Chromium and a local vision model (several gigabytes). Account access still requires your permission in Office HQ, and you sign in yourself. Browser screenshots stay with the local model." buttons {"Later", "Enable Browser Tasks"} default button "Enable Browser Tasks" with title "Office HQ · Agent Browser"' >/dev/null 2>&1; then
    export PATH="$(dirname "$NODE"):$PATH"
    NPM_CLI="$(dirname "$NODE")/../lib/node_modules/npm/bin/npm-cli.js"
    BROWSER_SETUP_OK=0
    if [ -f "$NPM_CLI" ]; then
      if "$NODE" "$NPM_CLI" install --prefix "$WEB" --no-audit --no-fund; then BROWSER_SETUP_OK=1; fi
    elif command -v npm >/dev/null 2>&1; then
      if npm install --prefix "$WEB" --no-audit --no-fund; then BROWSER_SETUP_OK=1; fi
    fi
    if [ "$BROWSER_SETUP_OK" -eq 1 ] && [ -f "$WEB/node_modules/playwright/cli.js" ] &&
      "$NODE" "$WEB/node_modules/playwright/cli.js" install chromium && "$OLLAMA" pull 'qwen2.5vl:7b'; then
      /bin/date > "$BASE/browser-access-enabled"
      /bin/date > "$BASE/browser-access-setup-decided"
      say 'Agent browser runtime installed. Approve accounts inside Agent website access.'
    else
      say 'Browser setup did not finish. Office HQ drafts remain available; relaunch to retry browser setup.'
    fi
  else
    /bin/date > "$BASE/browser-access-setup-decided"
    say 'Browser tasks deferred. Website permissions remain reviewable; browser runtime setup is still required.'
  fi
fi


# Validate the same shared browser modules that render on iPhone/iPad.
for module in app.js office-features.js ceo-secure-chat.js website-access.js coding-tasks.js officehq-device-sync.js server.mjs; do
  "$NODE" --check "$WEB/$module" >/dev/null || failed "Updated Office HQ module failed syntax validation: $module"
done

if curl -fsS --connect-timeout 2 --max-time 3 "$URL" 2>/dev/null | grep -q 'Agent Office HQ'; then
  if [ "$UPDATED_CODE" -eq 1 ]; then
    # Stop ONLY a local Office HQ process with the expected web directory as cwd.
    # An unrelated server on port 3000 must never be interrupted.
    ACTIVE_PID="$(lsof -nP -tiTCP:3000 -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
    if [ -z "$ACTIVE_PID" ] || ! lsof -a -p "$ACTIVE_PID" -d cwd -Fn 2>/dev/null | grep -Fxq "n$WEB"; then
      failed 'Port 3000 still serves a previous/unknown process. Close the old Office HQ server, then reopen Office HQ.app. The new files are safely backed up.'
    fi
    say 'Restarting the verified local Office HQ server to activate the update...'
    kill -TERM "$ACTIVE_PID" || failed 'Could not stop the old Office HQ server safely.'
    for i in $(seq 1 20); do
      if ! kill -0 "$ACTIVE_PID" 2>/dev/null; then break; fi
      sleep 1
    done
    if kill -0 "$ACTIVE_PID" 2>/dev/null; then
      failed 'Old Office HQ process did not close. Quit it before reopening Office HQ.app.'
    fi
  else
    say 'Your synced Office HQ Mac server is already running.'
  fi
fi
if ! curl -fsS --connect-timeout 2 --max-time 3 "$URL" 2>/dev/null | grep -q 'Agent Office HQ'; then
  if curl -fsS --connect-timeout 2 --max-time 3 "$URL" >/dev/null 2>&1; then
    failed 'Another app uses port 3000. It was not interrupted.'
  fi
  say 'Starting Office HQ locally on this Mac...'
  (
    cd "$WEB"
    export HOST=127.0.0.1 PORT=3000
    if [ -f "$BASE/browser-access-enabled" ]; then
      export OFFICE_HQ_AI_BACKEND=ollama OLLAMA_MODEL='qwen2.5vl:7b'
    fi
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
# Verify the actual Mac HTTP server exposes all three requested screens.
for module in website-access.js coding-tasks.js ceo-secure-chat.js; do
  curl -fsS --connect-timeout 2 --max-time 6 "$URL$module" -o "$TEMP/$module" ||
    failed "Mac health check could not load $module."
  cmp -s "$TEMP/$module" "$WEB/$module" ||
    failed "Mac is serving outdated $module. Close the old server and reopen Office HQ."
done
say 'Mac screen and module health checks passed.'
say 'Success. Opening Office HQ on this Mac.'
say 'This installs the web app server. Optional local AI runtime requires separate consent/setup.'
say 'Mac and iOS records will not sync without a separate secure connection.'
open "http://127.0.0.1:3000/?hq_update=$(date +%s)#/thread"
printf '\nYou may close Terminal; Office HQ stays running while the Mac is on.\n'

