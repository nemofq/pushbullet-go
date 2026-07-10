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
  const clearNotificationsButton = document.getElementById('clearNotificationsButton');
  const targetControl = document.getElementById('targetControl');
  const targetControlLabel = document.getElementById('targetControlLabel');
  const targetMenu = document.getElementById('targetMenu');
  const chatTab = document.getElementById('chatTab');
  const pushTabCount = document.getElementById('pushTabCount');
  const chatTabCount = document.getElementById('chatTabCount');
  const notificationTabCount = document.getElementById('notificationTabCount');
  const peopleList = document.getElementById('peopleList');
  const convWrap = document.getElementById('convWrap');
  const convBack = document.getElementById('convBack');
  const convAvatar = document.getElementById('convAvatar');
  const convName = document.getElementById('convName');
  const convEmail = document.getElementById('convEmail');
  const convHint = document.getElementById('convHint');
  const convMute = document.getElementById('convMute');
  const convMuteIcon = document.getElementById('convMuteIcon');
  const convMessages = document.getElementById('convMessages');

  // Per-popup target override applying to sends from this popup until it closes
  // (or the ✕ clears it): device idens and people emails are tracked in two
  // parallel arrays so a send can mix both kinds. Both [] = use the configured
  // default (remoteDeviceId). In-memory only, never persisted — closing the
  // popup is the natural reset.
  let perSendTargetIdens = [];
  let perSendTargetEmails = [];
  let targetDevices = [];
  let targetPeople = [];
  let defaultTargetLabel = '';
  let hasConfiguredDefault = false;

  // ---- Chat tab state (drill-down list ↔ conversation, in-memory) ----
  // currentTab tracks the active popup surface so storage.onChanged handlers
  // know whether the Chat surfaces are visible; chatView is the sub-view and
  // currentPerson the person whose conversation is open.
  let currentTab = 'push';   // 'push' | 'chat' | 'notification'
  let chatView = 'list';     // 'list' | 'conv'
  let currentPerson = null;
  // Cached "should the per-send target chip show" flag (set by
  // initTargetSelector). The conversation force-hides the chip; returning to
  // the Push tab restores it from this cached value without an async re-read.
  let targetChipEnabled = false;

  // Deterministic letter-avatar hue for people without a photo.
  const AVATAR_HUES = [262, 24, 202, 340, 174, 288, 16];
  const hueFor = s => AVATAR_HUES[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_HUES.length];
  // Bell icons for the conversation mute button + the list muted glyph.
  const BELL_PATH = 'M21,19V20H3V19L5,17V11C5,7.9 7.03,5.17 10,4.29C10,4.19 10,4.1 10,4A2,2 0 0,1 12,2A2,2 0 0,1 14,4C14,4.1 14,4.19 14,4.29C16.97,5.17 19,7.9 19,11V17L21,19M14,21A2,2 0 0,1 12,23A2,2 0 0,1 10,21';
  const BELL_OFF_PATH = 'M20,18.69L7.84,6.14L5.27,3.49L4,4.76L6.8,7.56V7.57C6.28,8.56 6,9.74 6,11V16L4,18V19H17.73L19.73,21L21,19.73L20,18.69M12,22A2,2 0 0,0 14,20H10A2,2 0 0,0 12,22M18,14.68V11C18,7.92 16.36,5.36 13.5,4.68V4A1.5,1.5 0 0,0 12,2.5A1.5,1.5 0 0,0 10.5,4V4.68C10.23,4.74 9.97,4.83 9.72,4.92L18,13.21V14.68Z';
  const BELL_OFF_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="${BELL_OFF_PATH}"/></svg>`;

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
    // Populate the per-tab unread pills once the switcher exists; storage
    // .onChanged keeps them live thereafter.
    updateTabCounts();
    checkQuickShare();
    initTargetSelector();
    updateConnectionStatus();
  });
  
  // Fallback scroll to bottom for first-time loading
  setTimeout(() => {
    messagesList.scrollTop = messagesList.scrollHeight;
  }, 200);

  // Keep relative timestamps fresh while the popup stays open (cheap: only
  // rewrites the timestamp nodes, which carry their raw epoch ms in data-ts).
  function refreshTimestamps() {
    if (!window.CustomI18n) return;
    document.querySelectorAll('[data-ts]').forEach(node => {
      const ts = window.CustomI18n.formatTimestamp(Number(node.dataset.ts));
      node.title = ts.title;
      // Nodes carrying a sender/recipient caption (people-push timeline rows)
      // keep it across refreshes; plain timestamp nodes just take the new text.
      renderTimestampContent(node, ts.text, node.dataset.tsCaption);
    });
  }

  // Fill a message-timestamp node with either a bare relative time or a
  // "<name> · time" caption line (people-push attribution). Caption text is set
  // via textContent so user-supplied names can never inject markup.
  function renderTimestampContent(node, tsText, caption) {
    if (caption) {
      node.replaceChildren();
      const nameSpan = document.createElement('span');
      nameSpan.className = 'ts-name';
      nameSpan.textContent = caption;
      node.appendChild(nameSpan);
      node.appendChild(document.createTextNode(' · ' + tsText));
    } else {
      node.textContent = tsText;
    }
  }
  setInterval(refreshTimestamps, 60000);
  
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
  bodyInput.addEventListener('input', updateSendButtonState);
  bodyInput.addEventListener('input', fitComposeHeight);
  updateSendButtonState();
  fitComposeHeight();

  quickShareSend.addEventListener('click', () => {
    if (quickShareUrl.textContent) {
      sendLink(quickShareUrl.textContent);
    }
  });

  logoLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://www.pushbullet.com/#people/me' });
  });

  clearNotificationsButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'clear_mirror_history' });
  });

  // Middle-click on links/images: open in background tab without closing the popup
  document.addEventListener('auxclick', (e) => {
    if (e.button === 1) {
      const link = e.target.closest('a.message-link');
      if (link) {
        e.preventDefault();
        e.stopPropagation();
        chrome.tabs.create({ url: link.href, active: false });
        return;
      }
      const img = e.target.closest('img.message-image');
      if (img) {
        e.preventDefault();
        e.stopPropagation();
        chrome.tabs.create({ url: img.src, active: false });
      }
    }
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

  // Drag-and-drop event handlers for the entire popup
  document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.classList.add('dragging');
  });

  document.body.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Remove class when leaving the window entirely
    if (e.clientX === 0 || e.clientY === 0 ||
        e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
      document.body.classList.remove('dragging');
    }
  });

  document.body.addEventListener('dragend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.classList.remove('dragging');
  });

  document.body.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.classList.remove('dragging');

    const files = Array.from(e.dataTransfer.files);

    if (files.length === 1) {
      await handleFilePaste(files[0]);
    } else if (files.length > 1) {
      bodyInput.placeholder = window.CustomI18n.getMessage('paste_one_file');
      setTimeout(() => {
        bodyInput.placeholder = window.CustomI18n.getMessage('type_or_paste_placeholder');
      }, 2500);
    }
  });

  sendFileButton.addEventListener('click', () => {
    console.log('Popup: Send File button clicked');

    // Thread the current target(s) into the file window via query params —
    // device idens in `to`, people emails in `email`, each only when present
    // (they die with the window, so nothing can leak into a later file send)
    const params = new URLSearchParams();
    if (currentTab === 'chat' && chatView === 'conv' && currentPerson) {
      // Conversation: the file goes to this person only (single email); the
      // per-send picker does not apply here.
      params.set('email', currentPerson.email_normalized);
    } else {
      if (perSendTargetIdens.length) {
        params.set('to', perSendTargetIdens.join(','));
      }
      if (perSendTargetEmails.length) {
        params.set('email', perSendTargetEmails.join(','));
      }
    }
    const query = params.toString();
    const fileUrl = query ? `file.html?${query}` : 'file.html';

    // Open file upload window
    chrome.windows.create({
      url: fileUrl,
      type: 'popup',
      width: 440,
      height: 340,
      focused: true
    });
  });

  // ---- per-send target selector (chip ↔ pill + dropdown menu) ----
  targetControl.addEventListener('click', (e) => {
    if (e.target.closest('.tc-clear')) {
      // ✕ resets to the default target without opening the menu
      e.stopPropagation();
      resetPerSendTarget();
      closeTargetMenu();
      bodyInput.focus();
      return;
    }
    if (targetMenu.hidden) {
      openTargetMenu();
    } else {
      closeTargetMenu();
    }
  });

  // multi-select: toggle devices and KEEP the menu open so several can be
  // picked in one go (mirrors the options page's multi-device target). The
  // menu closes when clicking away — e.g. into the input to type/send.
  targetMenu.addEventListener('click', (e) => {
    const option = e.target.closest('.menu-option');
    if (!option) return;
    const email = option.dataset.email;
    if (email) {
      // people row toggle (keyed by email_normalized)
      const index = perSendTargetEmails.indexOf(email);
      if (index === -1) {
        perSendTargetEmails.push(email);
      } else {
        perSendTargetEmails.splice(index, 1);
      }
    } else {
      const iden = option.dataset.iden;
      if (!iden) {
        // default row → back to the configured default, clearing every pick
        perSendTargetIdens = [];
        perSendTargetEmails = [];
      } else {
        const index = perSendTargetIdens.indexOf(iden);
        if (index === -1) {
          perSendTargetIdens.push(iden);
        } else {
          perSendTargetIdens.splice(index, 1);
        }
      }
    }
    renderTargetControl();
    markTargetMenuSelection();
  });

  document.addEventListener('click', (e) => {
    if (!targetMenu.hidden && !targetMenu.contains(e.target) && !targetControl.contains(e.target)) {
      closeTargetMenu();
    }
  });

  openOptionsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Tab switching
  pushTab.addEventListener('click', () => {
    switchTab('push');
  });

  chatTab.addEventListener('click', () => {
    switchTab('chat');
  });

  notificationTab.addEventListener('click', () => {
    switchTab('notification');
  });

  // Conversation: back returns to the list; mute is the one chat action.
  convBack.addEventListener('click', () => {
    chatView = 'list';
    currentPerson = null;
    updateChatView();
  });

  convMute.addEventListener('click', () => {
    // Hidden when the person entry has no iden (pre-upgrade trimmed entry), but
    // guard anyway — no iden means no mute endpoint to call.
    if (!currentPerson || !currentPerson.iden) return;
    const wasMuted = currentPerson.muted === true;
    const newMuted = !wasMuted;
    // Optimistic swap; revert on a failed server call (plan §9).
    currentPerson.muted = newMuted;
    renderMuteButton();
    chrome.runtime.sendMessage(
      {
        type: 'set_person_muted',
        iden: currentPerson.iden,
        email_normalized: currentPerson.email_normalized,
        muted: newMuted
      },
      (response) => {
        if (chrome.runtime.lastError || !response || response.success === false) {
          currentPerson.muted = wasMuted;
          renderMuteButton();
        }
      }
    );
  });

  async function checkAccessToken() {
    const data = await chrome.storage.sync.get('accessToken');
    
    const sendForm = document.querySelector('.send-form');
    
    if (!data.accessToken) {
      // No access token - show setup guide only
      setupGuide.classList.add('show');
      messagesList.style.display = 'none';
      notificationsList.style.display = 'none';
      peopleList.style.display = 'none';
      convWrap.style.display = 'none';
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

  // Computes which popup surfaces are enabled and lands on the right tab.
  // Fixed tab order Push | Chat | Notification: Push is always enabled, Chat per
  // the adaptive default (below), Notification iff mirroring is on; the switcher shows
  // only when signed in and at least two surfaces are enabled. Pass
  // { preserveCurrent: true } for reactive surface-toggle changes so an active,
  // still-available tab is kept — otherwise (initial load / reconnect) the saved
  // default tab is applied. The saved defaultTab is never rewritten here; a
  // disabled surface just falls back to Push for display.
  async function checkNotificationMirroring(options) {
    const preserveCurrent = !!(options && options.preserveCurrent);
    const tokenData = await chrome.storage.sync.get('accessToken');

    // Only show tabs if we have an access token
    if (!tokenData.accessToken) {
      tabSwitcher.style.display = 'none';
      chatTab.style.display = 'none';
      notificationTab.style.display = 'none';
      checkSmsShortcut();
      return;
    }

    const localData = await chrome.storage.local.get(['notificationMirroring', 'enableChat', 'defaultTab']);
    const mirroringOn = !!localData.notificationMirroring;
    // undefined = not yet seeded, behaves as off; the background seeds true once
    // people first exist.
    const chatOn = localData.enableChat === true;

    // Per-button visibility (fixed order); the switcher shows with >1 surface.
    chatTab.style.display = chatOn ? '' : 'none';
    notificationTab.style.display = mirroringOn ? '' : 'none';
    const enabledCount = 1 + (chatOn ? 1 : 0) + (mirroringOn ? 1 : 0);
    tabSwitcher.style.display = enabledCount > 1 ? 'flex' : 'none';

    const isTabAvailable = (tab) =>
      tab === 'push' || (tab === 'chat' && chatOn) || (tab === 'notification' && mirroringOn);
    const storedDefaultTab = localData.defaultTab || 'push';
    const effectiveDefaultTab = isTabAvailable(storedDefaultTab) ? storedDefaultTab : 'push';

    if (mirroringOn) {
      debouncedLoadNotifications();
    }

    // If the active tab's surface just turned off, drop any open conversation
    // before falling back so a later re-enable reopens on the list.
    if (!isTabAvailable(currentTab) && currentTab === 'chat') {
      chatView = 'list';
      currentPerson = null;
    }

    // switchTab('push') clears unread pushes; switchTab('notification') clears
    // unread mirrors; switchTab('chat') touches neither.
    const targetTab = (preserveCurrent && isTabAvailable(currentTab)) ? currentTab : effectiveDefaultTab;
    switchTab(targetTab);
    checkSmsShortcut();
  }

  async function checkSmsShortcut() {
    const [tokenData, smsData] = await Promise.all([
      chrome.storage.sync.get('accessToken'),
      chrome.storage.local.get('showSmsShortcut')
    ]);

    // Only show SMS shortcut if we have an access token and the setting is enabled
    if (tokenData.accessToken && smsData.showSmsShortcut) {
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
          quickShareUrl.dataset.title = tab.title || '';
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

    // Add title if available
    const title = quickShareUrl.dataset.title;
    if (title) {
      pushData.title = title;
    }

    applyPerSendTargets(pushData, configData.remoteDeviceId);

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
    const clearNotificationsBar = document.getElementById('clearNotificationsBar');

    currentTab = tab;

    if (tab === 'chat') {
      // Chat surface (list or conversation). The Chat tab itself clears nothing:
      // opening a conversation is the read event (per-person, via stampPersonRead
      // → peopleLastRead), and the derived unread-chat badge follows from the
      // background recompute. The unread-push and unread-mirror counters are
      // untouched here — each surface owns its own reads.
      pushTab.classList.remove('active');
      chatTab.classList.add('active');
      notificationTab.classList.remove('active');
      updateChatView();
      // Freshen the people list on tab open (throttled to 15 min in background).
      chrome.runtime.sendMessage({ type: 'refresh_people' });
      return;
    }

    if (tab === 'push') {
      pushTab.classList.add('active');
      chatTab.classList.remove('active');
      notificationTab.classList.remove('active');
      messagesList.style.display = 'flex';
      notificationsList.style.display = 'none';
      peopleList.style.display = 'none';
      convWrap.style.display = 'none';
      sendForm.style.display = 'block';
      clearNotificationsBar.style.display = 'none';
      // Restore the per-send target chip a conversation may have force-hidden.
      targetControl.hidden = !targetChipEnabled;
      // Restore the quick-share bar the Chat surface hid (shows only when
      // enabled + on a shareable page).
      checkQuickShare();


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
      chatTab.classList.remove('active');
      notificationTab.classList.add('active');
      messagesList.style.display = 'none';
      notificationsList.style.display = 'flex';
      peopleList.style.display = 'none';
      convWrap.style.display = 'none';
      sendForm.style.display = 'none';
      clearNotificationsBar.style.display = 'flex';


      debouncedLoadNotifications();

      // Clear unread mirrored notifications count when notifications tab is opened
      chrome.runtime.sendMessage({ type: 'clear_unread_mirrors' });
    }
  }

  // Toggle the Chat sub-view (list vs conversation) plus the composer. The
  // conversation reuses the standard composer but with no target chip — the
  // header already names the recipient (the per-send picker does not apply).
  function updateChatView() {
    const sendForm = document.querySelector('.send-form');
    const clearNotificationsBar = document.getElementById('clearNotificationsBar');
    const inConv = chatView === 'conv' && !!currentPerson;

    messagesList.style.display = 'none';
    notificationsList.style.display = 'none';
    peopleList.style.display = inConv ? 'none' : 'flex';
    convWrap.style.display = inConv ? 'flex' : 'none';
    clearNotificationsBar.style.display = 'none';
    sendForm.style.display = inConv ? 'block' : 'none';
    // Quick share is a Push-tab affordance; the conversation composer (which
    // also shows the send-form) must never surface it.
    quickShareContainer.style.display = 'none';

    if (inConv) {
      targetControl.hidden = true;
      closeTargetMenu();
      renderConversation();
    } else {
      renderPeopleList();
    }
  }

  // Per-tab unread pills mirror the toolbar badge composition exactly (see
  // background.js updateBadge): a component shows only when the master
  // displayUnreadCounts is on, its own sub-toggle is not explicitly false, and
  // its count is > 0. Push ← unreadPushCount, Chat ← unreadChatCount,
  // Notification ← unreadMirrorCount, with the same 99+ cap as the badge. The
  // existing clear paths (Push tab → clear_unread_pushes, conversation open →
  // per-person read, Notification tab → clear_unread_mirrors) all land as counter
  // writes that re-invoke this via storage.onChanged, so switchTab needs no
  // manual call.
  async function updateTabCounts() {
    const data = await chrome.storage.local.get([
      'unreadPushCount',
      'unreadChatCount',
      'unreadMirrorCount',
      'displayUnreadCounts',
      'displayUnreadPushes',
      'displayUnreadChats',
      'displayUnreadMirrored'
    ]);
    const master = !!data.displayUnreadCounts;
    const setPill = (el, show, count) => {
      if (show && count > 0) {
        el.textContent = count > 99 ? '99+' : String(count);
        el.hidden = false;
      } else {
        el.textContent = '';
        el.hidden = true;
      }
    };
    setPill(pushTabCount, master && data.displayUnreadPushes !== false, data.unreadPushCount || 0);
    setPill(chatTabCount, master && data.displayUnreadChats !== false, data.unreadChatCount || 0);
    setPill(notificationTabCount, master && data.displayUnreadMirrored !== false, data.unreadMirrorCount || 0);
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

  function debouncedLoadMessages(preserveScrollTop = null) {
    if (loadMessagesTimeout) {
      clearTimeout(loadMessagesTimeout);
    }
    loadMessagesTimeout = setTimeout(() => {
      loadMessages(preserveScrollTop);
      loadMessagesTimeout = null;
    }, 16); // Optimized for smooth 60fps updates
  }

  function debouncedLoadNotifications(preserveScrollTop = null) {
    if (loadNotificationsTimeout) {
      clearTimeout(loadNotificationsTimeout);
    }
    loadNotificationsTimeout = setTimeout(() => {
      loadNotifications(preserveScrollTop);
      loadNotificationsTimeout = null;
    }, 16); // Optimized for smooth 60fps updates
  }

  // Classify a push by direction (matches background.js): a people push is an
  // incoming person-to-person push (channel/client pushes excluded); an
  // outgoing push was sent to a person and belongs only to the conversation view.
  const isPeoplePush = push => push.direction === 'incoming' && !push.channel_iden && !push.client_iden;
  const isOutgoingPush = push => push.direction === 'outgoing';

  // Shared bubble builder for both the main Push timeline and the conversation
  // view: builds one .message-row (timestamp line + note/link/file/image bubble
  // + copy/delete buttons) from a push. `messageType` is 'received' | 'sent';
  // `caption` (or null) is the sender/recipient attribution shown on the
  // timestamp line — used by the main timeline for people pushes, always null in
  // the conversation (its header already names the person). `scrollContainer` is
  // scrolled to the bottom once an image bubble finishes loading. With a null
  // caption the output is identical to the pre-extraction inline markup.
  function buildMessageRow(push, messageType, caption, scrollContainer) {
    const messageRowDiv = document.createElement('div');
    messageRowDiv.className = `message-row ${messageType}`;

    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'message-timestamp';
    const timestamp = push.created ? push.created * 1000 : push.sentAt;
    const ts = window.CustomI18n.formatTimestamp(timestamp);
    timestampDiv.dataset.ts = timestamp;
    timestampDiv.title = ts.title;
    if (caption) {
      timestampDiv.dataset.tsCaption = caption;
    }
    renderTimestampContent(timestampDiv, ts.text, caption);

    const messageContentDiv = document.createElement('div');
    messageContentDiv.className = 'message-content';

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${messageType}`;

    if (push.title) {
      const titleDiv = document.createElement('div');
      titleDiv.className = 'message-title';
      titleDiv.textContent = push.title;
      messageDiv.appendChild(titleDiv);
    }

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'message-body';

    const hasLinkUrl = typeof push.url === 'string' && push.url;

    if (push.type === 'note') {
      parseTextWithLinks(push.body || '', bodyDiv, 'message-link');
    } else if (push.type === 'link') {
      if (push.body) {
        bodyDiv.textContent = push.body;
        if (hasLinkUrl) {
          bodyDiv.appendChild(document.createElement('br'));
        }
      }
      if (hasLinkUrl) {
        const link = document.createElement('a');
        // Bare www. would resolve as a relative URL under chrome-extension://;
        // match parseTextWithLinks() and prepend https:// for the href only.
        link.href = push.url.toLowerCase().startsWith('www.') ? 'https://' + push.url : push.url;
        link.textContent = push.url;
        link.className = 'message-link';
        link.target = '_blank';
        bodyDiv.appendChild(link);
      }
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
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
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
    if (messageType === 'received' && ((push.type === 'note' && push.body) || (push.type === 'link' && hasLinkUrl))) {
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-button';
      copyButton.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/></svg>';
      copyButton.title = push.type === 'link' ? window.CustomI18n.getMessage('copy_link') : window.CustomI18n.getMessage('copy_message');
      copyButton.onclick = (e) => {
        e.stopPropagation();
        const textToCopy = push.type === 'link' ? push.url : push.body;
        navigator.clipboard.writeText(textToCopy);
      };
      messageContentDiv.appendChild(copyButton);
    }

    // Add delete button for all pushes
    const deleteButton = document.createElement('button');
    deleteButton.className = 'push-delete-button';
    deleteButton.innerHTML = '<svg viewBox="3 2 18 20" fill="currentColor"><path d="M9,3V4H4V6H5V19A2,2 0 0,0 7,21H17A2,2 0 0,0 19,19V6H20V4H15V3H9M7,6H17V19H7V6M9,8V17H11V8H9M13,8V17H15V8H13Z"/></svg>';
    deleteButton.title = window.CustomI18n.getMessage('delete_push');
    deleteButton.onclick = (e) => {
      e.stopPropagation();
      chrome.runtime.sendMessage({
        type: 'delete_push',
        iden: push.iden
      });
    };
    messageContentDiv.appendChild(deleteButton);

    messageRowDiv.appendChild(timestampDiv);
    messageRowDiv.appendChild(messageContentDiv);
    return messageRowDiv;
  }

  async function loadMessages(preserveScrollTop = null) {
    const [receivedData, sentData, configData, localData, peopleData] = await Promise.all([
      chrome.storage.local.get('pushes'),
      chrome.storage.local.get('sentMessages'),
      chrome.storage.local.get(['onlyBrowserPushes', 'showOtherDevicePushes', 'showNoTargetPushes', 'showPeoplePushes', 'enableChat']),
      chrome.storage.local.get('chromeDeviceId'),
      chrome.storage.local.get('people')
    ]);

    // People lookup (by email_normalized) for the timestamp-line attribution
    // captions on people pushes / sent-to-person messages.
    const people = peopleData.people || [];
    const peopleByEmail = new Map(people.map(p => [p.email_normalized, p]));

    // undefined = not yet seeded, behaves as off; the background seeds true once
    // people first exist.
    // People pushes live in the Chat tab when it is enabled; the timeline only
    // carries them (with captions) as a fallback when Chat is off.
    const chatEnabled = configData.enableChat === true;

    // Get received messages (filtered by new flexible filtering settings)
    let receivedMessages = receivedData.pushes || [];
    receivedMessages = receivedMessages.filter(push => {
      // Classify by direction before device bucketing: outgoing pushes belong
      // only to the conversation view, and people pushes have their own filter
      // (default on) instead of mis-bucketing as "no target device".
      if (isOutgoingPush(push)) {
        return false;
      }
      if (isPeoplePush(push)) {
        // When Chat is on, received people pushes live only in the conversation.
        if (chatEnabled) return false;
        return configData.showPeoplePushes !== false; // Default is true
      }

      const targetDeviceIden = push.target_device_iden;

      if (targetDeviceIden === localData.chromeDeviceId) {
        // Push is targeted to current Chrome device
        return configData.onlyBrowserPushes !== false; // Default is true
      } else if (targetDeviceIden && targetDeviceIden !== localData.chromeDeviceId) {
        // Push is targeted to other device
        return configData.showOtherDevicePushes === true; // Default is false
      } else if (!targetDeviceIden) {
        // Push has no target device (sent to all)
        return configData.showNoTargetPushes === true; // Default is false
      }

      return false;
    });
    
    // Get sent messages. When Chat is on, entries addressed to a person
    // (receiver_email) live only in the conversation, so drop them here.
    const sentMessages = (sentData.sentMessages || []).filter(msg =>
      !(chatEnabled && msg.receiver_email));
    
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
      // People-push attribution on the timestamp line: incoming people pushes
      // show the sender name; sent-to-person messages show "To <name>". Name
      // resolves via the people list, then the push's own fields.
      let caption = null;
      if (push.messageType === 'received' && isPeoplePush(push)) {
        const person = peopleByEmail.get(push.sender_email_normalized);
        caption = (person && person.name) || push.sender_name || push.sender_email || null;
      } else if (push.messageType === 'sent' && push.receiver_email) {
        const person = peopleByEmail.get(push.receiver_email_normalized);
        const name = (person && person.name) || push.receiver_email;
        caption = window.CustomI18n.getMessage('to_person', [name]);
      }
      fragment.appendChild(buildMessageRow(push, push.messageType, caption, messagesList));
    });
    
    // Replace content atomically to prevent flashing
    messagesList.replaceChildren(fragment);

    // Conditionally restore scroll position or scroll to bottom
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (preserveScrollTop !== null) {
          messagesList.scrollTop = preserveScrollTop;
        } else {
          messagesList.scrollTop = messagesList.scrollHeight;
        }
      });
    });
  }

  async function loadNotifications(preserveScrollTop = null) {
    const data = await chrome.storage.local.get(['mirrorNotifications', 'mirrorDecryptIssue']);
    const notifications = data.mirrorNotifications || [];

    // Encrypted ephemerals are being dropped (missing or wrong encryption
    // password), so the list is frozen: show why, in place of stale entries,
    // until background clears the flag (readable mirror traffic arrives,
    // encryption settings change, or the token changes).
    if (data.mirrorDecryptIssue) {
      const tokenData = await chrome.storage.sync.get('accessToken');
      const fragment = document.createDocumentFragment();
      if (tokenData.accessToken) {
        const guideDiv = document.createElement('div');
        guideDiv.className = 'list-guide';
        const titleEl = document.createElement('h3');
        titleEl.textContent = window.CustomI18n.getMessage('mirror_encryption_title');
        const textEl = document.createElement('p');
        textEl.textContent = window.CustomI18n.getMessage('mirror_encryption_text');
        const optionsButton = document.createElement('button');
        optionsButton.className = 'setup-button';
        optionsButton.type = 'button';
        optionsButton.textContent = window.CustomI18n.getMessage('open_settings_button');
        optionsButton.onclick = () => {
          chrome.runtime.openOptionsPage();
        };
        guideDiv.appendChild(titleEl);
        guideDiv.appendChild(textEl);
        guideDiv.appendChild(optionsButton);
        fragment.appendChild(guideDiv);
      }
      notificationsList.replaceChildren(fragment);
      return;
    }

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

    // Sort by timestamp (oldest to newest as requested)
    notifications.sort((a, b) => (a.created || 0) - (b.created || 0));
    
    notifications.forEach(notification => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'notification-card';
      
      // Header with icon, app name, and timestamp
      const headerDiv = document.createElement('div');
      headerDiv.className = 'notification-header';
      
      // Icon (wrapper clips to a circle; the img is zoomed to crop the JPEG
      // chroma-bleed band at the edges — see MIRROR_ICON_INSET in background.js)
      const iconWrap = document.createElement('div');
      iconWrap.className = 'notification-icon-wrap';
      const iconImg = document.createElement('img');
      iconImg.className = 'notification-icon';
      if (notification.icon) {
        iconImg.src = `data:image/jpeg;base64,${notification.icon}`;
      } else {
        iconImg.src = 'assets/icon128.png'; // Fallback icon
      }
      iconImg.alt = window.CustomI18n.getMessage('app_icon_alt');
      iconWrap.appendChild(iconImg);
      headerDiv.appendChild(iconWrap);
      
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
      const ts = window.CustomI18n.formatTimestamp(timestamp);
      timestampDiv.dataset.ts = timestamp;
      timestampDiv.textContent = ts.text;
      timestampDiv.title = ts.title;
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

      // Actions section with verification code, copy and delete buttons
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'notification-actions';

      // Verification code button (if code is present) - on the left
      if (notification.verificationCode) {
        actionsDiv.classList.add('has-verification-code');

        const codeButton = document.createElement('button');
        codeButton.className = 'verification-code-button';
        codeButton.dataset.code = notification.verificationCode;
        codeButton.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M5.41,21L6.12,17H2.12L2.47,15H6.47L7.53,9H3.53L3.88,7H7.88L8.59,3H10.59L9.88,7H15.88L16.59,3H18.59L17.88,7H21.88L21.53,9H17.53L16.47,15H20.47L20.12,17H16.12L15.41,21H13.41L14.12,17H8.12L7.41,21H5.41M9.53,9L8.47,15H14.47L15.53,9H9.53Z"/></svg><span class="code-text">${notification.verificationCode}</span>`;
        codeButton.onclick = (e) => {
          e.stopPropagation();
          const button = e.currentTarget;
          const code = button.dataset.code;
          navigator.clipboard.writeText(code);

          // Show "Copied" feedback
          const originalHTML = button.innerHTML;
          button.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/></svg><span class="status-text">${window.CustomI18n.getMessage('copied')}</span>`;
          button.style.pointerEvents = 'none';

          setTimeout(() => {
            button.innerHTML = originalHTML;
            button.style.pointerEvents = '';
          }, 1500);
        };
        actionsDiv.appendChild(codeButton);
      }

      // Right side buttons wrapper
      const rightButtonsDiv = document.createElement('div');
      rightButtonsDiv.style.display = 'flex';
      rightButtonsDiv.style.gap = '4px';

      // Copy button (only if notification has body)
      if (notification.body) {
        const copyButton = document.createElement('button');
        copyButton.className = 'notification-copy-button';
        copyButton.title = window.CustomI18n.getMessage('copy_notification');
        copyButton.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/></svg>';
        copyButton.onclick = (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(notification.body);
        };
        rightButtonsDiv.appendChild(copyButton);
      }

      // Delete button
      const deleteButton = document.createElement('button');
      deleteButton.className = 'notification-delete-button';
      deleteButton.title = window.CustomI18n.getMessage('delete_notification');
      deleteButton.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9,3V4H4V6H5V19A2,2 0 0,0 7,21H17A2,2 0 0,0 19,19V6H20V4H15V3H9M7,6H17V19H7V6M9,8V17H11V8H9M13,8V17H15V8H13Z"/></svg>';
      deleteButton.onclick = (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({
          type: 'delete_notification',
          id: notification.id
        });
      };

      rightButtonsDiv.appendChild(deleteButton);
      actionsDiv.appendChild(rightButtonsDiv);
      cardDiv.appendChild(actionsDiv);

      fragment.appendChild(cardDiv);
    });
    
    // Replace content atomically to prevent flashing
    notificationsList.replaceChildren(fragment);

    // Conditionally restore scroll position or scroll to bottom
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (preserveScrollTop !== null) {
          notificationsList.scrollTop = preserveScrollTop; // Preserve position after deletion
        } else {
          notificationsList.scrollTop = notificationsList.scrollHeight; // Scroll to bottom for new notifications
        }
      });
    });
  }

  // ================================================================
  // Chat tab: list + conversation rendering
  // ================================================================

  // Epoch seconds for ordering: push `created`, else sent `sentAt` (ms → s).
  function itemTime(item) {
    if (item.created) return item.created;
    if (item.sentAt) return item.sentAt / 1000;
    return 0;
  }

  // A person's display name, falling back to the email (type:"email" people
  // have no name).
  function personDisplayName(person) {
    return person.name || person.email || '';
  }

  // Fill a .person-avatar element: the photo when image_url is present, else a
  // deterministic-hue letter circle. DOM-built (no innerHTML with user data).
  function fillAvatar(el, person, sizeClass) {
    el.className = 'person-avatar' + (sizeClass ? ' ' + sizeClass : '');
    el.removeAttribute('style');
    el.replaceChildren();
    const letterFallback = () => {
      el.replaceChildren();
      const key = person.email_normalized || person.email || person.name || '';
      el.style.background = `hsl(${hueFor(key)}, 45%, 52%)`;
      el.textContent = (person.name || person.email || '?').charAt(0).toUpperCase();
    };
    if (person.image_url) {
      const img = document.createElement('img');
      // A dead avatar URL would render the broken-image glyph; use the letter
      // circle instead.
      img.onerror = letterFallback;
      img.src = person.image_url;
      img.alt = window.CustomI18n.getMessage('person_avatar_alt');
      el.appendChild(img);
    } else {
      letterFallback();
    }
  }

  function buildAvatar(person, sizeClass) {
    const el = document.createElement('div');
    fillAvatar(el, person, sizeClass);
    return el;
  }

  // Green "pushbullet.com" link that opens the People page in a new tab —
  // identity management (add / remove / block) stays on pushbullet.com.
  function buildPeopleManageLink() {
    const link = document.createElement('a');
    link.href = 'https://www.pushbullet.com/#people';
    link.textContent = 'pushbullet.com';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://www.pushbullet.com/#people' });
    });
    return link;
  }

  // Persist "this conversation was read up to now" (epoch seconds) — the derived
  // per-person unread key (mirrors lastMirrorReadTime). Absent key = never
  // opened. Writing it triggers a storage.onChanged re-render that clears dots.
  async function stampPersonRead(emailNormalized) {
    if (!emailNormalized) return;
    const data = await chrome.storage.local.get(['peopleLastRead', 'pushes']);
    const peopleLastRead = data.peopleLastRead || {};
    // Clock-skew guard (same as the mirror-notification read stamp): stamp past
    // the newest incoming push in this conversation, not just the wall clock, so
    // a push carrying a future created (phone/server clock ahead) is still marked
    // read on open. The while-open re-stamp path reuses this function and so
    // inherits the guard against the just-arrived push it re-stamps against.
    const newest = (data.pushes || []).reduce((max, p) => {
      if (p.sender_email_normalized !== emailNormalized || p.direction !== 'incoming') return max;
      const t = p.created || 0;
      return t > max ? t : max;
    }, 0);
    peopleLastRead[emailNormalized] = Math.max(Date.now() / 1000, newest);
    await chrome.storage.local.set({ peopleLastRead });
  }

  async function renderPeopleList() {
    const [peopleData, pushesData, sentData, readData, chatMetaData] = await Promise.all([
      chrome.storage.local.get('people'),
      chrome.storage.local.get('pushes'),
      chrome.storage.local.get('sentMessages'),
      chrome.storage.local.get('peopleLastRead'),
      chrome.storage.local.get(['chatReadFloor', 'chatAutoOpenedIdens'])
    ]);
    const people = peopleData.people || [];
    const pushes = pushesData.pushes || [];
    const sentMessages = sentData.sentMessages || [];
    const peopleLastRead = readData.peopleLastRead || {};
    // Dot inputs mirror the derived badge count (background updateChatUnreadCount).
    const chatReadFloor = chatMetaData.chatReadFloor ?? 0;
    const autoOpenedIdens = chatMetaData.chatAutoOpenedIdens || [];

    const fragment = document.createDocumentFragment();

    // Empty state (setup-guide style): heading + the pushbullet.com manage tip.
    if (people.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'people-empty';
      const heading = document.createElement('h3');
      heading.textContent = window.CustomI18n.getMessage('no_people_yet');
      empty.appendChild(heading);
      empty.appendChild(document.createTextNode(window.CustomI18n.getMessage('manage_people_tip') + ' '));
      empty.appendChild(buildPeopleManageLink());
      fragment.appendChild(empty);
      peopleList.replaceChildren(fragment);
      return;
    }

    // Per-person activity from the local push caches: latest item (either
    // direction) drives the snippet + time; incoming pushes drive the unread
    // count (per the predicate below).
    const rows = people.map(person => {
      const key = person.email_normalized;
      let latestItem = null;
      let latestTime = 0;
      // Unread threshold: this person's read stamp, floored by the global chat
      // read floor (mirrors the badge's max(peopleLastRead ?? 0, chatReadFloor ?? 0)).
      const readThreshold = Math.max(peopleLastRead[key] ?? 0, chatReadFloor);
      let unreadCount = 0;
      const consider = item => {
        if (!key) return;
        if (item.sender_email_normalized !== key && item.receiver_email_normalized !== key) return;
        const t = itemTime(item);
        if (t >= latestTime) { latestTime = t; latestItem = item; }
      };
      pushes.forEach(push => {
        consider(push);
        // Unread-count predicate: matches the derived badge count minus the mute
        // clause — a muted person's count still shows here, but the badge excludes
        // them. Each incoming, non-dismissed push not consumed by a hidden
        // auto-open and newer than the read threshold adds to the person's count.
        if (push.sender_email_normalized === key && push.direction === 'incoming' &&
            push.dismissed !== true && !autoOpenedIdens.includes(push.iden) &&
            itemTime(push) > readThreshold) {
          unreadCount++;
        }
      });
      sentMessages.forEach(consider);

      let snippet = '';
      if (latestItem) {
        snippet = latestItem.title || latestItem.body || latestItem.url || latestItem.file_name || '';
      }
      if (!snippet) {
        snippet = (person.name && person.email && person.name !== person.email)
          ? person.email
          : window.CustomI18n.getMessage('no_pushes_yet_snippet');
      }

      return { person, latestTime, snippet, unreadCount, sortName: personDisplayName(person).toLowerCase() };
    });

    // Sort: most recent activity first; no-activity people fall to the bottom;
    // alphabetical within ties (necessarily client-side — /v2/chats has no sort).
    rows.sort((a, b) => {
      if (b.latestTime !== a.latestTime) return b.latestTime - a.latestTime;
      return a.sortName.localeCompare(b.sortName);
    });

    rows.forEach(r => {
      const person = r.person;
      const row = document.createElement('div');
      row.className = 'person-row' + (r.unreadCount > 0 ? ' unread' : '');
      row.appendChild(buildAvatar(person));

      const main = document.createElement('div');
      main.className = 'person-main';

      const nameDiv = document.createElement('div');
      nameDiv.className = 'person-name';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'nm';
      nameSpan.textContent = personDisplayName(person);
      nameDiv.appendChild(nameSpan);
      if (person.muted === true) {
        const glyph = document.createElement('span');
        glyph.className = 'muted-glyph';
        glyph.title = window.CustomI18n.getMessage('person_muted_title');
        glyph.innerHTML = BELL_OFF_SVG;
        nameDiv.appendChild(glyph);
      }
      main.appendChild(nameDiv);

      const snip = document.createElement('div');
      snip.className = 'person-snippet';
      snip.textContent = r.snippet;
      main.appendChild(snip);
      row.appendChild(main);

      const meta = document.createElement('div');
      meta.className = 'person-meta';
      if (r.latestTime > 0) {
        const timeDiv = document.createElement('div');
        timeDiv.className = 'person-time';
        const ms = r.latestTime * 1000;
        const ts = window.CustomI18n.formatTimestamp(ms);
        timeDiv.dataset.ts = ms;
        timeDiv.textContent = ts.text;
        timeDiv.title = ts.title;
        meta.appendChild(timeDiv);
      }
      if (r.unreadCount > 0) {
        const countEl = document.createElement('div');
        countEl.className = 'unread-count';
        countEl.textContent = r.unreadCount > 99 ? '99+' : String(r.unreadCount);
        meta.appendChild(countEl);
      }
      row.appendChild(meta);

      row.onclick = () => openConversation(person);
      fragment.appendChild(row);
    });

    // Quiet footer tip: manage identities at pushbullet.com.
    const tip = document.createElement('div');
    tip.className = 'people-tip';
    tip.appendChild(document.createTextNode(window.CustomI18n.getMessage('manage_people_tip') + ' '));
    tip.appendChild(buildPeopleManageLink());
    fragment.appendChild(tip);

    peopleList.replaceChildren(fragment);
  }

  async function openConversation(person) {
    currentPerson = person;
    chatView = 'conv';
    // Opening marks the conversation read (epoch seconds).
    await stampPersonRead(person.email_normalized);
    refreshConversationHeader();
    updateChatView();
  }

  // Fill the conversation header from currentPerson (name over email, email
  // hidden when identical; avatar; email-delivery hint; mute bell state).
  function refreshConversationHeader() {
    if (!currentPerson) return;
    fillAvatar(convAvatar, currentPerson, 'md');
    convName.textContent = personDisplayName(currentPerson);
    convEmail.textContent = (currentPerson.name === currentPerson.email) ? '' : (currentPerson.email || '');
    convHint.style.display = currentPerson.type === 'email' ? 'block' : 'none';
    renderMuteButton();
  }

  function renderMuteButton() {
    if (!currentPerson) return;
    const muted = currentPerson.muted === true;
    convMuteIcon.innerHTML = `<path d="${muted ? BELL_OFF_PATH : BELL_PATH}"/>`;
    convMute.title = window.CustomI18n.getMessage(muted ? 'unmute_person_title' : 'mute_person_title');
    // Mute needs the chat iden (POST /v2/chats/{iden}); hide it for pre-upgrade
    // trimmed entries that predate the stored iden.
    convMute.style.display = currentPerson.iden ? 'flex' : 'none';
  }

  async function renderConversation() {
    if (!currentPerson) return;
    const key = currentPerson.email_normalized;
    const [pushesData, sentData] = await Promise.all([
      chrome.storage.local.get('pushes'),
      chrome.storage.local.get('sentMessages')
    ]);
    const pushes = pushesData.pushes || [];
    const sentMessages = sentData.sentMessages || [];

    const matches = item =>
      item.sender_email_normalized === key || item.receiver_email_normalized === key;

    // Merge pushes ∪ sentMessages, dedupe by iden (prefer the pushes copy — an
    // own send appears in both once the tickle lands), filter to this person.
    const byIden = new Map();
    const noIden = [];
    sentMessages.filter(matches).forEach(m => { m.iden ? byIden.set(m.iden, m) : noIden.push(m); });
    pushes.filter(matches).forEach(p => { p.iden ? byIden.set(p.iden, p) : noIden.push(p); });
    const merged = [...byIden.values(), ...noIden];
    merged.sort((a, b) => itemTime(a) - itemTime(b));

    if (merged.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'no-messages';
      empty.textContent = window.CustomI18n.getMessage('no_pushes_with_person', [personDisplayName(currentPerson)]);
      convMessages.replaceChildren(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    merged.forEach(push => {
      // incoming → received bubble; outgoing/self → sent bubble. No caption in
      // the conversation — the header already names the person.
      const messageType = push.direction === 'incoming' ? 'received' : 'sent';
      fragment.appendChild(buildMessageRow(push, messageType, null, convMessages));
    });
    convMessages.replaceChildren(fragment);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        convMessages.scrollTop = convMessages.scrollHeight;
      });
    });
  }

  // ---- per-send target selector ----
  // Mirrors the options page "Target Devices" list: same devices key, same
  // active && pushable filter, same labelling (populateDeviceSelects).
  function deviceLabel(device) {
    return device.nickname || `${device.manufacturer} ${device.model}`;
  }

  // People rows are labelled by name, falling back to the email (type:"email"
  // people have no name), and keyed by email_normalized everywhere.
  function personLabel(person) {
    return person.name || person.email;
  }

  function selectedTargetDevices() {
    return targetDevices.filter(device => perSendTargetIdens.includes(device.iden));
  }

  function selectedTargetPeople() {
    return targetPeople.filter(person => perSendTargetEmails.includes(person.email_normalized));
  }

  async function initTargetSelector() {
    const configData = await chrome.storage.local.get(['showPerSendTarget', 'remoteDeviceId', 'devices', 'people', 'enableChat']);

    const devices = configData.devices || [];
    targetDevices = devices.filter(device => device.active && device.pushable !== false);

    // People join the menu as per-send targets only while Chat is enabled.
    // undefined = not yet seeded, behaves as off; the background seeds true once
    // people first exist.
    const chatEnabled = configData.enableChat === true;
    targetPeople = chatEnabled ? (configData.people || []) : [];

    // Drop selections that no longer point at an existing pushable device / person
    perSendTargetIdens = perSendTargetIdens.filter(iden =>
      targetDevices.some(device => device.iden === iden));
    perSendTargetEmails = perSendTargetEmails.filter(email =>
      targetPeople.some(person => person.email_normalized === email));

    // The default chip reflects the configured default target (remoteDeviceId),
    // which may be specific device(s) — "All devices" only when none is set.
    const remoteIds = (configData.remoteDeviceId || '').split(',').map(id => id.trim()).filter(id => id);
    const remoteDevices = targetDevices.filter(device => remoteIds.includes(device.iden));
    hasConfiguredDefault = remoteDevices.length > 0;
    if (remoteDevices.length === 1) {
      defaultTargetLabel = deviceLabel(remoteDevices[0]);
    } else if (remoteDevices.length > 1) {
      defaultTargetLabel = window.CustomI18n.getMessage('n_devices', [String(remoteDevices.length)]);
    } else {
      defaultTargetLabel = window.CustomI18n.getMessage('all_devices');
    }

    // Hidden when the option is off (default on), or when there's nothing to
    // choose between (≤1 pushable target across devices + people). With no
    // people this is exactly the previous `targetDevices.length > 1` gate.
    const enabled = configData.showPerSendTarget !== false && (targetDevices.length + targetPeople.length) > 1;
    targetChipEnabled = enabled;
    // In a conversation the chip is always hidden (the header names the
    // recipient); elsewhere it follows the computed enabled state.
    const inConversation = currentTab === 'chat' && chatView === 'conv';
    targetControl.hidden = inConversation || !enabled;
    if (!enabled) {
      perSendTargetIdens = [];
      perSendTargetEmails = [];
      closeTargetMenu();
    }
    renderTargetControl();
  }

  function renderTargetControl() {
    const selectedDevices = selectedTargetDevices();
    const selectedPeople = selectedTargetPeople();
    const total = selectedDevices.length + selectedPeople.length;
    if (total === 0) {
      targetControl.classList.add('is-default');
      targetControl.classList.remove('is-custom');
      targetControlLabel.textContent = defaultTargetLabel;
      targetControl.title = window.CustomI18n.getMessage('target_default_tooltip');
    } else {
      targetControl.classList.remove('is-default');
      targetControl.classList.add('is-custom');
      // Names listed devices-first, matching the menu order.
      const names = [
        ...selectedDevices.map(deviceLabel),
        ...selectedPeople.map(personLabel)
      ];
      let label;
      if (total === 1) {
        label = names[0];
      } else if (selectedPeople.length > 0) {
        // any person in the mix → "N targets"; all devices → "N devices"
        label = window.CustomI18n.getMessage('n_targets', [String(total)]);
      } else {
        label = window.CustomI18n.getMessage('n_devices', [String(total)]);
      }
      targetControlLabel.textContent = label;
      targetControl.title = window.CustomI18n.getMessage('target_custom_tooltip', [names.join(', ')]);
    }
  }

  function createTargetMenuOption(iden, label, email) {
    const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/></svg>';
    const option = document.createElement('button');
    option.className = 'menu-option';
    option.type = 'button';
    // People rows key by email; device rows by iden; the default/all row keeps
    // the empty iden. Device and people rows are both independent toggles.
    const isToggle = !!iden || !!email;
    if (email) {
      option.dataset.email = email;
    } else {
      option.dataset.iden = iden;
    }
    option.title = label;

    if (isToggle) {
      // device / people rows are independent toggles → leading checkbox
      const checkbox = document.createElement('span');
      checkbox.className = 'opt-checkbox';
      checkbox.innerHTML = CHECK_SVG;
      option.appendChild(checkbox);
    }

    const text = document.createElement('span');
    text.className = 'opt-text';
    text.textContent = label;
    option.appendChild(text);

    if (!isToggle) {
      // the default/all row is a single current-state choice → trailing ✓
      const check = document.createElement('span');
      check.className = 'opt-check';
      check.innerHTML = CHECK_SVG;
      option.appendChild(check);
    }

    return option;
  }

  function buildTargetMenu() {
    const fragment = document.createDocumentFragment();

    // Top option = back to the configured default; qualified so it can't be
    // confused with the same device's own row below ("" iden = default).
    const defaultOptionLabel = hasConfiguredDefault
      ? window.CustomI18n.getMessage('default_target_option', [defaultTargetLabel])
      : defaultTargetLabel;
    fragment.appendChild(createTargetMenuOption('', defaultOptionLabel));

    // Visible hint (tooltips are kept short on purpose): the default lives on
    // the options page — the green "Options" link takes you there. Split into
    // text + link keys like the options page's visit_link_tip pattern.
    const settingsTip = document.createElement('div');
    settingsTip.className = 'menu-tip';
    const tipText = document.createElement('span');
    tipText.textContent = window.CustomI18n.getMessage('change_target_tip');
    const tipLink = document.createElement('button');
    tipLink.className = 'menu-tip-link';
    tipLink.type = 'button';
    tipLink.textContent = window.CustomI18n.getMessage('options_link_text');
    tipLink.onclick = () => {
      chrome.runtime.openOptionsPage();
    };
    settingsTip.appendChild(tipText);
    settingsTip.appendChild(document.createTextNode(' '));
    settingsTip.appendChild(tipLink);
    fragment.appendChild(settingsTip);

    const divider = document.createElement('div');
    divider.className = 'menu-divider';
    fragment.appendChild(divider);

    targetDevices.forEach(device => {
      fragment.appendChild(createTargetMenuOption(device.iden, deviceLabel(device)));
    });

    // People section: divider + small tertiary label + one toggle row per
    // person, mixed freely with the device rows above. targetPeople is already
    // gated on enableChat (empty when Chat is off).
    if (targetPeople.length) {
      const peopleDivider = document.createElement('div');
      peopleDivider.className = 'menu-divider';
      fragment.appendChild(peopleDivider);

      const peopleLabel = document.createElement('div');
      peopleLabel.className = 'menu-section-label';
      peopleLabel.textContent = window.CustomI18n.getMessage('people_menu_label');
      fragment.appendChild(peopleLabel);

      targetPeople.forEach(person => {
        fragment.appendChild(createTargetMenuOption(null, personLabel(person), person.email_normalized));
      });
    }

    targetMenu.replaceChildren(fragment);
    markTargetMenuSelection();
  }

  function markTargetMenuSelection() {
    targetMenu.querySelectorAll('.menu-option').forEach(option => {
      const email = option.dataset.email;
      const iden = option.dataset.iden;
      let isSelected;
      if (email) {
        isSelected = perSendTargetEmails.includes(email);
      } else if (iden) {
        isSelected = perSendTargetIdens.includes(iden);
      } else {
        // default/all row — selected only when nothing is overridden
        isSelected = perSendTargetIdens.length === 0 && perSendTargetEmails.length === 0;
      }
      option.classList.toggle('selected', isSelected);
    });
  }

  function openTargetMenu() {
    buildTargetMenu();
    targetMenu.hidden = false;
  }

  function closeTargetMenu() {
    targetMenu.hidden = true;
  }

  // Snaps the control back to its quiet default face — the ✕ and option-off
  // paths. Sends do NOT reset it; closing the popup does (in-memory only).
  function resetPerSendTarget() {
    if (perSendTargetIdens.length || perSendTargetEmails.length) {
      perSendTargetIdens = [];
      perSendTargetEmails = [];
      renderTargetControl();
    }
  }

  // Apply the current per-send selection to a push payload: selected devices →
  // device_iden, selected people → email (either may be absent). With no
  // per-send override, fall back to the configured default device(s) — this
  // keeps quick-share and typed sends device-only by default.
  function applyPerSendTargets(pushData, remoteDeviceId) {
    if (perSendTargetIdens.length || perSendTargetEmails.length) {
      if (perSendTargetIdens.length) {
        pushData.device_iden = perSendTargetIdens.join(',');
      }
      if (perSendTargetEmails.length) {
        pushData.email = perSendTargetEmails.join(',');
      }
    } else if (remoteDeviceId) {
      pushData.device_iden = remoteDeviceId;
    }
  }

  // Reflect the input's content on the Send button: disabled when the trimmed
  // body is empty, matching sendMessage()'s own empty-guard so the button is
  // only actionable when there's actually something to send.
  function updateSendButtonState() {
    sendButton.disabled = bodyInput.value.trim() === '';
  }

  // Grow the input with its content (Shift+Enter / pasted multi-line text)
  // from the idle 40px up to the ~5-line cap, then hand overflow to the inner
  // scrollbar. Content is measured at height:auto, which is why the element
  // carries rows="1" — the default of 2 makes even an empty box measure two
  // lines tall. overflow-y flips to auto only at the cap: leaving it auto
  // while growing risks a phantom scrollbar from scrollHeight rounding.
  function fitComposeHeight() {
    const maxHeight = 118; // 5 lines × 19.6px + 18px padding + 2px border
    bodyInput.style.height = 'auto';
    const needed = bodyInput.scrollHeight + 2; // scrollHeight excludes the border
    bodyInput.style.height = Math.max(40, Math.min(needed, maxHeight)) + 'px';
    bodyInput.style.overflowY = needed > maxHeight ? 'auto' : 'hidden';
  }

  async function sendMessage() {
    const body = bodyInput.value.trim();

    if (!body) {
      return;
    }

    const isUrl = isValidUrl(body);
    const pushData = {
      type: isUrl ? 'link' : 'note',
      body: isUrl ? '' : body
    };

    if (isUrl) {
      pushData.url = body;
    }

    if (currentTab === 'chat' && chatView === 'conv' && currentPerson) {
      // Conversation send: addressed to this person only. The per-send target
      // picker does not apply here (the header names the recipient).
      pushData.email = currentPerson.email_normalized;
    } else {
      const configData = await chrome.storage.local.get('remoteDeviceId');
      applyPerSendTargets(pushData, configData.remoteDeviceId);
    }

    chrome.runtime.sendMessage({
      type: 'send_push',
      data: pushData
    });

    bodyInput.value = '';
    updateSendButtonState();
    fitComposeHeight();
  }



  function isValidUrl(string) {
    // Match the same prefixes parseTextWithLinks() linkifies on display, so the
    // send side can't promote non-URL text (e.g. "P2: ...", "foo: bar") to a
    // link push just because new URL() accepts any scheme-prefixed string.
    return /^(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)$/i.test(string);
  }

  function parseTextWithLinks(text, container, linkClass) {
    const urlRegex = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      const link = document.createElement('a');
      const url = match[1];
      link.href = url.toLowerCase().startsWith('www.') ? 'https://' + url : url;
      link.textContent = url;
      link.className = linkClass;
      link.target = '_blank';
      container.appendChild(link);

      lastIndex = urlRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      container.appendChild(document.createTextNode(text.slice(lastIndex)));
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

      // Snapshot the target(s) now (before the upload await) — devices and/or
      // people; fall back to the configured default device when nothing is
      // overridden.
      const target = (perSendTargetIdens.length || perSendTargetEmails.length)
        ? {
            device_iden: perSendTargetIdens.length ? perSendTargetIdens.join(',') : undefined,
            email: perSendTargetEmails.length ? perSendTargetEmails.join(',') : undefined
          }
        : { device_iden: configData.remoteDeviceId };
      await uploadPastedFile(file, tokenData.accessToken, target);

      bodyInput.placeholder = fileType.charAt(0).toUpperCase() + fileType.slice(1) + window.CustomI18n.getMessage('uploaded_successfully');
      setTimeout(() => {
        bodyInput.placeholder = window.CustomI18n.getMessage('type_or_paste_placeholder');
        bodyInput.disabled = false;
        updateSendButtonState();
      }, 2000);

    } catch (error) {
      bodyInput.placeholder = fileType.charAt(0).toUpperCase() + fileType.slice(1) + ' ' + window.CustomI18n.getMessage('upload_failed_retry');
      
      setTimeout(() => {
        bodyInput.placeholder = window.CustomI18n.getMessage('type_or_paste_placeholder');
        bodyInput.disabled = false;
        updateSendButtonState();
      }, 3000);
    }
  }

  async function uploadPastedFile(file, accessToken, target) {
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

    if (target.device_iden) {
      pushData.device_iden = target.device_iden;
    }
    if (target.email) {
      pushData.email = target.email;
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

    // Add new theme class (or nothing for system mode, :root handles it)
    if (mode !== 'system') {
      body.classList.add(`theme-${mode}`);
    }

    // Handle responsive sizing for Chrome zoom/scaling
    // Use window.innerHeight to get the actual available viewport height after zoom is applied
    requestAnimationFrame(() => {
      setTimeout(() => {
        body.style.height = window.innerHeight + "px";
      }, 50);
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

    // The target control's labels are built from messages — refresh them
    initTargetSelector();
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && (changes.pushes || changes.sentMessages)) {
      // Detect if deleting (either array shrinks)
      const oldPushesLen = changes.pushes?.oldValue?.length || 0;
      const newPushesLen = changes.pushes?.newValue?.length || 0;
      const oldSentLen = changes.sentMessages?.oldValue?.length || 0;
      const newSentLen = changes.sentMessages?.newValue?.length || 0;
      const isDeleting = (changes.pushes && newPushesLen < oldPushesLen) ||
                         (changes.sentMessages && newSentLen < oldSentLen);

      const savedScrollTop = isDeleting ? messagesList.scrollTop : null;
      debouncedLoadMessages(savedScrollTop);

      // Keep the Chat surfaces live: a new push in the open conversation
      // re-stamps it read (keeps the dot cleared) then re-renders; otherwise the
      // list re-renders (snippets, times, unread dots).
      if (currentTab === 'chat') {
        if (chatView === 'conv' && currentPerson) {
          stampPersonRead(currentPerson.email_normalized);
          renderConversation();
        } else {
          renderPeopleList();
        }
      }
    }
    if (areaName === 'local' && changes.mirrorNotifications) {
      // Scroll to bottom only when new content arrived, i.e. a new or updated
      // entry at the front of the stored array; deletions and dismissed-flag
      // writes (same entries, same order) keep the scroll position.
      const oldLength = changes.mirrorNotifications.oldValue?.length || 0;
      const newLength = changes.mirrorNotifications.newValue?.length || 0;
      const oldFirst = changes.mirrorNotifications.oldValue?.[0];
      const newFirst = changes.mirrorNotifications.newValue?.[0];
      const hasNewContent = newLength >= oldLength && !!newFirst &&
        (!oldFirst || newFirst.id !== oldFirst.id ||
          (newFirst.receivedAt ?? newFirst.created) !== (oldFirst.receivedAt ?? oldFirst.created));

      const savedScrollTop = hasNewContent ? null : notificationsList.scrollTop;
      debouncedLoadNotifications(savedScrollTop);
    }
    if (areaName === 'sync' && changes.accessToken) {
      checkAccessToken().then(() => {
        debouncedLoadMessages();
        checkNotificationMirroring();
      });
    }
    if (areaName === 'local' && changes.notificationMirroring) {
      // Reactive surface toggle: keep the active tab if still available, else
      // fall back (see checkNotificationMirroring).
      checkNotificationMirroring({ preserveCurrent: true });
    }
    if (areaName === 'local' && changes.enableChat) {
      // Chat surface toggled. undefined = not yet seeded, behaves as off; the
      // background seeds true once people first exist, and that enableChat write
      // (not the people write) is what flips Chat visibility live after Retrieve.
      // Same preserve-or-fall-back behavior.
      checkNotificationMirroring({ preserveCurrent: true });
    }
    if (areaName === 'local' && changes.mirrorDecryptIssue) {
      debouncedLoadNotifications();
    }
    if (areaName === 'local' && changes.showSmsShortcut) {
      checkSmsShortcut();
    }
    if (areaName === 'local' && changes.showQuickShare) {
      checkQuickShare();
    }
    if (areaName === 'local' && (changes.showPerSendTarget || changes.remoteDeviceId || changes.devices || changes.people || changes.enableChat)) {
      initTargetSelector();
    }
    if (areaName === 'local' && changes.people && currentTab === 'chat') {
      // People list changed (mute/name/avatar upgrade, added/removed people):
      // refresh the open conversation's person + timeline, or the list.
      if (chatView === 'conv' && currentPerson) {
        const updated = (changes.people.newValue || []).find(p => p.email_normalized === currentPerson.email_normalized);
        if (updated) {
          currentPerson = updated;
          refreshConversationHeader();
        }
        renderConversation();
      } else {
        renderPeopleList();
      }
    }
    if (areaName === 'local' && changes.peopleLastRead && currentTab === 'chat' && chatView === 'list') {
      // Read stamps changed — refresh the list so unread dots clear.
      renderPeopleList();
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
          // Re-render the Chat surfaces so their programmatic strings re-localize.
          if (currentTab === 'chat') {
            if (chatView === 'conv' && currentPerson) {
              refreshConversationHeader();
              renderConversation();
            } else {
              renderPeopleList();
            }
          }
        });
      }
    }
    if (areaName === 'local' && changes.defaultTab) {
      // Default tab changed (options Save): re-apply, honoring which surfaces
      // are enabled (Push always, Chat/Notification per their toggles). The
      // saved value itself is never rewritten here.
      checkNotificationMirroring();
    }
    if (areaName === 'local' && (changes.unreadPushCount || changes.unreadChatCount ||
        changes.unreadMirrorCount || changes.displayUnreadCounts || changes.displayUnreadPushes ||
        changes.displayUnreadChats || changes.displayUnreadMirrored)) {
      // Any toolbar-badge input changed → refresh the per-tab pills to match.
      // Covers the clear paths too (Push/Notification tab open, conversation
      // read), so switchTab needs no manual refresh.
      updateTabCounts();
    }
  });
});