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
  const colorModeSelect = document.getElementById('colorMode');
  const languageModeSelect = document.getElementById('languageMode');
  const deviceSelectionStatus = document.getElementById('deviceSelectionStatus');
  const defaultTabSelect = document.getElementById('defaultTab');
  const defaultTabGroup = document.getElementById('defaultTabGroup');
  
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
    chrome.storage.sync.get(['accessToken', 'devices', 'people'], resolve);
  });
  const localData = await new Promise(resolve => {
    chrome.storage.local.get(['remoteDeviceId', 'autoOpenLinks', 'autoOpenOnResume', 'notificationMirroring', 'onlyBrowserPushes', 'hideBrowserPushes', 'showSmsShortcut', 'requireInteraction', 'requireInteractionPushes', 'requireInteractionMirrored', 'closeAsDismiss', 'colorMode', 'languageMode', 'defaultTab'], resolve);
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
    
    // Load only browser pushes setting (default is true/on)
    onlyBrowserPushesCheckbox.checked = data.onlyBrowserPushes !== false; // Default to true
    updateOnlyBrowserPushesToggleVisual();
    
    // Load hide browser pushes setting (default is false/off)
    hideBrowserPushesCheckbox.checked = data.hideBrowserPushes || false; // Default to false
    updateHideBrowserPushesToggleVisual();
    
    // Load SMS shortcut setting (default is false/off)
    showSmsShortcutCheckbox.checked = data.showSmsShortcut || false; // Default to false
    updateShowSmsShortcutToggleVisual();
    
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
    
    // Load language mode setting (default is 'auto')
    languageModeSelect.value = data.languageMode || 'auto';
    
    // Load color mode setting (default is 'system')
    colorModeSelect.value = data.colorMode || 'system';
    applyColorMode(colorModeSelect.value);
    
    // Load default tab setting (default is 'push')
    defaultTabSelect.value = data.defaultTab || 'push';
    
    // Update conditional visibility for default tab option
    updateDefaultTabVisibility();
    
    // Update conditional visibility for require interaction mirrored option
    updateRequireInteractionMirroredVisibility();
    
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
    
    // Auto-enable mirrored sub-switch when notification mirroring is enabled and require interaction is on
    if (notificationMirroringCheckbox.checked && requireInteractionCheckbox.checked) {
      requireInteractionMirroredCheckbox.checked = true;
      updateRequireInteractionMirroredToggleVisual();
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

  requireInteractionToggle.addEventListener('click', function() {
    requireInteractionCheckbox.checked = !requireInteractionCheckbox.checked;
    updateRequireInteractionToggleVisual();
    updateRequireInteractionVisibility();
    
    // Auto-enable both sub-switches when main switch is turned on
    if (requireInteractionCheckbox.checked) {
      requireInteractionPushesCheckbox.checked = true;
      updateRequireInteractionPushesToggleVisual();
      if (notificationMirroringCheckbox.checked) {
        requireInteractionMirroredCheckbox.checked = true;
        updateRequireInteractionMirroredToggleVisual();
      }
    }
  });

  requireInteractionPushesToggle.addEventListener('click', function() {
    requireInteractionPushesCheckbox.checked = !requireInteractionPushesCheckbox.checked;
    updateRequireInteractionPushesToggleVisual();
  });

  requireInteractionMirroredToggle.addEventListener('click', function() {
    requireInteractionMirroredCheckbox.checked = !requireInteractionMirroredCheckbox.checked;
    updateRequireInteractionMirroredToggleVisual();
  });

  closeAsDismissToggle.addEventListener('click', function() {
    closeAsDismissCheckbox.checked = !closeAsDismissCheckbox.checked;
    updateCloseAsDismissToggleVisual();
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
      requireInteraction: requireInteractionCheckbox.checked,
      requireInteractionPushes: requireInteractionPushesCheckbox.checked,
      requireInteractionMirrored: requireInteractionMirroredCheckbox.checked,
      closeAsDismiss: closeAsDismissCheckbox.checked,
      languageMode: languageModeSelect.value,
      colorMode: colorModeSelect.value,
      defaultTab: defaultTabSelect.value
    };

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
      requireInteraction: saveData.requireInteraction,
      requireInteractionPushes: saveData.requireInteractionPushes,
      requireInteractionMirrored: saveData.requireInteractionMirrored,
      closeAsDismiss: saveData.closeAsDismiss,
      languageMode: saveData.languageMode,
      colorMode: saveData.colorMode,
      defaultTab: saveData.defaultTab
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