document.addEventListener('DOMContentLoaded', async function() {
  const accessTokenInput = document.getElementById('accessToken');
  const remoteDevicePickerEl = document.getElementById('remoteDevicePicker');
  const saveSettingsButton = document.getElementById('saveSettings');
  const retrieveDevicesButton = document.getElementById('retrieveDevices');
  const saveStatus = document.getElementById('saveStatus');
  const autoOpenLinksCheckbox = document.getElementById('autoOpenLinks');
  const autoOpenLinksToggle = document.getElementById('autoOpenLinksToggle');
  const autoOpenFilesCheckbox = document.getElementById('autoOpenFiles');
  const autoOpenFilesToggle = document.getElementById('autoOpenFilesToggle');
  const autoOpenFilesContainer = document.getElementById('autoOpenFilesContainer');
  const autoOpenOnResumeCheckbox = document.getElementById('autoOpenOnResume');
  const autoOpenOnResumeToggle = document.getElementById('autoOpenOnResumeToggle');
  const autoOpenOnResumeContainer = document.getElementById('autoOpenOnResumeContainer');
  const hideNotificationOnAutoOpenCheckbox = document.getElementById('hideNotificationOnAutoOpen');
  const hideNotificationOnAutoOpenToggle = document.getElementById('hideNotificationOnAutoOpenToggle');
  const hideNotificationOnAutoOpenContainer = document.getElementById('hideNotificationOnAutoOpenContainer');
  const autoOpenLinksFromPeopleCheckbox = document.getElementById('autoOpenLinksFromPeople');
  const autoOpenLinksFromPeopleToggle = document.getElementById('autoOpenLinksFromPeopleToggle');
  const autoOpenLinksFromPeopleContainer = document.getElementById('autoOpenLinksFromPeopleContainer');
  const trustedPeoplePickerEl = document.getElementById('trustedPeoplePicker');
  const trustedPeopleGroup = document.getElementById('trustedPeopleGroup');
  const autoOpenTabActiveCheckbox = document.getElementById('autoOpenTabActive');
  const autoOpenTabActiveToggle = document.getElementById('autoOpenTabActiveToggle');
  const autoOpenTabActiveContainer = document.getElementById('autoOpenTabActiveContainer');
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
  const enableChatCheckbox = document.getElementById('enableChat');
  const enableChatToggle = document.getElementById('enableChatToggle');
  // Retrieve-then-Save on a freshly loaded page must not write the checkbox's
  // pre-seed unchecked state back as an explicit false (see the Retrieve
  // success path, which mirrors the background's one-time seeding in-page).
  let enableChatWasUndefined = false;
  let enableChatTouched = false;
  const showQuickShareCheckbox = document.getElementById('showQuickShare');
  const showQuickShareToggle = document.getElementById('showQuickShareToggle');
  const requireInteractionCheckbox = document.getElementById('requireInteraction');
  const requireInteractionToggle = document.getElementById('requireInteractionToggle');
  const requireInteractionContainer = document.getElementById('requireInteractionContainer');
  const requireInteractionPushesCheckbox = document.getElementById('requireInteractionPushes');
  const requireInteractionPushesToggle = document.getElementById('requireInteractionPushesToggle');
  const requireInteractionPushesContainer = document.getElementById('requireInteractionPushesContainer');
  const requireInteractionMirroredCheckbox = document.getElementById('requireInteractionMirrored');
  const requireInteractionMirroredToggle = document.getElementById('requireInteractionMirroredToggle');
  const requireInteractionMirroredContainer = document.getElementById('requireInteractionMirroredContainer');
  const requireInteractionChatsCheckbox = document.getElementById('requireInteractionChats');
  const requireInteractionChatsToggle = document.getElementById('requireInteractionChatsToggle');
  const requireInteractionChatsContainer = document.getElementById('requireInteractionChatsContainer');
  const closeAsDismissCheckbox = document.getElementById('closeAsDismiss');
  const closeAsDismissToggle = document.getElementById('closeAsDismissToggle');
  const closeAsDismissContainer = document.getElementById('closeAsDismissContainer');
  const displayUnreadCountsCheckbox = document.getElementById('displayUnreadCounts');
  const displayUnreadCountsToggle = document.getElementById('displayUnreadCountsToggle');
  const displayUnreadPushesCheckbox = document.getElementById('displayUnreadPushes');
  const displayUnreadPushesToggle = document.getElementById('displayUnreadPushesToggle');
  const displayUnreadPushesContainer = document.getElementById('displayUnreadPushesContainer');
  const displayUnreadMirroredCheckbox = document.getElementById('displayUnreadMirrored');
  const displayUnreadMirroredToggle = document.getElementById('displayUnreadMirroredToggle');
  const displayUnreadMirroredContainer = document.getElementById('displayUnreadMirroredContainer');
  const displayUnreadChatsCheckbox = document.getElementById('displayUnreadChats');
  const displayUnreadChatsToggle = document.getElementById('displayUnreadChatsToggle');
  const displayUnreadChatsContainer = document.getElementById('displayUnreadChatsContainer');
  const encryptionPasswordInput = document.getElementById('encryptionPassword');
  const encryptionPasswordGroup = document.getElementById('encryptionPasswordGroup');
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
  const enableContextMenuCheckbox = document.getElementById('enableContextMenu');
  const enableContextMenuToggle = document.getElementById('enableContextMenuToggle');

  // Tab elements
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  // Inline device checklists — same row/checkmark language as the popup's
  // target menu. The top "All …" row is the empty selection ([] = all);
  // toggling never closes anything, and state only persists on Save.
  const DEVICE_CHECK_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/></svg>';
  const PENCIL_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/></svg>';

  // renameable (device pickers only) adds a hover-reveal pencil to each device
  // row for inline rename; the trusted-people picker passes it falsy (people
  // aren't renamable). The pencil and its editor are interactive, so renameable
  // rows are a <div role="button"> — nesting them inside the row's native
  // <button> is invalid HTML and swallows their clicks.
  // sublabelOf (trusted-people picker only) supplies a muted secondary string
  // (the person's email) rendered inline after the label so near-identical
  // names stay distinguishable; other pickers leave it undefined → no subtext.
  function createDeviceChecklist(container, getAllLabel, getEmptyLabel, labelOf, renameable, sublabelOf) {
    let devices = [];
    let selected = [];

    function deviceLabel(device) {
      // labelOf lets a non-device list (the trusted-people picker) supply its
      // own label; device pickers pass none and keep the nickname/model form.
      if (labelOf) return labelOf(device);
      return device.nickname || `${device.manufacturer} ${device.model}`;
    }

    function deviceSublabel(device) {
      // Only the trusted-people picker supplies this; every other picker leaves
      // sublabelOf undefined, so device rows never gain a subtext.
      return sublabelOf ? sublabelOf(device) : '';
    }

    function createOption(iden, label, sublabel) {
      // Only device rows (iden set) in a renameable picker carry the pencil +
      // inline editor, so those become a <div role="button">; the "All …" row
      // and every non-renameable picker keep the native <button>.
      const isRenameRow = Boolean(renameable && iden);
      const option = document.createElement(isRenameRow ? 'div' : 'button');
      option.className = 'list-option';
      if (isRenameRow) {
        option.setAttribute('role', 'button');
        option.tabIndex = 0;
        option.addEventListener('keydown', function(e) {
          // Restore the native button's Space/Enter activation; the editor's
          // own keydown stops propagation, so it never reaches this handler.
          if (e.target === option && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            option.click();
          }
        });
      } else {
        option.type = 'button';
      }
      option.dataset.iden = iden;
      // With a subtext, the tooltip carries both halves at full length
      // ("Name — email") since either can ellipsize on the row.
      option.title = sublabel ? `${label} — ${sublabel}` : label;
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
      if (sublabel) {
        // Muted email line on the same row (people picker only); has-subtext
        // lets the label yield width to it. Never present on device/"All …"
        // rows, so their layout is untouched.
        option.classList.add('has-subtext');
        const subtext = document.createElement('span');
        subtext.className = 'opt-subtext';
        subtext.textContent = sublabel;
        option.appendChild(subtext);
      }
      if (!iden) {
        // the "All …" row is a single current-state choice → trailing ✓
        const check = document.createElement('span');
        check.className = 'opt-check';
        check.innerHTML = DEVICE_CHECK_SVG;
        option.appendChild(check);
      }
      if (isRenameRow) {
        const pencil = document.createElement('button');
        pencil.type = 'button';
        pencil.className = 'opt-pencil';
        pencil.title = window.CustomI18n.getMessage('rename_device_title');
        pencil.innerHTML = PENCIL_SVG;
        pencil.addEventListener('click', function(e) {
          e.stopPropagation(); // never toggle the row's selection
          beginRename(iden, text, pencil);
        });
        option.appendChild(pencil);
      }
      return option;
    }

    // Swap a device row's label for a compact inline editor. Enter saves via the
    // API; Escape, blur, or an empty/unchanged value cancels. A successful save
    // re-renders the whole list; a failed one silently restores the old label
    // (same optimistic-revert stance as the chat mute bell).
    function beginRename(iden, textSpan, pencil) {
      const currentLabel = textSpan.textContent;
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'opt-rename-input';
      input.value = currentLabel;
      let done = false;

      function restore() {
        input.replaceWith(textSpan);
        pencil.style.display = '';
      }

      function cancel() {
        if (done) return;
        done = true;
        restore();
      }

      async function commit() {
        if (done) return;
        const nickname = input.value.trim();
        if (!nickname || nickname === currentLabel) {
          cancel();
          return;
        }
        done = true; // stop the disable-triggered blur / stray Escape from firing
        input.disabled = true;
        const ok = await renameDevice(iden, nickname);
        // On success renameDevice re-rendered the list and detached this input;
        // on failure quietly fall back to the previous label.
        if (!ok) restore();
      }

      input.addEventListener('keydown', function(e) {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancel();
        }
      });
      input.addEventListener('blur', cancel);
      input.addEventListener('click', function(e) { e.stopPropagation(); });

      pencil.style.display = 'none';
      textSpan.replaceWith(input);
      input.focus();
      input.select();
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
      // A null getAllLabel means explicit selection with no "All …" row (the
      // trusted-people picker: only checked rows count, empty selection = no one).
      if (getAllLabel) {
        fragment.appendChild(createOption('', getAllLabel()));
        const divider = document.createElement('div');
        divider.className = 'list-divider';
        fragment.appendChild(divider);
      }
      devices.forEach(device => {
        fragment.appendChild(createOption(device.iden, deviceLabel(device), deviceSublabel(device)));
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
    () => window.CustomI18n.getMessage('retrieve_devices_first'),
    undefined,
    true
  );
  const otherDevicePicker = createDeviceChecklist(
    otherDevicePickerEl,
    () => window.CustomI18n.getMessage('all_other_devices'),
    () => window.CustomI18n.getMessage('no_devices_yet'),
    undefined,
    true
  );
  // Trusted-people checklist for auto-open (issue #66). No "All …" row: the plan
  // requires explicit selection (only checked people auto-open), keyed by
  // email_normalized. The empty hint reuses the primary device list's key since
  // people are populated by the same "Retrieve devices and people" button.
  // The row label is the person's name (email for nameless contacts); a muted
  // subtext repeats their normalized email so two similar names stay apart.
  const personDisplayLabel = person => person.name || person.email || person.email_normalized;
  const trustedPeoplePicker = createDeviceChecklist(
    trustedPeoplePickerEl,
    null,
    () => window.CustomI18n.getMessage('retrieve_devices_first'),
    personDisplayLabel,
    false,
    person => {
      const email = person.email_normalized;
      if (!email) return '';
      // Suppress the subtext for email-only contacts whose name already IS that
      // email (case-only differences included) — no point showing it twice.
      return personDisplayLabel(person).toLowerCase() === email.toLowerCase() ? '' : email;
    }
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

    // The value shown as selected: the stored value when its option is
    // present, otherwise the first option (the fallback surface — e.g. Push
    // when a saved 'notification' default is hidden because mirroring is off).
    // The stored value itself is never rewritten here; getValue still returns it.
    function effectiveValue() {
      return items.some(item => item.value === value) ? value : (items[0] ? items[0].value : value);
    }

    function renderMenu() {
      const selectedValue = effectiveValue();
      const fragment = document.createDocumentFragment();
      items.forEach(item => {
        const option = createValueOption(item.value, itemLabel(item));
        option.classList.toggle('selected', item.value === selectedValue);
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
        // Store the desired value even when its option isn't currently shown
        // (a saved default whose surface is disabled): the display falls back
        // to the first option, and the saved choice returns once re-enabled.
        value = v;
        renderLabel();
      },
      setItems: function(newItems) {
        items = newItems;
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
  // Default-tab options track the enabled popup surfaces: Push is always
  // available; Chat while the Chat surface is enabled; Notification while
  // mirroring is on. Rebuilt via updateDefaultTabVisibility() when either
  // surface flips. The saved defaultTab is never rewritten when a surface is
  // disabled.
  function defaultTabItems() {
    const items = [{ value: 'push', label: () => window.CustomI18n.getMessage('push_button') }];
    if (enableChatCheckbox.checked) {
      items.push({ value: 'chat', label: () => window.CustomI18n.getMessage('chat_tab') });
    }
    if (notificationMirroringCheckbox.checked) {
      items.push({ value: 'notification', label: () => window.CustomI18n.getMessage('notification_button') });
    }
    return items;
  }
  const defaultTabDropdown = createSelectDropdown(document.getElementById('defaultTabDropdown'), defaultTabItems());
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
  // Chat surface master (enableChat, Phase 5). Read live from the checkbox so
  // toggling it updates dependent UI (the people auto-open row + trusted
  // checklist, and the default-tab dropdown's Chat option) without a reload.
  function isChatEnabled() {
    return enableChatCheckbox.checked;
  }

  // The Mirrored/Chats sub-switches only participate in the master's
  // auto-disable while their surface is on — a hidden sub must not hold
  // the master hostage. (Auto-ENABLE still seeds all subs: pre-setting a
  // hidden sub just matches the default it will show with later.)
  function applicableRequireInteractionSubs() {
    const subs = [requireInteractionPushesCheckbox];
    if (notificationMirroringCheckbox.checked) subs.push(requireInteractionMirroredCheckbox);
    if (isChatEnabled()) subs.push(requireInteractionChatsCheckbox);
    return subs;
  }
  function applicableDisplayUnreadSubs() {
    const subs = [displayUnreadPushesCheckbox];
    if (notificationMirroringCheckbox.checked) subs.push(displayUnreadMirroredCheckbox);
    if (isChatEnabled()) subs.push(displayUnreadChatsCheckbox);
    return subs;
  }

  // Get data from both sync and local storage
  const syncData = await new Promise(resolve => {
    chrome.storage.sync.get(['accessToken', 'userIden'], resolve);
  });
  const localData = await new Promise(resolve => {
    chrome.storage.local.get(['devices', 'people', 'remoteDeviceId', 'showPerSendTarget', 'enableContextMenu', 'autoOpenLinks', 'autoOpenFiles', 'autoOpenOnResume', 'hideNotificationOnAutoOpen', 'autoOpenLinksFromPeople', 'autoOpenTrustedPeople', 'autoOpenTabActive', 'enableChat', 'notificationMirroring', 'onlyBrowserPushes', 'showOtherDevicePushes', 'showNoTargetPushes', 'hideBrowserPushes', 'showSmsShortcut', 'showQuickShare', 'requireInteraction', 'requireInteractionPushes', 'requireInteractionMirrored', 'requireInteractionChats', 'closeAsDismiss', 'displayUnreadCounts', 'displayUnreadPushes', 'displayUnreadMirrored', 'displayUnreadChats', 'colorMode', 'languageMode', 'defaultTab', 'playSoundOnNotification', 'showOsNotifications', 'selectedOtherDeviceIds'], resolve);
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
    // Chat surface master. undefined = not yet seeded, behaves as off; the
    // background seeds true once people first exist. Set before updateAutoOpen*
    // runs so isChatEnabled() reads the right state during the load pass.
    // Toggling + saving always writes the explicit boolean.
    enableChatCheckbox.checked = data.enableChat === true;
    enableChatWasUndefined = data.enableChat === undefined;
    updateEnableChatToggleVisual();
    populateDeviceSelects();
    
    if (data.remoteDeviceId) {
      remoteDevicePicker.setSelected(data.remoteDeviceId.split(',').map(id => id.trim()).filter(id => id));
    }

    // Load per-send target selector setting (default is true/on)
    showPerSendTargetCheckbox.checked = data.showPerSendTarget !== false; // Default to true
    updateShowPerSendTargetToggleVisual();

    // Load auto-open links setting (default is false/off)
    autoOpenLinksCheckbox.checked = data.autoOpenLinks || false;
    updateToggleVisual();

    // Load auto-open file pushes sub-option (default is false/off)
    autoOpenFilesCheckbox.checked = data.autoOpenFiles === true;
    updateAutoOpenFilesToggleVisual();

    // Load auto-open on resume setting (default is false/off)
    autoOpenOnResumeCheckbox.checked = data.autoOpenOnResume || false;
    updateAutoOpenOnResumeToggleVisual();

    // Load hide notification on auto-open setting (default is false/off)
    hideNotificationOnAutoOpenCheckbox.checked = data.hideNotificationOnAutoOpen || false;
    updateHideNotificationOnAutoOpenToggleVisual();

    // Load auto-open-links-from-people setting (default is false/off) and the
    // trusted-people selection (comma-joined email_normalized; empty = no one).
    autoOpenLinksFromPeopleCheckbox.checked = data.autoOpenLinksFromPeople || false;
    updateAutoOpenLinksFromPeopleToggleVisual();
    if (data.autoOpenTrustedPeople) {
      trustedPeoplePicker.setSelected(data.autoOpenTrustedPeople.split(',').map(e => e.trim()).filter(e => e));
    }

    // Load make-the-new-tab-active sub-option (default is false/off)
    autoOpenTabActiveCheckbox.checked = data.autoOpenTabActive === true;
    updateAutoOpenTabActiveToggleVisual();

    // Show/hide the auto-open sub-options based on auto-open links setting (the
    // people row/checklist additionally require the Chat surface to be enabled)
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
    // Absent = follow the Pushes switch (people-push notifications rode it
    // before the Chats split), so existing setups keep their behavior until
    // the user saves an explicit choice.
    requireInteractionChatsCheckbox.checked = data.requireInteractionChats !== undefined
      ? data.requireInteractionChats
      : (data.requireInteractionPushes || false);
    updateRequireInteractionChatsToggleVisual();

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
    displayUnreadChatsCheckbox.checked = data.displayUnreadChats !== false; // Default to true
    updateDisplayUnreadChatsToggleVisual();

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

    // Load context menu setting (default is true/on)
    enableContextMenuCheckbox.checked = data.enableContextMenu !== false; // Default to true
    updateEnableContextMenuToggleVisual();
    
    // Update conditional visibility for default tab option
    updateDefaultTabVisibility();
    
    // Update conditional visibility for require interaction mirrored option
    updateRequireInteractionMirroredVisibility();

    // Update conditional visibility for require interaction chats option
    updateRequireInteractionChatsVisibility();
    
    // Update conditional visibility for display unread mirrored option
    updateDisplayUnreadMirroredVisibility();

    // Update conditional visibility for display unread chats option
    updateDisplayUnreadChatsVisibility();

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

  autoOpenFilesToggle.addEventListener('click', function() {
    autoOpenFilesCheckbox.checked = !autoOpenFilesCheckbox.checked;
    updateAutoOpenFilesToggleVisual();
  });

  autoOpenOnResumeToggle.addEventListener('click', function() {
    autoOpenOnResumeCheckbox.checked = !autoOpenOnResumeCheckbox.checked;
    updateAutoOpenOnResumeToggleVisual();
  });

  hideNotificationOnAutoOpenToggle.addEventListener('click', function() {
    hideNotificationOnAutoOpenCheckbox.checked = !hideNotificationOnAutoOpenCheckbox.checked;
    updateHideNotificationOnAutoOpenToggleVisual();
  });

  autoOpenLinksFromPeopleToggle.addEventListener('click', function() {
    autoOpenLinksFromPeopleCheckbox.checked = !autoOpenLinksFromPeopleCheckbox.checked;
    updateAutoOpenLinksFromPeopleToggleVisual();
    updateAutoOpenLinksFromPeopleVisibility();
  });

  autoOpenTabActiveToggle.addEventListener('click', function() {
    autoOpenTabActiveCheckbox.checked = !autoOpenTabActiveCheckbox.checked;
    updateAutoOpenTabActiveToggleVisual();
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
      
      // Auto-disable main Display unread counts switch if all sub-switches are off
      if (applicableDisplayUnreadSubs().every(cb => !cb.checked)) {
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

  enableChatToggle.addEventListener('click', function() {
    enableChatTouched = true;
    enableChatCheckbox.checked = !enableChatCheckbox.checked;
    updateEnableChatToggleVisual();
    // Chat is the visibility master for the people auto-open row + trusted list
    // (Behavior), and adds/removes Chat from the default-tab dropdown. It also
    // gates the "↳ Chats" sub-rows under Display unread counts (Appearance)
    // and Require interaction (Behavior).
    updateAutoOpenLinksFromPeopleVisibility();
    updateDefaultTabVisibility();
    updateDisplayUnreadChatsVisibility();
    updateRequireInteractionChatsVisibility();

    // Auto-enable the Chats sub-switch when Chat is enabled while require
    // interaction is on (same pattern as mirroring's Mirrored seeding)
    if (enableChatCheckbox.checked && requireInteractionCheckbox.checked) {
      requireInteractionChatsCheckbox.checked = true;
      updateRequireInteractionChatsToggleVisual();
    }
  });

  showQuickShareToggle.addEventListener('click', function() {
    showQuickShareCheckbox.checked = !showQuickShareCheckbox.checked;
    updateShowQuickShareToggleVisual();
  });

  requireInteractionToggle.addEventListener('click', function() {
    requireInteractionCheckbox.checked = !requireInteractionCheckbox.checked;
    updateRequireInteractionToggleVisual();
    updateRequireInteractionVisibility();
    
    // Auto-enable all sub-switches when main switch is turned on
    if (requireInteractionCheckbox.checked) {
      requireInteractionPushesCheckbox.checked = true;
      updateRequireInteractionPushesToggleVisual();
      requireInteractionMirroredCheckbox.checked = true;
      updateRequireInteractionMirroredToggleVisual();
      requireInteractionChatsCheckbox.checked = true;
      updateRequireInteractionChatsToggleVisual();
    }
  });

  requireInteractionPushesToggle.addEventListener('click', function() {
    requireInteractionPushesCheckbox.checked = !requireInteractionPushesCheckbox.checked;
    updateRequireInteractionPushesToggleVisual();

    // Auto-disable main switch if all sub-switches are off
    if (applicableRequireInteractionSubs().every(cb => !cb.checked)) {
      requireInteractionCheckbox.checked = false;
      updateRequireInteractionToggleVisual();
      updateRequireInteractionVisibility();
    }
  });

  requireInteractionMirroredToggle.addEventListener('click', function() {
    requireInteractionMirroredCheckbox.checked = !requireInteractionMirroredCheckbox.checked;
    updateRequireInteractionMirroredToggleVisual();

    // Auto-disable main switch if all sub-switches are off
    if (applicableRequireInteractionSubs().every(cb => !cb.checked)) {
      requireInteractionCheckbox.checked = false;
      updateRequireInteractionToggleVisual();
      updateRequireInteractionVisibility();
    }
  });

  requireInteractionChatsToggle.addEventListener('click', function() {
    requireInteractionChatsCheckbox.checked = !requireInteractionChatsCheckbox.checked;
    updateRequireInteractionChatsToggleVisual();

    // Auto-disable main switch if all sub-switches are off
    if (applicableRequireInteractionSubs().every(cb => !cb.checked)) {
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

    // Auto-enable the sub-switches when main switch is turned on
    if (displayUnreadCountsCheckbox.checked) {
      displayUnreadPushesCheckbox.checked = true;
      updateDisplayUnreadPushesToggleVisual();
      displayUnreadMirroredCheckbox.checked = true;
      updateDisplayUnreadMirroredToggleVisual();
      displayUnreadChatsCheckbox.checked = true;
      updateDisplayUnreadChatsToggleVisual();
    }

    // Auto-disable main switch if all sub-switches are off
    if (applicableDisplayUnreadSubs().every(cb => !cb.checked)) {
      displayUnreadCountsCheckbox.checked = false;
      updateDisplayUnreadCountsToggleVisual();
      updateDisplayUnreadCountsVisibility();
    }
  });

  displayUnreadPushesToggle.addEventListener('click', function() {
    displayUnreadPushesCheckbox.checked = !displayUnreadPushesCheckbox.checked;
    updateDisplayUnreadPushesToggleVisual();

    // Auto-disable main switch if all sub-switches are off
    if (applicableDisplayUnreadSubs().every(cb => !cb.checked)) {
      displayUnreadCountsCheckbox.checked = false;
      updateDisplayUnreadCountsToggleVisual();
      updateDisplayUnreadCountsVisibility();
    }
  });

  displayUnreadMirroredToggle.addEventListener('click', function() {
    displayUnreadMirroredCheckbox.checked = !displayUnreadMirroredCheckbox.checked;
    updateDisplayUnreadMirroredToggleVisual();

    // Auto-disable main switch if all sub-switches are off
    if (applicableDisplayUnreadSubs().every(cb => !cb.checked)) {
      displayUnreadCountsCheckbox.checked = false;
      updateDisplayUnreadCountsToggleVisual();
      updateDisplayUnreadCountsVisibility();
    }
  });

  displayUnreadChatsToggle.addEventListener('click', function() {
    displayUnreadChatsCheckbox.checked = !displayUnreadChatsCheckbox.checked;
    updateDisplayUnreadChatsToggleVisual();

    // Auto-disable main switch if all sub-switches are off
    if (applicableDisplayUnreadSubs().every(cb => !cb.checked)) {
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

  enableContextMenuToggle.addEventListener('click', function() {
    enableContextMenuCheckbox.checked = !enableContextMenuCheckbox.checked;
    updateEnableContextMenuToggleVisual();
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

  // Trim a chat object to the fields we store per person. Written to
  // storage.local only (never sync), matching background.js.
  // keep in sync with background.js trimChatToPerson
  function trimChatToPerson(chat) {
    return {
      iden: chat.iden,
      type: chat.with.type,
      email: chat.with.email,
      email_normalized: chat.with.email_normalized,
      name: chat.with.name || chat.with.email,
      image_url: chat.with.image_url,
      muted: chat.muted === true
    };
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
      
      // Fetch chats (people). ?active=true asks the server to omit deleted
      // chats; the client-side active filter below stays as belt-and-braces.
      const chatsResponse = await fetch('https://api.pushbullet.com/v2/chats?active=true', {
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
      
      // Filter active chats and trim to the fields we store per person
      people = chats
        .filter(chat => chat.active === true)
        .map(trimChatToPerson);
      
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
      await chrome.storage.local.set({ devices: devices, people: people, chromeDeviceId: chromeDeviceId, lastPeopleFetch: Date.now() });

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
              lastModified: lastModified,
              // Brand-new account: stamp the chat read floor at now so the
              // historical people pushes in this initial fetch never badge
              // (mirrors the background's initializeExtension seed).
              chatReadFloor: Date.now() / 1000
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

      // Mirror the background's one-time enableChat seeding in-page: this
      // checkbox loaded before any people existed, so without this a Save
      // right after Retrieve would write the still-unchecked state back as an
      // explicit false, overriding the seed. Never fires once the stored
      // value is explicit or the user has touched the toggle themselves.
      if (enableChatWasUndefined && !enableChatTouched && people.length > 0 && !enableChatCheckbox.checked) {
        enableChatCheckbox.checked = true;
        enableChatWasUndefined = false;
        updateEnableChatToggleVisual();
        updateAutoOpenLinksFromPeopleVisibility();
        updateDefaultTabVisibility();
        // Keep this visibility set in sync with the enableChatToggle click
        // handler: the "↳ Chats" sub-rows under Display unread counts and
        // Require interaction must appear the moment Chat seeds on, not only
        // after a manual toggle (values are left on their load-time fallbacks,
        // matching the background-seed path).
        updateDisplayUnreadChatsVisibility();
        updateRequireInteractionChatsVisibility();
      }

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
      // devices/people are deliberately NOT saved here: they aren't settings,
      // and every real writer (Retrieve, inline rename, the background
      // refreshers) persists them itself. Writing this page's load-time
      // snapshot would clobber runtime state (mute flags, entry upgrades).
      showPerSendTarget: showPerSendTargetCheckbox.checked,
      onlyBrowserPushes: onlyBrowserPushesCheckbox.checked,
      showOtherDevicePushes: showOtherDevicePushesCheckbox.checked,
      selectedOtherDeviceIds: getSelectedOtherDeviceIds(),
      showNoTargetPushes: showNoTargetPushesCheckbox.checked,
      hideBrowserPushes: hideBrowserPushesCheckbox.checked,
      autoOpenLinks: autoOpenLinksCheckbox.checked,
      autoOpenFiles: autoOpenFilesCheckbox.checked,
      autoOpenOnResume: autoOpenOnResumeCheckbox.checked,
      hideNotificationOnAutoOpen: hideNotificationOnAutoOpenCheckbox.checked,
      autoOpenLinksFromPeople: autoOpenLinksFromPeopleCheckbox.checked,
      autoOpenTrustedPeople: trustedPeoplePicker.getSelected().join(','),
      autoOpenTabActive: autoOpenTabActiveCheckbox.checked,
      // Appearance settings
      notificationMirroring: notificationMirroringCheckbox.checked,
      showSmsShortcut: showSmsShortcutCheckbox.checked,
      enableChat: enableChatCheckbox.checked,
      showQuickShare: showQuickShareCheckbox.checked,
      requireInteraction: requireInteractionCheckbox.checked,
      requireInteractionPushes: requireInteractionPushesCheckbox.checked,
      requireInteractionMirrored: requireInteractionMirroredCheckbox.checked,
      requireInteractionChats: requireInteractionChatsCheckbox.checked,
      closeAsDismiss: closeAsDismissCheckbox.checked,
      displayUnreadCounts: displayUnreadCountsCheckbox.checked,
      displayUnreadPushes: displayUnreadPushesCheckbox.checked,
      displayUnreadMirrored: displayUnreadMirroredCheckbox.checked,
      displayUnreadChats: displayUnreadChatsCheckbox.checked,
      languageMode: languageList.getValue(),
      colorMode: colorModeDropdown.getValue(),
      defaultTab: defaultTabDropdown.getValue(),
      playSoundOnNotification: playSoundOnNotificationCheckbox.checked,
      showOsNotifications: showOsNotificationsCheckbox.checked,
      enableContextMenu: enableContextMenuCheckbox.checked
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


    const localSaveData = {
      remoteDeviceId: saveData.remoteDeviceId,
      showPerSendTarget: saveData.showPerSendTarget,
      onlyBrowserPushes: saveData.onlyBrowserPushes,
      showOtherDevicePushes: saveData.showOtherDevicePushes,
      selectedOtherDeviceIds: saveData.selectedOtherDeviceIds,
      showNoTargetPushes: saveData.showNoTargetPushes,
      hideBrowserPushes: saveData.hideBrowserPushes,
      autoOpenLinks: saveData.autoOpenLinks,
      autoOpenFiles: saveData.autoOpenFiles,
      autoOpenOnResume: saveData.autoOpenOnResume,
      hideNotificationOnAutoOpen: saveData.hideNotificationOnAutoOpen,
      autoOpenLinksFromPeople: saveData.autoOpenLinksFromPeople,
      autoOpenTrustedPeople: saveData.autoOpenTrustedPeople,
      autoOpenTabActive: saveData.autoOpenTabActive,
      notificationMirroring: saveData.notificationMirroring,
      showSmsShortcut: saveData.showSmsShortcut,
      enableChat: saveData.enableChat,
      showQuickShare: saveData.showQuickShare,
      requireInteraction: saveData.requireInteraction,
      requireInteractionPushes: saveData.requireInteractionPushes,
      requireInteractionMirrored: saveData.requireInteractionMirrored,
      requireInteractionChats: saveData.requireInteractionChats,
      closeAsDismiss: saveData.closeAsDismiss,
      displayUnreadCounts: saveData.displayUnreadCounts,
      displayUnreadPushes: saveData.displayUnreadPushes,
      displayUnreadMirrored: saveData.displayUnreadMirrored,
      displayUnreadChats: saveData.displayUnreadChats,
      languageMode: saveData.languageMode,
      colorMode: saveData.colorMode,
      defaultTab: saveData.defaultTab,
      playSoundOnNotification: saveData.playSoundOnNotification,
      showOsNotifications: saveData.showOsNotifications,
      enableContextMenu: saveData.enableContextMenu
    };

    // enableChat is only persisted once it means something: the user touched
    // the toggle, or the account has people (so the checkbox shows a real
    // state rather than the pre-seed default). A people-less, untouched Save
    // must keep the key absent — an explicit false here would foreclose
    // seedEnableChatDefault forever (and could overwrite a seed that landed
    // while this page was open).
    if (!enableChatTouched && people.length === 0) {
      delete localSaveData.enableChat;
    }
    
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

    // Populate the trusted-people checklist (auto-open). The checklist keys on
    // `iden`, so people are mapped onto email_normalized — the identity key that
    // matches incoming pushes' sender_email_normalized and is persisted in
    // autoOpenTrustedPeople.
    trustedPeoplePicker.setDevices(people
      .filter(person => person.email_normalized)
      .map(person => ({
        iden: person.email_normalized,
        name: person.name,
        email: person.email,
        email_normalized: person.email_normalized
      })));
  }

  function populateOtherDeviceSelect() {
    // Filter out Chrome devices and get only active devices
    otherDevicePicker.setDevices(devices.filter(device =>
      device.active && device.pushable !== false && device.type !== 'chrome'
    ));
  }

  // Rename a device server-side (documented POST /v2/devices/{iden}), then patch
  // the in-memory device list and persist it to storage.local only — never the
  // stale sync copies. Resolves true on success; false (missing token, network,
  // or API error) tells the caller to revert the inline editor. The storage
  // write drives the popup/context-menu refresh via their onChanged listeners;
  // populateDeviceSelects() refreshes both option-page checklists here.
  async function renameDevice(iden, nickname) {
    const { accessToken } = await new Promise(resolve => {
      chrome.storage.sync.get(['accessToken'], resolve);
    });
    if (!accessToken) return false;
    try {
      const response = await fetch(`https://api.pushbullet.com/v2/devices/${iden}`, {
        method: 'POST',
        headers: {
          'Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nickname }),
        credentials: 'omit'
      });
      if (!response.ok) return false;
      const device = devices.find(d => d.iden === iden);
      if (device) device.nickname = nickname;
      await new Promise(resolve => chrome.storage.local.set({ devices }, resolve));
      populateDeviceSelects();
      return true;
    } catch (e) {
      return false;
    }
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
  
  function updateAutoOpenFilesToggleVisual() {
    if (autoOpenFilesCheckbox.checked) {
      autoOpenFilesToggle.classList.add('active');
    } else {
      autoOpenFilesToggle.classList.remove('active');
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
      autoOpenFilesContainer.style.display = 'flex';
      autoOpenOnResumeContainer.style.display = 'flex';
      hideNotificationOnAutoOpenContainer.style.display = 'flex';
      autoOpenTabActiveContainer.style.display = 'flex';
    } else {
      autoOpenFilesContainer.style.display = 'none';
      autoOpenOnResumeContainer.style.display = 'none';
      hideNotificationOnAutoOpenContainer.style.display = 'none';
      autoOpenTabActiveContainer.style.display = 'none';
    }
    // The people auto-open row/checklist also require the Chat surface enabled.
    updateAutoOpenLinksFromPeopleVisibility();
  }

  function updateAutoOpenLinksFromPeopleToggleVisual() {
    if (autoOpenLinksFromPeopleCheckbox.checked) {
      autoOpenLinksFromPeopleToggle.classList.add('active');
    } else {
      autoOpenLinksFromPeopleToggle.classList.remove('active');
    }
  }

  function updateAutoOpenLinksFromPeopleVisibility() {
    // Row shows only while the auto-open master is on and the Chat surface is
    // enabled (a Chat option shouldn't be offered while Chat is off); the
    // trusted checklist additionally needs the people sub-toggle on.
    const showRow = autoOpenLinksCheckbox.checked && isChatEnabled();
    autoOpenLinksFromPeopleContainer.style.display = showRow ? 'flex' : 'none';
    trustedPeopleGroup.style.display =
      (showRow && autoOpenLinksFromPeopleCheckbox.checked) ? 'block' : 'none';
  }

  function updateAutoOpenTabActiveToggleVisual() {
    if (autoOpenTabActiveCheckbox.checked) {
      autoOpenTabActiveToggle.classList.add('active');
    } else {
      autoOpenTabActiveToggle.classList.remove('active');
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

  function updateEnableContextMenuToggleVisual() {
    if (enableContextMenuCheckbox.checked) {
      enableContextMenuToggle.classList.add('active');
    } else {
      enableContextMenuToggle.classList.remove('active');
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

  function updateEnableChatToggleVisual() {
    if (enableChatCheckbox.checked) {
      enableChatToggle.classList.add('active');
    } else {
      enableChatToggle.classList.remove('active');
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
    // The control is always visible now; only its option list tracks the
    // enabled surfaces, rebuilt when mirroring flips. The stored defaultTab is
    // never rewritten here (see createSelectDropdown setItems/setValue) — the
    // dropdown just displays the Push fallback while a saved surface is off.
    defaultTabDropdown.setItems(defaultTabItems());
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

  function updateRequireInteractionChatsToggleVisual() {
    if (requireInteractionChatsCheckbox.checked) {
      requireInteractionChatsToggle.classList.add('active');
    } else {
      requireInteractionChatsToggle.classList.remove('active');
    }
  }
  
  function updateRequireInteractionVisibility() {
    // Pushes/Mirrored/Chats subs show only while both the Show notifications
    // master and Require interaction are on (they nest under Show
    // notifications now).
    if (showOsNotificationsCheckbox.checked && requireInteractionCheckbox.checked) {
      requireInteractionPushesContainer.style.display = 'flex';
      updateRequireInteractionMirroredVisibility();
      updateRequireInteractionChatsVisibility();
    } else {
      requireInteractionPushesContainer.style.display = 'none';
      requireInteractionMirroredContainer.style.display = 'none';
      requireInteractionChatsContainer.style.display = 'none';
    }
  }
  
  function updateRequireInteractionMirroredVisibility() {
    if (showOsNotificationsCheckbox.checked && requireInteractionCheckbox.checked && notificationMirroringCheckbox.checked) {
      requireInteractionMirroredContainer.style.display = 'flex';
    } else {
      requireInteractionMirroredContainer.style.display = 'none';
    }
  }

  function updateRequireInteractionChatsVisibility() {
    // Chat gates its row the way mirroring gates the Mirrored row; the stored
    // value is untouched while hidden.
    if (showOsNotificationsCheckbox.checked && requireInteractionCheckbox.checked && isChatEnabled()) {
      requireInteractionChatsContainer.style.display = 'flex';
    } else {
      requireInteractionChatsContainer.style.display = 'none';
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

  function updateDisplayUnreadChatsToggleVisual() {
    if (displayUnreadChatsCheckbox.checked) {
      displayUnreadChatsToggle.classList.add('active');
    } else {
      displayUnreadChatsToggle.classList.remove('active');
    }
  }

  function updateDisplayUnreadCountsVisibility() {
    if (displayUnreadCountsCheckbox.checked) {
      displayUnreadPushesContainer.style.display = 'flex';
      updateDisplayUnreadMirroredVisibility();
      updateDisplayUnreadChatsVisibility();
    } else {
      displayUnreadPushesContainer.style.display = 'none';
      displayUnreadMirroredContainer.style.display = 'none';
      displayUnreadChatsContainer.style.display = 'none';
    }
  }

  function updateDisplayUnreadMirroredVisibility() {
    if (displayUnreadCountsCheckbox.checked && notificationMirroringCheckbox.checked) {
      displayUnreadMirroredContainer.style.display = 'flex';
    } else {
      displayUnreadMirroredContainer.style.display = 'none';
    }
  }

  // Mirrors updateDisplayUnreadMirroredVisibility, but the master-gate is the
  // Chat surface (enableChat) rather than notification mirroring: the Chats
  // sub-row shows only when unread counts are on AND Chat is enabled.
  function updateDisplayUnreadChatsVisibility() {
    if (displayUnreadCountsCheckbox.checked && isChatEnabled()) {
      displayUnreadChatsContainer.style.display = 'flex';
    } else {
      displayUnreadChatsContainer.style.display = 'none';
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
    // Show notifications is the master for all notification behavior: its direct
    // sub-rows (hide-browser-pushes, play-sound, require-interaction,
    // close-as-dismiss) follow it. UI-only — the stored values are untouched.
    if (showOsNotificationsCheckbox.checked) {
      hideBrowserPushesContainer.style.display = 'flex';
      playSoundOnNotificationContainer.style.display = 'flex';
      requireInteractionContainer.style.display = 'flex';
      closeAsDismissContainer.style.display = 'flex';
    } else {
      hideBrowserPushesContainer.style.display = 'none';
      playSoundOnNotificationContainer.style.display = 'none';
      requireInteractionContainer.style.display = 'none';
      closeAsDismissContainer.style.display = 'none';
    }
    // Require-interaction's own Pushes/Mirrored subs need this master too.
    updateRequireInteractionVisibility();
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
    trustedPeoplePicker.rerender();
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