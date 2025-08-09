let ws = null;
let connectionStatus = 'disconnected';
let lastModified = 0;
let accessToken = null;
let heartbeatTimer = null;
let reconnectAttempts = 0;
let maxReconnectAttempts = 5;
let keepAliveIntervalId = null;
let isFirstFetch = true;

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed/updated');
  initializeExtension();
  setupContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Chrome started');
  initializeExtension();
  setupContextMenus();
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && (changes.devices || changes.people)) {
    setupContextMenus();
  }
});

chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'active' && connectionStatus === 'disconnected') {
    console.log('System resumed from idle - attempting reconnection');
    resetConnection();
    initializeExtension();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'token_updated':
      initializeExtension();
      setupContextMenus();
      break;
    case 'get_status':
      sendResponse({ 
        status: connectionStatus,
        canRetry: reconnectAttempts >= maxReconnectAttempts
      });
      return true; // Only return true for async responses
    case 'retry_connection':
      // Reset everything like fresh start
      resetConnection();
      initializeExtension();
      break;
    case 'refresh_messages':
      refreshPushList();
      break;
    case 'send_push':
      sendPush(message.data);
      break;
  }
});

async function initializeExtension() {
  const data = await chrome.storage.sync.get('accessToken');
  accessToken = data.accessToken;
  
  if (accessToken) {
    connectWebSocket();
  } else {
    connectionStatus = 'disconnected';
  }
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
  
  // Check network connectivity first
  if (!navigator.onLine) {
    connectionStatus = 'disconnected';
    handleReconnection();
    return;
  }
  
  // Universal error suppression: temporarily override console methods
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  // Filter function to suppress WebSocket-related errors
  const wsErrorFilter = (...args) => {
    const message = args.join(' ').toLowerCase();
    if (message.includes('websocket') || 
        message.includes('net::err_name_not_resolved') ||
        message.includes('net::err_network_changed') ||
        message.includes('net::err_connection_refused') ||
        message.includes('stream.pushbullet.com')) {
      return; // Suppress WebSocket-related errors
    }
    originalConsoleError.apply(console, args);
  };
  
  const wsWarnFilter = (...args) => {
    const message = args.join(' ').toLowerCase();
    if (message.includes('websocket') || message.includes('stream.pushbullet.com')) {
      return; // Suppress WebSocket-related warnings
    }
    originalConsoleWarn.apply(console, args);
  };
  
  try {
    // Temporarily override console methods
    console.error = wsErrorFilter;
    console.warn = wsWarnFilter;
    
    // Create WebSocket with comprehensive error suppression
    ws = new WebSocket(`wss://stream.pushbullet.com/websocket/${accessToken}`);
    
    // Set up all event handlers immediately
    ws.onerror = (event) => {
      connectionStatus = 'disconnected';
      // Complete silence - no logging at all
    };
    
    ws.onopen = () => {
      connectionStatus = 'connected';
      reconnectAttempts = 0; // Reset on successful connection
      console.log('WebSocket connected successfully');
      startHeartbeatMonitor();
      keepAlive(); // Start official Chrome 116+ keepalive
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'nop') {
          // Reset heartbeat timer on each nop message
          startHeartbeatMonitor();
        } else if (data.type === 'tickle' && data.subtype === 'push') {
          refreshPushList(true); // Pass true to indicate this is from a tickle (new message)
        } else if (data.type === 'push' && data.push && data.push.type === 'mirror') {
          handleMirrorNotification(data.push);
        }
      } catch (error) {
        // Silent error handling - don't log to avoid extension page errors
      }
    };
    
    ws.onclose = (event) => {
      connectionStatus = 'disconnected';
      // Only log non-error close codes to avoid spam
      if (event.code !== 1006 && event.code !== 1002) {
        console.log('WebSocket disconnected:', event.code);
      }
      
      if (heartbeatTimer) {
        clearTimeout(heartbeatTimer);
        heartbeatTimer = null;
      }
      
      if (keepAliveIntervalId) {
        clearInterval(keepAliveIntervalId);
        keepAliveIntervalId = null;
      }
      
      handleReconnection();
    };
    
    // Restore console methods after a brief delay to allow WebSocket initialization
    setTimeout(() => {
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
    }, 100);
    
  } catch (error) {
    // Restore console methods immediately on error
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    
    connectionStatus = 'disconnected';
    // Silent error handling - don't log to avoid extension page errors
    handleReconnection();
  }
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
  heartbeatTimer = setTimeout(() => {
    console.log('Heartbeat timeout - no nop message received');
    connectionStatus = 'disconnected';
    
    if (ws) {
      ws.close();
    }
    
    handleReconnection();
  }, 35000);
}

function handleReconnection() {
  if (!accessToken) {
    return;
  }
  
  reconnectAttempts++;
  console.log(`Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
  
  if (reconnectAttempts < maxReconnectAttempts) {
    // Auto-reconnect after 3 seconds
    setTimeout(() => {
      if (connectionStatus === 'disconnected') {
        connectWebSocket();
      }
    }, 3000);
  } else {
    console.log('Max reconnection attempts reached - manual retry required');
    connectionStatus = 'disconnected';
  }
}

async function refreshPushList(isFromTickle = false) {
  if (!accessToken) return;
  
  try {
    const wasInitialFetch = lastModified === 0;
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
          // Skip notifications on first fetch to avoid notifying about initial 20 messages
          if (isFromTickle && !isFirstFetch) {
            // Apply device filtering for notifications (same as popup display)
            const configData = await chrome.storage.sync.get(['onlyBrowserPushes', 'autoOpenLinks', 'hideBrowserPushes']);
            const localData = await chrome.storage.local.get('chromeDeviceId');
            
            newPushes.forEach(push => {
              // Apply "Only notify and show pushes to browsers" filter
              let shouldShowPush = true;
              
              if (configData.onlyBrowserPushes !== false && localData.chromeDeviceId) { // Default is true
                // Only show pushes targeted to the Chrome device
                shouldShowPush = push.target_device_iden === localData.chromeDeviceId;
              }
              
              if (shouldShowPush) {
                // Check if we should hide notifications from browser pushes
                let shouldHideNotification = false;
                
                if (configData.hideBrowserPushes !== false && localData.chromeDeviceId) { // Default is true
                  // Hide notification if push is from the Chrome device
                  shouldHideNotification = push.source_device_iden === localData.chromeDeviceId;
                }
                
                if (!shouldHideNotification) {
                  showNotificationForPush(push);
                }
                
                // Auto-open link pushes in background tabs (only if enabled)
                if (push.type === 'link' && push.url && configData.autoOpenLinks) {
                  chrome.tabs.create({ url: push.url, active: false });
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
      
      // Mark first fetch as complete only after the initial fetch (when we fetched the first 20 messages)
      if (isFirstFetch && wasInitialFetch) {
        isFirstFetch = false;
      }
    }
  } catch (error) {
    // Silent error handling - don't log to avoid extension page errors
  }
}

function showNotificationForPush(push) {
  let notificationBody = '';
  
  if (push.type === 'note') {
    notificationBody = push.body || 'New note';
  } else if (push.type === 'link') {
    notificationBody = push.body || push.url || 'New link';
  } else if (push.type === 'file') {
    notificationBody = push.body || `File: ${push.file_name}` || 'New file';
  } else {
    notificationBody = push.body || 'New push';
  }
  
  const notificationOptions = {
    type: 'basic',
    iconUrl: 'icon128.png',
    title: push.title || '',
    message: notificationBody
  };
  
  // Add buttons based on push type
  if (push.type === 'link' || push.type === 'file') {
    notificationOptions.buttons = [
      { title: 'Open' },
      { title: 'Dismiss' }
    ];
  } else {
    // For note and other types, only add dismiss button
    notificationOptions.buttons = [
      { title: 'Dismiss' }
    ];
  }
  
  chrome.notifications.create(`pushbullet-${push.iden}`, notificationOptions);
}

async function handleMirrorNotification(mirrorData) {
  // Check if notification mirroring is enabled
  const configData = await chrome.storage.sync.get('notificationMirroring');
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
    dismissable: mirrorData.dismissable
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
  const appName = mirrorData.application_name || mirrorData.package_name || 'Unknown App';
  
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
    message: message.trim() || 'New notification'
  };
  
  // Handle base64 icon if available
  if (mirrorData.icon) {
    notificationOptions.iconUrl = `data:image/jpeg;base64,${mirrorData.icon}`;
  } else {
    notificationOptions.iconUrl = 'icon128.png';
  }
  
  // Add dismiss button only if dismissable is true
  if (mirrorData.dismissable) {
    notificationOptions.buttons = [
      { title: 'Dismiss' }
    ];
  }
  
  // Create unique notification ID that includes mirror data for identification
  const notificationId = `pushbullet-mirror-${mirrorData.package_name}-${mirrorData.notification_id}-${Date.now()}`;
  
  chrome.notifications.create(notificationId, notificationOptions);
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
    const pushIden = notificationId.replace('pushbullet-', '');
    
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

async function handleDismissedPushes(updatedPushes) {
  const dismissedPushes = updatedPushes.filter(push => push.dismissed === true);
  
  if (dismissedPushes.length > 0) {
    console.log(`Found ${dismissedPushes.length} dismissed pushes`);
    
    for (const push of dismissedPushes) {
      const notificationId = `pushbullet-${push.iden}`;
      
      // Check if the notification is still active using Chrome's API
      try {
        const allNotifications = await chrome.notifications.getAll();
        
        if (allNotifications[notificationId]) {
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
    
    const dismissalData = {
      type: 'push',
      push: {
        type: 'dismissal',
        package_name: notification.package_name,
        notification_id: notification.notification_id,
        notification_tag: notification.notification_tag,
        source_user_iden: notification.source_user_iden
      }
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
    // Silent error handling - don't log to avoid extension page errors
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

async function setupContextMenus() {
  chrome.contextMenus.removeAll(async () => {
    // Get stored devices and people data
    const data = await chrome.storage.sync.get(['devices', 'people']);
    const devices = data.devices || [];
    const people = data.people || [];
    
    // Create main context menu for page
    chrome.contextMenus.create({
      id: 'pushbullet-page',
      title: 'Push current page\'s URL',
      contexts: ['page']
    });
    
    // Create sub-entries for page
    chrome.contextMenus.create({
      id: 'pushbullet-page-selected',
      parentId: 'pushbullet-page',
      title: 'To selected devices',
      contexts: ['page']
    });
    
    chrome.contextMenus.create({
      id: 'pushbullet-page-device',
      parentId: 'pushbullet-page',
      title: 'Choose device',
      contexts: ['page']
    });
    
    chrome.contextMenus.create({
      id: 'pushbullet-page-people',
      parentId: 'pushbullet-page',
      title: 'Choose people',
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
      title: 'Push selected text',
      contexts: ['selection']
    });
    
    // Create sub-entries for selection
    chrome.contextMenus.create({
      id: 'pushbullet-selection-selected',
      parentId: 'pushbullet-selection',
      title: 'To selected devices',
      contexts: ['selection']
    });
    
    chrome.contextMenus.create({
      id: 'pushbullet-selection-device',
      parentId: 'pushbullet-selection',
      title: 'Choose device',
      contexts: ['selection']
    });
    
    chrome.contextMenus.create({
      id: 'pushbullet-selection-people',
      parentId: 'pushbullet-selection',
      title: 'Choose people',
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
      title: 'Push this image',
      contexts: ['image']
    });
    
    // Create sub-entries for image
    chrome.contextMenus.create({
      id: 'pushbullet-image-selected',
      parentId: 'pushbullet-image',
      title: 'To selected devices',
      contexts: ['image']
    });
    
    chrome.contextMenus.create({
      id: 'pushbullet-image-device',
      parentId: 'pushbullet-image',
      title: 'Choose device',
      contexts: ['image']
    });
    
    chrome.contextMenus.create({
      id: 'pushbullet-image-people',
      parentId: 'pushbullet-image',
      title: 'Choose people',
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
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!accessToken) {
    console.log('No access token available for context menu action');
    return;
  }
  
  const configData = await chrome.storage.sync.get('remoteDeviceId');
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
