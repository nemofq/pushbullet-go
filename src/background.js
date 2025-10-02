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

async function playAlertSound() {
  try {
    // Check if sound is enabled
    const soundSettings = await chrome.storage.local.get('playSoundOnNotification');
    if (soundSettings.playSoundOnNotification === false) {
      return; // Sound is disabled
    }

    // Check if screen is locked
    if (currentIdleState === 'locked') {
      console.log('Screen is locked - suppressing notification sound');
      return;
    }

    // Check if offscreen document exists
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT]
    });

    // Create offscreen document if it doesn't exist
    if (existingContexts.length === 0) {
      try {
        await chrome.offscreen.createDocument({
          url: 'offscreen.html',
          reasons: [chrome.offscreen.Reason.AUDIO_PLAYBACK],
          justification: 'Play notification alert sound'
        });
        console.log('Offscreen document created for audio playback');
      } catch (error) {
        // If creation fails (e.g., already exists), log and continue
        console.warn('Could not create offscreen document:', error.message);
      }
    }

    // Send message to offscreen document to play sound
    try {
      await chrome.runtime.sendMessage({ type: 'PLAY_ALERT_SOUND' });
    } catch (error) {
      console.error('Error sending message to offscreen document:', error);
    }
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

// Run migration immediately when background script loads
migrateSpecificFieldsFromSyncToLocal();

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
        resetConnection(); // Reset attempts counter for fresh start
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

chrome.storage.onChanged.addListener(async (changes, namespace) => {
  if (namespace === 'sync' && (changes.devices || changes.people)) {
    await setupContextMenus();
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
  // Update badge when display settings change
  if (namespace === 'local' && (changes.displayUnreadCounts || changes.displayUnreadPushes || changes.displayUnreadMirrored)) {
    await updateBadge();
  }
});


chrome.idle.onStateChanged.addListener((state) => {
  console.log('Idle state changed to:', state);
  currentIdleState = state;

  if (state === 'active' && connectionStatus === 'disconnected' && accessToken) {
    console.log('System resumed from idle - triggering reconnection');
    // Reset attempts counter to allow fresh reconnection
    reconnectAttempts = 0;
    // Use existing reconnection logic directly
    connectWebSocket();
  }
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  switch (message.type) {
    case 'token_updated':
      initializeBackgroundI18n().then(async () => {
        // Check if token was removed (sign-out)
        const data = await chrome.storage.sync.get('accessToken');
        if (!data.accessToken) {
          // Clear all encryption keys on sign-out
          const localData = await chrome.storage.local.get(null);
          const keysToRemove = Object.keys(localData).filter(key => key.startsWith('encryptionKey_'));
          if (keysToRemove.length > 0) {
            await chrome.storage.local.remove(keysToRemove);
            console.log('Cleared encryption keys on sign-out');
          }
        }
        initializeExtension();
        await setupContextMenus();
      }).catch(async (error) => {
        console.error('Failed to reinitialize i18n:', error);
        initializeExtension();
        await setupContextMenus();
      });
      break;
    case 'get_status':
      sendResponse({ 
        status: connectionStatus,
        canRetry: reconnectAttempts >= maxReconnectAttempts
      });
      return true; // Only return true for async responses
    case 'retry_connection':
      // Manual reconnection from popup - use existing logic directly
      if (accessToken) {
        console.log('Manual reconnection requested from popup');
        // Reset attempts counter for fresh start
        reconnectAttempts = 0;
        // Use existing reconnection logic directly
        connectWebSocket();
      } else {
        console.log('No access token available for manual reconnection');
        connectionStatus = 'disconnected';
      }
      break;
    case 'send_push':
      sendPush(message.data);
      break;
    case 'clear_unread_pushes':
      await clearUnreadPushCount();
      break;
    case 'clear_unread_mirrors':
      await clearUnreadMirrorCount();
      break;
    case 'clear_push_history':
      await clearPushHistory();
      break;
    case 'clear_mirror_history':
      await clearMirrorHistory();
      break;
    case 'encryption_updated':
      initializeEncryption().then(() => {
        sendResponse({ success: true });
      });
      return true; // Will respond asynchronously
  }
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command === 'push-current-page') {
    if (!accessToken) {
      console.log('No access token available for keyboard shortcut');
      return;
    }
    
    // Get the configured remote device IDs (same logic as context menu)
    const configData = await chrome.storage.local.get('remoteDeviceId');
    
    const pageData = {
      type: 'link',
      url: tab.url
    };
    
    if (configData.remoteDeviceId) {
      pageData.device_iden = configData.remoteDeviceId;
    }
    
    await sendPush(pageData);
    console.log('Page URL pushed via keyboard shortcut:', tab.url);
  }
});

async function initializeExtension() {
  const data = await chrome.storage.sync.get('accessToken');
  const localData = await chrome.storage.local.get('lastModified');
  accessToken = data.accessToken;
  
  // Restore lastModified from storage to survive extension restarts
  if (localData.lastModified) {
    lastModified = localData.lastModified;
  }
  
  if (accessToken) {
    // Initialize encryption if key is stored (userIden should be available from options page)
    await initializeEncryption();
    
    connectWebSocket();
  } else {
    connectionStatus = 'disconnected';
  }
  
  // Update badge on initialization
  await updateBadge();
}


function resetConnection() {
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
  console.log('Connection reset - fresh start');
}

async function connectWebSocket() {
  if (!accessToken) {
    connectionStatus = 'disconnected';
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
  
  connectionStatus = 'connecting';
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
  ws = new WebSocket(`wss://stream.pushbullet.com/websocket/${accessToken}`);
  
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
        // Silently ignore encrypted messages when encryption is not configured
        console.warn('Received encrypted ephemeral but encryption is not configured - ignoring');
        return;
      }
      
      // Process encrypted ephemeral if applicable
      if (pushbulletCrypto && data.type === 'push' && data.push) {
        data = await pushbulletCrypto.processEphemeral(data);
        
        // Check if decryption failed (push is still encrypted)
        if (data.push && data.push.encrypted === true) {
          console.warn('Failed to decrypt ephemeral (wrong password?) - ignoring');
          return;
        }
      }
      
      if (data.type === 'nop') {
        startHeartbeatMonitor();
      } else if (data.type === 'tickle' && data.subtype === 'push') {
        refreshPushList(true);
      } else if (data.type === 'push' && data.push && data.push.type === 'mirror') {
        handleMirrorNotification(data.push);
      } else if (data.type === 'push' && data.push && data.push.type === 'dismissal') {
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

function handleReconnection() {
  if (!accessToken) {
    console.log('No access token available for reconnection');
    connectionStatus = 'disconnected';
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
  }
}

async function refreshPushList(isFromTickle = false, allowAutoOpenLinks = true) {
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
          
          // Show notifications for new pushes (only if from tickle, meaning real-time)
          if (isFromTickle) {
            // Apply device filtering for notifications (same as popup display)
            const configData = await chrome.storage.local.get(['onlyBrowserPushes', 'autoOpenLinks', 'hideBrowserPushes']);
            const localData = await chrome.storage.local.get('chromeDeviceId');
            
            newPushes.forEach(push => {
              // Apply "Only notify and show pushes to browsers" filter
              let shouldShowPush = true;
              
              if (configData.onlyBrowserPushes !== false && localData.chromeDeviceId) { // Default is true
                // Only show pushes targeted to the Chrome device
                shouldShowPush = push.target_device_iden === localData.chromeDeviceId;
              }
              
              if (shouldShowPush) {
                // Skip notifications for dismissed pushes
                let shouldHideNotification = push.dismissed === true;
                
                // Check if we should hide notifications from browser pushes
                if (!shouldHideNotification && configData.hideBrowserPushes !== false && localData.chromeDeviceId) { // Default is true
                  // Hide notification if push is from the Chrome device
                  shouldHideNotification = push.source_device_iden === localData.chromeDeviceId;
                }
                
                if (!shouldHideNotification) {
                  showNotificationForPush(push, configData.autoOpenLinks && allowAutoOpenLinks);
                }
              }
            });
          }
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
          await chrome.storage.local.set({ pushes: pushes.slice(0, 100) });
        }
      }
      
    }
  } catch (error) {
    console.log('API request failed - will retry on next tickle:', error);
  }
}

async function showNotificationForPush(push, autoOpenLinks = false) {
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
  
  const notificationOptions = {
    type: 'basic',
    iconUrl: 'assets/icon128.png',
    title: push.title || '',
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
  
  // Check if require interaction is enabled for pushes
  const requireInteractionData = await chrome.storage.local.get(['requireInteraction', 'requireInteractionPushes']);
  if (requireInteractionData.requireInteraction && requireInteractionData.requireInteractionPushes) {
    notificationOptions.requireInteraction = true;
  }
  
  chrome.notifications.create(`pushbullet-${push.iden}-${Date.now()}`, notificationOptions);
  
  // Play alert sound
  await playAlertSound();
  
  // Increment unread push count
  await incrementUnreadPushCount();
  
  // Auto-open link pushes in background tabs (only if enabled and notification is created)
  if (push.type === 'link' && push.url && autoOpenLinks) {
    chrome.tabs.create({ url: push.url, active: false });
  }
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
    created: mirrorData.created && typeof mirrorData.created === 'number' && mirrorData.created > 0 
      ? mirrorData.created 
      : Date.now() / 1000,  // Use current time in seconds if websocket timestamp is invalid
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

  // Store in local storage (keep latest 100)
  const existingNotifications = await chrome.storage.local.get('mirrorNotifications');
  const notifications = existingNotifications.mirrorNotifications || [];
  
  notifications.unshift(notificationData);
  await chrome.storage.local.set({ 
    mirrorNotifications: notifications.slice(0, 100) 
  });

  // Create Chrome notification
  await showMirrorNotification(mirrorData);
}

async function showMirrorNotification(mirrorData) {
  const appName = mirrorData.application_name || mirrorData.package_name || getMessage('unknown_app');
  
  let message = '';
  if (mirrorData.title) {
    message += `${mirrorData.title}\n`;
  }
  if (mirrorData.body) {
    message += `${mirrorData.body}`;
  }
  
  const notificationOptions = {
    type: 'basic',
    title: appName,
    message: message.trim() || getMessage('new_notification')
  };
  
  // Handle base64 icon if available
  if (mirrorData.icon) {
    notificationOptions.iconUrl = `data:image/jpeg;base64,${mirrorData.icon}`;
  } else {
    notificationOptions.iconUrl = 'assets/icon128.png';
  }
  
  // Add dismiss button only if dismissible is true
  if (mirrorData.dismissible) {
    notificationOptions.buttons = [
      { title: getMessage('dismiss_button') }
    ];
  }
  
  // Check if require interaction is enabled for mirrored notifications
  const requireInteractionData = await chrome.storage.local.get(['requireInteraction', 'requireInteractionMirrored']);
  if (requireInteractionData.requireInteraction && requireInteractionData.requireInteractionMirrored) {
    notificationOptions.requireInteraction = true;
  }
  
  // Create unique notification ID that includes mirror data for identification
  const notificationId = `pushbullet-mirror-${mirrorData.package_name}-${mirrorData.notification_id}-${Date.now()}`;
  
  chrome.notifications.create(notificationId, notificationOptions);
  
  // Play alert sound
  await playAlertSound();
  
  // Increment unread mirrored notification count
  await incrementUnreadMirrorCount();
}

chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (notificationId.startsWith('pushbullet-mirror-')) {
    // Handle mirror notification button clicks
    if (buttonIndex === 0) {
      // Dismiss button clicked for mirror notification
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
          
          if (push.type === 'link' && push.url) {
            urlToOpen = push.url;
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
    // Handle mirror notification close
    // Check if the notification had dismiss button (only dismiss if it was dismissible)
    const parts = notificationId.replace('pushbullet-mirror-', '').split('-');
    if (parts.length >= 3) {
      const timestamp = parts.pop();
      const package_name = parts[0];
      const notification_id = parts.slice(1).join('-');
      
      // Check if the notification was dismissible by looking at stored data
      const existingNotifications = await chrome.storage.local.get('mirrorNotifications');
      const notifications = existingNotifications.mirrorNotifications || [];
      const notification = notifications.find(n => 
        n.package_name === package_name && n.notification_id === notification_id
      );
      
      // Only dismiss if the notification was dismissible (had dismiss button)
      if (notification && notification.dismissible) {
        await dismissMirrorNotification(notificationId);
      }
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
  if (!accessToken) return;
  
  try {
    const response = await fetch(`https://api.pushbullet.com/v2/pushes/${pushIden}`, {
      method: 'POST',
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dismissed: true
      })
    });
    
    if (response.ok) {
      console.log('Push dismissed successfully');
      // Decrement unread push count when successfully dismissed
      await decrementUnreadPushCount();
    } else {
      console.error('Failed to dismiss push:', response.statusText);
    }
  } catch (error) {
    console.error('Error dismissing push:', error);
  }
}

async function dismissMirrorNotification(notificationId) {
  if (!accessToken) return;
  
  try {
    // Parse notification ID to extract mirror notification data
    // Format: pushbullet-mirror-{package_name}-{notification_id}-{timestamp}
    const parts = notificationId.replace('pushbullet-mirror-', '').split('-');
    
    if (parts.length < 3) {
      console.error('Invalid mirror notification ID format');
      return;
    }
    
    // Extract package_name and notification_id (timestamp is the last part)
    const timestamp = parts.pop(); // Remove timestamp
    const package_name = parts[0];
    const notification_id = parts.slice(1).join('-'); // Rejoin remaining parts as notification_id might contain dashes
    
    // Find the stored mirror notification to get complete data
    const existingNotifications = await chrome.storage.local.get('mirrorNotifications');
    const notifications = existingNotifications.mirrorNotifications || [];
    
    // Find matching notification based on package_name and notification_id
    const notification = notifications.find(n => 
      n.package_name === package_name && n.notification_id === notification_id
    );
    
    if (!notification) {
      console.error('Mirror notification not found in storage');
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
        'Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dismissalData)
    });
    
    if (response.ok) {
      console.log('Mirror notification dismissed successfully');
      // Decrement unread mirror count when successfully dismissed
      await decrementUnreadMirrorCount();
    } else {
      console.error('Failed to dismiss mirror notification:', response.statusText);
    }
  } catch (error) {
    console.error('Error dismissing mirror notification:', error);
  }
}

async function handleMirrorDismissal(dismissalData) {
  try {
    // Since notification IDs now include timestamps, we need to find and clear all matching notifications
    // by iterating through active notifications and matching by package_name and notification_id
    const allNotifications = await chrome.notifications.getAll();
    
    const matchingNotificationIds = Object.keys(allNotifications).filter(notificationId => {
      if (!notificationId.startsWith('pushbullet-mirror-')) return false;
      
      // Parse the notification ID to extract package_name and notification_id
      const parts = notificationId.replace('pushbullet-mirror-', '').split('-');
      if (parts.length < 3) return false;
      
      // Extract package_name and notification_id (timestamp is the last part)
      parts.pop(); // Remove timestamp
      const package_name = parts[0];
      const notification_id = parts.slice(1).join('-');
      
      return package_name === dismissalData.package_name && 
             notification_id === dismissalData.notification_id;
    });
    
    // Clear all matching notifications
    for (const notificationId of matchingNotificationIds) {
      console.log(`Clearing mirror notification for dismissal: ${dismissalData.package_name}`);
      await chrome.notifications.clear(notificationId);
    }
  } catch (error) {
    console.error('Error handling mirror dismissal:', error);
  }
}

async function sendPush(pushData) {
  if (!accessToken) return;
  
  try {
    // Get Chrome device ID to add as source_device_iden
    const configData = await chrome.storage.local.get('chromeDeviceId');
    if (configData.chromeDeviceId) {
      pushData.source_device_iden = configData.chromeDeviceId;
    }
    
    // Handle multiple device IDs
    const deviceIds = pushData.device_iden ? pushData.device_iden.split(',').map(id => id.trim()).filter(id => id) : [];
    
    if (deviceIds.length <= 1) {
      // Single or no device - use original logic
      const response = await fetch('https://api.pushbullet.com/v2/pushes', {
        method: 'POST',
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pushData)
      });
      
      if (response.ok) {
        const push = await response.json();
        await storeSentMessage(push);
      }
    } else {
      // Multiple devices - send to each one
      const pushPromises = deviceIds.map(deviceId => {
        const devicePushData = { ...pushData, device_iden: deviceId };
        return fetch('https://api.pushbullet.com/v2/pushes', {
          method: 'POST',
          headers: {
            'Access-Token': accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(devicePushData)
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

// Unread count management functions
async function incrementUnreadPushCount() {
  try {
    const data = await chrome.storage.local.get('unreadPushCount');
    const currentCount = data.unreadPushCount || 0;
    await chrome.storage.local.set({ unreadPushCount: currentCount + 1 });
    await updateBadge();
  } catch (error) {
    console.error('Failed to increment unread push count:', error);
  }
}

async function incrementUnreadMirrorCount() {
  try {
    const data = await chrome.storage.local.get('unreadMirrorCount');
    const currentCount = data.unreadMirrorCount || 0;
    await chrome.storage.local.set({ unreadMirrorCount: currentCount + 1 });
    await updateBadge();
  } catch (error) {
    console.error('Failed to increment unread mirror count:', error);
  }
}

async function decrementUnreadPushCount() {
  try {
    const data = await chrome.storage.local.get('unreadPushCount');
    const currentCount = Math.max(0, (data.unreadPushCount || 0) - 1);
    await chrome.storage.local.set({ unreadPushCount: currentCount });
    await updateBadge();
  } catch (error) {
    console.error('Failed to decrement unread push count:', error);
  }
}

async function clearUnreadPushCount() {
  try {
    await chrome.storage.local.set({ unreadPushCount: 0 });
    await updateBadge();
  } catch (error) {
    console.error('Failed to clear unread push count:', error);
  }
}

async function decrementUnreadMirrorCount() {
  try {
    const data = await chrome.storage.local.get('unreadMirrorCount');
    const currentCount = Math.max(0, (data.unreadMirrorCount || 0) - 1);
    await chrome.storage.local.set({ unreadMirrorCount: currentCount });
    await updateBadge();
  } catch (error) {
    console.error('Failed to decrement unread mirror count:', error);
  }
}

async function clearUnreadMirrorCount() {
  try {
    await chrome.storage.local.set({ unreadMirrorCount: 0 });
    await updateBadge();
  } catch (error) {
    console.error('Failed to clear unread mirror count:', error);
  }
}

async function updateBadge() {
  try {
    // PRIORITY 1: Show ERR badge when disconnected
    if (connectionStatus === 'disconnected') {
      chrome.action.setBadgeText({ text: 'OFF' });
      chrome.action.setBadgeBackgroundColor({ color: '#d32f2f' });
      return;
    }

    // Get display settings and counts
    const data = await chrome.storage.local.get([
      'displayUnreadCounts',
      'displayUnreadPushes',
      'displayUnreadMirrored',
      'unreadPushCount',
      'unreadMirrorCount'
    ]);

    // Check if badge display is enabled
    if (!data.displayUnreadCounts) {
      chrome.action.setBadgeText({ text: '' });
      return;
    }
    
    const pushCount = data.unreadPushCount || 0;
    const mirrorCount = data.unreadMirrorCount || 0;
    const showPushes = data.displayUnreadPushes !== false; // Default true
    const showMirrored = data.displayUnreadMirrored !== false; // Default true
    
    let totalCount = 0;
    
    if (showPushes) {
      totalCount += pushCount;
    }
    if (showMirrored) {
      totalCount += mirrorCount;
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
      // Get stored devices and people data
      const data = await chrome.storage.sync.get(['devices', 'people']);
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
    devices.filter(d => d.active).forEach(device => {
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
    devices.filter(d => d.active).forEach(device => {
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
    devices.filter(d => d.active).forEach(device => {
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
    devices.filter(d => d.active).forEach(device => {
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
  if (!accessToken) {
    console.log('No access token available for context menu action');
    return;
  }
  
  const configData = await chrome.storage.local.get('remoteDeviceId');
  const menuItemId = info.menuItemId;
  
  // Handle "To selected devices" menu items (uses configured remote devices)
  if (menuItemId === 'pushbullet-page-selected') {
    const pageData = {
      type: 'link',
      url: tab.url
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
  // Step 1: Request upload URL
  const uploadRequest = await fetch('https://api.pushbullet.com/v2/upload-request', {
    method: 'POST',
    headers: {
      'Access-Token': accessToken,
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
      unreadPushCount: 0 
    });
    await updateBadge();
    console.log('Push history cleared');
  } catch (error) {
    console.error('Failed to clear push history:', error);
  }
}

async function clearMirrorHistory() {
  try {
    await chrome.storage.local.set({ 
      mirrorNotifications: [],
      unreadMirrorCount: 0 
    });
    await updateBadge();
    console.log('Mirror notification history cleared');
  } catch (error) {
    console.error('Failed to clear mirror history:', error);
  }
}
