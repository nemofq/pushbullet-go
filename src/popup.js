document.addEventListener('DOMContentLoaded', function() {
  const statusElement = document.getElementById('connectionStatus');
  const retryButton = document.getElementById('retryConnection');
  const messagesList = document.getElementById('messagesList');
  const notificationsList = document.getElementById('notificationsList');
  const bodyInput = document.getElementById('bodyInput');
  const sendButton = document.getElementById('sendButton');
  const sendFileButton = document.getElementById('sendFileButton');
  const setupGuide = document.getElementById('setupGuide');
  const openOptionsButton = document.getElementById('openOptionsButton');
  const tabSwitcher = document.getElementById('tabSwitcher');
  const pushTab = document.getElementById('pushTab');
  const notificationTab = document.getElementById('notificationTab');

  loadAndApplyColorMode();
  
  // Check access token first, then handle other initializations
  checkAccessToken().then(() => {
    // Only load messages after checking access token to ensure proper display
    loadMessages();
    checkNotificationMirroring();
    updateConnectionStatus();
    refreshMessagesFromAPI();
  });
  
  // Fallback scroll to bottom for first-time loading
  setTimeout(() => {
    messagesList.scrollTop = messagesList.scrollHeight;
  }, 200);
  
  setInterval(updateConnectionStatus, 2000);

  retryButton.addEventListener('click', () => {
    // Check if we have an access token
    chrome.storage.sync.get('accessToken').then(tokenData => {
      if (!tokenData.accessToken) {
        // No access token - open options page
        chrome.runtime.openOptionsPage();
      } else {
        // Has access token - try to reconnect
        retryButton.style.display = 'none';
        statusElement.className = 'status connecting';
        chrome.runtime.sendMessage({ type: 'retry_connection' });
        setTimeout(updateConnectionStatus, 2000);
      }
    });
  });

  sendButton.addEventListener('click', sendMessage);
  
  bodyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  bodyInput.addEventListener('paste', async (e) => {
    const items = e.clipboardData.items;
    const files = [];
    
    // Collect all files from clipboard
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }
    
    // Only proceed if exactly one file is pasted
    if (files.length === 1) {
      e.preventDefault();
      await handleFilePaste(files[0]);
    } else if (files.length > 1) {
      // Multiple files - show tip and do nothing
      e.preventDefault();
      bodyInput.placeholder = 'Paste one image/file at a time.';
      setTimeout(() => {
        bodyInput.placeholder = 'Type or paste';
      }, 2500);
    }
    // If no files, let default paste behavior continue
  });

  sendFileButton.addEventListener('click', () => {
    console.log('Popup: Send File button clicked');
    
    // Open file upload window
    chrome.windows.create({
      url: 'file.html',
      type: 'popup',
      width: 440,
      height: 340,
      focused: true
    });
  });

  openOptionsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Tab switching
  pushTab.addEventListener('click', () => {
    switchTab('push');
  });

  notificationTab.addEventListener('click', () => {
    switchTab('notification');
  });

  async function checkAccessToken() {
    const data = await chrome.storage.sync.get('accessToken');
    
    const sendForm = document.querySelector('.send-form');
    
    if (!data.accessToken) {
      // No access token - show setup guide only
      setupGuide.classList.add('show');
      messagesList.style.display = 'none';
      notificationsList.style.display = 'none';
      sendForm.style.display = 'none';
      tabSwitcher.style.display = 'none';
      // Clear any content that might be affecting layout
      messagesList.innerHTML = '';
      notificationsList.innerHTML = '';
    } else {
      // Access token exists - show normal UI
      setupGuide.classList.remove('show');
      messagesList.style.display = 'flex';
      notificationsList.style.display = 'none';
      sendForm.style.display = 'block';
      // Re-check notification mirroring to show/hide tabs appropriately
      checkNotificationMirroring();
    }
  }

  async function checkNotificationMirroring() {
    const tokenData = await chrome.storage.sync.get('accessToken');
    
    // Only show tabs if we have an access token
    if (!tokenData.accessToken) {
      tabSwitcher.style.display = 'none';
      return;
    }
    
    const data = await chrome.storage.sync.get('notificationMirroring');
    
    if (data.notificationMirroring) {
      tabSwitcher.style.display = 'flex';
      loadNotifications();
    } else {
      tabSwitcher.style.display = 'none';
    }
  }

  function switchTab(tab) {
    const sendForm = document.querySelector('.send-form');
    
    if (tab === 'push') {
      pushTab.classList.add('active');
      notificationTab.classList.remove('active');
      messagesList.style.display = 'flex';
      notificationsList.style.display = 'none';
      sendForm.style.display = 'block';
    } else {
      pushTab.classList.remove('active');
      notificationTab.classList.add('active');
      messagesList.style.display = 'none';
      notificationsList.style.display = 'flex';
      sendForm.style.display = 'none';
      loadNotifications();
    }
  }

  function updateConnectionStatus() {
    chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
      if (response && response.status) {
        statusElement.className = `status ${response.status}`;
        
        // Check if we have an access token first
        chrome.storage.sync.get('accessToken').then(tokenData => {
          if (!tokenData.accessToken) {
            // No access token - always show reconnect button (acts as setup), hide tabs
            retryButton.style.display = 'block';
            retryButton.textContent = 'Reconnect';
            retryButton.title = 'Open settings to configure access token';
            tabSwitcher.style.display = 'none';
            return;
          }
          
          // Has access token - normal connection status handling
          retryButton.textContent = 'Reconnect';
          retryButton.title = 'Retry connection';
          const isDisconnected = response.status === 'disconnected';
          retryButton.style.display = isDisconnected ? 'block' : 'none';
          
          if (isDisconnected) {
            tabSwitcher.style.display = 'none';
            // Ensure we're on push tab and show send form
            switchTab('push');
          } else {
            // Re-check notification mirroring setting to show/hide tabs
            checkNotificationMirroring();
          }
          
          // Auto-reconnect if disconnected when popup opens
          if (isDisconnected) {
            console.log('Popup opened with disconnected status - attempting reconnection');
            chrome.runtime.sendMessage({ type: 'retry_connection' });
          }
        });
      }
    });
  }

  async function loadMessages() {
    const [receivedData, sentData, configData, localData] = await Promise.all([
      chrome.storage.local.get('pushes'),
      chrome.storage.local.get('sentMessages'),
      chrome.storage.sync.get('onlyBrowserPushes'),
      chrome.storage.local.get('chromeDeviceId')
    ]);
    
    // Get received messages (filtered by "Only notify and show pushes to browsers" if set)
    let receivedMessages = receivedData.pushes || [];
    if (configData.onlyBrowserPushes !== false && localData.chromeDeviceId) { // Default is true
      receivedMessages = receivedMessages.filter(push => 
        push.target_device_iden === localData.chromeDeviceId
      );
    }
    
    // Get sent messages
    const sentMessages = sentData.sentMessages || [];
    
    // Combine and sort by timestamp
    const allMessages = [
      ...receivedMessages.map(msg => ({ ...msg, messageType: 'received' })),
      ...sentMessages.map(msg => ({ ...msg, messageType: 'sent' }))
    ];
    
    // Sort by creation time (most recent first, then reverse for display)
    allMessages.sort((a, b) => (b.created || b.sentAt / 1000) - (a.created || a.sentAt / 1000));
    
    if (allMessages.length === 0) {
      // Only show "No messages yet" if we have access token, otherwise show empty
      const tokenData = await chrome.storage.sync.get('accessToken');
      if (tokenData.accessToken) {
        messagesList.innerHTML = '<div class="no-messages">No messages yet</div>';
      } else {
        messagesList.innerHTML = '';
      }
      return;
    }

    messagesList.innerHTML = '';
    
    allMessages.reverse().forEach(push => {
      const messageRowDiv = document.createElement('div');
      messageRowDiv.className = `message-row ${push.messageType}`;
      
      const timestampDiv = document.createElement('div');
      timestampDiv.className = 'message-timestamp';
      const timestamp = push.created ? push.created * 1000 : push.sentAt;
      const date = new Date(timestamp);
      const timeString = date.toLocaleString(undefined, { 
        hour12: false, 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      timestampDiv.textContent = timeString;
      
      const messageContentDiv = document.createElement('div');
      messageContentDiv.className = 'message-content';
      
      const messageDiv = document.createElement('div');
      messageDiv.className = `message ${push.messageType}`;
      
      // Make link-type messages clickable
      if (push.type === 'link' && push.url) {
        messageDiv.classList.add('clickable');
        messageDiv.onclick = () => {
          window.open(push.url, '_blank');
        };
      }
      
      if (push.title) {
        const titleDiv = document.createElement('div');
        titleDiv.className = 'message-title';
        titleDiv.textContent = push.title;
        messageDiv.appendChild(titleDiv);
      }
      
      const bodyDiv = document.createElement('div');
      bodyDiv.className = 'message-body';
      
      if (push.type === 'note') {
        bodyDiv.textContent = push.body || '';
      } else if (push.type === 'link') {
        if (push.body) {
          bodyDiv.textContent = push.body;
          bodyDiv.appendChild(document.createElement('br'));
        }
        const link = document.createElement('a');
        link.href = push.url;
        link.textContent = push.url;
        link.className = 'message-link';
        link.target = '_blank';
        bodyDiv.appendChild(link);
      } else if (push.type === 'file') {
        if (push.body) {
          bodyDiv.textContent = push.body;
          bodyDiv.appendChild(document.createElement('br'));
        }
        
        if (push.file_type && push.file_type.startsWith('image/')) {
          const img = document.createElement('img');
          img.src = push.file_url;
          img.className = 'message-image';
          img.onclick = () => window.open(push.file_url, '_blank');
          // Add load event listener to handle scroll positioning after image loads
          img.onload = () => {
            messagesList.scrollTop = messagesList.scrollHeight;
          };
          bodyDiv.appendChild(img);
        } else {
          const link = document.createElement('a');
          link.href = push.file_url;
          link.textContent = push.file_name || 'Download File';
          link.className = 'message-link';
          link.target = '_blank';
          bodyDiv.appendChild(link);
        }
      }
      
      messageDiv.appendChild(bodyDiv);
      messageContentDiv.appendChild(messageDiv);
      
      // Add copy button for received text messages and links
      if (push.messageType === 'received' && ((push.type === 'note' && push.body) || (push.type === 'link' && push.url))) {
        const copyButton = document.createElement('button');
        copyButton.className = 'copy-button';
        copyButton.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/></svg>';
        copyButton.title = push.type === 'link' ? 'Copy link' : 'Copy message';
        copyButton.onclick = (e) => {
          e.stopPropagation();
          const textToCopy = push.type === 'link' ? push.url : push.body;
          navigator.clipboard.writeText(textToCopy);
        };
        messageContentDiv.appendChild(copyButton);
      }
      
      messageRowDiv.appendChild(timestampDiv);
      messageRowDiv.appendChild(messageContentDiv);
      messagesList.appendChild(messageRowDiv);
    });
    
    // Ensure scroll to bottom after DOM updates
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        messagesList.scrollTop = messagesList.scrollHeight;
      });
    });
  }

  async function loadNotifications() {
    const data = await chrome.storage.local.get('mirrorNotifications');
    const notifications = data.mirrorNotifications || [];

    if (notifications.length === 0) {
      // Only show "No notifications received" if we have access token, otherwise show empty
      const tokenData = await chrome.storage.sync.get('accessToken');
      if (tokenData.accessToken) {
        notificationsList.innerHTML = '<div class="no-messages">No notifications received</div>';
      } else {
        notificationsList.innerHTML = '';
      }
      return;
    }

    notificationsList.innerHTML = '';
    
    // Sort by timestamp (oldest to newest as requested)
    notifications.sort((a, b) => (a.created || 0) - (b.created || 0));
    
    notifications.forEach(notification => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'notification-card';
      
      // Header with icon, app name, and timestamp
      const headerDiv = document.createElement('div');
      headerDiv.className = 'notification-header';
      
      // Icon
      const iconImg = document.createElement('img');
      iconImg.className = 'notification-icon';
      if (notification.icon) {
        iconImg.src = `data:image/jpeg;base64,${notification.icon}`;
      } else {
        iconImg.src = 'icon128.png'; // Fallback icon
      }
      iconImg.alt = 'App icon';
      headerDiv.appendChild(iconImg);
      
      // App name
      const appDiv = document.createElement('div');
      appDiv.className = 'notification-app';
      appDiv.textContent = notification.application_name || notification.package_name || 'Unknown App';
      headerDiv.appendChild(appDiv);
      
      // Timestamp
      const timestampDiv = document.createElement('div');
      timestampDiv.className = 'notification-timestamp';
      
      // Use the same timestamp handling as Push tab
      const timestamp = notification.created ? notification.created * 1000 : Date.now();
      const date = new Date(timestamp);
      const timeString = date.toLocaleString(undefined, { 
        hour12: false, 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      timestampDiv.textContent = timeString;
      headerDiv.appendChild(timestampDiv);
      
      cardDiv.appendChild(headerDiv);
      
      // Title (if available)
      if (notification.title) {
        const titleDiv = document.createElement('div');
        titleDiv.className = 'notification-title';
        titleDiv.textContent = notification.title;
        cardDiv.appendChild(titleDiv);
      }
      
      // Body (if available)
      if (notification.body) {
        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'notification-body';
        bodyDiv.textContent = notification.body;
        cardDiv.appendChild(bodyDiv);
      }
      
      notificationsList.appendChild(cardDiv);
    });
    
    // Scroll to bottom to show newest notifications
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        notificationsList.scrollTop = notificationsList.scrollHeight;
      });
    });
  }

  async function sendMessage() {
    const body = bodyInput.value.trim();
    
    if (!body) {
      return;
    }
    
    const configData = await chrome.storage.sync.get('remoteDeviceId');
    
    const isUrl = isValidUrl(body);
    const pushData = {
      type: isUrl ? 'link' : 'note',
      body: isUrl ? '' : body
    };
    
    if (isUrl) {
      pushData.url = body;
    }
    
    if (configData.remoteDeviceId) {
      pushData.device_iden = configData.remoteDeviceId;
    }
    
    chrome.runtime.sendMessage({ 
      type: 'send_push', 
      data: pushData 
    });
    
    bodyInput.value = '';
    
    setTimeout(loadMessages, 1000);
  }



  function isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }

  function refreshMessagesFromAPI() {
    console.log('Refreshing messages from API');
    chrome.runtime.sendMessage({ type: 'refresh_messages' });
  }

  async function handleFilePaste(file) {
    const isImage = file.type.startsWith('image/');
    const fileType = isImage ? 'image' : 'file';
    
    try {
      
      bodyInput.placeholder = `Uploading ${fileType}...`;
      bodyInput.disabled = true;
      sendButton.disabled = true;

      const [tokenData, configData] = await Promise.all([
        chrome.storage.sync.get('accessToken'),
        chrome.storage.sync.get('remoteDeviceId')
      ]);

      if (!tokenData.accessToken) {
        throw new Error('No access token found. Please configure in options.');
      }

      await uploadPastedFile(file, tokenData.accessToken, configData.remoteDeviceId);
      
      bodyInput.placeholder = `${fileType.charAt(0).toUpperCase() + fileType.slice(1)} uploaded successfully!`;
      setTimeout(() => {
        bodyInput.placeholder = 'Type or paste';
        bodyInput.disabled = false;
        sendButton.disabled = false;
      }, 2000);

      setTimeout(loadMessages, 1000);

    } catch (error) {
      bodyInput.placeholder = `${fileType.charAt(0).toUpperCase() + fileType.slice(1)} upload failed. Try again.`;
      
      setTimeout(() => {
        bodyInput.placeholder = 'Type or paste';
        bodyInput.disabled = false;
        sendButton.disabled = false;
      }, 3000);
    }
  }

  async function uploadPastedFile(file, accessToken, remoteDeviceId) {
    const uploadRequest = await fetch('https://api.pushbullet.com/v2/upload-request', {
      method: 'POST',
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        file_name: file.name || `pasted-${file.type.startsWith('image/') ? 'image' : 'file'}-${Date.now()}.${file.type.split('/')[1] || 'bin'}`,
        file_type: file.type
      })
    });

    if (!uploadRequest.ok) {
      throw new Error('Failed to get upload URL');
    }

    const uploadData = await uploadRequest.json();

    const formData = new FormData();
    if (uploadData.data) {
      Object.keys(uploadData.data).forEach(key => {
        formData.append(key, uploadData.data[key]);
      });
    }
    formData.append('file', file, uploadData.file_name);

    const uploadResponse = await fetch(uploadData.upload_url, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error('File upload failed');
    }

    const pushData = {
      type: 'file',
      file_name: uploadData.file_name,
      file_type: uploadData.file_type,
      file_url: uploadData.file_url
    };

    if (remoteDeviceId) {
      pushData.device_iden = remoteDeviceId;
    }

    // Use the background script's sendPush function which handles multiple devices
    chrome.runtime.sendMessage({ 
      type: 'send_push', 
      data: pushData 
    });
  }

  async function loadAndApplyColorMode() {
    const data = await chrome.storage.sync.get('colorMode');
    const colorMode = data.colorMode || 'system';
    applyColorMode(colorMode);
  }

  function applyColorMode(mode) {
    const body = document.body;
    
    // Remove existing theme classes
    body.classList.remove('theme-light', 'theme-dark', 'theme-system');
    
    // Add new theme class
    body.classList.add(`theme-${mode}`);
    
    // For system mode, detect user's preference
    if (mode === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      body.classList.toggle('system-dark', prefersDark);
    }
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && (changes.pushes || changes.sentMessages)) {
      loadMessages();
    }
    if (areaName === 'local' && changes.mirrorNotifications) {
      loadNotifications();
    }
    if (areaName === 'sync' && changes.accessToken) {
      checkAccessToken().then(() => {
        loadMessages();
        checkNotificationMirroring();
      });
    }
    if (areaName === 'sync' && changes.notificationMirroring) {
      checkNotificationMirroring();
    }
    if (areaName === 'sync' && changes.colorMode) {
      loadAndApplyColorMode();
    }
  });
});