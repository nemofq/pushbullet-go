# Pushbullet Go

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

Install directly from the [Chrome Web Store](https://chromewebstore.google.com/) or:

1. Download the extension (crx file) from the `release/` folder
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Drag the crx file from Step 1 to the page to install

## Setup

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

## License

This project uses the AGPL-3.0 license. If you have any feature requests or feedback, feel free to create an issue or pull request.