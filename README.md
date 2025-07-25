# Pushbullet Go
> **Note**: The extension name has been changed to "Push Go" due to Chrome Web Store policy.

![Pushbullet Go](screenshots/1_popup.png)

A lightweight Chrome extension for Pushbullet that enables receiving and sending pushes directly from your browser.

This extension is compatible with Manifest V3, making it an alternative to the official extension (since we could no longer use the official one in newer versions of Chrome).

## Features

This is an extension for [Pushbullet](https://www.pushbullet.com/), so you must be a Pushbullet user to access any of the following features:

- Receive and send pushes
- Push files/images by pasting or uploading (in standalone window due to Chrome's restrictions)
- Notifications for received pushes (display only)
- Filter received pushes by setting local device ID
- Control which device to push to by setting remote device ID
- Note: Only the 100 latest pushes (including received and sent) are stored locally; you can always access your entire push history on the Pushbullet website

## Installation

Install directly from the [Chrome Web Store (pending review)](https://chromewebstore.google.com/) or:

### Method 1: Install from Source
1. Download and unzip the source code from this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `/src` folder from the unzipped source code

### Method 2: Install from Release
1. Download the extension (crx file) from the `release/` folder
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Drag the crx file from Step 1 to the page to install
5. Verify the extension manually at the top of extension page (in three-dot menus)

## Setup

> **Note**: Chrome version 116 or higher is required to use this extension since the `chrome.idle` API is used to maintain connection to Pushbullet's WebSocket server.

1. Get your Pushbullet Access Token from [pushbullet.com](https://www.pushbullet.com/#settings/account)
2. Click the Pushbullet Go icon in your browser
3. Enter your access token in the options page
4. Start receiving and sending pushes!
5. (Optional) Set Local Device ID and Remote Device ID in the options page to filter incoming pushes and set targets for outgoing ones. You can get device IDs from URLs when visiting and choosing a device on the [Pushbullet devices page](https://www.pushbullet.com/#devices)

## Permissions

This extension requires the following permissions:
- **Storage**: To save your options and push history locally
- **Idle**: To maintain the connection to Pushbullet servers to receive pushes in real time
- **Notifications**: To display push notifications
- **Host Access**: To communicate with Pushbullet API servers

## Privacy

This extension stores everything locally and does not transmit any information beyond Pushbullet's API server.

## License

This project uses the [AGPL-3.0 license](https://github.com/nemofq/pushbullet-go?tab=AGPL-3.0-1-ov-file). If you have any feature requests or feedback, feel free to create an issue or pull request.

## Support

This is a hobby project, you can buy me a coffee to support: https://buymeacoffee.com/nemofq

## One More Thing

If you're also an iOS+Pushbullet user, you may find following Shortcuts useful:

- [Push to Pushbullet](https://www.icloud.com/shortcuts/42b9dce7d6b44c72acd3e5c55b5de07a)
- [Pushbullet Receiver](https://www.icloud.com/shortcuts/1f94913de21b41debe60ef43631afde2)
