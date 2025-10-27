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
  const showOtherDevicePushesCheckbox = document.getElementById('showOtherDevicePushes');
  const showOtherDevicePushesToggle = document.getElementById('showOtherDevicePushesToggle');
  const showNoTargetPushesCheckbox = document.getElementById('showNoTargetPushes');
  const showNoTargetPushesToggle = document.getElementById('showNoTargetPushesToggle');
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
  const encryptionPasswordGroup = document.getElementById('encryptionPasswordGroup');
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
    chrome.storage.local.get(['remoteDeviceId', 'autoOpenLinks', 'autoOpenOnResume', 'notificationMirroring', 'onlyBrowserPushes', 'showOtherDevicePushes', 'showNoTargetPushes', 'hideBrowserPushes', 'showSmsShortcut', 'showQuickShare', 'requireInteraction', 'requireInteractionPushes', 'requireInteractionMirrored', 'closeAsDismiss', 'displayUnreadCounts', 'displayUnreadPushes', 'displayUnreadMirrored', 'colorMode', 'languageMode', 'defaultTab', 'playSoundOnNotification'], resolve);
  });
  const data = { ...syncData, ...localData };
  
  (function(data) {
    // Handle access token display like encryption password
    if (data.accessToken) {
      accessTokenInput.type = 'password';
      accessTokenInput.placeholder = chrome.i18n.getMessage('access_token_set_placeholder');
      accessTokenInput.value = '';
      // Store the actual token in a data attribute for later use
      accessTokenInput.dataset.hasToken = 'true';
    } else {
      accessTokenInput.value = '';
      accessTokenInput.dataset.hasToken = 'false';
    }
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
          encryptionPasswordInput.placeholder = chrome.i18n.getMessage('encryption_password_set_placeholder');
        }
      });
    }
    
    // Load only browser pushes setting (default is true/on)
    onlyBrowserPushesCheckbox.checked = data.onlyBrowserPushes !== false; // Default to true
    updateOnlyBrowserPushesToggleVisual();

    // Migration logic for new filter settings
    if (data.showOtherDevicePushes === undefined || data.showNoTargetPushes === undefined) {
      // First time loading after update - perform migration
      if (data.onlyBrowserPushes === false) {
        // Old setting was OFF - meant "show all pushes"
        // New system: need ALL THREE switches ON (including flipping the first one)
        onlyBrowserPushesCheckbox.checked = true;  // FLIP: false → true
        showOtherDevicePushesCheckbox.checked = true;
        showNoTargetPushesCheckbox.checked = true;
      } else {
        // Old setting was ON/undefined - meant "only Chrome"
        // New system: only first switch ON
        onlyBrowserPushesCheckbox.checked = true;  // Keep as true
        showOtherDevicePushesCheckbox.checked = false;
        showNoTargetPushesCheckbox.checked = false;
      }
      // Save ALL THREE migrated values immediately (including the corrected onlyBrowserPushes)
      chrome.storage.local.set({
        onlyBrowserPushes: onlyBrowserPushesCheckbox.checked,
        showOtherDevicePushes: showOtherDevicePushesCheckbox.checked,
        showNoTargetPushes: showNoTargetPushesCheckbox.checked
      });
      // Update visual for first switch since we may have flipped it
      updateOnlyBrowserPushesToggleVisual();
    } else {
      // Load existing values
      showOtherDevicePushesCheckbox.checked = data.showOtherDevicePushes || false;
      showNoTargetPushesCheckbox.checked = data.showNoTargetPushes || false;
    }
    updateShowOtherDevicePushesToggleVisual();
    updateShowNoTargetPushesToggleVisual();

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
  
  accessTokenInput.addEventListener('input', function() {
    // When user starts typing, change to text type for new input
    if (accessTokenInput.type === 'password' && accessTokenInput.value) {
      accessTokenInput.type = 'text';
      accessTokenInput.placeholder = chrome.i18n.getMessage('access_token_placeholder');
    }
    updateRetrieveButton();
  });
  
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

  showOtherDevicePushesToggle.addEventListener('click', function() {
    showOtherDevicePushesCheckbox.checked = !showOtherDevicePushesCheckbox.checked;
    updateShowOtherDevicePushesToggleVisual();
  });

  showNoTargetPushesToggle.addEventListener('click', function() {
    showNoTargetPushesCheckbox.checked = !showNoTargetPushesCheckbox.checked;
    updateShowNoTargetPushesToggleVisual();
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
    // Get access token - either from new input or existing stored
    let accessToken = accessTokenInput.value.trim();
    if (!accessToken && accessTokenInput.dataset.hasToken === 'true') {
      // Use stored token
      const existingData = await new Promise(resolve => {
        chrome.storage.sync.get(['accessToken'], resolve);
      });
      accessToken = existingData.accessToken || '';
    }
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
      
      // Fetch user info for encryption
      let userIden = null;
      try {
        const userResponse = await fetch('https://api.pushbullet.com/v2/users/me', {
          headers: {
            'Access-Token': accessToken
          }
        });
        
        if (userResponse.ok) {
          const user = await userResponse.json();
          userIden = user.iden;
          console.log('User info retrieved successfully for encryption');
        } else {
          console.warn('Failed to fetch user info:', userResponse.status, userResponse.statusText);
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
      }
      
      // Save Chrome device ID to local storage for reference
      const chromeDevice = devices.find(device => device.active && device.type === 'chrome');
      const chromeDeviceId = chromeDevice ? chromeDevice.iden : null;
      
      // Save all data including userIden for encryption and the access token
      const syncData = { devices: devices, people: people, accessToken: accessToken };
      if (userIden) {
        syncData.userIden = userIden;
      }
      await chrome.storage.sync.set(syncData);
      await chrome.storage.local.set({ chromeDeviceId: chromeDeviceId });

      // Update access token field display after saving (same as "Save" button behavior)
      accessTokenInput.type = 'password';
      accessTokenInput.value = '';
      accessTokenInput.placeholder = chrome.i18n.getMessage('access_token_set_placeholder');
      accessTokenInput.dataset.hasToken = 'true';
      
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

      // Notify background script to establish connection
      chrome.runtime.sendMessage({ type: 'token_updated' });

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

  // OAuth authentication handler
  const oauthLink = document.getElementById('oauthLink');
  if (oauthLink) {
    oauthLink.addEventListener('click', async function(e) {
      e.preventDefault();

      // OAuth parameters
      const clientId = 'KvjVLv9nrb2jNftJwZ9QWwwNXc1h8Qvb';
      // Use Chrome's identity redirect URL
      const redirectUri = chrome.identity.getRedirectURL();
      const responseType = 'token';
      
      // Build OAuth URL
      const authUrl = `https://www.pushbullet.com/authorize?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=${responseType}`;

      // Launch the web auth flow
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl,
          interactive: true
        },
        function(responseUrl) {
          if (chrome.runtime.lastError) {
            // Handle errors (user cancelled, network error, etc.)
            const errorMessage = chrome.runtime.lastError.message;
            console.error('OAuth error:', chrome.runtime.lastError);
            if (errorMessage && !errorMessage.includes('User cancelled')) {
              const errorPrefix = window.CustomI18n.getMessage('oauth_error') || 'OAuth error:';
              showStatus(`${errorPrefix} ${errorMessage}`, 'error');
            }
            return;
          }

          if (responseUrl) {
            console.log('Final redirect URL:', responseUrl); // Debug log

            // Extract access token from URL fragment (Pushbullet returns it in the hash)
            const url = new URL(responseUrl);
            const hashParams = new URLSearchParams(url.hash.substring(1));
            const accessToken = hashParams.get('access_token');

            // Also check query params for errors
            const queryParams = new URLSearchParams(url.search);
            const error = queryParams.get('error') || hashParams.get('error');

            if (accessToken) {
              console.log('Access token retrieved successfully');
              // Fill in the access token field
              accessTokenInput.value = accessToken;
              accessTokenInput.type = 'text';
              accessTokenInput.dataset.hasToken = 'false';

              // Enable the retrieve devices button
              retrieveDevicesButton.disabled = false;
            } else if (error) {
              // Handle OAuth error
              const errorPrefix = window.CustomI18n.getMessage('oauth_error') || 'OAuth error:';
              showStatus(`${errorPrefix} ${error}`, 'error');
            } else {
              console.warn('No access token found in response URL');
              showStatus('Failed to retrieve access token', 'error');
            }
          } else {
            console.warn('Authorization flow cancelled or failed.');
          }
        }
      );
    });
  }

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
  saveSettingsButton.addEventListener('click', async function() {
    // Handle access token - only update if user entered a new one
    let accessTokenToSave;
    if (accessTokenInput.value.trim()) {
      // User entered a new token
      accessTokenToSave = accessTokenInput.value.trim();
    } else if (accessTokenInput.dataset.hasToken === 'true') {
      // Keep existing token (don't save empty string)
      const existingData = await new Promise(resolve => {
        chrome.storage.sync.get(['accessToken'], resolve);
      });
      accessTokenToSave = existingData.accessToken || '';
    } else {
      accessTokenToSave = '';
    }

    const selectedRemoteDevices = Array.from(remoteDeviceSelect.selectedOptions)
      .map(option => option.value)
      .filter(value => value)
      .join(',');

    const saveData = {
      // General settings
      accessToken: accessTokenToSave,
      remoteDeviceId: selectedRemoteDevices || '',
      devices: devices,
      people: people,
      onlyBrowserPushes: onlyBrowserPushesCheckbox.checked,
      showOtherDevicePushes: showOtherDevicePushesCheckbox.checked,
      showNoTargetPushes: showNoTargetPushesCheckbox.checked,
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
            encryptionPasswordInput.placeholder = chrome.i18n.getMessage('encryption_password_set_placeholder');
            
            // Notify background about encryption changes
            chrome.runtime.sendMessage({ type: 'encryption_updated' });
          } catch (error) {
            console.error('Failed to derive encryption key:', error);
            showStatus('Encryption setup failed. Please check your password and try again.', 'error');
          }
        } else {
          console.error('User iden not found - please retrieve devices first');
          showStatus('Encryption setup failed. Please retrieve devices and people first.', 'error');
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
      showOtherDevicePushes: saveData.showOtherDevicePushes,
      showNoTargetPushes: saveData.showNoTargetPushes,
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

      // Update access token field display after saving
      if (accessTokenToSave) {
        accessTokenInput.type = 'password';
        accessTokenInput.value = '';
        accessTokenInput.placeholder = chrome.i18n.getMessage('access_token_set_placeholder');
        accessTokenInput.dataset.hasToken = 'true';
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
    // Check if we have a token (either new input or existing stored)
    const hasNewInput = accessTokenInput.value.trim().length > 0;
    const hasStoredToken = accessTokenInput.dataset.hasToken === 'true';
    retrieveDevicesButton.disabled = !hasNewInput && !hasStoredToken;
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
      encryptionPasswordGroup.style.display = 'block';
    } else {
      notificationMirroringToggle.classList.remove('active');
      encryptionPasswordGroup.style.display = 'none';
    }
  }
  
  function updateOnlyBrowserPushesToggleVisual() {
    if (onlyBrowserPushesCheckbox.checked) {
      onlyBrowserPushesToggle.classList.add('active');
    } else {
      onlyBrowserPushesToggle.classList.remove('active');
    }
  }

  function updateShowOtherDevicePushesToggleVisual() {
    if (showOtherDevicePushesCheckbox.checked) {
      showOtherDevicePushesToggle.classList.add('active');
    } else {
      showOtherDevicePushesToggle.classList.remove('active');
    }
  }

  function updateShowNoTargetPushesToggleVisual() {
    if (showNoTargetPushesCheckbox.checked) {
      showNoTargetPushesToggle.classList.add('active');
    } else {
      showNoTargetPushesToggle.classList.remove('active');
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

    // Add new theme class (or nothing for system mode, :root handles it)
    if (mode !== 'system') {
      body.classList.add(`theme-${mode}`);
    }
  }
});