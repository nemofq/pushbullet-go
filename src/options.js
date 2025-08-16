document.addEventListener('DOMContentLoaded', async function() {
  const accessTokenInput = document.getElementById('accessToken');
  const remoteDeviceSelect = document.getElementById('remoteDeviceId');
  const saveSettingsButton = document.getElementById('saveSettings');
  const retrieveDevicesButton = document.getElementById('retrieveDevices');
  const saveStatus = document.getElementById('saveStatus');
  const autoOpenLinksCheckbox = document.getElementById('autoOpenLinks');
  const autoOpenLinksToggle = document.getElementById('autoOpenLinksToggle');
  const autoOpenOnResumeCheckbox = document.getElementById('autoOpenOnResume');
  const autoOpenOnResumeToggle = document.getElementById('autoOpenOnResumeToggle');
  const autoOpenOnResumeContainer = document.getElementById('autoOpenOnResumeContainer');
  const notificationMirroringCheckbox = document.getElementById('notificationMirroring');
  const notificationMirroringToggle = document.getElementById('notificationMirroringToggle');
  const onlyBrowserPushesCheckbox = document.getElementById('onlyBrowserPushes');
  const onlyBrowserPushesToggle = document.getElementById('onlyBrowserPushesToggle');
  const hideBrowserPushesCheckbox = document.getElementById('hideBrowserPushes');
  const hideBrowserPushesToggle = document.getElementById('hideBrowserPushesToggle');
  const showSmsShortcutCheckbox = document.getElementById('showSmsShortcut');
  const showSmsShortcutToggle = document.getElementById('showSmsShortcutToggle');
  const showQuickShareCheckbox = document.getElementById('showQuickShare');
  const showQuickShareToggle = document.getElementById('showQuickShareToggle');
  const requireInteractionCheckbox = document.getElementById('requireInteraction');
  const requireInteractionToggle = document.getElementById('requireInteractionToggle');
  const requireInteractionPushesCheckbox = document.getElementById('requireInteractionPushes');
  const requireInteractionPushesToggle = document.getElementById('requireInteractionPushesToggle');
  const requireInteractionPushesContainer = document.getElementById('requireInteractionPushesContainer');
  const requireInteractionMirroredCheckbox = document.getElementById('requireInteractionMirrored');
  const requireInteractionMirroredToggle = document.getElementById('requireInteractionMirroredToggle');
  const requireInteractionMirroredContainer = document.getElementById('requireInteractionMirroredContainer');
  const closeAsDismissCheckbox = document.getElementById('closeAsDismiss');
  const closeAsDismissToggle = document.getElementById('closeAsDismissToggle');
  const displayUnreadCountsCheckbox = document.getElementById('displayUnreadCounts');
  const displayUnreadCountsToggle = document.getElementById('displayUnreadCountsToggle');
  const displayUnreadPushesCheckbox = document.getElementById('displayUnreadPushes');
  const displayUnreadPushesToggle = document.getElementById('displayUnreadPushesToggle');
  const displayUnreadPushesContainer = document.getElementById('displayUnreadPushesContainer');
  const displayUnreadMirroredCheckbox = document.getElementById('displayUnreadMirrored');
  const displayUnreadMirroredToggle = document.getElementById('displayUnreadMirroredToggle');
  const displayUnreadMirroredContainer = document.getElementById('displayUnreadMirroredContainer');
  const encryptionPasswordInput = document.getElementById('encryptionPassword');
  const colorModeSelect = document.getElementById('colorMode');
  const languageModeSelect = document.getElementById('languageMode');
  const deviceSelectionStatus = document.getElementById('deviceSelectionStatus');
  const defaultTabSelect = document.getElementById('defaultTab');
  const defaultTabGroup = document.getElementById('defaultTabGroup');
  const playSoundOnNotificationCheckbox = document.getElementById('playSoundOnNotification');
  const playSoundOnNotificationToggle = document.getElementById('playSoundOnNotificationToggle');
  
  // Tab elements
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
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
  
  let devices = [];
  let people = [];

  // Get data from both sync and local storage
  const syncData = await new Promise(resolve => {
    chrome.storage.sync.get(['accessToken', 'devices', 'people', 'userIden'], resolve);
  });
  const localData = await new Promise(resolve => {
    chrome.storage.local.get(['remoteDeviceId', 'autoOpenLinks', 'autoOpenOnResume', 'notificationMirroring', 'onlyBrowserPushes', 'hideBrowserPushes', 'showSmsShortcut', 'showQuickShare', 'requireInteraction', 'requireInteractionPushes', 'requireInteractionMirrored', 'closeAsDismiss', 'displayUnreadCounts', 'displayUnreadPushes', 'displayUnreadMirrored', 'colorMode', 'languageMode', 'defaultTab', 'playSoundOnNotification'], resolve);
  });
  const data = { ...syncData, ...localData };
  
  (function(data) {
    accessTokenInput.value = data.accessToken || '';
    devices = data.devices || [];
    people = data.people || [];
    populateDeviceSelects();
    
    if (data.remoteDeviceId) {
      const remoteIds = data.remoteDeviceId.split(',').map(id => id.trim()).filter(id => id);
      Array.from(remoteDeviceSelect.options).forEach(option => {
        option.selected = remoteIds.includes(option.value);
      });
    }
    
    updateDeviceSelectionStatus();
    
    // Load auto-open links setting (default is false/off)
    autoOpenLinksCheckbox.checked = data.autoOpenLinks || false;
    updateToggleVisual();
    
    // Load auto-open on resume setting (default is false/off)
    autoOpenOnResumeCheckbox.checked = data.autoOpenOnResume || false;
    updateAutoOpenOnResumeToggleVisual();
    
    // Show/hide the auto-open on resume option based on auto-open links setting
    updateAutoOpenOnResumeVisibility();
    
    // Load notification mirroring setting (default is false/off)
    notificationMirroringCheckbox.checked = data.notificationMirroring || false;
    updateNotificationMirroringToggleVisual();
    
    // Check if encryption key is already set (stored locally)
    if (data.userIden) {
      const keyName = `encryptionKey_${data.userIden}`;
      chrome.storage.local.get(keyName, function(localData) {
        if (localData[keyName]) {
          encryptionPasswordInput.placeholder = 'Password is set (enter new to change)';
        }
      });
    }
    
    // Load only browser pushes setting (default is true/on)
    onlyBrowserPushesCheckbox.checked = data.onlyBrowserPushes !== false; // Default to true
    updateOnlyBrowserPushesToggleVisual();
    
    // Load hide browser pushes setting (default is false/off)
    hideBrowserPushesCheckbox.checked = data.hideBrowserPushes || false; // Default to false
    updateHideBrowserPushesToggleVisual();
    
    // Load SMS shortcut setting (default is false/off)
    showSmsShortcutCheckbox.checked = data.showSmsShortcut || false; // Default to false
    updateShowSmsShortcutToggleVisual();
    
    // Load show quick share setting (default is false/off)
    showQuickShareCheckbox.checked = data.showQuickShare || false; // Default to false
    updateShowQuickShareToggleVisual();
    
    // Load require interaction settings (default is false/off)
    requireInteractionCheckbox.checked = data.requireInteraction || false; // Default to false
    updateRequireInteractionToggleVisual();
    requireInteractionPushesCheckbox.checked = data.requireInteractionPushes || false; // Default to false
    updateRequireInteractionPushesToggleVisual();
    requireInteractionMirroredCheckbox.checked = data.requireInteractionMirrored || false; // Default to false
    updateRequireInteractionMirroredToggleVisual();
    
    // Show/hide the require interaction sub-options based on main setting
    updateRequireInteractionVisibility();
    
    // Load close as dismiss setting (default is false/off)
    closeAsDismissCheckbox.checked = data.closeAsDismiss || false; // Default to false
    updateCloseAsDismissToggleVisual();
    
    // Load display unread counts settings (default is all enabled)
    displayUnreadCountsCheckbox.checked = data.displayUnreadCounts !== false; // Default to true
    updateDisplayUnreadCountsToggleVisual();
    displayUnreadPushesCheckbox.checked = data.displayUnreadPushes !== false; // Default to true
    updateDisplayUnreadPushesToggleVisual();
    displayUnreadMirroredCheckbox.checked = data.displayUnreadMirrored !== false; // Default to true
    updateDisplayUnreadMirroredToggleVisual();
    
    // Show/hide the display unread counts sub-options based on main setting
    updateDisplayUnreadCountsVisibility();
    
    // Load language mode setting (default is 'auto')
    languageModeSelect.value = data.languageMode || 'auto';
    
    // Load color mode setting (default is 'system')
    colorModeSelect.value = data.colorMode || 'system';
    applyColorMode(colorModeSelect.value);
    
    // Load default tab setting (default is 'push')
    defaultTabSelect.value = data.defaultTab || 'push';
    
    // Load play sound on notification setting (default is true/enabled)
    playSoundOnNotificationCheckbox.checked = data.playSoundOnNotification !== false; // Default to true
    updatePlaySoundOnNotificationToggleVisual();
    
    // Update conditional visibility for default tab option
    updateDefaultTabVisibility();
    
    // Update conditional visibility for require interaction mirrored option
    updateRequireInteractionMirroredVisibility();
    
    // Update conditional visibility for display unread mirrored option
    updateDisplayUnreadMirroredVisibility();
    
    updateRetrieveButton();
  })(data);
  
  accessTokenInput.addEventListener('input', updateRetrieveButton);
  
  // Handle toggle clicks
  autoOpenLinksToggle.addEventListener('click', function() {
    autoOpenLinksCheckbox.checked = !autoOpenLinksCheckbox.checked;
    updateToggleVisual();
    updateAutoOpenOnResumeVisibility();
  });

  autoOpenOnResumeToggle.addEventListener('click', function() {
    autoOpenOnResumeCheckbox.checked = !autoOpenOnResumeCheckbox.checked;
    updateAutoOpenOnResumeToggleVisual();
  });

  notificationMirroringToggle.addEventListener('click', function() {
    notificationMirroringCheckbox.checked = !notificationMirroringCheckbox.checked;
    updateNotificationMirroringToggleVisual();
    updateDefaultTabVisibility();
    updateRequireInteractionMirroredVisibility();
    updateDisplayUnreadMirroredVisibility();
    
    // Auto-enable mirrored sub-switch when notification mirroring is enabled and require interaction is on
    if (notificationMirroringCheckbox.checked && requireInteractionCheckbox.checked) {
      requireInteractionMirroredCheckbox.checked = true;
      updateRequireInteractionMirroredToggleVisual();
    }
    
    // Auto-disable Mirrored Notifications under Display unread counts when Enable Notification Mirroring is turned off
    if (!notificationMirroringCheckbox.checked && displayUnreadMirroredCheckbox.checked) {
      displayUnreadMirroredCheckbox.checked = false;
      updateDisplayUnreadMirroredToggleVisual();
      
      // Auto-disable main Display unread counts switch if both sub-switches are off
      if (!displayUnreadPushesCheckbox.checked && !displayUnreadMirroredCheckbox.checked) {
        displayUnreadCountsCheckbox.checked = false;
        updateDisplayUnreadCountsToggleVisual();
        updateDisplayUnreadCountsVisibility();
      }
    }
  });

  onlyBrowserPushesToggle.addEventListener('click', function() {
    onlyBrowserPushesCheckbox.checked = !onlyBrowserPushesCheckbox.checked;
    updateOnlyBrowserPushesToggleVisual();
  });

  hideBrowserPushesToggle.addEventListener('click', function() {
    hideBrowserPushesCheckbox.checked = !hideBrowserPushesCheckbox.checked;
    updateHideBrowserPushesToggleVisual();
  });

  showSmsShortcutToggle.addEventListener('click', function() {
    showSmsShortcutCheckbox.checked = !showSmsShortcutCheckbox.checked;
    updateShowSmsShortcutToggleVisual();
  });

  showQuickShareToggle.addEventListener('click', function() {
    showQuickShareCheckbox.checked = !showQuickShareCheckbox.checked;
    updateShowQuickShareToggleVisual();
  });

  requireInteractionToggle.addEventListener('click', function() {
    requireInteractionCheckbox.checked = !requireInteractionCheckbox.checked;
    updateRequireInteractionToggleVisual();
    updateRequireInteractionVisibility();
    
    // Auto-enable both sub-switches when main switch is turned on
    if (requireInteractionCheckbox.checked) {
      requireInteractionPushesCheckbox.checked = true;
      updateRequireInteractionPushesToggleVisual();
      requireInteractionMirroredCheckbox.checked = true;
      updateRequireInteractionMirroredToggleVisual();
    }
  });

  requireInteractionPushesToggle.addEventListener('click', function() {
    requireInteractionPushesCheckbox.checked = !requireInteractionPushesCheckbox.checked;
    updateRequireInteractionPushesToggleVisual();
    
    // Auto-disable main switch if both sub-switches are off
    if (!requireInteractionPushesCheckbox.checked && !requireInteractionMirroredCheckbox.checked) {
      requireInteractionCheckbox.checked = false;
      updateRequireInteractionToggleVisual();
      updateRequireInteractionVisibility();
    }
  });

  requireInteractionMirroredToggle.addEventListener('click', function() {
    requireInteractionMirroredCheckbox.checked = !requireInteractionMirroredCheckbox.checked;
    updateRequireInteractionMirroredToggleVisual();
    
    // Auto-disable main switch if both sub-switches are off
    if (!requireInteractionPushesCheckbox.checked && !requireInteractionMirroredCheckbox.checked) {
      requireInteractionCheckbox.checked = false;
      updateRequireInteractionToggleVisual();
      updateRequireInteractionVisibility();
    }
  });

  closeAsDismissToggle.addEventListener('click', function() {
    closeAsDismissCheckbox.checked = !closeAsDismissCheckbox.checked;
    updateCloseAsDismissToggleVisual();
  });

  displayUnreadCountsToggle.addEventListener('click', function() {
    displayUnreadCountsCheckbox.checked = !displayUnreadCountsCheckbox.checked;
    updateDisplayUnreadCountsToggleVisual();
    updateDisplayUnreadCountsVisibility();
    
    // Auto-enable both sub-switches when main switch is turned on
    if (displayUnreadCountsCheckbox.checked) {
      displayUnreadPushesCheckbox.checked = true;
      updateDisplayUnreadPushesToggleVisual();
      displayUnreadMirroredCheckbox.checked = true;
      updateDisplayUnreadMirroredToggleVisual();
    }
    
    // Auto-disable main switch if both sub-switches are off
    if (!displayUnreadPushesCheckbox.checked && !displayUnreadMirroredCheckbox.checked) {
      displayUnreadCountsCheckbox.checked = false;
      updateDisplayUnreadCountsToggleVisual();
      updateDisplayUnreadCountsVisibility();
    }
  });

  displayUnreadPushesToggle.addEventListener('click', function() {
    displayUnreadPushesCheckbox.checked = !displayUnreadPushesCheckbox.checked;
    updateDisplayUnreadPushesToggleVisual();
    
    // Auto-disable main switch if both sub-switches are off
    if (!displayUnreadPushesCheckbox.checked && !displayUnreadMirroredCheckbox.checked) {
      displayUnreadCountsCheckbox.checked = false;
      updateDisplayUnreadCountsToggleVisual();
      updateDisplayUnreadCountsVisibility();
    }
  });

  displayUnreadMirroredToggle.addEventListener('click', function() {
    displayUnreadMirroredCheckbox.checked = !displayUnreadMirroredCheckbox.checked;
    updateDisplayUnreadMirroredToggleVisual();
    
    // Auto-disable main switch if both sub-switches are off
    if (!displayUnreadPushesCheckbox.checked && !displayUnreadMirroredCheckbox.checked) {
      displayUnreadCountsCheckbox.checked = false;
      updateDisplayUnreadCountsToggleVisual();
      updateDisplayUnreadCountsVisibility();
    }
  });

  playSoundOnNotificationToggle.addEventListener('click', function() {
    playSoundOnNotificationCheckbox.checked = !playSoundOnNotificationCheckbox.checked;
    updatePlaySoundOnNotificationToggleVisual();
  });

  // Handle color mode changes for immediate preview
  colorModeSelect.addEventListener('change', function() {
    applyColorMode(colorModeSelect.value);
  });

  // Handle remote device selection changes
  remoteDeviceSelect.addEventListener('change', function() {
    updateDeviceSelectionStatus();
  });

  retrieveDevicesButton.addEventListener('click', async function() {
    const accessToken = accessTokenInput.value.trim();
    if (!accessToken) return;
    
    retrieveDevicesButton.disabled = true;
    retrieveDevicesButton.textContent = window.CustomI18n.getMessage('retrieving');
    
    try {
      // Fetch devices
      const devicesResponse = await fetch('https://api.pushbullet.com/v2/devices', {
        headers: {
          'Access-Token': accessToken
        }
      });
      
      if (!devicesResponse.ok) {
        throw new Error(`Failed to fetch devices: ${devicesResponse.status} ${devicesResponse.statusText}`);
      }
      
      const devicesData = await devicesResponse.json();
      devices = devicesData.devices || [];
      
      // Check if there's a Chrome device, if not create one
      const hasChromeDevice = devices.some(device => device.type === 'chrome');
      if (!hasChromeDevice) {
        console.log('No Chrome device found, creating one...');
        const createDeviceResponse = await fetch('https://api.pushbullet.com/v2/devices', {
          method: 'POST',
          headers: {
            'Access-Token': accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            nickname: 'Chrome',
            type: 'chrome',
            model: 'Chrome'
          })
        });
        
        if (createDeviceResponse.ok) {
          console.log('Chrome device created successfully');
          // Re-fetch devices to get the complete updated list
          const updatedDevicesResponse = await fetch('https://api.pushbullet.com/v2/devices', {
            headers: {
              'Access-Token': accessToken
            }
          });
          
          if (updatedDevicesResponse.ok) {
            const updatedDevicesData = await updatedDevicesResponse.json();
            devices = updatedDevicesData.devices || [];
          }
        } else {
          console.warn('Failed to create Chrome device:', createDeviceResponse.status, createDeviceResponse.statusText);
        }
      }
      
      // Fetch chats (people)
      const chatsResponse = await fetch('https://api.pushbullet.com/v2/chats', {
        headers: {
          'Access-Token': accessToken
        }
      });
      
      if (!chatsResponse.ok) {
        throw new Error(`Failed to fetch chats: ${chatsResponse.status} ${chatsResponse.statusText}`);
      }
      
      const chatsData = await chatsResponse.json();
      const chats = chatsData.chats || [];
      
      // Filter active chats and extract needed fields
      people = chats
        .filter(chat => chat.active === true)
        .map(chat => ({
          email_normalized: chat.with.email_normalized,
          name: chat.with.name
        }));
      
      // Save Chrome device ID to local storage for reference
      const chromeDevice = devices.find(device => device.active && device.type === 'chrome');
      const chromeDeviceId = chromeDevice ? chromeDevice.iden : null;
      
      await chrome.storage.sync.set({ devices: devices, people: people });
      await chrome.storage.local.set({ chromeDeviceId: chromeDeviceId });
      
      // Check if we need to fetch initial pushes (only if we haven't done it before)
      const existingData = await chrome.storage.local.get('lastModified');
      const hasInitialPushes = existingData.lastModified && existingData.lastModified > 0;
      
      if (!hasInitialPushes) {
        console.log('No initial pushes found - fetching first 20 pushes for display');
        // Fetch initial 20 pushes for display in popup (silent, no notifications)
        const pushesResponse = await fetch('https://api.pushbullet.com/v2/pushes?active=true&limit=20', {
          headers: {
            'Access-Token': accessToken
          }
        });
        
        if (pushesResponse.ok) {
          const pushesData = await pushesResponse.json();
          if (pushesData.pushes && pushesData.pushes.length > 0) {
            // Store the initial pushes and set lastModified
            const lastModified = pushesData.pushes[0].modified;
            await chrome.storage.local.set({ 
              pushes: pushesData.pushes.slice(0, 100),
              lastModified: lastModified 
            });
            console.log(`Initial setup: Retrieved ${pushesData.pushes.length} pushes, lastModified set to ${lastModified}`);
          }
        } else {
          console.warn('Failed to fetch initial pushes:', pushesResponse.status, pushesResponse.statusText);
        }
      } else {
        console.log('Initial pushes already exist - skipping fetch (lastModified:', existingData.lastModified, ')');
      }
      
      populateDeviceSelects();
      
      showRetrieveSuccess();
      
    } catch (error) {
      console.error('Error retrieving devices:', error);
      showStatus(`Error: ${error.message}`, 'error');
    } finally {
      // Note: Don't re-enable here as showRetrieveSuccess will handle it
      if (retrieveDevicesButton.textContent === window.CustomI18n.getMessage('retrieving')) {
        retrieveDevicesButton.disabled = false;
        retrieveDevicesButton.textContent = window.CustomI18n.getMessage('retrieve_devices_button');
      }
    }
  });

  // Tab switching functionality
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      const targetTab = this.getAttribute('data-tab');
      
      // Remove active class from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      this.classList.add('active');
      document.getElementById(`${targetTab}-content`).classList.add('active');
    });
  });

  // Save All Settings
  saveSettingsButton.addEventListener('click', function() {
    const accessToken = accessTokenInput.value.trim();
    const selectedRemoteDevices = Array.from(remoteDeviceSelect.selectedOptions)
      .map(option => option.value)
      .filter(value => value)
      .join(',');

    const saveData = { 
      // General settings
      accessToken: accessToken || '',
      remoteDeviceId: selectedRemoteDevices || '',
      devices: devices,
      people: people,
      onlyBrowserPushes: onlyBrowserPushesCheckbox.checked,
      hideBrowserPushes: hideBrowserPushesCheckbox.checked,
      autoOpenLinks: autoOpenLinksCheckbox.checked,
      autoOpenOnResume: autoOpenOnResumeCheckbox.checked,
      // Appearance settings
      notificationMirroring: notificationMirroringCheckbox.checked,
      showSmsShortcut: showSmsShortcutCheckbox.checked,
      showQuickShare: showQuickShareCheckbox.checked,
      requireInteraction: requireInteractionCheckbox.checked,
      requireInteractionPushes: requireInteractionPushesCheckbox.checked,
      requireInteractionMirrored: requireInteractionMirroredCheckbox.checked,
      closeAsDismiss: closeAsDismissCheckbox.checked,
      displayUnreadCounts: displayUnreadCountsCheckbox.checked,
      displayUnreadPushes: displayUnreadPushesCheckbox.checked,
      displayUnreadMirrored: displayUnreadMirroredCheckbox.checked,
      languageMode: languageModeSelect.value,
      colorMode: colorModeSelect.value,
      defaultTab: defaultTabSelect.value,
      playSoundOnNotification: playSoundOnNotificationCheckbox.checked
    };
    
    // Handle encryption password - derive key and store locally
    const encryptionPassword = encryptionPasswordInput.value.trim();
    if (encryptionPassword) {
      // Get userIden from sync storage to derive the key
      chrome.storage.sync.get('userIden', async function(userData) {
        if (userData.userIden) {
          try {
            // Import crypto module functionality
            const pbCrypto = new PushbulletCrypto();
            await pbCrypto.initialize(encryptionPassword, userData.userIden);
            const derivedKey = await pbCrypto.exportKey();
            
            // Store derived key locally (not synced), namespaced by user
            const keyName = `encryptionKey_${userData.userIden}`;
            await chrome.storage.local.set({ [keyName]: derivedKey });
            
            // Clear the input and update placeholder
            encryptionPasswordInput.value = '';
            encryptionPasswordInput.placeholder = 'Password is set (enter new to change)';
            
            // Notify background about encryption changes
            chrome.runtime.sendMessage({ type: 'encryption_updated' });
          } catch (error) {
            console.error('Failed to derive encryption key:', error);
            showSaveError();
          }
        } else {
          console.error('User iden not found - please retrieve devices first');
          showSaveError();
        }
      });
    }

    // Split data between sync and local storage
    const syncSaveData = {
      accessToken: saveData.accessToken,
      devices: saveData.devices,
      people: saveData.people
    };
    
    
    const localSaveData = {
      remoteDeviceId: saveData.remoteDeviceId,
      onlyBrowserPushes: saveData.onlyBrowserPushes,
      hideBrowserPushes: saveData.hideBrowserPushes,
      autoOpenLinks: saveData.autoOpenLinks,
      autoOpenOnResume: saveData.autoOpenOnResume,
      notificationMirroring: saveData.notificationMirroring,
      showSmsShortcut: saveData.showSmsShortcut,
      showQuickShare: saveData.showQuickShare,
      requireInteraction: saveData.requireInteraction,
      requireInteractionPushes: saveData.requireInteractionPushes,
      requireInteractionMirrored: saveData.requireInteractionMirrored,
      closeAsDismiss: saveData.closeAsDismiss,
      displayUnreadCounts: saveData.displayUnreadCounts,
      displayUnreadPushes: saveData.displayUnreadPushes,
      displayUnreadMirrored: saveData.displayUnreadMirrored,
      languageMode: saveData.languageMode,
      colorMode: saveData.colorMode,
      defaultTab: saveData.defaultTab,
      playSoundOnNotification: saveData.playSoundOnNotification
    };
    
    // Save to both storages
    chrome.storage.sync.set(syncSaveData);
    chrome.storage.local.set(localSaveData, function() {
      // Check if language has changed
      const oldLanguage = window.CustomI18n.getCurrentLanguage();
      const newLanguage = languageModeSelect.value;
      
      if (oldLanguage !== newLanguage) {
        // Language changed, reload the locale and update UI
        window.CustomI18n.changeLanguage(newLanguage).then(() => {
          initializeI18n();
          showSaveSuccess();
        });
      } else {
        showSaveSuccess();
      }
      
      chrome.runtime.sendMessage({ type: 'token_updated' });
    });
  });

  function populateDeviceSelects() {
    remoteDeviceSelect.innerHTML = '';
    
    devices.forEach(device => {
      if (device.active) {
        const remoteOption = document.createElement('option');
        remoteOption.value = device.iden;
        remoteOption.textContent = device.nickname || `${device.manufacturer} ${device.model}`;
        remoteDeviceSelect.appendChild(remoteOption);
      }
    });
    
    updateDeviceSelectionStatus();
  }
  
  function updateRetrieveButton() {
    const hasToken = accessTokenInput.value.trim().length > 0;
    retrieveDevicesButton.disabled = !hasToken;
  }
  
  function updateToggleVisual() {
    if (autoOpenLinksCheckbox.checked) {
      autoOpenLinksToggle.classList.add('active');
    } else {
      autoOpenLinksToggle.classList.remove('active');
    }
  }
  
  function updateAutoOpenOnResumeToggleVisual() {
    if (autoOpenOnResumeCheckbox.checked) {
      autoOpenOnResumeToggle.classList.add('active');
    } else {
      autoOpenOnResumeToggle.classList.remove('active');
    }
  }
  
  function updateAutoOpenOnResumeVisibility() {
    if (autoOpenLinksCheckbox.checked) {
      autoOpenOnResumeContainer.style.display = 'flex';
    } else {
      autoOpenOnResumeContainer.style.display = 'none';
    }
  }
  
  function updateNotificationMirroringToggleVisual() {
    if (notificationMirroringCheckbox.checked) {
      notificationMirroringToggle.classList.add('active');
    } else {
      notificationMirroringToggle.classList.remove('active');
    }
  }
  
  function updateOnlyBrowserPushesToggleVisual() {
    if (onlyBrowserPushesCheckbox.checked) {
      onlyBrowserPushesToggle.classList.add('active');
    } else {
      onlyBrowserPushesToggle.classList.remove('active');
    }
  }
  
  function updateHideBrowserPushesToggleVisual() {
    if (hideBrowserPushesCheckbox.checked) {
      hideBrowserPushesToggle.classList.add('active');
    } else {
      hideBrowserPushesToggle.classList.remove('active');
    }
  }
  
  function updateShowSmsShortcutToggleVisual() {
    if (showSmsShortcutCheckbox.checked) {
      showSmsShortcutToggle.classList.add('active');
    } else {
      showSmsShortcutToggle.classList.remove('active');
    }
  }
  
  function updateShowQuickShareToggleVisual() {
    if (showQuickShareCheckbox.checked) {
      showQuickShareToggle.classList.add('active');
    } else {
      showQuickShareToggle.classList.remove('active');
    }
  }
  
  function updateDefaultTabVisibility() {
    if (notificationMirroringCheckbox.checked) {
      defaultTabGroup.style.display = 'block';
    } else {
      defaultTabGroup.style.display = 'none';
    }
  }
  
  function updateRequireInteractionToggleVisual() {
    if (requireInteractionCheckbox.checked) {
      requireInteractionToggle.classList.add('active');
    } else {
      requireInteractionToggle.classList.remove('active');
    }
  }
  
  function updateRequireInteractionPushesToggleVisual() {
    if (requireInteractionPushesCheckbox.checked) {
      requireInteractionPushesToggle.classList.add('active');
    } else {
      requireInteractionPushesToggle.classList.remove('active');
    }
  }
  
  function updateRequireInteractionMirroredToggleVisual() {
    if (requireInteractionMirroredCheckbox.checked) {
      requireInteractionMirroredToggle.classList.add('active');
    } else {
      requireInteractionMirroredToggle.classList.remove('active');
    }
  }
  
  function updateRequireInteractionVisibility() {
    if (requireInteractionCheckbox.checked) {
      requireInteractionPushesContainer.style.display = 'flex';
      updateRequireInteractionMirroredVisibility();
    } else {
      requireInteractionPushesContainer.style.display = 'none';
      requireInteractionMirroredContainer.style.display = 'none';
    }
  }
  
  function updateRequireInteractionMirroredVisibility() {
    if (requireInteractionCheckbox.checked && notificationMirroringCheckbox.checked) {
      requireInteractionMirroredContainer.style.display = 'flex';
    } else {
      requireInteractionMirroredContainer.style.display = 'none';
    }
  }
  
  function updateCloseAsDismissToggleVisual() {
    if (closeAsDismissCheckbox.checked) {
      closeAsDismissToggle.classList.add('active');
    } else {
      closeAsDismissToggle.classList.remove('active');
    }
  }
  
  function updateDisplayUnreadCountsToggleVisual() {
    if (displayUnreadCountsCheckbox.checked) {
      displayUnreadCountsToggle.classList.add('active');
    } else {
      displayUnreadCountsToggle.classList.remove('active');
    }
  }
  
  function updateDisplayUnreadPushesToggleVisual() {
    if (displayUnreadPushesCheckbox.checked) {
      displayUnreadPushesToggle.classList.add('active');
    } else {
      displayUnreadPushesToggle.classList.remove('active');
    }
  }
  
  function updateDisplayUnreadMirroredToggleVisual() {
    if (displayUnreadMirroredCheckbox.checked) {
      displayUnreadMirroredToggle.classList.add('active');
    } else {
      displayUnreadMirroredToggle.classList.remove('active');
    }
  }
  
  function updateDisplayUnreadCountsVisibility() {
    if (displayUnreadCountsCheckbox.checked) {
      displayUnreadPushesContainer.style.display = 'flex';
      updateDisplayUnreadMirroredVisibility();
    } else {
      displayUnreadPushesContainer.style.display = 'none';
      displayUnreadMirroredContainer.style.display = 'none';
    }
  }
  
  function updateDisplayUnreadMirroredVisibility() {
    if (displayUnreadCountsCheckbox.checked && notificationMirroringCheckbox.checked) {
      displayUnreadMirroredContainer.style.display = 'flex';
    } else {
      displayUnreadMirroredContainer.style.display = 'none';
    }
  }
  
  function updatePlaySoundOnNotificationToggleVisual() {
    if (playSoundOnNotificationCheckbox.checked) {
      playSoundOnNotificationToggle.classList.add('active');
    } else {
      playSoundOnNotificationToggle.classList.remove('active');
    }
  }
  
  function updateDeviceSelectionStatus() {
    const selectedOptions = Array.from(remoteDeviceSelect.selectedOptions);
    const selectedDevices = selectedOptions.filter(option => option.value);
    
    if (selectedDevices.length === 0) {
      deviceSelectionStatus.textContent = window.CustomI18n && window.CustomI18n.getMessage 
        ? window.CustomI18n.getMessage('none_selected_all_devices') 
        : 'None selected (to all devices)';
      deviceSelectionStatus.style.display = 'inline';
    } else if (selectedDevices.length === 1) {
      deviceSelectionStatus.textContent = `${selectedDevices[0].textContent}`;
      deviceSelectionStatus.style.display = 'inline';
    } else {
      const devicesSelectedText = window.CustomI18n && window.CustomI18n.getMessage 
        ? window.CustomI18n.getMessage('devices_selected') 
        : 'devices selected';
      deviceSelectionStatus.textContent = `${selectedDevices.length} ${devicesSelectedText}`;
      deviceSelectionStatus.style.display = 'inline';
    }
  }
  
  function showStatus(message, type) {
    saveStatus.textContent = message;
    saveStatus.className = `status ${type}`;
    saveStatus.style.display = 'block';
    
    setTimeout(() => {
      saveStatus.style.display = 'none';
    }, 3000);
  }

  function showSaveSuccess() {
    const originalContent = saveSettingsButton.innerHTML;
    
    saveSettingsButton.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
      </svg>
      ${window.CustomI18n.getMessage('saved')}
    `;
    saveSettingsButton.disabled = true;
    
    setTimeout(() => {
      saveSettingsButton.innerHTML = originalContent;
      saveSettingsButton.disabled = false;
    }, 2000);
  }

  function showRetrieveSuccess() {
    const originalContent = window.CustomI18n.getMessage('retrieve_devices_button');
    
    retrieveDevicesButton.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
      </svg>
      ${window.CustomI18n.getMessage('retrieved')}
    `;
    retrieveDevicesButton.disabled = true;
    
    setTimeout(() => {
      retrieveDevicesButton.textContent = originalContent;
      retrieveDevicesButton.disabled = false;
    }, 2000);
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
    
    // Update device selection status with proper i18n
    updateDeviceSelectionStatus();
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
});