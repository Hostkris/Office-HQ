#!/usr/bin/env python3
"""Build a downloadable one-click macOS app bundle in a ZIP using stdlib only.
No credentials or third-party Python dependencies. GitHub Action publishes ZIP.
"""
from pathlib import Path
import os
import plistlib
import stat
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BOOT = ROOT / "mac" / "install.command"
DIST = ROOT / "downloads"
TARGET = DIST / "Office_HQ_for_Mac.zip"

def archive_file(zf, relative, content, executable=False):
    info = zipfile.ZipInfo(relative)
    info.create_system = 3
    info.compress_type = zipfile.ZIP_DEFLATED
    info.external_attr = (0o100755 if executable else 0o100644) << 16
    zf.writestr(info, content)

def main():
    subprocess.run(["bash", "-n", str(BOOT)], check=True)
    DIST.mkdir(exist_ok=True)
    plist = {
        "CFBundleDisplayName": "Office HQ",
        "CFBundleExecutable": "OfficeHQ",
        "CFBundleIdentifier": "com.hostkris.officehq.mac-launcher",
        "CFBundleInfoDictionaryVersion": "6.0",
        "CFBundleName": "Office HQ",
        "CFBundlePackageType": "APPL",
        "CFBundleShortVersionString": "1.0.0",
        "CFBundleVersion": "1",
        "LSMinimumSystemVersion": "14.0",
        "NSHighResolutionCapable": True,
        "LSUIElement": False,
    }
    executable = """#!/bin/bash
set -Eeuo pipefail
APP="$(cd "$(dirname "$0")/.." && pwd)"
/usr/bin/open -a Terminal "$APP/Resources/install.command"
"""
    readme = """Office HQ for Mac — install from your iPhone/iPad
=================================================

1. AirDrop this ZIP or its download URL to your Mac.
2. On the Mac, download the ZIP and double-click to extract it.
3. Open Office HQ.app. If macOS blocks the unsigned app, inspect its
   origin and use Finder > Control-click > Open, or System Settings
   > Privacy & Security > Open Anyway only if you trust this file.
4. Approve the setup dialog. The launcher fetches your GitHub app,
   privately installs Node.js when necessary, and starts the local
   Office HQ website at http://127.0.0.1:3000/#/thread.

Existing ~/Office-HQ files are NEVER replaced automatically.

This is a Mac launcher, not a signed offline application.
On setup it fetches and installs the full independent Ollama runtime and
llama3.2:3b model from the official vendor. These are several GB and run
locally on your Mac. First installation requires internet and macOS 14+.
The Mac sync engine connects to your existing private Office HQ cloud
account only AFTER you sign in under Company Messages. Sign in on your
iPhone/iPad with the same account to begin automatic assignment sync.
Authorize each Mac AI specialist separately to prepare draft-only work.
It never grants website sign-ins, emailing, publishing or money actions.

Your company records are stored separately on each device unless
you configure authenticated sync.
"""
    rel = "Office HQ.app/Contents/"
    with zipfile.ZipFile(TARGET, "w") as z:
        archive_file(z, rel + "Info.plist", plistlib.dumps(plist))
        archive_file(z, rel + "MacOS/OfficeHQ", executable.encode(), True)
        archive_file(z, rel + "Resources/install.command", BOOT.read_bytes(), True)
        archive_file(z, rel + "Resources/README.txt", readme.encode())
    with zipfile.ZipFile(TARGET) as z:
        assert z.testzip() is None
        assert len(z.namelist()) == 4
    print(f"Built {TARGET} ({TARGET.stat().st_size} bytes)")

if __name__ == "__main__":
    main()
