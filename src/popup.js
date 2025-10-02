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
  const smsShortcut = document.getElementById('smsShortcut');
  const quickShareContainer = document.getElementById('quickShareContainer');
  const quickShareUrl = document.getElementById('quickShareUrl');
  const quickShareSend = document.getElementById('quickShareSend');
  const logoLink = document.getElementById('logoLink');

  // Initialize i18n after CustomI18n is ready
  if (window.CustomI18n) {
    window.CustomI18n.initializeI18n().then(() => {
      initializeI18n();
    });
  } else {
    // Fallback if CustomI18n not available
    setTimeout(() => {
      if (window.CustomI18n) {
        window.CustomI18n.initializeI18n().then(() => {
          initializeI18n();
        });
      } else {
        initializeI18n();
      }
    }, 100);
  }
  
  loadAndApplyColorMode();
  
  // Check access token first, then handle other initializations
  checkAccessToken().then(() => {
    // Only load messages after checking access token to ensure proper display
    debouncedLoadMessages();
    checkNotificationMirroring();
    checkQuickShare();
    updateConnectionStatus();
  });
  
  // Fallback scroll to bottom for first-time loading
  setTimeout(() => {
    messagesList.scrollTop = messagesList.scrollHeight;
  }, 200);
  
  let lastConnectionStatus = null;
  let loadMessagesTimeout = null;
  let loadNotificationsTimeout = null;
  setInterval(updateConnectionStatus, 2000);

  retryButton.addEventListener('click', () => {
    // Check if we have an access token
    chrome.storage.sync.get('accessToken').then(tokenData => {
      if (!tokenData.accessToken) {
        // No access token - open options page for setup
        chrome.runtime.openOptionsPage();
      } else {
        // Has access token - delegate manual reconnection to background.js
        retryButton.style.display = 'none';
        statusElement.className = 'status connecting';
        chrome.runtime.sendMessage({ type: 'retry_connection' });
        // Update status after a short delay to show connecting state
        setTimeout(updateConnectionStatus, 1000);
      }
    });
  });

  sendButton.addEventListener('click', sendMessage);
  
  quickShareSend.addEventListener('click', () => {
    if (quickShareUrl.textContent) {
      sendLink(quickShareUrl.textContent);
    }
  });

  logoLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://www.pushbullet.com/#people/me' });
  });

  
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
      bodyInput.placeholder = window.CustomI18n.getMessage('paste_one_file');
      setTimeout(() => {
        bodyInput.placeholder = window.CustomI18n.getMessage('type_or_paste_placeholder');
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
      checkSmsShortcut();
      return;
    }
    
    const [mirroringData, defaultTabData] = await Promise.all([
      chrome.storage.local.get('notificationMirroring'),
      chrome.storage.local.get('defaultTab')
    ]);
    
    if (mirroringData.notificationMirroring) {
      tabSwitcher.style.display = 'flex';
      debouncedLoadNotifications();
      
      // Switch to default tab
      const defaultTab = defaultTabData.defaultTab || 'push';
      switchTab(defaultTab);
    } else {
      tabSwitcher.style.display = 'none';
      // Clear unread push count when viewing pushes without tabs
      chrome.runtime.sendMessage({ type: 'clear_unread_pushes' });
    }
    checkSmsShortcut();
  }

  async function checkSmsShortcut() {
    const [tokenData, smsData] = await Promise.all([
      chrome.storage.sync.get('accessToken'),
      chrome.storage.local.get('showSmsShortcut')
    ]);
    
    // Only show SMS shortcut if we have an access token and the setting is enabled
    if (tokenData.accessToken && smsData.showSmsShortcut && tabSwitcher.style.display !== 'none') {
      smsShortcut.style.display = 'flex';
    } else {
      smsShortcut.style.display = 'none';
    }
  }
  
  async function checkQuickShare() {
    const [tokenData, quickShareData] = await Promise.all([
      chrome.storage.sync.get('accessToken'),
      chrome.storage.local.get('showQuickShare')
    ]);
    
    // Only show quick share if we have an access token and the setting is enabled
    if (tokenData.accessToken && quickShareData.showQuickShare) {
      try {
        // Get current tab URL
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
          quickShareUrl.textContent = tab.url;
          quickShareContainer.style.display = 'block';
        } else {
          quickShareContainer.style.display = 'none';
        }
      } catch (error) {
        console.log('Could not get active tab URL:', error);
        quickShareContainer.style.display = 'none';
      }
    } else {
      quickShareContainer.style.display = 'none';
    }
  }
  
  async function sendLink(url) {
    const configData = await chrome.storage.local.get('remoteDeviceId');
    
    const pushData = {
      type: 'link',
      url: url,
      body: ''
    };
    
    if (configData.remoteDeviceId) {
      pushData.device_iden = configData.remoteDeviceId;
    }
    
    // Use the background script's sendPush function which handles multiple devices
    chrome.runtime.sendMessage({ 
      type: 'send_push', 
      data: pushData 
    });
    
    // Provide visual feedback
    const originalText = quickShareSend.textContent;
    quickShareSend.textContent = '✓';
    quickShareSend.disabled = true;
    
    setTimeout(() => {
      // Hide the quick share element after sending
      quickShareContainer.style.display = 'none';
    }, 1500);
  }

  function switchTab(tab) {
    const sendForm = document.querySelector('.send-form');
    
    if (tab === 'push') {
      pushTab.classList.add('active');
      notificationTab.classList.remove('active');
      messagesList.style.display = 'flex';
      notificationsList.style.display = 'none';
      sendForm.style.display = 'block';
      
      
      // Clear unread push count when pushes tab is opened
      chrome.runtime.sendMessage({ type: 'clear_unread_pushes' });
      
      // Ensure push tab scrolls to bottom when switching to it
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          messagesList.scrollTop = messagesList.scrollHeight;
        });
      });
    } else {
      pushTab.classList.remove('active');
      notificationTab.classList.add('active');
      messagesList.style.display = 'none';
      notificationsList.style.display = 'flex';
      sendForm.style.display = 'none';
      
      
      debouncedLoadNotifications();
      
      // Clear unread mirrored notifications count when notifications tab is opened
      chrome.runtime.sendMessage({ type: 'clear_unread_mirrors' });
    }
  }

  function updateConnectionStatus() {
    chrome.runtime.sendMessage({ type: 'get_status' }, (response) => {
      if (response && response.status) {
        const currentStatus = response.status;
        statusElement.className = `status ${currentStatus}`;
        
        // Check if we have an access token first
        chrome.storage.sync.get('accessToken').then(tokenData => {
          if (!tokenData.accessToken) {
            // No access token - show setup button
            retryButton.style.display = 'block';
            retryButton.textContent = window.CustomI18n.getMessage('reconnect_button');
            retryButton.title = window.CustomI18n.getMessage('open_settings_to_configure');
            tabSwitcher.style.display = 'none';
            lastConnectionStatus = currentStatus;
            return;
          }
          
          // Has access token - display connection status only
          retryButton.textContent = window.CustomI18n.getMessage('reconnect_button');
          retryButton.title = window.CustomI18n.getMessage('retry_connection_title');
          const isDisconnected = currentStatus === 'disconnected';
          
          // Show retry button for manual reconnection when disconnected
          retryButton.style.display = isDisconnected ? 'block' : 'none';
          
          if (isDisconnected) {
            tabSwitcher.style.display = 'none';
            smsShortcut.style.display = 'none';
            switchTab('push');
          } else {
            // Only refresh content when transitioning from disconnected to connected
            if (lastConnectionStatus === 'disconnected' || lastConnectionStatus === null) {
              console.log('Connection restored - refreshing content');
              debouncedLoadMessages();
              checkNotificationMirroring();
            }
          }
          
          lastConnectionStatus = currentStatus;
        });
      }
    });
  }

  function debouncedLoadMessages() {
    if (loadMessagesTimeout) {
      clearTimeout(loadMessagesTimeout);
    }
    loadMessagesTimeout = setTimeout(() => {
      loadMessages();
      loadMessagesTimeout = null;
    }, 16); // Optimized for smooth 60fps updates
  }

  function debouncedLoadNotifications() {
    if (loadNotificationsTimeout) {
      clearTimeout(loadNotificationsTimeout);
    }
    loadNotificationsTimeout = setTimeout(() => {
      loadNotifications();
      loadNotificationsTimeout = null;
    }, 16); // Optimized for smooth 60fps updates
  }

  async function loadMessages() {
    const [receivedData, sentData, configData, localData] = await Promise.all([
      chrome.storage.local.get('pushes'),
      chrome.storage.local.get('sentMessages'),
      chrome.storage.local.get('onlyBrowserPushes'),
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
      const fragment = document.createDocumentFragment();
      if (tokenData.accessToken) {
        const noMessagesDiv = document.createElement('div');
        noMessagesDiv.className = 'no-messages';
        noMessagesDiv.textContent = window.CustomI18n.getMessage('no_messages_yet');
        fragment.appendChild(noMessagesDiv);
      }
      messagesList.replaceChildren(fragment);
      return;
    }

    // Build content in DocumentFragment to avoid visible flashing
    const fragment = document.createDocumentFragment();
    
    // Add clear history button as first element when we have messages and API token
    const tokenData = await chrome.storage.sync.get('accessToken');
    if (tokenData.accessToken) {
      const clearButton = document.createElement('button');
      clearButton.className = 'clear-history-button';
      clearButton.textContent = window.CustomI18n.getMessage('clear_push_history');
      clearButton.onclick = () => {
        chrome.runtime.sendMessage({ type: 'clear_push_history' });
      };
      fragment.appendChild(clearButton);
    }
    
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
          link.textContent = push.file_name || window.CustomI18n.getMessage('download_file');
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
        copyButton.title = push.type === 'link' ? window.CustomI18n.getMessage('copy_link') : window.CustomI18n.getMessage('copy_message');
        copyButton.onclick = (e) => {
          e.stopPropagation();
          const textToCopy = push.type === 'link' ? push.url : push.body;
          navigator.clipboard.writeText(textToCopy);
        };
        messageContentDiv.appendChild(copyButton);
      }
      
      messageRowDiv.appendChild(timestampDiv);
      messageRowDiv.appendChild(messageContentDiv);
      fragment.appendChild(messageRowDiv);
    });
    
    // Replace content atomically to prevent flashing
    messagesList.replaceChildren(fragment);
    
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
      const fragment = document.createDocumentFragment();
      if (tokenData.accessToken) {
        const noNotificationsDiv = document.createElement('div');
        noNotificationsDiv.className = 'no-messages';
        noNotificationsDiv.textContent = window.CustomI18n.getMessage('no_notifications_received');
        fragment.appendChild(noNotificationsDiv);
      }
      notificationsList.replaceChildren(fragment);
      return;
    }

    // Build content in DocumentFragment to avoid visible flashing
    const fragment = document.createDocumentFragment();
    
    // Add clear history button as first element when we have notifications and API token
    const tokenData = await chrome.storage.sync.get('accessToken');
    if (tokenData.accessToken) {
      const clearButton = document.createElement('button');
      clearButton.className = 'clear-history-button';
      clearButton.textContent = window.CustomI18n.getMessage('clear_mirror_history');
      clearButton.onclick = () => {
        chrome.runtime.sendMessage({ type: 'clear_mirror_history' });
      };
      fragment.appendChild(clearButton);
    }
    
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
        iconImg.src = 'assets/icon128.png'; // Fallback icon
      }
      iconImg.alt = window.CustomI18n.getMessage('app_icon_alt');
      headerDiv.appendChild(iconImg);
      
      // App name
      const appDiv = document.createElement('div');
      appDiv.className = 'notification-app';
      appDiv.textContent = notification.application_name || notification.package_name || window.CustomI18n.getMessage('unknown_app');
      headerDiv.appendChild(appDiv);
      
      // Timestamp
      const timestampDiv = document.createElement('div');
      timestampDiv.className = 'notification-timestamp';
      
      // Use stored timestamp (guaranteed to be valid from background script)
      const timestamp = notification.created * 1000;
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
      
      fragment.appendChild(cardDiv);
    });
    
    // Replace content atomically to prevent flashing
    notificationsList.replaceChildren(fragment);
    
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
    
    const configData = await chrome.storage.local.get('remoteDeviceId');
    
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
  }



  function isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  }


  async function handleFilePaste(file) {
    const isImage = file.type.startsWith('image/');
    const fileTypeKey = isImage ? 'image' : 'file';
    const fileType = window.CustomI18n.getMessage(fileTypeKey);
    
    try {
      
      bodyInput.placeholder = window.CustomI18n.getMessage('uploading') + fileType + '...';
      bodyInput.disabled = true;
      sendButton.disabled = true;

      const [tokenData, configData] = await Promise.all([
        chrome.storage.sync.get('accessToken'),
        chrome.storage.local.get('remoteDeviceId')
      ]);

      if (!tokenData.accessToken) {
        throw new Error(window.CustomI18n.getMessage('no_access_token'));
      }

      await uploadPastedFile(file, tokenData.accessToken, configData.remoteDeviceId);
      
      bodyInput.placeholder = fileType.charAt(0).toUpperCase() + fileType.slice(1) + window.CustomI18n.getMessage('uploaded_successfully');
      setTimeout(() => {
        bodyInput.placeholder = window.CustomI18n.getMessage('type_or_paste_placeholder');
        bodyInput.disabled = false;
        sendButton.disabled = false;
      }, 2000);

    } catch (error) {
      bodyInput.placeholder = fileType.charAt(0).toUpperCase() + fileType.slice(1) + ' ' + window.CustomI18n.getMessage('upload_failed_retry');
      
      setTimeout(() => {
        bodyInput.placeholder = window.CustomI18n.getMessage('type_or_paste_placeholder');
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
    const data = await chrome.storage.local.get('colorMode');
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
    
    // Handle responsive sizing for Chrome zoom/scaling
    // Use window.innerHeight to get the actual available viewport height after zoom is applied
    requestAnimationFrame(() => {
      body.style.height = window.innerHeight + "px";
    });
  }

  function initializeI18n() {
    // Replace all elements with data-i18n attribute
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const messageKey = element.getAttribute('data-i18n');
      element.textContent = window.CustomI18n.getMessage(messageKey);
    });
    
    // Replace placeholder attributes
    const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
    placeholderElements.forEach(element => {
      const messageKey = element.getAttribute('data-i18n-placeholder');
      element.placeholder = window.CustomI18n.getMessage(messageKey);
    });
    
    // Replace title attributes
    const titleElements = document.querySelectorAll('[data-i18n-title]');
    titleElements.forEach(element => {
      const messageKey = element.getAttribute('data-i18n-title');
      element.title = window.CustomI18n.getMessage(messageKey);
    });
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && (changes.pushes || changes.sentMessages)) {
      debouncedLoadMessages();
    }
    if (areaName === 'local' && changes.mirrorNotifications) {
      debouncedLoadNotifications();
    }
    if (areaName === 'sync' && changes.accessToken) {
      checkAccessToken().then(() => {
        debouncedLoadMessages();
        checkNotificationMirroring();
      });
    }
    if (areaName === 'local' && changes.notificationMirroring) {
      checkNotificationMirroring();
    }
    if (areaName === 'local' && changes.showSmsShortcut) {
      checkSmsShortcut();
    }
    if (areaName === 'local' && changes.showQuickShare) {
      checkQuickShare();
    }
    if (areaName === 'local' && changes.colorMode) {
      loadAndApplyColorMode();
    }
    if (areaName === 'local' && changes.languageMode) {
      // Language changed, reload locale and reinitialize UI
      if (window.CustomI18n) {
        window.CustomI18n.changeLanguage(changes.languageMode.newValue).then(() => {
          initializeI18n();
          debouncedLoadMessages(); // Refresh messages to update any UI text
          debouncedLoadNotifications(); // Refresh notifications too
        });
      }
    }
    if (areaName === 'local' && changes.defaultTab) {
      // Default tab changed, switch to new default if notification mirroring is enabled
      chrome.storage.local.get('notificationMirroring').then(data => {
        if (data.notificationMirroring) {
          const newDefaultTab = changes.defaultTab.newValue || 'push';
          switchTab(newDefaultTab);
        }
      });
    }
  });
});