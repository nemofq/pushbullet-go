// Custom i18n system for Chrome Extension
let cachedMessages = {};
let currentLanguage = 'auto';
let isInitialized = false;

// Initialize the i18n system
async function initializeI18n() {
  try {
    const data = await chrome.storage.local.get('languageMode');
    currentLanguage = data.languageMode || 'auto';
    
    if (currentLanguage === 'auto') {
      // Use Chrome's default behavior
      isInitialized = true;
      return;
    }
    
    // Load custom locale file
    await loadLocaleMessages(currentLanguage);
    isInitialized = true;
  } catch (error) {
    console.warn('Failed to initialize custom i18n, falling back to Chrome default:', error);
    currentLanguage = 'auto';
    isInitialized = true;
  }
}

// Load messages for a specific locale
async function loadLocaleMessages(locale) {
  try {
    const response = await fetch(chrome.runtime.getURL(`_locales/${locale}/messages.json`));
    if (response.ok) {
      cachedMessages = await response.json();
    } else {
      throw new Error(`Failed to load locale ${locale}`);
    }
  } catch (error) {
    console.warn(`Failed to load locale ${locale}, falling back to English:`, error);
    // Try to load English as fallback
    try {
      const response = await fetch(chrome.runtime.getURL('_locales/en/messages.json'));
      if (response.ok) {
        cachedMessages = await response.json();
      }
    } catch (fallbackError) {
      console.error('Failed to load fallback locale:', fallbackError);
      throw fallbackError;
    }
  }
}

// Custom getMessage function that replaces chrome.i18n.getMessage
function getMessage(messageKey, substitutions = []) {
  // Ensure i18n is initialized
  if (!isInitialized) {
    // If not initialized, use Chrome's default for now
    return chrome.i18n.getMessage(messageKey, substitutions);
  }
  
  if (currentLanguage === 'auto') {
    // Use Chrome's default behavior
    return chrome.i18n.getMessage(messageKey, substitutions);
  }
  
  // Use custom loaded messages
  const messageObj = cachedMessages[messageKey];
  if (!messageObj || !messageObj.message) {
    // Fallback to Chrome's default if message not found
    return chrome.i18n.getMessage(messageKey, substitutions);
  }
  
  let message = messageObj.message;
  
  // Handle substitutions
  if (substitutions && substitutions.length > 0) {
    substitutions.forEach((substitution, index) => {
      const placeholder = `$${index + 1}`;
      message = message.replace(new RegExp(`\\${placeholder}`, 'g'), substitution);
    });
  }
  
  return message;
}

// Function to change language and reload messages
async function changeLanguage(newLanguage) {
  currentLanguage = newLanguage;
  
  if (newLanguage === 'auto') {
    cachedMessages = {};
  } else {
    await loadLocaleMessages(newLanguage);
  }
  
  // Save the language preference
  await chrome.storage.local.set({ languageMode: newLanguage });
}

// Function to get current language
function getCurrentLanguage() {
  return currentLanguage;
}

// Resolve the active locale as a BCP-47 tag, honoring the manual language
// override so timestamps track the same locale as the rest of the UI.
function getActiveLocale() {
  if (!currentLanguage || currentLanguage === 'auto') {
    try {
      return chrome.i18n.getUILanguage() || 'en';
    } catch (error) {
      return 'en';
    }
  }
  // Chrome locale codes use '_' (zh_CN); Intl/BCP-47 expects '-'.
  return currentLanguage.replace('_', '-');
}

// Tiered, locale-aware timestamp formatter. Returns { text, title }:
//   text  - shortest unambiguous label for how old `ms` (epoch milliseconds) is
//   title - full absolute date+time, intended for a hover tooltip
// All wording (relative phrases, month/weekday names, plural forms, 12/24h) is
// produced by Intl keyed to the active locale, so no message strings are needed.
function formatTimestamp(ms, options = {}) {
  if (!Number.isFinite(ms)) {
    return { text: '', title: '' };
  }

  const locale = getActiveLocale();
  const nowMs = Number.isFinite(options.now) ? options.now : Date.now();
  const date = new Date(ms);

  // Full absolute timestamp for the tooltip (locale decides order and 12/24h).
  const title = new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).format(date);

  // Clamp future timestamps (clock skew) so they read as "now".
  const diffSec = Math.max(0, (nowMs - ms) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  const timeOfDay = () => new Intl.DateTimeFormat(locale, {
    hour: '2-digit', minute: '2-digit'
  }).format(date);

  let text;
  if (diffSec < 60) {
    text = rtf.format(0, 'second');                       // locale's "now"
  } else if (diffSec < 3600) {
    text = rtf.format(-Math.floor(diffSec / 60), 'minute'); // "5 min ago"
  } else {
    // Calendar-aware tiers for everything older than an hour.
    const startOfToday = new Date(nowMs);
    startOfToday.setHours(0, 0, 0, 0);
    const dayMs = 86400000;

    if (ms >= startOfToday.getTime()) {
      text = timeOfDay();                                 // earlier today -> "14:30"
    } else if (ms >= startOfToday.getTime() - dayMs) {
      text = `${rtf.format(-1, 'day')} ${timeOfDay()}`;   // "yesterday 21:15"
    } else if (ms >= startOfToday.getTime() - 6 * dayMs) {
      text = new Intl.DateTimeFormat(locale, {
        weekday: 'short', hour: '2-digit', minute: '2-digit'
      }).format(date);                                    // "Tue 09:40"
    } else if (date.getFullYear() === startOfToday.getFullYear()) {
      text = new Intl.DateTimeFormat(locale, {
        month: 'short', day: 'numeric'
      }).format(date);                                    // "14 Mar"
    } else {
      text = new Intl.DateTimeFormat(locale, {
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(date);                                    // older -> full date
    }
  }

  return { text, title };
}

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getMessage, changeLanguage, getCurrentLanguage, initializeI18n, getActiveLocale, formatTimestamp };
} else {
  // Browser environment - attach to window
  window.CustomI18n = { getMessage, changeLanguage, getCurrentLanguage, initializeI18n, getActiveLocale, formatTimestamp };
}

// Auto-initialize when script loads (only in DOM context)
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeI18n();
  });
}