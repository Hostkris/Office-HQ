# Office HQ

Your Office HQ web application works on iPhone, iPad, and Mac.

## Send Office HQ from an iPhone or iPad to your Mac

**[Download Office HQ for Mac (ZIP)](https://raw.githubusercontent.com/Hostkris/Office-HQ/main/downloads/Office_HQ_for_Mac.zip)**

**[Open the Send to Mac / AirDrop page](https://hostkris.github.io/Office-HQ/agent-office-hq/mac.html)**

On your iPhone or iPad, open Office HQ in Safari and tap **Send to Mac**. Use the iOS share sheet to AirDrop the public download link to your Mac, or send the link through Messages. On the Mac, open the link, download the ZIP, extract it, and open **Office HQ.app**. macOS may request manual approval for the unsigned app.

The Mac launcher installs or reuses Office HQ and downloads the full independent Ollama runtime and its local `llama3.2:3b` model. macOS 14+, disk space, and internet are required for first setup. The model runs privately on your Mac; you authorize each AI employee before draft work begins. No external accounts or financial actions are enabled automatically.

The iPhone cannot silently install software on your Mac. AirDrop/Share sends the link; downloading and launching require the Mac owner's action. **Automatic assignments sync:** In Company Messages on both devices, open **Connect devices / manage sync** and sign into the same private Office HQ Cloud account. On the Mac, separately authorize any specialist allowed to handle synced draft-only tasks. The Mac server polls for assignments even when its browser is closed. iOS sends and retrieves updates while Office HQ is open; Apple does not allow this web app to run continuously after you close it. The iPhone-style signal bars display full strength only when both signed-in devices recently exchanged data, and an X when disconnected.

[Open Office HQ on iOS or desktop](https://hostkris.github.io/Office-HQ/) · [Mac installer source](./mac/) · [Full Office HQ README](./agent-office-hq/README.md)


## Latest workforce update

Open **Department activation** to authorize a department's individual Mac AI
specialists and their phone-sync mappings. Use **Department teams** for one
combined report across one or all 12 departments, **Ask / chat** in Company
Messages for local AI conversations, and **Agent Health → Fix It** to check and
resume eligible interrupted drafts. The Mac launcher is version 1.0.4. Your Mac
must run the update and remain awake; outside account access is separately
controlled. See the [workforce instructions](agent-office-hq/README.md).


## Coding work loop

Open [Coding tasks](https://hostkris.github.io/Office-HQ/agent-office-hq/#/coding)
for a separately approved repository snapshot, selected source files, exact checks,
repair attempts and a diff with evidence for CEO review. Update the Mac launcher
to 1.0.4 and configure an installed tool-capable Ollama model. Optional OpenRouter
Inkling uses the supplied pinned free route, a Mac-only API key and explicit
public-data consent. See the [setup and boundaries](agent-office-hq/README.md).
