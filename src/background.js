let ws = null;
let connectionStatus = 'disconnected';
let lastModified = 0;
let accessToken = null;
let heartbeatTimer = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let keepAliveIntervalId = null;
let pushbulletCrypto = null;
let currentIdleState = 'active';

// Context menu setup lock to prevent race conditions
let isSettingUpContextMenus = false;

// Shared promise lock for offscreen document creation. Chrome only allows one
// offscreen document per extension; concurrent playAlertSound() callers after
// a cold service worker would otherwise all see no existing context and race
// into createDocument(), causing the second call to throw.
let creatingOffscreenDocument = null;


// Initialize custom i18n for background script
let cachedMessages = {};
let currentLanguage = 'auto';
let isI18nInitialized = false;

// Custom getMessage for background script
function getMessage(messageKey, substitutions = []) {
  if (currentLanguage === 'auto' || !isI18nInitialized) {
    return chrome.i18n.getMessage(messageKey, substitutions);
  }
  
  const messageObj = cachedMessages[messageKey];
  if (!messageObj || !messageObj.message) {
    return chrome.i18n.getMessage(messageKey, substitutions);
  }
  
  let message = messageObj.message;
  
  if (substitutions && substitutions.length > 0) {
    substitutions.forEach((substitution, index) => {
      const placeholder = `$${index + 1}`;
      message = message.replace(new RegExp(`\\${placeholder}`, 'g'), substitution);
    });
  }
  
  return message;
}

// Initialize i18n for background script
async function initializeBackgroundI18n() {
  try {
    const data = await chrome.storage.local.get('languageMode');
    currentLanguage = data.languageMode || 'auto';
    
    if (currentLanguage === 'auto') {
      isI18nInitialized = true;
      return;
    }
    
    // Load locale messages differently in service worker context
    try {
      const url = chrome.runtime.getURL(`_locales/${currentLanguage}/messages.json`);
      const response = await fetch(url);
      
      if (response.ok) {
        const text = await response.text();
        cachedMessages = JSON.parse(text);
      } else {
        throw new Error(`Failed to load locale: ${response.status}`);
      }
    } catch (fetchError) {
      console.warn(`Failed to load custom locale ${currentLanguage}, using Chrome default:`, fetchError);
      currentLanguage = 'auto';
    }
    
    isI18nInitialized = true;
  } catch (error) {
    console.warn('Failed to initialize background i18n, falling back to Chrome default:', error);
    currentLanguage = 'auto';
    isI18nInitialized = true;
  }
}

// Get current language function for background script
function getCurrentLanguage() {
  return currentLanguage;
}

// Create a global CustomI18n object for service worker context
const CustomI18n = { getMessage, getCurrentLanguage, initializeI18n: initializeBackgroundI18n };

// Initialize i18n immediately for service worker
initializeBackgroundI18n().catch(error => {
  console.warn('Initial i18n initialization failed, will use Chrome default:', error);
});

// Import crypto module
importScripts('crypto.js');
// @ts-ignore - PushbulletCrypto is loaded via importScripts

// Initialize idle state on extension load
chrome.idle.queryState(60, (state) => {
  currentIdleState = state;
  console.log('Initial idle state:', state);
});

// Ensure the offscreen document is open, serializing concurrent callers
// through a shared promise. createDocument() resolves before the document's
// script registers its message listener, so we also wait for the OFFSCREEN_READY
// handshake — otherwise the first sound after a cold service worker is dropped.
async function ensureOffscreenDocument() {
  // Check the in-flight creation promise BEFORE getContexts: createDocument()
  // resolves once the document exists but before its script registers a
  // message listener, so a second caller arriving in that window would see an
  // existing context and skip the OFFSCREEN_READY wait, dropping their message.
  if (creatingOffscreenDocument) {
    await creatingOffscreenDocument;
    return;
  }

  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT]
  });
  if (existingContexts.length > 0) return;

  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = (async () => {
      const ready = new Promise((resolve) => {
        const onReady = (message) => {
          if (message?.type !== 'OFFSCREEN_READY') return;
          chrome.runtime.onMessage.removeListener(onReady);
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          chrome.runtime.onMessage.removeListener(onReady);
          resolve(); // best-effort fallback; attempt playback regardless
        }, 2000);
        chrome.runtime.onMessage.addListener(onReady);
      });
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
        justification: 'Play notification alert sound.'
      });
      await ready;
    })().finally(() => {
      creatingOffscreenDocument = null;
    });
  }
  await creatingOffscreenDocument;
}

async function playAlertSound() {
  try {
    // Check if sound is enabled; sound is a sub-option of the OS notifications
    // master toggle, so it is muted when the master is off (absent means on)
    const soundSettings = await chrome.storage.local.get(['playSoundOnNotification', 'showOsNotifications']);
    if (soundSettings.playSoundOnNotification === false || soundSettings.showOsNotifications === false) {
      return; // Sound is disabled
    }

    // Check if screen is locked
    if (currentIdleState === 'locked') {
      console.log('Screen is locked - suppressing notification sound');
      return;
    }

    await ensureOffscreenDocument();

    // Send message to offscreen document to play sound
    chrome.runtime.sendMessage({
      type: 'PLAY_ALERT_SOUND',
      target: 'offscreen-doc'
    });
  } catch (error) {
    console.error('Failed to play alert sound:', error);
  }
}


// One-time migration from sync to local storage for specific fields
async function migrateSpecificFieldsFromSyncToLocal() {
  try {
    // Check if migration already completed
    const migrationCheck = await chrome.storage.local.get('migrationFromSyncCompleted_v2');
    if (migrationCheck.migrationFromSyncCompleted_v2) {
      return; // Already migrated
    }

    console.log('Starting migration of specific fields from sync to local storage');

    // Fields to migrate from sync to local
    const fieldsToMigrate = [
      'remoteDeviceId',
      'autoOpenLinks',
      'notificationMirroring',
      'onlyBrowserPushes',
      'showOtherDevicePushes',
      'selectedOtherDeviceIds',
      'showNoTargetPushes',
      'hideBrowserPushes',
      'showSmsShortcut',
      'colorMode',
      'languageMode',
      'defaultTab'
    ];

    // Get these specific fields from sync storage
    const syncData = await chrome.storage.sync.get(fieldsToMigrate);

    // Check if any of the fields exist in sync storage
    const hasFieldsToMigrate = Object.keys(syncData).length > 0 && 
                              fieldsToMigrate.some(field => syncData[field] !== undefined);

    if (hasFieldsToMigrate) {
      console.log(`Migrating ${Object.keys(syncData).length} fields from sync to local storage:`, Object.keys(syncData));
      
      // Copy the fields to local storage
      await chrome.storage.local.set(syncData);
      
      // Remove only these specific fields from sync storage
      await chrome.storage.sync.remove(fieldsToMigrate);
      
      console.log('Migration completed successfully');
    } else {
      console.log('No relevant fields found in sync storage, skipping migration');
    }

    // Mark migration as completed (this ensures it only runs once)
    await chrome.storage.local.set({ migrationFromSyncCompleted_v2: true });

    // Re-initialize extension components to pick up migrated settings
    if (hasFieldsToMigrate) {
      console.log('Re-initializing extension after settings migration');
      
      // Re-initialize i18n for language settings
      if (syncData.languageMode !== undefined || syncData.colorMode !== undefined) {
        await initializeBackgroundI18n();
      }
      
      // Update context menus if relevant settings changed
      if (syncData.languageMode !== undefined) {
        await setupContextMenus();
      }
    }

  } catch (error) {
    console.error('Migration failed:', error);
    // Don't set migration as completed if it failed, so it can retry next time
  }
}

// One-time migration of the devices and people lists from sync to local
// storage. sync caps each item at 8KB (QUOTA_BYTES_PER_ITEM), which the raw
// devices array can exceed for accounts with many devices.
async function migrateDevicesPeopleFromSyncToLocal() {
  try {
    const migrationCheck = await chrome.storage.local.get('migrationFromSyncCompleted_v3');
    if (migrationCheck.migrationFromSyncCompleted_v3) {
      return; // Already migrated
    }

    const syncData = await chrome.storage.sync.get(['devices', 'people']);
    const localData = await chrome.storage.local.get(['devices', 'people']);

    // Copy only keys local doesn't already have, so a fresher copy written by
    // ensureDeviceDataFromServer() is never clobbered by the stale sync copy
    const toCopy = {};
    if (syncData.devices !== undefined && localData.devices === undefined) {
      toCopy.devices = syncData.devices;
    }
    if (syncData.people !== undefined && localData.people === undefined) {
      toCopy.people = syncData.people;
    }

    if (Object.keys(toCopy).length > 0) {
      console.log('Migrating devices/people lists from sync to local storage:', Object.keys(toCopy));
      await chrome.storage.local.set(toCopy);
    }

    // Leave the sync copies in place: pre-v1.11.5 installs on the same
    // Chrome profile still read them, and a remove() here would sync the
    // deletion over to those machines, emptying their device/people lists.
    // Reclaim the sync quota in a later release once old versions age out.

    await chrome.storage.local.set({ migrationFromSyncCompleted_v3: true });
  } catch (error) {
    console.error('Devices/people migration failed:', error);
    // Don't set migration as completed if it failed, so it can retry next time
  }
}

// Run migration immediately when background script loads
migrateSpecificFieldsFromSyncToLocal();
const devicesPeopleMigration = migrateDevicesPeopleFromSyncToLocal();

// Mirrors the stored mirrorDecryptIssue flag so repeated drops don't rewrite
// storage on every frame; undefined = not yet written this worker lifetime.
let mirrorDecryptIssueCache;

// Record why encrypted ephemerals are being dropped ('not_configured' |
// 'failed') or clear the record (null). The popup shows this state in the
// notifications tab in place of the frozen list.
async function setMirrorDecryptIssue(reason) {
  if (mirrorDecryptIssueCache === reason) return;
  mirrorDecryptIssueCache = reason;
  try {
    if (reason) {
      await chrome.storage.local.set({ mirrorDecryptIssue: reason });
    } else {
      await chrome.storage.local.remove('mirrorDecryptIssue');
    }
  } catch (error) {
    console.error('Failed to update mirrorDecryptIssue:', error);
  }
}

// Initialize encryption if key is stored
async function initializeEncryption() {
  try {
    // Get userIden to load the correct key
    const syncData = await chrome.storage.sync.get('userIden');
    if (!syncData.userIden) {
      // No user logged in, clear any encryption
      if (pushbulletCrypto) {
        pushbulletCrypto.clear();
        pushbulletCrypto = null;
      }
      return;
    }
    
    const keyName = `encryptionKey_${syncData.userIden}`;
    const localData = await chrome.storage.local.get(keyName);
    
    if (localData[keyName]) {
      if (!pushbulletCrypto) {
        pushbulletCrypto = new PushbulletCrypto();
      }
      await pushbulletCrypto.importKey(localData[keyName]);
      console.log('Encryption initialized successfully');
    } else if (pushbulletCrypto) {
      // Clear encryption if key is removed
      pushbulletCrypto.clear();
      pushbulletCrypto = null;
    }
  } catch (error) {
    console.error('Failed to initialize encryption:', error);
  }
}
// Network event listeners for immediate reconnection when network comes back
// Note: In service workers, we rely on navigator.onLine checks in connectWebSocket instead of events

// Consolidated auto-reconnection logic: check connection status periodically
setInterval(async () => {
  try {
    const data = await chrome.storage.sync.get('accessToken');
    if (data.accessToken && connectionStatus === 'disconnected' && !ws) {
      // Auto-reconnect scenarios:
      // 1. After max attempts reached - periodic retry after individual attempts gave up  
      // 2. Fresh extension start - initializeExtension should handle this, but as backup
      if (reconnectAttempts >= maxReconnectAttempts) {
        console.log('Auto-reconnection: periodic retry after max attempts reached');
        await resetConnection(); // Reset attempts counter for fresh start
        connectWebSocket();
      }
      // For disable/enable scenario, initializeExtension() should handle the connection
      // This periodic check primarily serves as backup for max attempts scenario
    }
  } catch (error) {
    console.log('Auto-reconnection check failed - will retry next cycle:', error);
  }
}, 5000); // Check every 5 seconds like original

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated');
  initializeBackgroundI18n().then(async () => {
    initializeExtension();
    await setupContextMenus();
  }).catch(async (error) => {
    console.error('Failed to initialize extension:', error);
    // Fallback initialization without custom i18n
    initializeExtension();
    await setupContextMenus();
  });
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Chrome started');
  initializeBackgroundI18n().then(async () => {
    initializeExtension();
    await setupContextMenus();
  }).catch(async (error) => {
    console.error('Failed to initialize extension:', error);
    // Fallback initialization without custom i18n
    initializeExtension();
    await setupContextMenus();
  });
});

// Handle extension enable after disable - this doesn't trigger onInstalled
// Initialize immediately when service worker starts
console.log('Service worker starting - initializing extension');
initializeBackgroundI18n().then(async () => {
  initializeExtension();
  await setupContextMenus();
}).catch(async (error) => {
  console.error('Failed to initialize extension on startup:', error);
  // Fallback initialization without custom i18n
  initializeExtension();
  await setupContextMenus();
});

// Seeds the user's default ON the first time the account has people; an
// explicit value is never overwritten.
async function seedEnableChatDefault() {
  try {
    const { people, enableChat } = await chrome.storage.local.get(['people', 'enableChat']);
    if (enableChat === undefined && (people || []).length > 0) {
      await chrome.storage.local.set({ enableChat: true });
    }
  } catch (error) {
    console.error('Failed to seed enableChat default:', error);
  }
}

chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'local' && (changes.devices || changes.people || changes.enableContextMenu)) {
    await setupContextMenus();
  }
  if (namespace === 'local' && changes.people) {
    // Seed the Chat-default the first time the account has people; this branch
    // catches every people writer (incl. the options-page Retrieve, whose write
    // wakes the service worker). An explicit value is never overwritten.
    await seedEnableChatDefault();
  }
  if (namespace === 'local' && changes.languageMode) {
    // Language changed, reinitialize i18n and update context menus
    initializeBackgroundI18n().then(async () => {
      await setupContextMenus();
    }).catch(async (error) => {
      console.error('Failed to reinitialize i18n:', error);
      await setupContextMenus();
    });
  }
  // Recompute the derived chat unread count when any of its inputs change: the
  // people list (membership + mute), or the per-person read stamps the popup
  // writes on opening a conversation. Push arrivals are handled by the notify
  // batch, and popup deletions by deletePush.
  if (namespace === 'local' && (changes.people || changes.peopleLastRead)) {
    await updateChatUnreadCount();
  }
  // Chat surface toggled. Enabling stamps a fresh read floor so people
  // pushes that accumulated while Chat was off never badge retroactively
  // (they were out of scope); the recompute then settles the count in
  // both directions (to 0 on disable).
  if (namespace === 'local' && changes.enableChat) {
    if (changes.enableChat.newValue === true && changes.enableChat.oldValue !== true) {
      await chrome.storage.local.set({ chatReadFloor: Date.now() / 1000 });
    }
    await updateChatUnreadCount();
  }
  // Update badge when display settings change
  if (namespace === 'local' && (changes.displayUnreadCounts || changes.displayUnreadPushes || changes.displayUnreadMirrored || changes.displayUnreadChats)) {
    await updateBadge();
  }
});


chrome.idle.onStateChanged.addListener((state) => {
  console.log('Idle state changed to:', state);
  currentIdleState = state;

  if (state === 'active' && connectionStatus === 'disconnected') {
    console.log('System resumed from idle - triggering reconnection');
    // Reset attempts counter to allow fresh reconnection
    reconnectAttempts = 0;
    // Use existing reconnection logic directly
    connectWebSocket();
  }
});

// Keep this listener synchronous: an async listener returns a Promise for every
// message, which Chrome treats as sendResponse(value). Cases that don't need to
// reply should return nothing; only the explicit async-response case returns
// `true` to keep the channel open for sendResponse.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'token_updated':
      handleTokenUpdated();
      return;
    case 'get_status':
      sendResponse({
        status: connectionStatus,
        canRetry: reconnectAttempts >= maxReconnectAttempts
      });
      return;
    case 'retry_connection':
      handleRetryConnection();
      return;
    case 'send_push':
      sendPush(message.data);
      return;
    case 'clear_unread_pushes':
      clearUnreadPushCount();
      return;
    case 'clear_unread_mirrors':
      markMirrorNotificationsRead();
      return;
    case 'clear_push_history':
      clearPushHistory();
      return;
    case 'clear_person_history':
      clearPersonHistory(message.email_normalized);
      return;
    case 'clear_mirror_history':
      clearMirrorHistory();
      return;
    case 'delete_notification':
      deleteNotification(message.id);
      return;
    case 'delete_push':
      deletePush(message.iden);
      return;
    case 'refresh_people':
      // Chat tab opened: opportunistic people-list refresh (§7 trigger 4),
      // fire-and-forget. Throttled to 15 min on tab open here, then to 60s
      // inside refreshPeopleFromServer().
      maybeRefreshPeopleOnTabOpen();
      return;
    case 'set_person_muted':
      // Mute / unmute the person's chat — the one in-extension chat action
      // (POST /v2/chats/{iden}); replies with { success } once the server + the
      // local people entry are updated.
      setPersonMuted(message.iden, message.email_normalized, message.muted)
        .then(success => sendResponse({ success }));
      return true; // Will respond asynchronously
    case 'encryption_updated':
      // Encryption settings changed: reset the drop notice; the next
      // encrypted ephemeral re-evaluates against the new key state
      setMirrorDecryptIssue(null);
      initializeEncryption().then(() => {
        sendResponse({ success: true });
      });
      return true; // Will respond asynchronously
  }
});

async function handleTokenUpdated() {
  // Token/account changed: the drop notice reflects the old account's
  // traffic; the next encrypted ephemeral re-evaluates against the new state
  setMirrorDecryptIssue(null);
  try {
    await initializeBackgroundI18n();
  } catch (error) {
    console.error('Failed to reinitialize i18n:', error);
  }
  initializeExtension();
  await setupContextMenus();
}

async function handleRetryConnection() {
  // Manual reconnection from popup - use existing logic directly.
  // Go through getAccessToken() so a cold service-worker wake before
  // initializeExtension() finishes doesn't silently no-op the retry.
  if (await getAccessToken()) {
    console.log('Manual reconnection requested from popup');
    // Reset attempts counter for fresh start
    reconnectAttempts = 0;
    // Use existing reconnection logic directly
    connectWebSocket();
  } else {
    console.log('No access token available for manual reconnection');
    connectionStatus = 'disconnected';
    await updateBadge();
  }
}

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'push-current-page') {
    // No accessToken pre-check: sendPush() lazy-loads the token so a cold
    // service-worker wake-up doesn't silently drop the keyboard action.

    // Get the configured remote device IDs (same logic as context menu)
    const configData = await chrome.storage.local.get('remoteDeviceId');

    const pageData = {
      type: 'link',
      url: tab.url,
      title: tab.title
    };

    if (configData.remoteDeviceId) {
      pageData.device_iden = configData.remoteDeviceId;
    }

    await sendPush(pageData);
    console.log('Page URL pushed via keyboard shortcut:', tab.url);
  }
});

// Trim a chat object down to the fields we store per person. Written to
// storage.local only — never to the stale pre-1.11.5 sync copies, which must
// not gain the new fields. Older {email_normalized, name} entries that predate
// these fields are tolerated by every consumer until the next fetch upgrades them.
// keep in sync with options.js trimChatToPerson
function trimChatToPerson(chat) {
  return {
    iden: chat.iden,
    type: chat.with.type,
    email: chat.with.email,
    email_normalized: chat.with.email_normalized,
    name: chat.with.name || chat.with.email,
    image_url: chat.with.image_url,
    muted: chat.muted === true
  };
}

// Fetch the devices and people lists from the server when a token exists but
// the local lists are missing or empty (new machine that received the token
// via Chrome sync, token saved without running Retrieve).
// Mirrors the options-page Retrieve flow, including creating this browser's
// chrome-type device if the account has never had one. Read-only otherwise;
// safe to re-run on every service-worker start.
let isEnsuringDeviceData = false;

async function ensureDeviceDataFromServer() {
  if (isEnsuringDeviceData) {
    return;
  }
  isEnsuringDeviceData = true;

  try {
    // Let the one-time migration finish first so its sync copy (if any) wins
    // over a needless network fetch
    await devicesPeopleMigration;

    const token = await getAccessToken();
    if (!token) return;

    // The migration copies the device list but chromeDeviceId was never in
    // sync, so only a completed fetch (which records chromeDeviceId - even as
    // null for accounts with no usable Chrome device) satisfies this gate
    const localData = await chrome.storage.local.get(['devices', 'chromeDeviceId']);
    if (localData.devices && localData.devices.length > 0 && localData.chromeDeviceId !== undefined) return;

    const devicesResponse = await fetch('https://api.pushbullet.com/v2/devices', {
      headers: { 'Access-Token': token }
    });
    if (!devicesResponse.ok) return; // Retry on a later service-worker start

    const devicesData = await devicesResponse.json();
    let devices = devicesData.devices || [];

    // Deleted devices come back as inactive tombstones and still count here,
    // so a device the user removed on pushbullet.com is not resurrected
    const hasChromeDevice = devices.some(device => device.type === 'chrome');
    if (!hasChromeDevice) {
      console.log('No Chrome device found, creating one...');
      const createDeviceResponse = await fetch('https://api.pushbullet.com/v2/devices', {
        method: 'POST',
        headers: {
          'Access-Token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nickname: 'Chrome',
          type: 'chrome',
          model: 'Chrome'
        })
      });

      if (createDeviceResponse.ok) {
        const updatedDevicesResponse = await fetch('https://api.pushbullet.com/v2/devices', {
          headers: { 'Access-Token': token }
        });
        if (updatedDevicesResponse.ok) {
          const updatedDevicesData = await updatedDevicesResponse.json();
          devices = updatedDevicesData.devices || [];
        }
      } else {
        console.warn('Failed to create Chrome device:', createDeviceResponse.status, createDeviceResponse.statusText);
      }
    }

    // ?active=true asks the server to omit deleted chats; the client-side
    // active filter below stays as belt-and-braces (deleted objects are
    // returned by default per the API docs).
    const chatsResponse = await fetch('https://api.pushbullet.com/v2/chats?active=true', {
      headers: { 'Access-Token': token }
    });
    if (!chatsResponse.ok) return; // Save nothing partial; retry later

    const chatsData = await chatsResponse.json();
    const people = (chatsData.chats || [])
      .filter(chat => chat.active === true)
      .map(trimChatToPerson);

    const chromeDevice = devices.find(device => device.active && device.pushable !== false && device.type === 'chrome');
    const chromeDeviceId = chromeDevice ? chromeDevice.iden : null;

    await chrome.storage.local.set({ devices: devices, people: people, chromeDeviceId: chromeDeviceId, lastPeopleFetch: Date.now() });
    console.log(`Device data fetched from server: ${devices.length} devices, ${people.length} people`);
  } finally {
    isEnsuringDeviceData = false;
  }
}

// People-list freshness (§7): there is no chat tickle, so the list is refreshed
// opportunistically — here, when an incoming push arrives from a sender not yet
// in the local list. Throttled to at most once a minute via a module-level
// timestamp so a burst of unknown-sender pushes triggers a single refetch.
let lastPeopleRefreshAttempt = 0;

// Bumped on every targeted local write to `people` (currently the mute
// toggle). refreshPeopleFromServer snapshots it before fetching and discards
// its response if the token moved while the request was in flight — a
// wholesale write from a stale snapshot must never overwrite a newer local
// fact; the next refresh, whose request post-dates the write, reconciles.
let peopleWriteToken = 0;

async function refreshPeopleFromServer() {
  if (Date.now() - lastPeopleRefreshAttempt < 60 * 1000) return;
  lastPeopleRefreshAttempt = Date.now();

  const token = await getAccessToken();
  if (!token) return;
  const writeTokenAtFetch = peopleWriteToken;

  try {
    // ?active=true asks the server to omit deleted chats; the client-side
    // active filter below stays as belt-and-braces.
    const response = await fetch('https://api.pushbullet.com/v2/chats?active=true', {
      headers: { 'Access-Token': token }
    });
    if (!response.ok) return;

    const data = await response.json();
    // A targeted write landed while this fetch was in flight: this response
    // pre-dates it — discard instead of overwriting (see peopleWriteToken).
    if (writeTokenAtFetch !== peopleWriteToken) return;
    const people = (data.chats || [])
      .filter(chat => chat.active === true)
      .map(trimChatToPerson);
    await chrome.storage.local.set({ people: people, lastPeopleFetch: Date.now() });
  } catch (error) {
    console.error('Failed to refresh people from server:', error);
  }
}

// Chat tab open (§7 trigger 4): refresh the people list only when the last
// successful fetch is older than 15 minutes. refreshPeopleFromServer() keeps its
// own 60s guard on top; fire-and-forget.
async function maybeRefreshPeopleOnTabOpen() {
  const data = await chrome.storage.local.get('lastPeopleFetch');
  const last = data.lastPeopleFetch || 0;
  if (Date.now() - last < 15 * 60 * 1000) return;
  refreshPeopleFromServer();
}

// Mute / unmute a person's chat (POST /v2/chats/{iden} {muted}). On success the
// local people entry is updated immediately from the POST response body — the
// updated chat object, the post-mute truth. Returns whether it succeeded.
async function setPersonMuted(iden, emailNormalized, muted) {
  const token = await getAccessToken();
  if (!token || !iden) return false;

  try {
    const response = await fetch(`https://api.pushbullet.com/v2/chats/${iden}`, {
      method: 'POST',
      headers: {
        'Access-Token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ muted: muted })
    });
    if (!response.ok) return false;

    // The response body is the updated chat object — the post-mute truth —
    // so apply it directly instead of refetching to confirm (the old confirm
    // refetch was throttled into a no-op by the refresh's own 60s guard).
    // Fall back to flipping the flag if the body ever lacks the shape.
    let updatedPerson = null;
    try {
      const chat = await response.json();
      if (chat && chat.with) updatedPerson = trimChatToPerson(chat);
    } catch (e) {
      // Body unusable; the flag-flip below covers it.
    }

    const data = await chrome.storage.local.get('people');
    const people = (data.people || []).map(person =>
      person.email_normalized === emailNormalized
        ? (updatedPerson || { ...person, muted: muted })
        : person);
    peopleWriteToken++;
    await chrome.storage.local.set({ people: people });
    return true;
  } catch (error) {
    console.error('Failed to set chat muted state:', error);
    return false;
  }
}

async function initializeExtension() {
  const data = await chrome.storage.sync.get('accessToken');
  const localData = await chrome.storage.local.get(['lastModified', 'lastMirrorReadTime', 'chatReadFloor']);
  accessToken = data.accessToken;

  // Restore lastModified from storage to survive extension restarts
  if (localData.lastModified) {
    lastModified = localData.lastModified;
  }

  // First run after the update that introduced the derived unread count:
  // treat entries stored before it as read so the badge does not light up
  // retroactively.
  if (localData.lastMirrorReadTime === undefined) {
    await chrome.storage.local.set({ lastMirrorReadTime: Date.now() / 1000 });
  }

  // Same day-zero guard for the derived chat unread count: seed the read floor
  // at now the first time we run (existing installs and fresh setups alike), so
  // historical people pushes already in the cache never badge retroactively.
  if (localData.chatReadFloor === undefined) {
    await chrome.storage.local.set({ chatReadFloor: Date.now() / 1000 });
  }

  // Recompute the derived unread count on startup so the cached value can
  // never stay stale across service worker restarts.
  await updateMirrorNotifications(() => null);

  // Same startup recompute for the derived chat unread count.
  await updateChatUnreadCount();

  if (accessToken) {
    // Initialize encryption if key is stored (userIden should be available from options page)
    await initializeEncryption();
    
    connectWebSocket();
  } else {
    connectionStatus = 'disconnected';
    await updateBadge();
  }

  // Update badge on initialization
  await updateBadge();

  // Seed the Chat-default for installs that already had people before this
  // logic existed: the storage.onChanged people branch only fires on future
  // writes, so cover the already-present case here once (a no-op afterwards).
  await seedEnableChatDefault();

  // Repopulate local device data if it's missing (never awaited — must not
  // delay connection setup)
  ensureDeviceDataFromServer().catch(error => {
    console.error('Failed to ensure device data:', error);
  });
}


async function resetConnection() {
  // Clean up everything completely
  if (ws) {
    ws.close();
    ws = null;
  }
  
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  }
  
  if (keepAliveIntervalId) {
    clearInterval(keepAliveIntervalId);
    keepAliveIntervalId = null;
  }
  
  reconnectAttempts = 0;
  connectionStatus = 'disconnected';
  await updateBadge();
  console.log('Connection reset - fresh start');
}

async function connectWebSocket() {
  // Reentrancy guard. connectionStatus is claimed as 'connecting' synchronously
  // here, before the first await, and 'connecting' is set nowhere else, so a
  // second concurrent call returns immediately instead of racing. Without it two
  // callers (e.g. onStartup and the top-level init both firing on a cold start,
  // or two overlapping reconnection timers) could each clear the `if (ws)` block
  // below while ws is still null and open a separate socket; the orphaned one
  // keeps delivering, surfacing as duplicated mirror notifications.
  if (connectionStatus === 'connecting') {
    console.log('WebSocket connection attempt already in progress - ignoring reentrant call');
    return;
  }
  connectionStatus = 'connecting';

  const token = await getAccessToken();
  if (!token) {
    connectionStatus = 'disconnected';
    await updateBadge();
    return;
  }

  // Clean up existing connection
  if (ws) {
    ws.close();
    ws = null;
  }
  
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  }
  
  if (keepAliveIntervalId) {
    clearInterval(keepAliveIntervalId);
    keepAliveIntervalId = null;
  }
  
  console.log(`Connecting to WebSocket... (attempt ${reconnectAttempts + 1})`);
  await updateBadge();

  // Check network connectivity before attempting connection
  if (!navigator.onLine) {
    console.log('No network connectivity - postponing WebSocket connection');
    connectionStatus = 'disconnected';
    handleReconnection();
    return;
  }
  
  // Create WebSocket with consolidated error handling
  ws = new WebSocket(`wss://stream.pushbullet.com/websocket/${token}`);
  
  // Set up error handler immediately - treat errors as disconnection
  ws.onerror = async (event) => {
    console.log('WebSocket error occurred - treating as disconnected:', {
      type: event.type,
      target: event.target?.readyState,
      timestamp: new Date().toISOString()
    });
    connectionStatus = 'disconnected';
    await updateBadge();
    handleReconnection();
  };
  
  // Centralized WebSocket close handling
  const handleWebSocketClose = async (event) => {
    connectionStatus = 'disconnected';
    await updateBadge();
    // Only log unexpected closures for debugging
    if (event.code !== 1000 && event.code !== 1001) {
      console.log('WebSocket closed unexpectedly:', event.code, event.reason || 'No reason provided');
    }
    handleReconnection();
  };
  
  ws.onopen = async () => {
    connectionStatus = 'connected';
    reconnectAttempts = 0;
    console.log('WebSocket connected successfully');
    await updateBadge();
    startHeartbeatMonitor();
    keepAlive();
    
    // Don't show notifications on resume if we have no baseline (lastModified=0)
    // This prevents notification spam from old pushes after Chrome sync/storage loss
    const shouldShowNotifications = lastModified > 0;
    
    // Check if auto-open on resume is enabled
    const configData = await chrome.storage.local.get('autoOpenOnResume');
    const allowAutoOpenOnResume = configData.autoOpenOnResume || false;
    
    refreshPushList(shouldShowNotifications, allowAutoOpenOnResume);
  };
  
  ws.onmessage = async (event) => {
    try {
      let data = JSON.parse(event.data);
      
      // Check for encrypted ephemeral without configured crypto - graceful degradation
      if (data.type === 'push' && data.push && data.push.encrypted === true && !pushbulletCrypto) {
        console.warn('Received encrypted ephemeral but encryption is not configured - ignoring');
        await setMirrorDecryptIssue('not_configured');
        return;
      }

      // Process encrypted ephemeral if applicable
      if (pushbulletCrypto && data.type === 'push' && data.push) {
        const wasEncrypted = data.push.encrypted === true;
        data = await pushbulletCrypto.processEphemeral(data);

        // Check if decryption failed (push is still encrypted)
        if (data.push && data.push.encrypted === true) {
          console.warn('Failed to decrypt ephemeral (wrong password?) - ignoring');
          await setMirrorDecryptIssue('failed');
          return;
        }
        if (wasEncrypted) {
          // The key decrypts real traffic again - retire the popup notice
          await setMirrorDecryptIssue(null);
        }
      }
      
      if (data.type === 'nop') {
        startHeartbeatMonitor();
      } else if (data.type === 'tickle' && data.subtype === 'push') {
        refreshPushList(true);
      } else if (data.type === 'push' && data.push && data.push.type === 'mirror') {
        // Mirror traffic arrived readable - retire the drop notice
        await setMirrorDecryptIssue(null);
        handleMirrorNotification(data.push);
      } else if (data.type === 'push' && data.push && data.push.type === 'dismissal') {
        await setMirrorDecryptIssue(null);
        handleMirrorDismissal(data.push);
      }
    } catch (error) {
      console.log('Failed to parse WebSocket message:', error);
    }
  };
  
  ws.onclose = handleWebSocketClose;
}

function keepAlive() {
  // Official Chrome 116+ solution: send keepalive every 20 seconds
  keepAliveIntervalId = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send('keepalive');
      console.log('Sent keepalive ping');
    } else {
      clearInterval(keepAliveIntervalId);
      keepAliveIntervalId = null;
    }
  }, 20 * 1000); // 20 seconds to prevent service worker from becoming inactive
}

function startHeartbeatMonitor() {
  // Clear existing timer
  if (heartbeatTimer) {
    clearTimeout(heartbeatTimer);
  }
  
  // Start 35-second timer (5 seconds buffer over 30s heartbeat)
  heartbeatTimer = setTimeout(async () => {
    console.log('Heartbeat timeout - no nop message received');
    connectionStatus = 'disconnected';
    await updateBadge();

    if (ws) {
      ws.close();
    }

    handleReconnection();
  }, 35000);
}

async function handleReconnection() {
  if (!accessToken) {
    console.log('No access token available for reconnection');
    connectionStatus = 'disconnected';
    await updateBadge();
    return;
  }
  
  reconnectAttempts++;
  console.log(`Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
  
  if (reconnectAttempts < maxReconnectAttempts) {
    // Individual reconnection attempts: 5 attempts, 5s intervals each
    // Total time before giving up: 25 seconds (5 attempts × 5s each)
    console.log(`Scheduling reconnection in 5000ms (${maxReconnectAttempts - reconnectAttempts} attempts remaining)`);
    
    setTimeout(async () => {
      if (connectionStatus === 'disconnected' && accessToken) {
        // Double-check network before attempting reconnection
        if (!navigator.onLine) {
          console.log('Still offline - postponing reconnection');
          handleReconnection();
          return;
        }
        connectWebSocket();
      }
    }, 5000);
  } else {
    console.log('Max individual reconnection attempts reached (25s total) - periodic check will take over');
    connectionStatus = 'disconnected';
    await updateBadge();
  }
}

// classifyPush(push) — the single classifier for every push. Consumers act
// only on the tag they own; a tag they don't recognize is inert to them, so
// ignored (and any future) kinds are skipped everywhere by construction.
//
//   'ignored'      — channel pushes. Unsupported: kept in the cache
//                    (faithful server mirror), consumed by no surface.
//   'people'       — a human wrote to me. sender_email_normalized is also
//                    the conversation key, so every people push is
//                    displayable by construction. Chat surface only, and
//                    only while Chat is enabled.
//   'conversation' — I wrote to a human (receiver key — the official
//                    client's own gate). Sent bubble in that thread only;
//                    never a Push-tab bubble, never notified, never counted.
//   'device'       — my own device traffic (direction self, both
//                    directions), app/OAuth-created pushes (incoming with
//                    no human sender — e.g. this extension's own OAuth
//                    sends), receiver-less outgoing, and any unforeseen
//                    shape. Exactly the pre-Chat behavior: target buckets,
//                    device notifications, push counter. Deliberate
//                    fail-safe — a surprise shape behaves like v1.11; it
//                    can never vanish and never impersonate a person.
// keep in sync with the copy in popup.js
function classifyPush(push) {
  if (push.channel_iden) return 'ignored';
  if (push.direction === 'self') return 'device';
  if (push.direction === 'incoming') return push.sender_email_normalized ? 'people' : 'device';
  if (push.direction === 'outgoing') return push.receiver_email_normalized ? 'conversation' : 'device';
  return 'device'; // unknown direction — fail toward v1.11 visibility
}

// Refreshes run strictly one at a time. Overlapping runs (ws.onopen plus an
// immediately-following tickle) would read the same lastModified/pushes
// baseline and notify and count the same pushes twice; a queued run sees the
// updated baseline instead and fetches nothing new.
let refreshQueue = Promise.resolve();

function refreshPushList(isFromTickle = false, allowAutoOpenLinks = true) {
  const run = refreshQueue.then(() => doRefreshPushList(isFromTickle, allowAutoOpenLinks));
  refreshQueue = run.catch(() => {});
  return run;
}

async function doRefreshPushList(isFromTickle, allowAutoOpenLinks) {
  if (!accessToken) return;
  
  try {
    // Always fetch based on lastModified, no special initial fetch logic
    const url = lastModified > 0 
      ? `https://api.pushbullet.com/v2/pushes?modified_after=${lastModified}&active=true`
      : `https://api.pushbullet.com/v2/pushes?active=true&limit=20`;
    
    const response = await fetch(url, {
      headers: {
        'Access-Token': accessToken
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.pushes && data.pushes.length > 0) {
        lastModified = data.pushes[0].modified;
        // Persist lastModified to survive extension restarts
        chrome.storage.local.set({ lastModified: lastModified });
        
        const existingPushes = await chrome.storage.local.get('pushes');
        const pushes = existingPushes.pushes || [];
        
        const newPushes = data.pushes.filter(push => 
          !pushes.find(existing => existing.iden === push.iden)
        );
        
        const updatedPushes = data.pushes.filter(push => 
          pushes.find(existing => existing.iden === push.iden)
        );
        
        // Handle new pushes
        if (newPushes.length > 0) {
          pushes.unshift(...newPushes);
        }
        
        // Handle updated pushes
        if (updatedPushes.length > 0) {
          // Update existing pushes in storage
          updatedPushes.forEach(updatedPush => {
            const existingIndex = pushes.findIndex(p => p.iden === updatedPush.iden);
            if (existingIndex !== -1) {
              pushes[existingIndex] = updatedPush;
            }
          });
          
          // Check for dismissed pushes and clear their notifications
          if (isFromTickle) {
            await handleDismissedPushes(updatedPushes);
          }
        }
        
        // Save updated pushes array
        if (newPushes.length > 0 || updatedPushes.length > 0) {
          await chrome.storage.local.set({ pushes: pushes.slice(0, 200) });
        }

        // Show notifications for new pushes (only if from tickle, meaning
        // real-time). Runs after the list write so the popup reflects the
        // whole batch immediately. The unread count is applied once for the
        // batch: per-push increments are racy read-modify-writes that drop
        // updates when a resume delivers many pushes at once.
        if (isFromTickle && newPushes.length > 0) {
          // Apply device filtering for notifications (same as popup display)
          const configData = await chrome.storage.local.get(['onlyBrowserPushes', 'showOtherDevicePushes', 'selectedOtherDeviceIds', 'showNoTargetPushes', 'autoOpenLinks', 'autoOpenFiles', 'autoOpenLinksFromPeople', 'autoOpenTrustedPeople', 'enableChat', 'hideNotificationOnAutoOpen', 'hideBrowserPushes']);
          const localData = await chrome.storage.local.get(['chromeDeviceId', 'people']);
          const people = localData.people || [];

          const pushesToNotify = newPushes.filter(push => {
            // Only device-tagged pushes use these buckets; people, conversation,
            // and ignored (channel) pushes never notify through this lane.
            if (classifyPush(push) !== 'device') {
              return false;
            }

            // Apply new flexible push filtering
            let shouldShowPush = false;

            // Check if push should be shown based on target device
            const targetDeviceIden = push.target_device_iden;

            if (targetDeviceIden === localData.chromeDeviceId) {
              // Push is targeted to current Chrome device
              shouldShowPush = configData.onlyBrowserPushes !== false; // Default is true
            } else if (targetDeviceIden && targetDeviceIden !== localData.chromeDeviceId) {
              // Push is targeted to other device
              if (configData.showOtherDevicePushes === true) {
                // Check if specific devices are selected
                const selectedIds = configData.selectedOtherDeviceIds || '';

                if (!selectedIds) {
                  // Empty means all other devices (backward compatible)
                  shouldShowPush = true;
                } else {
                  // Check if this device is in the selected list
                  const deviceIds = selectedIds.split(',').map(id => id.trim());
                  shouldShowPush = deviceIds.includes(targetDeviceIden);
                }
              } else {
                shouldShowPush = false;
              }
            } else if (!targetDeviceIden) {
              // Push has no target device (sent to all)
              shouldShowPush = configData.showNoTargetPushes === true; // Default is false
            }

            if (!shouldShowPush) {
              return false;
            }

            // Skip notifications for dismissed pushes
            let shouldHideNotification = push.dismissed === true;

            // Check if we should hide notifications from browser pushes
            if (!shouldHideNotification && configData.hideBrowserPushes === true && localData.chromeDeviceId) { // Default is false, matching the options page
              // Hide notification if push is from the Chrome device
              shouldHideNotification = push.source_device_iden === localData.chromeDeviceId;
            }

            return !shouldHideNotification;
          });

          // People pushes: mirror-notification style, attributed to the sender.
          // Notified and counted while Chat is enabled and the sender's chat is
          // not muted. Auto-opened (issue #66) only for senders in the trusted
          // list, when the auto-open master + its people sub are on and the Chat
          // surface is enabled — otherwise the auto-open arg stays off.
          const trustedPeople = (configData.autoOpenTrustedPeople || '').split(',').map(e => e.trim()).filter(Boolean);
          // undefined = not yet seeded, behaves as off; the background seeds
          // true once people first exist.
          const chatEnabled = configData.enableChat === true;
          const peopleTasks = [];
          for (const push of newPushes) {
            if (classifyPush(push) !== 'people') continue;
            const person = people.find(p => p.email_normalized === push.sender_email_normalized);
            // Unknown sender: refresh the chats list (throttled, fire-and-forget)
            // even while Chat is off — this write is what lets
            // seedEnableChatDefault flip Chat on when people first exist.
            if (!person) refreshPeopleFromServer();
            // Already dismissed (device-lane parity, see the pushesToNotify
            // filter): a remote dismissal bumps `modified` and can re-deliver
            // an old push the cache no longer holds — it must be cached
            // silently, never toasted, auto-opened, or counted.
            if (push.dismissed === true) continue;
            // Chat disabled: people pushes are out of scope — stored, but never
            // notified, auto-opened, or counted.
            if (!chatEnabled) continue;
            // muted = notifications from this chat will not be shown, so a
            // muted push is neither notified nor counted (it is still stored
            // and shown in the popup, which does not check muted). This skip
            // also keeps muted senders out of the auto-open path below.
            if (person && person.muted === true) continue;
            const titleOverride = (person && person.name) || push.sender_name || push.sender_email || '';
            // Unknown senders have no person record yet; synthesize one from
            // the push's sender fields so getPersonIconDataUrl renders the same
            // letter avatar the popup will show once the chats refresh lands.
            const iconPerson = person || {
              name: push.sender_name,
              email: push.sender_email,
              email_normalized: push.sender_email_normalized
            };
            const iconUrl = await getPersonIconDataUrl(iconPerson);
            // Explicit trusted selection: only checked people auto-open, and
            // only while the sender is still in the chats list — deleting the
            // chat revokes the grant the moment the local list refreshes (the
            // options checklist can neither show nor edit a grant for a person
            // who is gone). The Chat surface (chatEnabled above) gates it so a
            // hidden option can never keep acting. Resume gating and
            // hideNotificationOnAutoOpen compose exactly as the device path.
            const autoOpenForPush = configData.autoOpenLinks
              && configData.autoOpenLinksFromPeople
              && chatEnabled
              && !!person
              && trustedPeople.includes(push.sender_email_normalized);
            // Keep the push alongside its task so a false result (auto-opened
            // + hidden) can be traced back to the iden after the batch.
            peopleTasks.push({
              push,
              promise: showNotificationForPush(
                push,
                autoOpenForPush && allowAutoOpenLinks,
                configData.hideNotificationOnAutoOpen || false,
                { titleOverride, iconUrl, autoOpenFiles: configData.autoOpenFiles === true }
              )
            });
          }

          // Device pushes feed the incremental push counter; people pushes are
          // counted separately by the derived updateChatUnreadCount() below, so
          // they are awaited here (for completion + side effects) but excluded
          // from unreadDelta. Both sets run concurrently.
          const [deviceResults, peopleResults] = await Promise.all([
            Promise.all(pushesToNotify.map(push =>
              showNotificationForPush(push, configData.autoOpenLinks && allowAutoOpenLinks, configData.hideNotificationOnAutoOpen || false, { autoOpenFiles: configData.autoOpenFiles === true })
            )),
            Promise.all(peopleTasks.map(task => task.promise))
          ]);

          const unreadDelta = deviceResults.filter(Boolean).length;
          if (unreadDelta > 0) {
            await incrementUnreadPushCount(unreadDelta);
          }

          // A people task resolving false means the push was auto-opened with
          // its notification hidden (trusted auto-open, issue #66): record its
          // iden so the derived chat count and the popup dot both treat it as
          // already consumed — the people analogue of a device push returning
          // false and being left out of unreadDelta. One read-modify-write,
          // newest appended, oldest dropped past the 100 cap.
          const autoOpenedIdens = peopleTasks
            .filter((task, i) => peopleResults[i] === false)
            .map(task => task.push.iden);
          if (autoOpenedIdens.length > 0) {
            const stored = await chrome.storage.local.get('chatAutoOpenedIdens');
            const merged = [...(stored.chatAutoOpenedIdens || []), ...autoOpenedIdens].slice(-100);
            await chrome.storage.local.set({ chatAutoOpenedIdens: merged });
          }

          // Recompute the derived chat unread count once for the whole batch.
          await updateChatUnreadCount();
        } else if (newPushes.length > 0 || updatedPushes.length > 0) {
          // The cache changed without the notify path running — update-only
          // batches (e.g. remote dismissals streaming in) and non-tickle
          // refreshes. Dismissed pushes must stop counting, so settle the
          // derived chat count here too.
          await updateChatUnreadCount();
        }
      }
      
    }
  } catch (error) {
    console.log('API request failed - will retry on next tickle:', error);
  }
}

function normalizeOpenUrl(url) {
  if (typeof url !== 'string' || !url) return null;
  // Bare www. without scheme is treated as a relative URL by chrome.tabs.create
  // and would open under chrome-extension://; prepend https:// to keep it absolute.
  return url.toLowerCase().startsWith('www.') ? 'https://' + url : url;
}

// Resolves with whether the push counts toward the unread badge — false only
// when the push is auto-opened with hideNotificationOnAutoOpen. The caller
// tallies a whole batch into one counter write, so the decision is made before
// the side effects below, and their failures neither reject nor change it.
// A people push passes { titleOverride, iconUrl } so the sender names the
// notification and their avatar (or the fallback icon) is shown; device pushes
// keep the push title with the default icon. autoOpenLinks is the composed gate
// (master / trusted-people): when it is on, link pushes auto-open their url and
// — only if autoOpenFiles is also on — file pushes auto-open their file_url,
// mirroring the notification Open button.
async function showNotificationForPush(push, autoOpenLinks = false, hideNotificationOnAutoOpen = false, { titleOverride, iconUrl, autoOpenFiles } = {}) {
  // Determine if this push will actually be auto-opened
  let autoOpenUrl = null;
  if (autoOpenLinks) {
    if (push.type === 'link') {
      autoOpenUrl = normalizeOpenUrl(push.url);
    } else if (push.type === 'file' && autoOpenFiles && push.file_url) {
      autoOpenUrl = push.file_url;
    }
  }
  const willAutoOpen = autoOpenUrl !== null;

  // Skip notification creation if both conditions are met:
  // 1. hideNotificationOnAutoOpen is enabled
  // 2. This is a link push that will be auto-opened
  const shouldSkipNotification = willAutoOpen && hideNotificationOnAutoOpen;

  try {
    if (!shouldSkipNotification) {
      let notificationBody = '';

      if (push.type === 'note') {
        notificationBody = push.body || getMessage('new_note');
      } else if (push.type === 'link') {
        notificationBody = push.body || push.url || getMessage('new_link');
      } else if (push.type === 'file') {
        notificationBody = push.body || `${getMessage('file_prefix')}${push.file_name}` || getMessage('new_file');
      } else {
        notificationBody = push.body || getMessage('new_push');
      }

      // People pushes name the sender in the title, so the push's own title
      // (if any) folds onto the first line of the message, mirror-style.
      let notificationTitle = push.title || '';
      if (titleOverride !== undefined) {
        notificationTitle = titleOverride;
        if (push.title) {
          notificationBody = `${push.title}\n${notificationBody}`;
        }
      }

      const notificationOptions = {
        type: 'basic',
        iconUrl: iconUrl || 'assets/icon128.png',
        title: notificationTitle,
        message: notificationBody
      };

      // Add buttons based on push type
      if (push.type === 'link' || push.type === 'file') {
        notificationOptions.buttons = [
          { title: getMessage('open_button') },
          { title: getMessage('dismiss_button') }
        ];
      } else {
        // For note and other types, only add dismiss button
        notificationOptions.buttons = [
          { title: getMessage('dismiss_button') }
        ];
      }

      // Check if require interaction is enabled for this notification's
      // category. People pushes have their own Chats switch; absent means
      // follow the Pushes switch (their gate before the split), so existing
      // setups keep persisting until the user saves an explicit choice.
      const notifPrefs = await chrome.storage.local.get(['requireInteraction', 'requireInteractionPushes', 'requireInteractionChats', 'showOsNotifications']);
      const requireForCategory = classifyPush(push) === 'people'
        ? (notifPrefs.requireInteractionChats !== undefined
          ? notifPrefs.requireInteractionChats
          : notifPrefs.requireInteractionPushes)
        : notifPrefs.requireInteractionPushes;
      if (notifPrefs.requireInteraction && requireForCategory) {
        notificationOptions.requireInteraction = true;
      }

      // Skip the desktop/OS notification when the master toggle is off (absent
      // means on); the push is still recorded in the popup and counted as unread.
      if (notifPrefs.showOsNotifications !== false) {
        chrome.notifications.create(`pushbullet-${push.iden}-${Date.now()}`, notificationOptions);
      }
    }

    // Play alert sound (happens whenever push is processed, respects global sound setting)
    await playAlertSound();

    // Auto-open link pushes in background tabs (happens regardless of notification)
    if (autoOpenUrl) {
      chrome.tabs.create({ url: autoOpenUrl, active: false });
    }
  } catch (error) {
    console.error('Failed to show notification for push:', error);
  }

  return !shouldSkipNotification;
}

const MIRROR_ICON_MAX_SIZE = 256;
// Crop the outer band before clipping: Pushbullet icons are 4:2:0-subsampled
// JPEGs whose chroma bleeds ~1-2px past saturated edges. The inscribed clip
// circle would otherwise sample that band and render a colored ring, so we
// zoom into the clean interior instead.
const MIRROR_ICON_INSET = 0.06;
// Cap the cached person avatars so the store can't grow without bound.
const PERSON_AVATAR_CACHE_CAP = 50;

// Encode an OffscreenCanvas to a PNG data URL. Shared tail of the circle-crop
// and letter-avatar pipelines.
async function canvasToPngDataUrl(canvas) {
  const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(pngBlob);
  });
}

// Circle-crop a decoded bitmap to a PNG data URL, insetting the outer band
// first (see MIRROR_ICON_INSET). Shared by the mirror-icon and person-avatar
// notification pipelines; consumes (closes) the bitmap.
async function bitmapToCircleDataUrl(bitmap) {
  const srcSquare = Math.min(bitmap.width, bitmap.height);
  const cropSquare = srcSquare * (1 - MIRROR_ICON_INSET);
  const size = Math.min(Math.round(cropSquare), MIRROR_ICON_MAX_SIZE);
  const sx = (bitmap.width - cropSquare) / 2;
  const sy = (bitmap.height - cropSquare) / 2;

  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(bitmap, sx, sy, cropSquare, cropSquare, 0, 0, size, size);
  bitmap.close();

  return await canvasToPngDataUrl(canvas);
}

async function getMirrorIconDataUrl(iconBase64) {
  if (!iconBase64 || typeof iconBase64 !== 'string') return null;
  try {
    const resp = await fetch(`data:image/jpeg;base64,${iconBase64}`);
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);
    return await bitmapToCircleDataUrl(bitmap);
  } catch (e) {
    console.error('getMirrorIconDataUrl failed:', e);
    return `data:image/jpeg;base64,${iconBase64}`;
  }
}

// Bundled default person avatar (drawn in-repo, official-client-inspired but
// our own circular design) — the notification icon whenever a real photo
// cannot be fetched. A static asset rather than a runtime-generated letter
// circle: the popup can display photo hosts the worker cannot fetch, so a
// letter here would contradict the photo the user then sees in the popup.
const PERSON_FALLBACK_ICON = 'assets/person128.png';

// Insert or refresh a personAvatars entry at the freshest position, then evict
// the oldest (insertion order) until the store is within
// PERSON_AVATAR_CACHE_CAP. Entries are either successes ({ image_url, dataUrl })
// or negative-cached failures ({ image_url, failed: true }); both kinds count
// toward the cap. A write failure is swallowed — the avatar was already
// produced for the caller.
async function putPersonAvatar(cache, emailNormalized, entry) {
  try {
    const next = { ...cache };
    delete next[emailNormalized];
    next[emailNormalized] = entry;
    const keys = Object.keys(next);
    for (const key of keys.slice(0, Math.max(0, keys.length - PERSON_AVATAR_CACHE_CAP))) {
      delete next[key];
    }
    await chrome.storage.local.set({ personAvatars: next });
  } catch (e) {
    // Non-fatal.
  }
}

// Notification avatar for a person. Resolution order:
//   1. cached success ({ image_url, dataUrl })      -> the cropped photo
//   2. cached failure ({ image_url, failed: true }) -> the default avatar
//   3. image_url is an https dl.pushbulletusercontent.com URL -> fetch it; on
//      success cache + return the photo, on any failure (non-ok / network /
//      decode) negative-cache the image_url and return the default avatar
//   4. absent / unparseable / non-whitelisted image_url -> the default avatar
// Only dl.pushbulletusercontent.com is ever fetched: it is verified to send
// `access-control-allow-origin: *`. static.pushbullet.com (Google profile
// photos) sends no CORS headers, so a fetch there can only fail and spam an
// unsuppressible CORS error onto the extensions page — it, and every other
// host, is never requested. Cache entries invalidate when image_url changes.
async function getPersonIconDataUrl(person) {
  if (!person) return PERSON_FALLBACK_ICON;

  let cache = {};
  try {
    const stored = await chrome.storage.local.get('personAvatars');
    cache = stored.personAvatars || {};
    const cached = cache[person.email_normalized];
    if (cached && cached.image_url === person.image_url) {
      if (cached.dataUrl) return cached.dataUrl;      // cached success
      if (cached.failed) return PERSON_FALLBACK_ICON; // cached failure
    }
  } catch (e) {
    // Storage read failed; fall through to a fresh attempt.
  }

  // Whitelist gate: only build a request for an https URL whose host is exactly
  // dl.pushbulletusercontent.com. Anything unparseable, http, or any other host
  // (including static.pushbullet.com) never issues a network request.
  let fetchable = false;
  if (person.image_url) {
    try {
      const u = new URL(person.image_url);
      fetchable = u.protocol === 'https:' && u.hostname === 'dl.pushbulletusercontent.com';
    } catch (e) {
      fetchable = false;
    }
  }

  if (!fetchable) {
    return PERSON_FALLBACK_ICON;
  }

  try {
    const resp = await fetch(person.image_url);
    if (!resp.ok) throw new Error(`avatar fetch failed: ${resp.status}`);
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);
    const dataUrl = await bitmapToCircleDataUrl(bitmap);
    await putPersonAvatar(cache, person.email_normalized, { image_url: person.image_url, dataUrl });
    return dataUrl;
  } catch (e) {
    // Negative-cache this image_url so it is not retried (or re-logged) until it
    // changes, then fall back to the default avatar.
    await putPersonAvatar(cache, person.email_normalized, { image_url: person.image_url, failed: true });
    return PERSON_FALLBACK_ICON;
  }
}

// Android identifies an active notification by the (package_name,
// notification_tag, notification_id) triple; a repeated mirror of the same
// triple is a content update of that notification, not a new one.
function isSameMirrorNotification(a, b) {
  return a.package_name === b.package_name &&
    (a.notification_tag ?? null) === (b.notification_tag ?? null) &&
    a.notification_id === b.notification_id;
}

// mirrorNotifications is read-modify-write from several concurrent entry
// points (new mirrors, phone-side dismissals, extension-side dismissals,
// popup deletes); like unreadCountOps, one queue keeps overlapping mutations
// from reading the same starting array and dropping each other's writes.
// mutate() (sync or async) gets the stored array and returns the next one,
// or falsy to skip the write; the unread count is recomputed either way.
let mirrorStoreOps = Promise.resolve();

function updateMirrorNotifications(mutate) {
  const run = mirrorStoreOps.then(async () => {
    try {
      const data = await chrome.storage.local.get('mirrorNotifications');
      const notifications = data.mirrorNotifications || [];
      const next = await mutate(notifications);
      if (next) {
        await chrome.storage.local.set({ mirrorNotifications: next });
      }
      await recomputeUnreadMirrorCount(next || notifications);
    } catch (error) {
      console.error('Failed to update mirrorNotifications:', error);
    }
  });
  mirrorStoreOps = run.catch(() => {});
  return run;
}

// The unread mirror count is derived, not bookkept: the number of entries
// with activity newer than the last time the popup's notifications tab was
// opened, excluding dismissed ones. Recomputed inside the queue after every
// list change, so it cannot drift from the list.
async function recomputeUnreadMirrorCount(notifications) {
  const data = await chrome.storage.local.get('lastMirrorReadTime');
  const lastRead = data.lastMirrorReadTime || 0;
  const count = notifications.filter(n => !n.dismissed && (n.receivedAt ?? n.created) > lastRead).length;
  await chrome.storage.local.set({ unreadMirrorCount: count });
  await updateBadge();
}

async function markMirrorNotificationsRead() {
  // Opening the popup must always clear the badge: stamp the read time past
  // every stored entry (not just the wall clock) inside the queue, so the
  // recompute that follows is guaranteed to count zero even if an entry
  // carries a futuristic timestamp from a skewed or corrected clock.
  await updateMirrorNotifications(async (notifications) => {
    const newest = notifications.reduce((max, n) => {
      const t = n.receivedAt ?? n.created;
      return t > max ? t : max;
    }, 0);
    await chrome.storage.local.set({ lastMirrorReadTime: Math.max(Date.now() / 1000, newest) });
    return null;
  });
}

async function handleMirrorNotification(mirrorData) {
  // Check if notification mirroring is enabled
  const configData = await chrome.storage.local.get('notificationMirroring');
  if (!configData.notificationMirroring) {
    return;
  }

  // Check if this is a dismissal notification
  if (mirrorData.type === 'dismissal') {
    await handleMirrorDismissal(mirrorData);
    return;
  }

  // Extract needed fields for storage
  const notificationData = {
    id: crypto.randomUUID(), // Generate unique ID for reliable deletion
    created: mirrorData.created && typeof mirrorData.created === 'number' && mirrorData.created > 0
      ? mirrorData.created
      : Date.now() / 1000,  // Use current time in seconds if websocket timestamp is invalid
    // Local-clock arrival stamp. created can be phone/server time, so recency
    // checks (unread count, popup scroll) use this to stay in one clock
    // domain with lastMirrorReadTime, and it advances even when an app
    // re-posts a notification without changing its timestamp.
    receivedAt: Date.now() / 1000,
    icon: mirrorData.icon,
    title: mirrorData.title,
    body: mirrorData.body,
    application_name: mirrorData.application_name,
    package_name: mirrorData.package_name,
    notification_id: mirrorData.notification_id,
    notification_tag: mirrorData.notification_tag,
    source_user_iden: mirrorData.source_user_iden,
    dismissible: mirrorData.dismissible
  };

  // Extract verification code (5-8 digits) from body if present
  if (notificationData.body) {
    const codeMatch = notificationData.body.match(/\b\d{5,8}\b/);
    if (codeMatch) {
      notificationData.verificationCode = codeMatch[0];
    }
  }

  // Store in local storage (keep latest 100). A repeated mirror of a live
  // notification replaces its entry in place, keeping the stored UUID so the
  // Chrome notification and the dismissal flows stay addressable. Dismissed
  // entries stay in the list as history; their Android slot starts over as a
  // new entry.
  let isUpdate = false;
  await updateMirrorNotifications((notifications) => {
    const existingIndex = notifications.findIndex(n => isSameMirrorNotification(n, notificationData));
    if (existingIndex !== -1 && !notifications[existingIndex].dismissed) {
      notificationData.id = notifications[existingIndex].id;
      notifications.splice(existingIndex, 1);
      isUpdate = true;
    }
    notifications.unshift(notificationData);
    return notifications.slice(0, 100);
  });

  // Create or replace Chrome notification
  await showMirrorNotification(notificationData, isUpdate);
}

async function showMirrorNotification(notificationData, isUpdate = false) {
  const appName = notificationData.application_name || notificationData.package_name || getMessage('unknown_app');

  let message = '';
  if (notificationData.title) {
    message += `${notificationData.title}\n`;
  }
  if (notificationData.body) {
    message += `${notificationData.body}`;
  }

  const notificationOptions = {
    type: 'basic',
    title: appName,
    message: message.trim() || getMessage('new_notification')
  };

  const processedIconUrl = await getMirrorIconDataUrl(notificationData.icon);
  notificationOptions.iconUrl = processedIconUrl || 'assets/icon128.png';

  // Add dismiss button if notification is dismissible
  if (notificationData.dismissible) {
    notificationOptions.buttons = [
      { title: getMessage('dismiss_button') }
    ];
  }

  // Check if require interaction is enabled for mirrored notifications
  const notifPrefs = await chrome.storage.local.get(['requireInteraction', 'requireInteractionMirrored', 'showOsNotifications']);
  if (notifPrefs.requireInteraction && notifPrefs.requireInteractionMirrored) {
    notificationOptions.requireInteraction = true;
  }

  // Use the UUID as notification ID for easy lookup
  const notificationId = `pushbullet-mirror-${notificationData.id}`;

  // Skip the desktop/OS notification when the master toggle is off (absent
  // means on); the mirrored notification is still recorded and counted as unread.
  if (notifPrefs.showOsNotifications !== false) {
    if (isUpdate) {
      // clear() first so the replacement re-alerts; create() alone can
      // coalesce into a still-visible toast without alerting. update() would
      // show nothing at all once the old toast is gone.
      await chrome.notifications.clear(notificationId);
    }
    chrome.notifications.create(notificationId, notificationOptions);
  }

  // Play alert sound
  await playAlertSound();
}

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (notificationId.startsWith('pushbullet-mirror-')) {
    // Dismiss button clicked (always at index 0)
    if (buttonIndex === 0) {
      await dismissMirrorNotification(notificationId);
      chrome.notifications.clear(notificationId);
    }
  } else if (notificationId.startsWith('pushbullet-')) {
    // Extract push iden from notification ID (format: pushbullet-{iden}-{timestamp})
    const pushIden = notificationId.replace('pushbullet-', '').split('-').slice(0, -1).join('-');
    
    // Get the push data from storage
    const data = await chrome.storage.local.get('pushes');
    const pushes = data.pushes || [];
    const push = pushes.find(p => p.iden === pushIden);
    
    if (push) {
      if (push.type === 'link' || push.type === 'file') {
        // For link/file: buttonIndex 0 = Open, buttonIndex 1 = Dismiss
        if (buttonIndex === 0) {
          // Open button clicked
          let urlToOpen = null;
          
          if (push.type === 'link') {
            urlToOpen = normalizeOpenUrl(push.url);
          } else if (push.type === 'file' && push.file_url) {
            urlToOpen = push.file_url;
          }
          
          if (urlToOpen) {
            chrome.tabs.create({ url: urlToOpen });
          }
          
          // Clear the notification after opening
          chrome.notifications.clear(notificationId);
        } else if (buttonIndex === 1) {
          // Dismiss button clicked
          await dismissPush(pushIden);
          chrome.notifications.clear(notificationId);
        }
      } else {
        // For note and other types: buttonIndex 0 = Dismiss
        if (buttonIndex === 0) {
          await dismissPush(pushIden);
          chrome.notifications.clear(notificationId);
        }
      }
    }
  }
});

chrome.notifications.onClosed.addListener(async (notificationId, byUser) => {
  // Only handle user-initiated closes (not system closes) when setting is enabled
  if (!byUser) return;
  
  // Check if close as dismiss is enabled
  const closeAsDismissData = await chrome.storage.local.get('closeAsDismiss');
  if (!closeAsDismissData.closeAsDismiss) return;
  
  if (notificationId.startsWith('pushbullet-mirror-')) {
    // Extract UUID from notification ID
    const uuid = notificationId.replace('pushbullet-mirror-', '');

    // Find the notification by UUID
    const existingNotifications = await chrome.storage.local.get('mirrorNotifications');
    const notifications = existingNotifications.mirrorNotifications || [];
    const notification = notifications.find(n => n.id === uuid);

    // Only dismiss if the notification was dismissible (had dismiss button)
    if (notification && notification.dismissible) {
      await dismissMirrorNotification(notificationId);
    }
  } else if (notificationId.startsWith('pushbullet-')) {
    // Handle push notification close
    // All push notifications have dismiss buttons, so we can safely dismiss
    const pushIden = notificationId.replace('pushbullet-', '').split('-').slice(0, -1).join('-');
    await dismissPush(pushIden);
  }
});

async function handleDismissedPushes(updatedPushes) {
  const dismissedPushes = updatedPushes.filter(push => push.dismissed === true);
  
  if (dismissedPushes.length > 0) {
    console.log(`Found ${dismissedPushes.length} dismissed pushes`);
    
    for (const push of dismissedPushes) {
      // Since notification IDs now include timestamps, we need to find and clear all matching notifications
      // by iterating through active notifications and matching by push identifier
      try {
        const allNotifications = await chrome.notifications.getAll();
        
        const matchingNotificationIds = Object.keys(allNotifications).filter(notificationId => {
          if (!notificationId.startsWith('pushbullet-')) return false;
          if (notificationId.startsWith('pushbullet-mirror-')) return false;
          
          // Extract push iden from notification ID (format: pushbullet-{iden}-{timestamp})
          const pushIden = notificationId.replace('pushbullet-', '').split('-').slice(0, -1).join('-');
          return pushIden === push.iden;
        });
        
        // Clear all matching notifications
        for (const notificationId of matchingNotificationIds) {
          console.log(`Clearing notification for dismissed push: ${push.iden}`);
          await chrome.notifications.clear(notificationId);
        }
      } catch (error) {
        console.error('Error checking/clearing notification:', error);
      }
    }
  }
}

async function dismissPush(pushIden) {
  const token = await getAccessToken();
  if (!token) return;

  try {
    const response = await fetch(`https://api.pushbullet.com/v2/pushes/${pushIden}`, {
      method: 'POST',
      headers: {
        'Access-Token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dismissed: true
      })
    });
    
    if (response.ok) {
      console.log('Push dismissed successfully');
      // Route the counter side effect by category: device pushes decrement
      // the incremental counter they were counted into. People pushes are
      // counted by the derived chat recompute instead — their dismissal
      // settles when the server's update echo lands (the updatedPushes
      // recompute in doRefreshPushList), so decrementing here would eat an
      // unrelated device unread. A cache miss (aged-out push) keeps the old
      // decrement behavior.
      const data = await chrome.storage.local.get('pushes');
      const push = (data.pushes || []).find(p => p.iden === pushIden);
      if (!push || classifyPush(push) !== 'people') {
        await decrementUnreadPushCount();
      }
    } else {
      console.error('Failed to dismiss push:', response.statusText);
    }
  } catch (error) {
    console.error('Error dismissing push:', error);
  }
}

async function dismissMirrorNotification(notificationId) {
  const token = await getAccessToken();
  if (!token) return;

  try {
    // Extract UUID from notification ID
    const uuid = notificationId.replace('pushbullet-mirror-', '');

    // Find the stored mirror notification by UUID
    const existingNotifications = await chrome.storage.local.get('mirrorNotifications');
    const notifications = existingNotifications.mirrorNotifications || [];
    const notification = notifications.find(n => n.id === uuid);

    if (!notification) {
      console.error('Mirror notification not found in storage:', uuid);
      return;
    }
    
    let dismissalPush = {
      type: 'dismissal',
      package_name: notification.package_name,
      notification_id: notification.notification_id,
      notification_tag: notification.notification_tag,
      source_user_iden: notification.source_user_iden
    };
    
    // Encrypt dismissal if E2E is enabled
    if (pushbulletCrypto) {
      try {
        dismissalPush = await pushbulletCrypto.prepareEncryptedPush(dismissalPush);
      } catch (error) {
        console.error('Failed to encrypt dismissal push:', error);
        // Continue with unencrypted dismissal - important not to block dismissal functionality
        console.warn('Sending unencrypted dismissal due to encryption failure');
      }
    }
    
    const dismissalData = {
      type: 'push',
      push: dismissalPush
    };
    
    const response = await fetch('https://api.pushbullet.com/v2/ephemerals', {
      method: 'POST',
      headers: {
        'Access-Token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dismissalData)
    });
    
    if (response.ok) {
      console.log('Mirror notification dismissed successfully');
      // Flag instead of removing: the entry stays in the popup list as
      // history and stops counting toward the unread badge.
      await updateMirrorNotifications((notifications) => {
        const stored = notifications.find(n => n.id === uuid);
        if (!stored || stored.dismissed) return null;
        stored.dismissed = true;
        return notifications;
      });
    } else {
      console.error('Failed to dismiss mirror notification:', response.statusText);
    }
  } catch (error) {
    console.error('Error dismissing mirror notification:', error);
  }
}

async function handleMirrorDismissal(dismissalData) {
  try {
    // Flag the matching live notification as dismissed; it stays in the
    // popup list as history. No live match means the dismissal was already
    // handled (e.g. the echo of our own dismissal).
    let notification;
    await updateMirrorNotifications((notifications) => {
      notification = notifications.find(n => isSameMirrorNotification(n, dismissalData) && !n.dismissed);
      if (!notification) return null;
      notification.dismissed = true;
      return notifications;
    });

    if (!notification) {
      console.log('No matching live notification found for dismissal');
      return;
    }

    // Clear the Chrome notification using the UUID
    const notificationId = `pushbullet-mirror-${notification.id}`;
    const allNotifications = await chrome.notifications.getAll();

    if (allNotifications[notificationId]) {
      console.log(`Clearing mirror notification for dismissal: ${dismissalData.package_name}`);
      await chrome.notifications.clear(notificationId);
    }
  } catch (error) {
    console.error('Error handling mirror dismissal:', error);
  }
}

// Return the current access token, lazy-loading from storage if the
// module-level cache is empty. Any entry point that may run before
// initializeExtension() finishes (popup/file sends, keyboard shortcut,
// context menu, image upload, notification dismiss) should go through this
// rather than touching the global, so a cold service-worker wake-up can't
// drop the call.
async function getAccessToken() {
  if (accessToken) return accessToken;
  const data = await chrome.storage.sync.get('accessToken');
  accessToken = data.accessToken;
  return accessToken;
}

async function sendPush(pushData) {
  const token = await getAccessToken();
  if (!token) return;

  try {
    // Get Chrome device ID to add as source_device_iden
    const configData = await chrome.storage.local.get('chromeDeviceId');
    if (configData.chromeDeviceId) {
      pushData.source_device_iden = configData.chromeDeviceId;
    }

    // Build the target list: one entry per device iden and one per email
    // (either param may carry a comma-joined list, or be absent). device_iden
    // and email are mutually exclusive on a single push, so each target owns
    // exactly one addressing field and the shared base drops both.
    const deviceIds = pushData.device_iden ? pushData.device_iden.split(',').map(id => id.trim()).filter(id => id) : [];
    const emails = pushData.email ? pushData.email.split(',').map(e => e.trim()).filter(e => e) : [];
    const { device_iden, email, ...basePushData } = pushData;
    const targets = [
      ...deviceIds.map(iden => ({ device_iden: iden })),
      ...emails.map(addr => ({ email: addr }))
    ];

    if (targets.length <= 1) {
      // Single or no explicit target - use original logic (an untargeted push
      // still goes out as-is, i.e. to all devices)
      const response = await fetch('https://api.pushbullet.com/v2/pushes', {
        method: 'POST',
        headers: {
          'Access-Token': token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pushData)
      });

      if (response.ok) {
        const push = await response.json();
        await storeSentMessage(push);
      }
    } else {
      // Multiple targets - one POST each, addressed to a single device or email
      const pushPromises = targets.map(target => {
        const targetPushData = { ...basePushData, ...target };
        return fetch('https://api.pushbullet.com/v2/pushes', {
          method: 'POST',
          headers: {
            'Access-Token': token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(targetPushData)
        });
      });

      const responses = await Promise.all(pushPromises);

      // Store the first successful push for display
      for (const response of responses) {
        if (response.ok) {
          const push = await response.json();
          await storeSentMessage(push);
          break; // Only store one copy for display
        }
      }
    }
  } catch (error) {
    console.log('Push send failed:', error);
  }
}

async function storeSentMessage(push) {
  const existingSentMessages = await chrome.storage.local.get('sentMessages');
  const sentMessages = existingSentMessages.sentMessages || [];
  
  // Mark as sent and add timestamp
  push.isSent = true;
  push.sentAt = Date.now();
  
  sentMessages.unshift(push);
  
  await chrome.storage.local.set({ sentMessages: sentMessages.slice(0, 100) });
}

// Unread push count management. The counter is read-modify-write on storage
// with this service worker as the only writer, so every mutation runs through
// one queue: overlapping updates (a batch increment against a dismissal
// decrement or a popup clear) would otherwise read the same starting value
// and silently drop each other's writes. The mirror count is not managed
// here; it is derived in recomputeUnreadMirrorCount.
let unreadCountOps = Promise.resolve();

function updateUnreadCount(storageKey, mutate) {
  const run = unreadCountOps.then(async () => {
    try {
      const data = await chrome.storage.local.get(storageKey);
      const next = Math.max(0, mutate(data[storageKey] || 0));
      await chrome.storage.local.set({ [storageKey]: next });
      await updateBadge();
    } catch (error) {
      console.error(`Failed to update ${storageKey}:`, error);
    }
  });
  unreadCountOps = run.catch(() => {});
  return run;
}

async function incrementUnreadPushCount(count = 1) {
  return updateUnreadCount('unreadPushCount', current => current + count);
}

async function decrementUnreadPushCount() {
  return updateUnreadCount('unreadPushCount', current => current - 1);
}

async function clearUnreadPushCount() {
  return updateUnreadCount('unreadPushCount', () => 0);
}

// The unread chat count is derived, not bookkept — the same pattern the mirror
// count uses (recomputeUnreadMirrorCount). It is the number of cached pushes
// that are ALL of:
//   - tagged 'people' by classifyPush (a human wrote to me)
//   - not dismissed (push.dismissed !== true)
//   - from a sender present in the local people list
//   - whose person is not muted (person.muted !== true)
//   - not a hidden trusted auto-open (push.iden ∉ chatAutoOpenedIdens)
//   - newer than that sender's read stamp and the global chat read floor:
//       push.created > max(peopleLastRead[sender] ?? 0, chatReadFloor ?? 0)
// It is 0 whenever Chat is disabled — people pushes are out of scope then; the
// enableChat onChanged branch below recomputes on toggle. Recomputed (never
// incremented), serialized through its own promise-chain queue (mirror of
// unreadCountOps/mirrorStoreOps) so overlapping recomputes can't interleave
// their read-modify-writes.
let chatCountOps = Promise.resolve();

function updateChatUnreadCount() {
  const run = chatCountOps.then(async () => {
    try {
      const data = await chrome.storage.local.get(['pushes', 'people', 'peopleLastRead', 'enableChat', 'chatAutoOpenedIdens', 'chatReadFloor', 'unreadChatCount']);
      const pushes = data.pushes || [];
      const people = data.people || [];
      const peopleLastRead = data.peopleLastRead || {};
      const autoOpenedIdens = data.chatAutoOpenedIdens || [];
      const floor = data.chatReadFloor ?? 0;
      const chatEnabled = data.enableChat === true;

      let count = 0;
      if (chatEnabled) {
        for (const push of pushes) {
          if (classifyPush(push) !== 'people') continue;
          if (push.dismissed === true) continue;
          const person = people.find(p => p.email_normalized === push.sender_email_normalized);
          if (!person || person.muted === true) continue;
          if (autoOpenedIdens.includes(push.iden)) continue;
          const readAt = Math.max(peopleLastRead[push.sender_email_normalized] ?? 0, floor);
          if ((push.created ?? 0) > readAt) count++;
        }
      }

      // Skip the write + badge refresh when nothing changed — this recompute
      // runs on every service-worker wake and most runs are no-ops.
      if (count !== (data.unreadChatCount || 0)) {
        await chrome.storage.local.set({ unreadChatCount: count });
        await updateBadge();
      }
    } catch (error) {
      console.error('Failed to update unread chat count:', error);
    }
  });
  chatCountOps = run.catch(() => {});
  return run;
}

async function updateBadge() {
  try {
    // PRIORITY 1: Show OFF badge when not connected
    if (connectionStatus !== 'connected') {
      chrome.action.setBadgeText({ text: 'OFF' });
      chrome.action.setBadgeBackgroundColor({ color: '#d32f2f' });
      return;
    }

    // Get display settings and counts
    const data = await chrome.storage.local.get([
      'displayUnreadCounts',
      'displayUnreadPushes',
      'displayUnreadMirrored',
      'displayUnreadChats',
      'unreadPushCount',
      'unreadMirrorCount',
      'unreadChatCount'
    ]);

    // Check if badge display is enabled
    if (!data.displayUnreadCounts) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    const pushCount = data.unreadPushCount || 0;
    const mirrorCount = data.unreadMirrorCount || 0;
    const chatCount = data.unreadChatCount || 0;
    const showPushes = data.displayUnreadPushes !== false; // Default true
    const showMirrored = data.displayUnreadMirrored !== false; // Default true
    const showChats = data.displayUnreadChats !== false; // Default true

    let totalCount = 0;

    if (showPushes) {
      totalCount += pushCount;
    }
    if (showMirrored) {
      totalCount += mirrorCount;
    }
    if (showChats) {
      totalCount += chatCount;
    }
    
    // Set badge text
    if (totalCount > 0) {
      const badgeText = totalCount > 99 ? '99+' : totalCount.toString();
      chrome.action.setBadgeText({ text: badgeText });
      chrome.action.setBadgeBackgroundColor({ color: '#d32f2f' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (error) {
    console.error('Failed to update badge:', error);
  }
}

async function setupContextMenus() {
  // Prevent concurrent context menu setup
  if (isSettingUpContextMenus) {
    console.log('Context menu setup already in progress, skipping...');
    return;
  }
  
  isSettingUpContextMenus = true;
  
  return new Promise((resolve) => {
    chrome.contextMenus.removeAll(async () => {
      // Wait for the one-time sync→local migration so the first build after
      // an update doesn't read local before the lists land (the concurrency
      // guard above drops the rebuild the migration would otherwise trigger)
      await devicesPeopleMigration;
      // Get stored devices, people & enableContextMenu data
      const data = await chrome.storage.local.get(['devices', 'people', 'enableContextMenu']);

      // Don't create context menu if option is manually disabled (default is true or not set)
      if (data.enableContextMenu === false) {
        isSettingUpContextMenus = false;
        
        return resolve();
      }

      const devices = data.devices || [];
      const people = data.people || [];
    
    // Create main context menu for page
    chrome.contextMenus.create({
      id: 'pushbullet-page',
      title: getMessage('push_current_page_url'),
      contexts: ['page']
    });
    
    // Create sub-entries for page
    chrome.contextMenus.create({
      id: 'pushbullet-page-selected',
      parentId: 'pushbullet-page',
      title: getMessage('to_selected_devices'),
      contexts: ['page']
    });
    
    chrome.contextMenus.create({
      id: 'pushbullet-page-device',
      parentId: 'pushbullet-page',
      title: getMessage('choose_device'),
      contexts: ['page']
    });
    
    chrome.contextMenus.create({
      id: 'pushbullet-page-people',
      parentId: 'pushbullet-page',
      title: getMessage('choose_people'),
      contexts: ['page']
    });
    
    // Add device options under "Choose device" for page
    devices.filter(d => d.active && d.pushable !== false).forEach(device => {
      chrome.contextMenus.create({
        id: `pushbullet-page-device-${device.iden}`,
        parentId: 'pushbullet-page-device',
        title: device.nickname || `${device.manufacturer} ${device.model}`,
        contexts: ['page']
      });
    });
    
    // Add people options under "Choose people" for page
    people.forEach(person => {
      chrome.contextMenus.create({
        id: `pushbullet-page-people-${person.email_normalized}`,
        parentId: 'pushbullet-page-people',
        title: person.name,
        contexts: ['page']
      });
    });
    
    // Create main context menu for selection
    chrome.contextMenus.create({
      id: 'pushbullet-selection',
      title: getMessage('push_selected_text'),
      contexts: ['selection']
    });
    
    // Create sub-entries for selection
    chrome.contextMenus.create({
      id: 'pushbullet-selection-selected',
      parentId: 'pushbullet-selection',
      title: getMessage('to_selected_devices'),
      contexts: ['selection']
    });
    
    chrome.contextMenus.create({
      id: 'pushbullet-selection-device',
      parentId: 'pushbullet-selection',
      title: getMessage('choose_device'),
      contexts: ['selection']
    });
    
    chrome.contextMenus.create({
      id: 'pushbullet-selection-people',
      parentId: 'pushbullet-selection',
      title: getMessage('choose_people'),
      contexts: ['selection']
    });
    
    // Add device options under "Choose device" for selection
    devices.filter(d => d.active && d.pushable !== false).forEach(device => {
      chrome.contextMenus.create({
        id: `pushbullet-selection-device-${device.iden}`,
        parentId: 'pushbullet-selection-device',
        title: device.nickname || `${device.manufacturer} ${device.model}`,
        contexts: ['selection']
      });
    });
    
    // Add people options under "Choose people" for selection
    people.forEach(person => {
      chrome.contextMenus.create({
        id: `pushbullet-selection-people-${person.email_normalized}`,
        parentId: 'pushbullet-selection-people',
        title: person.name,
        contexts: ['selection']
      });
    });
    
    // Create main context menu for image
    chrome.contextMenus.create({
      id: 'pushbullet-image',
      title: getMessage('push_this_image'),
      contexts: ['image']
    });
    
    // Create sub-entries for image
    chrome.contextMenus.create({
      id: 'pushbullet-image-selected',
      parentId: 'pushbullet-image',
      title: getMessage('to_selected_devices'),
      contexts: ['image']
    });
    
    chrome.contextMenus.create({
      id: 'pushbullet-image-device',
      parentId: 'pushbullet-image',
      title: getMessage('choose_device'),
      contexts: ['image']
    });
    
    chrome.contextMenus.create({
      id: 'pushbullet-image-people',
      parentId: 'pushbullet-image',
      title: getMessage('choose_people'),
      contexts: ['image']
    });
    
    // Add device options under "Choose device" for image
    devices.filter(d => d.active && d.pushable !== false).forEach(device => {
      chrome.contextMenus.create({
        id: `pushbullet-image-device-${device.iden}`,
        parentId: 'pushbullet-image-device',
        title: device.nickname || `${device.manufacturer} ${device.model}`,
        contexts: ['image']
      });
    });
    
    // Add people options under "Choose people" for image
    people.forEach(person => {
      chrome.contextMenus.create({
        id: `pushbullet-image-people-${person.email_normalized}`,
        parentId: 'pushbullet-image-people',
        title: person.name,
        contexts: ['image']
      });
    });
    
    // Create main context menu for link
    chrome.contextMenus.create({
      id: 'pushbullet-link',
      title: getMessage('push_this_link'),
      contexts: ['link']
    });
    
    // Create sub-entries for link
    chrome.contextMenus.create({
      id: 'pushbullet-link-selected',
      parentId: 'pushbullet-link',
      title: getMessage('to_selected_devices'),
      contexts: ['link']
    });
    
    chrome.contextMenus.create({
      id: 'pushbullet-link-device',
      parentId: 'pushbullet-link',
      title: getMessage('choose_device'),
      contexts: ['link']
    });
    
    chrome.contextMenus.create({
      id: 'pushbullet-link-people',
      parentId: 'pushbullet-link',
      title: getMessage('choose_people'),
      contexts: ['link']
    });
    
    // Add device options under "Choose device" for link
    devices.filter(d => d.active && d.pushable !== false).forEach(device => {
      chrome.contextMenus.create({
        id: `pushbullet-link-device-${device.iden}`,
        parentId: 'pushbullet-link-device',
        title: device.nickname || `${device.manufacturer} ${device.model}`,
        contexts: ['link']
      });
    });
    
    // Add people options under "Choose people" for link
    people.forEach(person => {
      chrome.contextMenus.create({
        id: `pushbullet-link-people-${person.email_normalized}`,
        parentId: 'pushbullet-link-people',
        title: person.name,
        contexts: ['link']
      });
    });
      
      isSettingUpContextMenus = false;
      resolve();
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  // No accessToken pre-check: sendPush() lazy-loads the token so a cold
  // service-worker wake-up doesn't silently drop the context-menu action.

  const configData = await chrome.storage.local.get('remoteDeviceId');
  const menuItemId = info.menuItemId;
  
  // Handle "To selected devices" menu items (uses configured remote devices)
  if (menuItemId === 'pushbullet-page-selected') {
    const pageData = {
      type: 'link',
      url: tab.url,
      title: tab.title
    };
    if (configData.remoteDeviceId) {
      pageData.device_iden = configData.remoteDeviceId;
    }
    await sendPush(pageData);
    return;
  }
  
  if (menuItemId === 'pushbullet-selection-selected') {
    const textData = {
      type: 'note',
      body: info.selectionText
    };
    if (configData.remoteDeviceId) {
      textData.device_iden = configData.remoteDeviceId;
    }
    await sendPush(textData);
    return;
  }
  
  if (menuItemId === 'pushbullet-image-selected') {
    await handleImageContextMenu(info, configData.remoteDeviceId);
    return;
  }
  
  if (menuItemId === 'pushbullet-link-selected') {
    const linkData = {
      type: 'link',
      url: info.linkUrl
    };
    if (configData.remoteDeviceId) {
      linkData.device_iden = configData.remoteDeviceId;
    }
    await sendPush(linkData);
    return;
  }
  
  // Handle device-specific menu items
  if (menuItemId.includes('-device-') && !menuItemId.endsWith('-device')) {
    if (menuItemId.startsWith('pushbullet-page-device-')) {
      const deviceId = menuItemId.replace('pushbullet-page-device-', '');
      const pageData = {
        type: 'link',
        url: tab.url,
        title: tab.title,
        device_iden: deviceId
      };
      await sendPush(pageData);
    } else if (menuItemId.startsWith('pushbullet-selection-device-')) {
      const deviceId = menuItemId.replace('pushbullet-selection-device-', '');
      const textData = {
        type: 'note',
        body: info.selectionText,
        device_iden: deviceId
      };
      await sendPush(textData);
    } else if (menuItemId.startsWith('pushbullet-image-device-')) {
      const deviceId = menuItemId.replace('pushbullet-image-device-', '');
      await handleImageContextMenu(info, deviceId);
    } else if (menuItemId.startsWith('pushbullet-link-device-')) {
      const deviceId = menuItemId.replace('pushbullet-link-device-', '');
      const linkData = {
        type: 'link',
        url: info.linkUrl,
        device_iden: deviceId
      };
      await sendPush(linkData);
    }
    return;
  }
  
  // Handle people-specific menu items
  if (menuItemId.includes('-people-') && !menuItemId.endsWith('-people')) {
    if (menuItemId.startsWith('pushbullet-page-people-')) {
      const email = menuItemId.replace('pushbullet-page-people-', '');
      const pageData = {
        type: 'link',
        url: tab.url,
        title: tab.title,
        email: email
      };
      await sendPush(pageData);
    } else if (menuItemId.startsWith('pushbullet-selection-people-')) {
      const email = menuItemId.replace('pushbullet-selection-people-', '');
      const textData = {
        type: 'note',
        body: info.selectionText,
        email: email
      };
      await sendPush(textData);
    } else if (menuItemId.startsWith('pushbullet-image-people-')) {
      const email = menuItemId.replace('pushbullet-image-people-', '');
      await handleImageContextMenuForPeople(info, email);
    } else if (menuItemId.startsWith('pushbullet-link-people-')) {
      const email = menuItemId.replace('pushbullet-link-people-', '');
      const linkData = {
        type: 'link',
        url: info.linkUrl,
        email: email
      };
      await sendPush(linkData);
    }
    return;
  }
});

async function handleImageContextMenu(info, remoteDeviceId) {
  try {
    // Fetch the image data
    const response = await fetch(info.srcUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch image');
    }
    
    const blob = await response.blob();
    const fileName = getImageFileName(info.srcUrl);
    
    // Upload the image using the same process as file uploads
    await uploadImageFromUrl(blob, fileName, remoteDeviceId);
    
  } catch (error) {
    console.error('Failed to send image:', error);
  }
}

async function uploadImageFromUrl(blob, fileName, remoteDeviceId, email = null) {
  const token = await getAccessToken();
  if (!token) return;

  // Step 1: Request upload URL
  const uploadRequest = await fetch('https://api.pushbullet.com/v2/upload-request', {
    method: 'POST',
    headers: {
      'Access-Token': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      file_name: fileName,
      file_type: blob.type
    })
  });

  if (!uploadRequest.ok) {
    throw new Error('Failed to get upload URL');
  }

  const uploadData = await uploadRequest.json();

  // Step 2: Upload file
  const formData = new FormData();
  if (uploadData.data) {
    Object.keys(uploadData.data).forEach(key => {
      formData.append(key, uploadData.data[key]);
    });
  }
  formData.append('file', blob, fileName);

  const uploadResponse = await fetch(uploadData.upload_url, {
    method: 'POST',
    body: formData
  });

  if (!uploadResponse.ok) {
    throw new Error('File upload failed');
  }

  // Step 3: Create push
  const pushData = {
    type: 'file',
    file_name: uploadData.file_name,
    file_type: uploadData.file_type,
    file_url: uploadData.file_url
  };

  if (email) {
    pushData.email = email;
  } else if (remoteDeviceId) {
    pushData.device_iden = remoteDeviceId;
  }

  await sendPush(pushData);
}

async function handleImageContextMenuForPeople(info, email) {
  try {
    // Fetch the image data
    const response = await fetch(info.srcUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch image');
    }
    
    const blob = await response.blob();
    const fileName = getImageFileName(info.srcUrl);
    
    // Upload the image for people
    await uploadImageFromUrl(blob, fileName, null, email);
    
  } catch (error) {
    console.error('Failed to send image to people:', error);
  }
}

function getImageFileName(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const fileName = pathname.split('/').pop();
    
    // If we got a filename with extension, use it
    if (fileName && fileName.includes('.')) {
      return fileName;
    }
    
    // Otherwise generate a name with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `image-${timestamp}.jpg`;
  } catch (error) {
    // Fallback filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `image-${timestamp}.jpg`;
  }
}

async function clearPushHistory() {
  try {
    await chrome.storage.local.set({
      pushes: [],
      sentMessages: [],
      // Cache emptied ⇒ the derived chat count is definitionally 0; write it
      // atomically with the list reset so no window shows a stale chat badge.
      unreadChatCount: 0
    });
    // Reset the counter through the serialized queue (which also refreshes the
    // badge, picking up unreadChatCount: 0 above) so an in-flight batch
    // increment can't overwrite it
    await clearUnreadPushCount();
    // Converge the chat counter too: a recompute already in flight may have
    // read the pre-clear pushes and would write a stale count back over the
    // atomic zero above — this enqueued recompute runs after it and reads the
    // emptied cache, so the cleared state always wins (same pattern as
    // clearPersonHistory).
    await updateChatUnreadCount();
    console.log('Push history cleared');
  } catch (error) {
    console.error('Failed to clear push history:', error);
  }
}

// Clear one conversation's local history — the per-person analogue of
// clearPushHistory (popup button at the top of the conversation). Removes the
// person's pushes and sent messages from the local caches only (the server is
// never touched), then recomputes the derived chat count through its
// serialized queue — other conversations' unreads must survive, so no atomic
// zero here.
async function clearPersonHistory(emailNormalized) {
  if (!emailNormalized) return;
  try {
    const data = await chrome.storage.local.get(['pushes', 'sentMessages']);
    const belongsToPerson = p => {
      const kind = classifyPush(p);
      return (kind === 'people' && p.sender_email_normalized === emailNormalized)
        || (kind === 'conversation' && p.receiver_email_normalized === emailNormalized);
    };
    await chrome.storage.local.set({
      pushes: (data.pushes || []).filter(p => !belongsToPerson(p)),
      sentMessages: (data.sentMessages || []).filter(m => !belongsToPerson(m))
    });
    await updateChatUnreadCount();
    console.log('Person history cleared:', emailNormalized);
  } catch (error) {
    console.error('Failed to clear person history:', error);
  }
}

async function clearMirrorHistory() {
  await updateMirrorNotifications(() => []);
  console.log('Mirror notification history cleared');
}

async function deleteNotification(id) {
  // Filter out the notification with the matching unique ID
  await updateMirrorNotifications(notifications =>
    notifications.filter(notification => notification.id !== id));
  console.log('Notification deleted:', id);
}

async function deletePush(iden) {
  try {
    const data = await chrome.storage.local.get(['pushes', 'sentMessages']);

    const pushes = (data.pushes || []).filter(p => p.iden !== iden);
    const sentMessages = (data.sentMessages || []).filter(m => m.iden !== iden);

    await chrome.storage.local.set({ pushes, sentMessages });
    // A deleted push may have been an unread people push; recompute the derived
    // chat count (the general pushes-change path deliberately doesn't).
    await updateChatUnreadCount();
    console.log('Push deleted:', iden);
  } catch (error) {
    console.error('Failed to delete push:', error);
  }
}
