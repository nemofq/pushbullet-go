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
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Chrome started');
  initializeExtension();
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

function connectWebSocket() {
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
  
  try {
    // Create WebSocket with additional error suppression
    ws = new WebSocket(`wss://stream.pushbullet.com/websocket/${accessToken}`);
    
    // Immediately attach error handler to suppress browser console errors
    ws.onerror = () => {
      connectionStatus = 'disconnected';
      // Silent error handling - don't log to avoid extension page errors
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
        }
      } catch (error) {
        // Silent error handling - don't log to avoid extension page errors
      }
    };
    
    ws.onclose = (event) => {
      connectionStatus = 'disconnected';
      console.log('WebSocket disconnected:', event.code);
      
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
    
  } catch (error) {
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
        
        if (newPushes.length > 0) {
          pushes.unshift(...newPushes);
          await chrome.storage.local.set({ pushes: pushes.slice(0, 100) });
          
          // Show notifications for new pushes (only if from tickle, meaning real-time)
          // Skip notifications on first fetch to avoid notifying about initial 20 messages
          if (isFromTickle && !isFirstFetch) {
            // Apply device filtering for notifications (same as popup display)
            const configData = await chrome.storage.sync.get('localDeviceId');
            
            newPushes.forEach(push => {
              // Only show notification if no device filter is set, or if push matches the device filter
              if (!configData.localDeviceId || push.target_device_iden === configData.localDeviceId) {
                showNotificationForPush(push);
              }
            });
          }
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
  
  chrome.notifications.create(`pushbullet-${push.iden}`, {
    type: 'basic',
    iconUrl: 'icon128.png',
    title: push.title || '',
    message: notificationBody
  });
}

async function sendPush(pushData) {
  if (!accessToken) return;
  
  try {
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
      
      // Store sent message in separate storage for display
      const existingSentMessages = await chrome.storage.local.get('sentMessages');
      const sentMessages = existingSentMessages.sentMessages || [];
      
      // Mark as sent and add timestamp
      push.isSent = true;
      push.sentAt = Date.now();
      
      sentMessages.unshift(push);
      
      await chrome.storage.local.set({ sentMessages: sentMessages.slice(0, 100) });
    }
  } catch (error) {
    // Silent error handling - don't log to avoid extension page errors
  }
}
