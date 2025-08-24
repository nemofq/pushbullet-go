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

// Export functions for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getMessage, changeLanguage, getCurrentLanguage, initializeI18n };
} else {
  // Browser environment - attach to window
  window.CustomI18n = { getMessage, changeLanguage, getCurrentLanguage, initializeI18n };
}

// Auto-initialize when script loads (only in DOM context)
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeI18n();
  });
}