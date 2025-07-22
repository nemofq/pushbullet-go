document.addEventListener('DOMContentLoaded', function() {
  const fileInput = document.getElementById('fileInput');
  const fileButton = document.getElementById('fileButton');
  const progress = document.getElementById('progress');
  const progressFill = document.getElementById('progressFill');
  const status = document.getElementById('status');

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
    status.textContent = 'Processing file...';
    progressFill.style.width = '20%';

    try {
      // Get access token and device config
      const [tokenData, configData] = await Promise.all([
        chrome.storage.sync.get('accessToken'),
        chrome.storage.sync.get('remoteDeviceId')
      ]);

      if (!tokenData.accessToken) {
        throw new Error('No access token found. Please configure in options.');
      }

      status.textContent = 'Uploading file...';
      progressFill.style.width = '50%';

      // Upload file using Pushbullet API directly
      await uploadFile(file, tokenData.accessToken, configData.remoteDeviceId);

      status.textContent = 'Upload complete!';
      progressFill.style.width = '100%';

      // Close window after a short delay
      setTimeout(() => {
        window.close();
      }, 1500);

    } catch (error) {
      console.error('File upload failed:', error);
      status.textContent = 'Upload failed: ' + error.message;
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
    
    status.textContent = 'Uploading to server...';
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

    status.textContent = 'Creating push...';
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

    const pushResponse = await fetch('https://api.pushbullet.com/v2/pushes', {
      method: 'POST',
      headers: {
        'Access-Token': accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pushData)
    });

    if (!pushResponse.ok) {
      throw new Error('Failed to create push');
    }

    const push = await pushResponse.json();
    console.log('File upload window: Push created successfully:', push);

    // Store sent message for display in popup
    const existingSentMessages = await chrome.storage.local.get('sentMessages');
    const sentMessages = existingSentMessages.sentMessages || [];
    
    push.isSent = true;
    push.sentAt = Date.now();
    
    sentMessages.unshift(push);
    await chrome.storage.local.set({ sentMessages: sentMessages.slice(0, 100) });
  }
});