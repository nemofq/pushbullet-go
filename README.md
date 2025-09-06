# Pushbullet Go
> **Note 1**: The extension name has been changed to "Push Go" due to Chrome Web Store policy.
>
> **Note 2**: This is a third-party, open-source client for Pushbullet API. Not affiliated with or endorsed by the service.

![Pushbullet Go](screenshots/1_popup.png)

A lightweight Chrome extension for Pushbullet that enables receiving and sending pushes directly from your browser.

This extension is compatible with Manifest V3, making it an alternative to the official extension which no longer works.

## Features

Require a [Pushbullet](https://www.pushbullet.com/) account. Features include:

- Receive and send pushes
- Push files/images by pasting or uploading (in standalone window due to Chrome's restriction)
- Push current page's URL, selected text, or images from context menu with device/people selection
- Control which devices to push to by selecting devices
- Notifications for received pushes with buttons to open links and dismiss
- Auto-open received link in a new tab (default off, enable in options page)
- Stores 100 latest pushes locally (full history available on Pushbullet website)
- (New) Filter to only show and notify pushes sent to browsers
- (New) Control notifications from browser-sourced pushes (useful for multi-browser use case)
- (New) Notification Mirroring (requires Pushbullet Android app installed and enabled in both Android app and Push Go settings)
- (New) Dark Mode (follows system by default, or choose manually)
- (New) Supports i18n with 33 languages
- (New) Unread count
- (New) Quick share of current tab's link in the popup (default off, enable in options page)
- (New) Play sound on notification (can be disabled in options page)
- (New) End-to-end encryption for notification mirroring

## Installation
> **Note 3**: Requires Chrome 116+ for using `chrome.idle` API to maintain connection to Pushbullet's WebSocket server.

Install directly from the [Chrome Web Store](https://chromewebstore.google.com/detail/push-go/dghndapbehjdbhiffbckojkhoennbofg) or:

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
5. Click "Keep this extension" at the top of extension page (in three-dot menus)

## Setup

1. Get your access token from [Pushbullet settings](https://www.pushbullet.com/#settings/account)
2. Click the extension icon and enter your token
3. Start sending and receiving pushes!
4. Customize settings on the options page as needed

## Permissions

This extension requires the following permissions:
- **Storage**: To save your options and push history locally
- **Idle**: To maintain the connection to receive pushes in real time
- **Notifications**: To display push notifications
- **Context Menus**: To add right-click menu options for pushing content
- **Active Tab**: To access current page's URL for context menu actions
- **Host Access**: To communicate with Pushbullet API servers
- **Offscreen**: To play notification sound

## Privacy

This extension stores everything locally and does not transmit any information beyond Pushbullet's API.

## License

This project uses the [AGPL-3.0 license](https://github.com/nemofq/pushbullet-go?tab=AGPL-3.0-1-ov-file). If you have any feature requests or feedback, feel free to create an issue or pull request.

## Support

This is a hobby project, you can buy me a coffee to support: https://buymeacoffee.com/nemofq

## One More Thing

If you're also an iOS+Pushbullet user, you may find these Shortcuts useful:

- [Push to Pushbullet](https://www.icloud.com/shortcuts/5549bbb5b06e4f0a8ccb1b6fd33e853f)
- [Pushbullet Receiver](https://www.icloud.com/shortcuts/1f94913de21b41debe60ef43631afde2)
