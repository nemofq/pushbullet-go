document.addEventListener('DOMContentLoaded', function() {
  const accessTokenInput = document.getElementById('accessToken');
  const remoteDeviceSelect = document.getElementById('remoteDeviceId');
  const saveButton = document.getElementById('save');
  const retrieveDevicesButton = document.getElementById('retrieveDevices');
  const status = document.getElementById('status');
  const autoOpenLinksCheckbox = document.getElementById('autoOpenLinks');
  const autoOpenLinksToggle = document.getElementById('autoOpenLinksToggle');
  const notificationMirroringCheckbox = document.getElementById('notificationMirroring');
  const notificationMirroringToggle = document.getElementById('notificationMirroringToggle');
  const onlyBrowserPushesCheckbox = document.getElementById('onlyBrowserPushes');
  const onlyBrowserPushesToggle = document.getElementById('onlyBrowserPushesToggle');
  const hideBrowserPushesCheckbox = document.getElementById('hideBrowserPushes');
  const hideBrowserPushesToggle = document.getElementById('hideBrowserPushesToggle');
  const colorModeSelect = document.getElementById('colorMode');
  const deviceSelectionStatus = document.getElementById('deviceSelectionStatus');
  
  let devices = [];
  let people = [];

  chrome.storage.sync.get(['accessToken', 'remoteDeviceId', 'devices', 'people', 'autoOpenLinks', 'notificationMirroring', 'onlyBrowserPushes', 'hideBrowserPushes', 'colorMode'], function(data) {
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
    
    // Load notification mirroring setting (default is false/off)
    notificationMirroringCheckbox.checked = data.notificationMirroring || false;
    updateNotificationMirroringToggleVisual();
    
    // Load only browser pushes setting (default is true/on)
    onlyBrowserPushesCheckbox.checked = data.onlyBrowserPushes !== false; // Default to true
    updateOnlyBrowserPushesToggleVisual();
    
    // Load hide browser pushes setting (default is true/on)
    hideBrowserPushesCheckbox.checked = data.hideBrowserPushes !== false; // Default to true
    updateHideBrowserPushesToggleVisual();
    
    // Load color mode setting (default is 'system')
    colorModeSelect.value = data.colorMode || 'system';
    applyColorMode(colorModeSelect.value);
    
    updateRetrieveButton();
  });
  
  accessTokenInput.addEventListener('input', updateRetrieveButton);
  
  // Handle toggle clicks
  autoOpenLinksToggle.addEventListener('click', function() {
    autoOpenLinksCheckbox.checked = !autoOpenLinksCheckbox.checked;
    updateToggleVisual();
  });

  notificationMirroringToggle.addEventListener('click', function() {
    notificationMirroringCheckbox.checked = !notificationMirroringCheckbox.checked;
    updateNotificationMirroringToggleVisual();
  });

  onlyBrowserPushesToggle.addEventListener('click', function() {
    onlyBrowserPushesCheckbox.checked = !onlyBrowserPushesCheckbox.checked;
    updateOnlyBrowserPushesToggleVisual();
  });

  hideBrowserPushesToggle.addEventListener('click', function() {
    hideBrowserPushesCheckbox.checked = !hideBrowserPushesCheckbox.checked;
    updateHideBrowserPushesToggleVisual();
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
    retrieveDevicesButton.textContent = 'Retrieving...';
    
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
      
      populateDeviceSelects();
      
      showRetrieveSuccess();
      
    } catch (error) {
      console.error('Error retrieving devices:', error);
      showStatus(`Error: ${error.message}`, 'error');
    } finally {
      // Note: Don't re-enable here as showRetrieveSuccess will handle it
      if (retrieveDevicesButton.textContent === 'Retrieving...') {
        retrieveDevicesButton.disabled = false;
        retrieveDevicesButton.textContent = 'Retrieve devices and people';
      }
    }
  });

  saveButton.addEventListener('click', function() {
    const accessToken = accessTokenInput.value.trim();
    const selectedRemoteDevices = Array.from(remoteDeviceSelect.selectedOptions)
      .map(option => option.value)
      .filter(value => value)
      .join(',');

    const saveData = { 
      accessToken: accessToken || '',
      remoteDeviceId: selectedRemoteDevices || '',
      devices: devices,
      people: people,
      autoOpenLinks: autoOpenLinksCheckbox.checked,
      notificationMirroring: notificationMirroringCheckbox.checked,
      onlyBrowserPushes: onlyBrowserPushesCheckbox.checked,
      hideBrowserPushes: hideBrowserPushesCheckbox.checked,
      colorMode: colorModeSelect.value
    };

    chrome.storage.sync.set(saveData, function() {
      showSaveSuccess();
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
  
  function updateDeviceSelectionStatus() {
    const selectedOptions = Array.from(remoteDeviceSelect.selectedOptions);
    const selectedDevices = selectedOptions.filter(option => option.value);
    
    if (selectedDevices.length === 0) {
      deviceSelectionStatus.textContent = 'None selected (to all devices)';
      deviceSelectionStatus.style.display = 'inline';
    } else if (selectedDevices.length === 1) {
      deviceSelectionStatus.textContent = `${selectedDevices[0].textContent}`;
      deviceSelectionStatus.style.display = 'inline';
    } else {
      deviceSelectionStatus.textContent = `${selectedDevices.length} devices selected`;
      deviceSelectionStatus.style.display = 'inline';
    }
  }
  
  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    setTimeout(() => {
      status.style.display = 'none';
    }, 3000);
  }

  function showSaveSuccess() {
    const originalContent = saveButton.innerHTML;
    
    saveButton.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
      </svg>
      Saved
    `;
    saveButton.disabled = true;
    
    setTimeout(() => {
      saveButton.innerHTML = originalContent;
      saveButton.disabled = false;
    }, 2000);
  }

  function showRetrieveSuccess() {
    const originalContent = 'Retrieve devices and people';
    
    retrieveDevicesButton.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
      </svg>
      Retrieved
    `;
    retrieveDevicesButton.disabled = true;
    
    setTimeout(() => {
      retrieveDevicesButton.textContent = originalContent;
      retrieveDevicesButton.disabled = false;
    }, 2000);
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