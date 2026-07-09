document.addEventListener('DOMContentLoaded', async function() {
  const accessTokenInput = document.getElementById('accessToken');
  const deviceNameInput = document.getElementById('deviceName');
  const remoteDevicePickerEl = document.getElementById('remoteDevicePicker');
  const saveSettingsButton = document.getElementById('saveSettings');
  const retrieveDevicesButton = document.getElementById('retrieveDevices');
  const saveStatus = document.getElementById('saveStatus');
  const autoOpenLinksCheckbox = document.getElementById('autoOpenLinks');
  const autoOpenLinksToggle = document.getElementById('autoOpenLinksToggle');
  const autoOpenOnResumeCheckbox = document.getElementById('autoOpenOnResume');
  const autoOpenOnResumeToggle = document.getElementById('autoOpenOnResumeToggle');
  const autoOpenOnResumeContainer = document.getElementById('autoOpenOnResumeContainer');
  const hideNotificationOnAutoOpenCheckbox = document.getElementById('hideNotificationOnAutoOpen');
  const hideNotificationOnAutoOpenToggle = document.getElementById('hideNotificationOnAutoOpenToggle');
  const hideNotificationOnAutoOpenContainer = document.getElementById('hideNotificationOnAutoOpenContainer');
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
  const defaultTabGroup = document.getElementById('defaultTabGroup');
  const playSoundOnNotificationCheckbox = document.getElementById('playSoundOnNotification');
  const playSoundOnNotificationToggle = document.getElementById('playSoundOnNotificationToggle');
  const showOsNotificationsCheckbox = document.getElementById('showOsNotifications');
  const showOsNotificationsToggle = document.getElementById('showOsNotificationsToggle');
  const hideBrowserPushesContainer = document.getElementById('hideBrowserPushesContainer');
  const playSoundOnNotificationContainer = document.getElementById('playSoundOnNotificationContainer');
  const otherDevicePickerEl = document.getElementById('otherDevicePicker');
  const otherDeviceListGroup = document.getElementById('otherDeviceListGroup');
  const showPerSendTargetCheckbox = document.getElementById('showPerSendTarget');
  const showPerSendTargetToggle = document.getElementById('showPerSendTargetToggle');

  // Tab elements
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  // Inline device checklists — same row/checkmark language as the popup's
  // target menu. The top "All …" row is the empty selection ([] = all);
  // toggling never closes anything, and state only persists on Save.
  const DEVICE_CHECK_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/></svg>';

  function createDeviceChecklist(container, getAllLabel, getEmptyLabel) {
    let devices = [];
    let selected = [];

    function deviceLabel(device) {
      return device.nickname || `${device.manufacturer} ${device.model}`;
    }

    function createOption(iden, label) {
      const option = document.createElement('button');
      option.className = 'list-option';
      option.type = 'button';
      option.dataset.iden = iden;
      option.title = label;
      if (iden) {
        // device rows are independent toggles → leading checkbox
        const checkbox = document.createElement('span');
        checkbox.className = 'opt-checkbox';
        checkbox.innerHTML = DEVICE_CHECK_SVG;
        option.appendChild(checkbox);
      }
      const text = document.createElement('span');
      text.className = 'opt-text';
      text.textContent = label;
      option.appendChild(text);
      if (!iden) {
        // the "All …" row is a single current-state choice → trailing ✓
        const check = document.createElement('span');
        check.className = 'opt-check';
        check.innerHTML = DEVICE_CHECK_SVG;
        option.appendChild(check);
      }
      return option;
    }

    function markSelection() {
      container.querySelectorAll('.list-option').forEach(option => {
        const iden = option.dataset.iden;
        option.classList.toggle('selected', iden ? selected.includes(iden) : selected.length === 0);
      });
    }

    function render() {
      // No devices retrieved yet — show a hint in an empty well instead of
      // a misleadingly selected "All …" row over nothing.
      container.classList.toggle('empty', devices.length === 0);
      if (devices.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'list-empty';
        empty.textContent = getEmptyLabel();
        container.replaceChildren(empty);
        return;
      }
      const fragment = document.createDocumentFragment();
      fragment.appendChild(createOption('', getAllLabel()));
      const divider = document.createElement('div');
      divider.className = 'list-divider';
      fragment.appendChild(divider);
      devices.forEach(device => {
        fragment.appendChild(createOption(device.iden, deviceLabel(device)));
      });
      container.replaceChildren(fragment);
      markSelection();
    }

    container.addEventListener('click', function(e) {
      const option = e.target.closest('.list-option');
      if (!option) return;
      const iden = option.dataset.iden;
      if (!iden) {
        selected = [];
      } else {
        const index = selected.indexOf(iden);
        if (index === -1) {
          selected.push(iden);
        } else {
          selected.splice(index, 1);
        }
      }
      markSelection();
    });

    return {
      setDevices: function(list) {
        devices = list;
        // keep only selections that still point at an existing device
        selected = selected.filter(iden => devices.some(device => device.iden === iden));
        render();
      },
      setSelected: function(ids) {
        selected = ids.filter(iden => devices.some(device => device.iden === iden));
        markSelection();
      },
      getSelected: function() {
        return selected.slice();
      },
      getDeviceCount: function() {
        return devices.length;
      },
      rerender: render
    };
  }

  const remoteDevicePicker = createDeviceChecklist(
    remoteDevicePickerEl,
    () => window.CustomI18n.getMessage('all_devices'),
    () => window.CustomI18n.getMessage('retrieve_devices_first')
  );
  const otherDevicePicker = createDeviceChecklist(
    otherDevicePickerEl,
    () => window.CustomI18n.getMessage('all_other_devices'),
    () => window.CustomI18n.getMessage('no_devices_yet')
  );

  // Shared row builder for the value-based lists below (same .list-option
  // row + checkmark the device checklists use). label may be a string or a
  // function (for i18n-dependent labels, re-resolved on rerender).
  function itemLabel(item) {
    return typeof item.label === 'function' ? item.label() : item.label;
  }

  function createValueOption(value, labelText) {
    const option = document.createElement('button');
    option.className = 'list-option';
    option.type = 'button';
    option.dataset.value = value;
    option.title = labelText;
    const text = document.createElement('span');
    text.className = 'opt-text';
    text.textContent = labelText;
    option.appendChild(text);
    const check = document.createElement('span');
    check.className = 'opt-check';
    check.innerHTML = DEVICE_CHECK_SVG;
    option.appendChild(check);
    return option;
  }

  // Always-visible single-select list (used by the language picker)
  function createSingleSelectList(container, items) {
    let value = items.length ? items[0].value : '';

    function markSelection() {
      container.querySelectorAll('.list-option').forEach(option => {
        option.classList.toggle('selected', option.dataset.value === value);
      });
    }

    function render() {
      const fragment = document.createDocumentFragment();
      items.forEach(item => {
        fragment.appendChild(createValueOption(item.value, itemLabel(item)));
      });
      container.replaceChildren(fragment);
      markSelection();
    }

    container.addEventListener('click', function(e) {
      const option = e.target.closest('.list-option');
      if (!option) return;
      value = option.dataset.value;
      markSelection();
    });

    render();

    return {
      getValue: function() { return value; },
      setValue: function(v) {
        if (items.some(item => item.value === v)) {
          value = v;
        }
        markSelection();
      },
      rerender: render,
      revealSelected: function() {
        const selectedOption = container.querySelector('.list-option.selected');
        if (selectedOption) {
          selectedOption.scrollIntoView({ block: 'nearest' });
        }
      }
    };
  }

  // Single-select dropdown: a rounded trigger styled like the inputs, opening
  // a device-list-styled menu. opensUp avoids the container's overflow:hidden
  // clipping for controls near the bottom of a tab.
  const DROPDOWN_CARET_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"/></svg>';

  function createSelectDropdown(container, items, config) {
    let value = items.length ? items[0].value : '';

    container.classList.add('dropdown');
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'dropdown-trigger';
    const labelSpan = document.createElement('span');
    labelSpan.className = 'dropdown-label';
    trigger.appendChild(labelSpan);
    const caret = document.createElement('span');
    caret.className = 'dropdown-caret';
    caret.innerHTML = DROPDOWN_CARET_SVG;
    trigger.appendChild(caret);
    const menu = document.createElement('div');
    menu.className = `device-list dropdown-menu ${config && config.opensUp ? 'opens-up' : 'opens-down'}`;
    menu.hidden = true;
    container.appendChild(trigger);
    container.appendChild(menu);

    function renderLabel() {
      const current = items.find(item => item.value === value) || items[0];
      labelSpan.textContent = current ? itemLabel(current) : '';
    }

    function renderMenu() {
      const fragment = document.createDocumentFragment();
      items.forEach(item => {
        const option = createValueOption(item.value, itemLabel(item));
        option.classList.toggle('selected', item.value === value);
        fragment.appendChild(option);
      });
      menu.replaceChildren(fragment);
    }

    function closeMenu() {
      menu.hidden = true;
      container.classList.remove('open');
    }

    trigger.addEventListener('click', function() {
      if (menu.hidden) {
        renderMenu();
        menu.hidden = false;
        container.classList.add('open');
      } else {
        closeMenu();
      }
    });

    menu.addEventListener('click', function(e) {
      const option = e.target.closest('.list-option');
      if (!option) return;
      value = option.dataset.value;
      renderLabel();
      closeMenu();
      if (config && config.onChange) {
        config.onChange(value);
      }
    });

    document.addEventListener('click', function(e) {
      if (!menu.hidden && !container.contains(e.target)) {
        closeMenu();
      }
    });

    renderLabel();

    return {
      getValue: function() { return value; },
      setValue: function(v) {
        if (items.some(item => item.value === v)) {
          value = v;
        }
        renderLabel();
      },
      rerender: renderLabel
    };
  }

  // Native option labels carried over verbatim; 'auto' tracks the UI language
  const LANGUAGE_OPTIONS = [
    { value: 'auto', label: () => window.CustomI18n.getMessage('auto_browser_language') },
    { value: 'id', label: 'Bahasa Indonesia' },
    { value: 'de', label: 'Deutsch' },
    { value: 'en', label: 'English' },
    { value: 'fr', label: 'français' },
    { value: 'nl', label: 'nederlands' },
    { value: 'no', label: 'norsk' },
    { value: 'tr', label: 'türkçe' },
    { value: 'ca', label: 'català' },
    { value: 'da', label: 'dansk' },
    { value: 'es', label: 'español' },
    { value: 'it', label: 'italiano' },
    { value: 'hu', label: 'magyar' },
    { value: 'pl', label: 'polski' },
    { value: 'pt_BR', label: 'português (Brasil)' },
    { value: 'pt_PT', label: 'português (Portugal)' },
    { value: 'ro', label: 'română' },
    { value: 'sk', label: 'slovenčina' },
    { value: 'sl', label: 'slovenščina' },
    { value: 'fi', label: 'suomi' },
    { value: 'sv', label: 'svenska' },
    { value: 'bg', label: 'български' },
    { value: 'ru', label: 'русский' },
    { value: 'he', label: 'עברית' },
    { value: 'th', label: 'ไทย' },
    { value: 'ar', label: 'العربية' },
    { value: 'zh_CN', label: '中文（简体）' },
    { value: 'zh_TW', label: '中文（繁體）' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어' },
    { value: 'cs', label: 'čeština' },
    { value: 'el', label: 'ελληνικά' },
    { value: 'uk', label: 'українська' },
    { value: 'vi', label: 'tiếng Việt' }
  ];

  const languageList = createSingleSelectList(document.getElementById('languageList'), LANGUAGE_OPTIONS);
  const defaultTabDropdown = createSelectDropdown(document.getElementById('defaultTabDropdown'), [
    { value: 'push', label: () => window.CustomI18n.getMessage('push_button') },
    { value: 'notification', label: () => window.CustomI18n.getMessage('notification_button') }
  ]);
  const colorModeDropdown = createSelectDropdown(document.getElementById('colorModeDropdown'), [
    { value: 'system', label: () => window.CustomI18n.getMessage('follow_system') },
    { value: 'light', label: () => window.CustomI18n.getMessage('light') },
    { value: 'dark', label: () => window.CustomI18n.getMessage('dark') }
  ], { onChange: applyColorMode, opensUp: true });
  
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
    chrome.storage.sync.get(['accessToken', 'userIden'], resolve);
  });
  const localData = await new Promise(resolve => {
    chrome.storage.local.get(['devices','deviceName', 'people', 'remoteDeviceId', 'showPerSendTarget', 'autoOpenLinks', 'autoOpenOnResume', 'hideNotificationOnAutoOpen', 'notificationMirroring', 'onlyBrowserPushes', 'showOtherDevicePushes', 'showNoTargetPushes', 'hideBrowserPushes', 'showSmsShortcut', 'showQuickShare', 'requireInteraction', 'requireInteractionPushes', 'requireInteractionMirrored', 'closeAsDismiss', 'displayUnreadCounts', 'displayUnreadPushes', 'displayUnreadMirrored', 'colorMode', 'languageMode', 'defaultTab', 'playSoundOnNotification', 'showOsNotifications', 'selectedOtherDeviceIds'], resolve);
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
    if (!data.deviceName) {
       data.deviceName="Chrome";
    }
    if (data.deviceName) {
      deviceNameInput.value = data.deviceName;
    }
    
    if (data.remoteDeviceId) {
      remoteDevicePicker.setSelected(data.remoteDeviceId.split(',').map(id => id.trim()).filter(id => id));
    }

    // Load per-send target selector setting (default is true/on)
    showPerSendTargetCheckbox.checked = data.showPerSendTarget !== false; // Default to true
    updateShowPerSendTargetToggleVisual();

    // Load auto-open links setting (default is false/off)
    autoOpenLinksCheckbox.checked = data.autoOpenLinks || false;
    updateToggleVisual();
    
    // Load auto-open on resume setting (default is false/off)
    autoOpenOnResumeCheckbox.checked = data.autoOpenOnResume || false;
    updateAutoOpenOnResumeToggleVisual();

    // Load hide notification on auto-open setting (default is false/off)
    hideNotificationOnAutoOpenCheckbox.checked = data.hideNotificationOnAutoOpen || false;
    updateHideNotificationOnAutoOpenToggleVisual();

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

    // Load other device selections ('' or unset means all other devices,
    // which the checklist shows as its selected "All other devices" row)
    if (data.selectedOtherDeviceIds !== undefined && data.selectedOtherDeviceIds !== '') {
      otherDevicePicker.setSelected(data.selectedOtherDeviceIds.split(',').map(id => id.trim()).filter(id => id));
    }
    // Show/hide other device list based on toggle state
    updateOtherDeviceListVisibility();

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
    languageList.setValue(data.languageMode || 'auto');

    // Load color mode setting (default is 'system')
    colorModeDropdown.setValue(data.colorMode || 'system');
    applyColorMode(colorModeDropdown.getValue());

    // Load default tab setting (default is 'push')
    defaultTabDropdown.setValue(data.defaultTab || 'push');
    
    // Load play sound on notification setting (default is true/enabled)
    playSoundOnNotificationCheckbox.checked = data.playSoundOnNotification !== false; // Default to true
    updatePlaySoundOnNotificationToggleVisual();

    // Load show OS notifications master setting (default is true/on)
    showOsNotificationsCheckbox.checked = data.showOsNotifications !== false; // Default to true
    updateShowOsNotificationsToggleVisual();
    updateShowOsNotificationsVisibility();
    
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

  hideNotificationOnAutoOpenToggle.addEventListener('click', function() {
    hideNotificationOnAutoOpenCheckbox.checked = !hideNotificationOnAutoOpenCheckbox.checked;
    updateHideNotificationOnAutoOpenToggleVisual();
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

  showPerSendTargetToggle.addEventListener('click', function() {
    showPerSendTargetCheckbox.checked = !showPerSendTargetCheckbox.checked;
    updateShowPerSendTargetToggleVisual();
  });

  onlyBrowserPushesToggle.addEventListener('click', function() {
    onlyBrowserPushesCheckbox.checked = !onlyBrowserPushesCheckbox.checked;
    updateOnlyBrowserPushesToggleVisual();
  });

  showOtherDevicePushesToggle.addEventListener('click', function() {
    showOtherDevicePushesCheckbox.checked = !showOtherDevicePushesCheckbox.checked;
    updateShowOtherDevicePushesToggleVisual();
    updateOtherDeviceListVisibility();
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

  showOsNotificationsToggle.addEventListener('click', function() {
    showOsNotificationsCheckbox.checked = !showOsNotificationsCheckbox.checked;
    updateShowOsNotificationsToggleVisual();
    updateShowOsNotificationsVisibility();
  });

  // Resolve the account iden behind an access token via /v2/users/me. The
  // encryption key is stored and derived per account iden, so userIden must
  // only be saved alongside a token confirmed to belong to that account.
  // Returns { status: 'ok', iden }, { status: 'invalid' } when the API
  // rejects the token, or { status: 'error' } when validity is unknown.
  async function fetchUserIden(accessToken) {
    try {
      const response = await fetch('https://api.pushbullet.com/v2/users/me', {
        headers: {
          'Access-Token': accessToken
        },
        // A 401 here carries a WWW-Authenticate challenge; without this the
        // browser pops its native sign-in dialog on top of the options page.
        credentials: 'omit'
      });
      if (response.ok) {
        const user = await response.json();
        if (user.iden) {
          return { status: 'ok', iden: user.iden };
        }
        return { status: 'error' };
      }
      if (response.status === 401) {
        return { status: 'invalid' };
      }
      console.warn('Failed to fetch user info:', response.status, response.statusText);
      return { status: 'error' };
    } catch (error) {
      console.error('Error fetching user info:', error);
      return { status: 'error' };
    }
  }

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
        },
        credentials: 'omit'
      });
      
      if (!devicesResponse.ok) {
        throw new Error(window.CustomI18n.getMessage('retrieve_failed'));
      }
      
      const devicesData = await devicesResponse.json();
      devices = devicesData.devices || [];
      
      // Check if there's a Chrome device, if not create one
      let hasChromeDevice = devices.some(device => device.type === 'chrome');
      let deviceName=deviceNameInput.value;
      if (deviceName==''){
         deviceName="Chrome";
      }
      hasChromeDevice = devices.some(device => device.nickname === deviceName);
      if (!hasChromeDevice) {
        console.log('No Chrome device found, creating one...');
        const createDeviceResponse = await fetch('https://api.pushbullet.com/v2/devices', {
          method: 'POST',
          headers: {
            'Access-Token': accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            nickname: deviceName,
            type: 'chrome',
            model: 'Chrome'
          }),
          credentials: 'omit'
        });
        
        if (createDeviceResponse.ok) {
          console.log('Chrome device created successfully');
          // Re-fetch devices to get the complete updated list
          const updatedDevicesResponse = await fetch('https://api.pushbullet.com/v2/devices', {
            headers: {
              'Access-Token': accessToken
            },
            credentials: 'omit'
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
        },
        credentials: 'omit'
      });
      
      if (!chatsResponse.ok) {
        throw new Error(window.CustomI18n.getMessage('retrieve_failed'));
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
      const userInfo = await fetchUserIden(accessToken);
      
      // Save Chrome device ID to local storage for reference
      const chromeDevice = devices.find(device => device.active && device.pushable !== false && device.type === 'chrome');
      const chromeDeviceId = chromeDevice ? chromeDevice.iden : null;
      
      // Save the access token (and userIden for encryption) to sync first, on
      // its own, so it persists even if a later write fails. The device and
      // people lists go to local storage: sync caps each item at 8KB
      // (QUOTA_BYTES_PER_ITEM), which the devices array can exceed.
      const syncData = { accessToken: accessToken };
      if (userInfo.status === 'ok') {
        syncData.userIden = userInfo.iden;
      }
      await chrome.storage.sync.set(syncData);
      if (userInfo.status !== 'ok') {
        // A stale iden would pair this token with another account's encryption
        // key, so drop it when the account can't be confirmed.
        await chrome.storage.sync.remove('userIden');
      }
      await chrome.storage.local.set({ devices: devices, people: people, chromeDeviceId: chromeDeviceId });

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
          },
          credentials: 'omit'
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
      showStatus(error.message, 'error');
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
              // Automatically retrieve devices and people after OAuth succeeds
              retrieveDevicesButton.click();
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

      // Scroll the language list to the active language once it's visible
      if (targetTab === 'appearance') {
        languageList.revealSelected();
      }
    });
  });

  // Save All Settings
  saveSettingsButton.addEventListener('click', async function() {
    // Handle access token - only update if user entered a new one
    let accessTokenToSave;
    let userIdenToSave = null;
    let dropUserIden = false;
    if (accessTokenInput.value.trim()) {
      // User entered a new token
      accessTokenToSave = accessTokenInput.value.trim();
      // Keep userIden paired with the account this token belongs to (see
      // fetchUserIden); a stale iden would load another account's encryption key
      const userInfo = await fetchUserIden(accessTokenToSave);
      if (userInfo.status === 'invalid') {
        showStatus(window.CustomI18n.getMessage('invalid_token'), 'error');
        return;
      }
      if (userInfo.status === 'ok') {
        userIdenToSave = userInfo.iden;
      } else {
        dropUserIden = true;
      }
    } else if (accessTokenInput.dataset.hasToken === 'true') {
      // Keep existing token (don't save empty string)
      const existingData = await new Promise(resolve => {
        chrome.storage.sync.get(['accessToken'], resolve);
      });
      accessTokenToSave = existingData.accessToken || '';
    } else {
      accessTokenToSave = '';
    }

    const selectedRemoteDevices = remoteDevicePicker.getSelected().join(',');

    const saveData = {
      // General settings
      accessToken: accessTokenToSave,
      remoteDeviceId: selectedRemoteDevices || '',
      devices: devices,
      deviceName: deviceNameInput.value,
      people: people,
      showPerSendTarget: showPerSendTargetCheckbox.checked,
      onlyBrowserPushes: onlyBrowserPushesCheckbox.checked,
      showOtherDevicePushes: showOtherDevicePushesCheckbox.checked,
      selectedOtherDeviceIds: getSelectedOtherDeviceIds(),
      showNoTargetPushes: showNoTargetPushesCheckbox.checked,
      hideBrowserPushes: hideBrowserPushesCheckbox.checked,
      autoOpenLinks: autoOpenLinksCheckbox.checked,
      autoOpenOnResume: autoOpenOnResumeCheckbox.checked,
      hideNotificationOnAutoOpen: hideNotificationOnAutoOpenCheckbox.checked,
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
      languageMode: languageList.getValue(),
      colorMode: colorModeDropdown.getValue(),
      defaultTab: defaultTabDropdown.getValue(),
      playSoundOnNotification: playSoundOnNotificationCheckbox.checked,
      showOsNotifications: showOsNotificationsCheckbox.checked
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
      accessToken: saveData.accessToken
    };
    if (userIdenToSave) {
      syncSaveData.userIden = userIdenToSave;
    }

    if (deviceNameInput.value==''){
       deviceNameInput.value="Chrome";
    }

    const localSaveData = {
      devices: saveData.devices,
      deviceName: deviceNameInput.value,
      people: saveData.people,
      remoteDeviceId: saveData.remoteDeviceId,
      showPerSendTarget: saveData.showPerSendTarget,
      onlyBrowserPushes: saveData.onlyBrowserPushes,
      showOtherDevicePushes: saveData.showOtherDevicePushes,
      selectedOtherDeviceIds: saveData.selectedOtherDeviceIds,
      showNoTargetPushes: saveData.showNoTargetPushes,
      hideBrowserPushes: saveData.hideBrowserPushes,
      autoOpenLinks: saveData.autoOpenLinks,
      autoOpenOnResume: saveData.autoOpenOnResume,
      hideNotificationOnAutoOpen: saveData.hideNotificationOnAutoOpen,
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
      playSoundOnNotification: saveData.playSoundOnNotification,
      showOsNotifications: saveData.showOsNotifications
    };
    
    // Save to both storages
    if (dropUserIden) {
      chrome.storage.sync.remove('userIden');
    }
    chrome.storage.sync.set(syncSaveData);
    chrome.storage.local.set(localSaveData, function() {
      // Check if language has changed
      const oldLanguage = window.CustomI18n.getCurrentLanguage();
      const newLanguage = languageList.getValue();
      
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
    remoteDevicePicker.setDevices(devices.filter(device => device.active && device.pushable !== false));

    // Also populate the other device list
    populateOtherDeviceSelect();
  }

  function populateOtherDeviceSelect() {
    // Filter out Chrome devices and get only active devices
    otherDevicePicker.setDevices(devices.filter(device =>
      device.active && device.pushable !== false && device.type !== 'chrome'
    ));
  }

  function updateOtherDeviceListVisibility() {
    if (showOtherDevicePushesCheckbox.checked) {
      otherDeviceListGroup.style.display = 'block';
    } else {
      otherDeviceListGroup.style.display = 'none';
    }
  }

  function getSelectedOtherDeviceIds() {
    const selected = otherDevicePicker.getSelected();

    // If all selected or none selected, return empty (means all, backward compatible)
    if (selected.length === 0 || selected.length === otherDevicePicker.getDeviceCount()) {
      return '';
    }

    // Return comma-separated IDs
    return selected.join(',');
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

  function updateHideNotificationOnAutoOpenToggleVisual() {
    if (hideNotificationOnAutoOpenCheckbox.checked) {
      hideNotificationOnAutoOpenToggle.classList.add('active');
    } else {
      hideNotificationOnAutoOpenToggle.classList.remove('active');
    }
  }

  function updateAutoOpenOnResumeVisibility() {
    if (autoOpenLinksCheckbox.checked) {
      autoOpenOnResumeContainer.style.display = 'flex';
      hideNotificationOnAutoOpenContainer.style.display = 'flex';
    } else {
      autoOpenOnResumeContainer.style.display = 'none';
      hideNotificationOnAutoOpenContainer.style.display = 'none';
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
  
  function updateShowPerSendTargetToggleVisual() {
    if (showPerSendTargetCheckbox.checked) {
      showPerSendTargetToggle.classList.add('active');
    } else {
      showPerSendTargetToggle.classList.remove('active');
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

  function updateShowOsNotificationsToggleVisual() {
    if (showOsNotificationsCheckbox.checked) {
      showOsNotificationsToggle.classList.add('active');
    } else {
      showOsNotificationsToggle.classList.remove('active');
    }
  }

  function updateShowOsNotificationsVisibility() {
    if (showOsNotificationsCheckbox.checked) {
      hideBrowserPushesContainer.style.display = 'flex';
      playSoundOnNotificationContainer.style.display = 'flex';
    } else {
      hideBrowserPushesContainer.style.display = 'none';
      playSoundOnNotificationContainer.style.display = 'none';
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
    
    // Re-render the custom controls whose labels are message-based
    remoteDevicePicker.rerender();
    otherDevicePicker.rerender();
    languageList.rerender();
    defaultTabDropdown.rerender();
    colorModeDropdown.rerender();
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
