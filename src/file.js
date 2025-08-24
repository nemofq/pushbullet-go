document.addEventListener('DOMContentLoaded', function() {
  const fileInput = document.getElementById('fileInput');
  const fileButton = document.getElementById('fileButton');
  const progress = document.getElementById('progress');
  const progressFill = document.getElementById('progressFill');
  const status = document.getElementById('status');

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

  fileButton.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', handleFileSelection);

  async function handleFileSelection() {
    const file = fileInput.files[0];
    if (!file) return;

    console.log('File upload window: File selected:', file.name);
    
    // Show progress
    progress.style.display = 'block';
    status.textContent = window.CustomI18n.getMessage('processing_file');
    progressFill.style.width = '20%';

    try {
      // Get access token and device config
      const [tokenData, configData] = await Promise.all([
        chrome.storage.sync.get('accessToken'),
        chrome.storage.local.get('remoteDeviceId')
      ]);

      if (!tokenData.accessToken) {
        throw new Error(window.CustomI18n.getMessage('no_access_token'));
      }

      status.textContent = window.CustomI18n.getMessage('preparing_upload');
      progressFill.style.width = '50%';

      // Upload file using Pushbullet API directly
      await uploadFile(file, tokenData.accessToken, configData.remoteDeviceId);

      status.textContent = window.CustomI18n.getMessage('file_image_pushed');
      progressFill.style.width = '100%';

      // Close window after a short delay
      setTimeout(() => {
        window.close();
      }, 1500);

    } catch (error) {
      console.error('File upload failed:', error);
      status.textContent = window.CustomI18n.getMessage('upload_failed') + error.message;
      progressFill.style.width = '0%';
    }
  }

  async function uploadFile(file, accessToken, remoteDeviceId) {
    // Step 1: Request upload URL
    const uploadRequest = await fetch('https://api.pushbullet.com/v2/upload-request', {
      method: 'POST',
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        file_name: file.name,
        file_type: file.type
      })
    });

    if (!uploadRequest.ok) {
      throw new Error('Failed to get upload URL');
    }

    const uploadData = await uploadRequest.json();
    
    status.textContent = window.CustomI18n.getMessage('uploading_to_server');
    progressFill.style.width = '70%';

    // Step 2: Upload file
    const formData = new FormData();
    if (uploadData.data) {
      Object.keys(uploadData.data).forEach(key => {
        formData.append(key, uploadData.data[key]);
      });
    }
    formData.append('file', file, file.name);

    const uploadResponse = await fetch(uploadData.upload_url, {
      method: 'POST',
      body: formData
    });

    if (!uploadResponse.ok) {
      throw new Error('File upload failed');
    }

    status.textContent = window.CustomI18n.getMessage('creating_push');
    progressFill.style.width = '90%';

    // Step 3: Create push
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

    console.log('File upload window: Push sent via background script');
  }

  async function loadAndApplyColorMode() {
    const data = await chrome.storage.local.get('colorMode');
    const colorMode = data.colorMode || 'system';
    applyColorMode(colorMode);
  }

  function initializeI18n() {
    // Replace all elements with data-i18n attribute
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(element => {
      const messageKey = element.getAttribute('data-i18n');
      element.textContent = window.CustomI18n.getMessage(messageKey);
    });
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