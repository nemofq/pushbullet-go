document.addEventListener('DOMContentLoaded', function() {
  const accessTokenInput = document.getElementById('accessToken');
  const localDeviceSelect = document.getElementById('localDeviceId');
  const remoteDeviceSelect = document.getElementById('remoteDeviceId');
  const saveButton = document.getElementById('save');
  const retrieveDevicesButton = document.getElementById('retrieveDevices');
  const status = document.getElementById('status');
  
  let devices = [];

  chrome.storage.sync.get(['accessToken', 'localDeviceId', 'remoteDeviceId', 'devices'], function(data) {
    accessTokenInput.value = data.accessToken || '';
    devices = data.devices || [];
    populateDeviceSelects();
    
    if (data.localDeviceId) {
      localDeviceSelect.value = data.localDeviceId;
    }
    
    if (data.remoteDeviceId) {
      const remoteIds = data.remoteDeviceId.split(',').map(id => id.trim()).filter(id => id);
      Array.from(remoteDeviceSelect.options).forEach(option => {
        option.selected = remoteIds.includes(option.value);
      });
    }
    
    updateRetrieveButton();
  });
  
  accessTokenInput.addEventListener('input', updateRetrieveButton);

  retrieveDevicesButton.addEventListener('click', async function() {
    const accessToken = accessTokenInput.value.trim();
    if (!accessToken) return;
    
    retrieveDevicesButton.disabled = true;
    retrieveDevicesButton.textContent = 'Retrieving...';
    
    try {
      const response = await fetch('https://api.pushbullet.com/v2/devices', {
        headers: {
          'Access-Token': accessToken
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch devices: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      devices = data.devices || [];
      
      await chrome.storage.sync.set({ devices: devices });
      
      populateDeviceSelects();
      showStatus('Devices retrieved successfully!', 'success');
      
    } catch (error) {
      console.error('Error retrieving devices:', error);
      showStatus(`Error: ${error.message}`, 'error');
    } finally {
      retrieveDevicesButton.disabled = false;
      retrieveDevicesButton.textContent = 'Retrieve Devices';
    }
  });

  saveButton.addEventListener('click', function() {
    const accessToken = accessTokenInput.value.trim();
    const localDeviceId = localDeviceSelect.value;
    const selectedRemoteDevices = Array.from(remoteDeviceSelect.selectedOptions)
      .map(option => option.value)
      .filter(value => value)
      .join(',');

    const saveData = { 
      accessToken: accessToken || '',
      localDeviceId: localDeviceId || '',
      remoteDeviceId: selectedRemoteDevices || '',
      devices: devices
    };

    chrome.storage.sync.set(saveData, function() {
      showSaveSuccess();
      chrome.runtime.sendMessage({ type: 'token_updated' });
    });
  });

  function populateDeviceSelects() {
    localDeviceSelect.innerHTML = '<option value="">None</option>';
    remoteDeviceSelect.innerHTML = '<option value="">None (all devices)</option>';
    
    devices.forEach(device => {
      if (device.active) {
        const localOption = document.createElement('option');
        localOption.value = device.iden;
        localOption.textContent = device.nickname || `${device.manufacturer} ${device.model}`;
        localDeviceSelect.appendChild(localOption);
        
        const remoteOption = document.createElement('option');
        remoteOption.value = device.iden;
        remoteOption.textContent = device.nickname || `${device.manufacturer} ${device.model}`;
        remoteDeviceSelect.appendChild(remoteOption);
      }
    });
  }
  
  function updateRetrieveButton() {
    const hasToken = accessTokenInput.value.trim().length > 0;
    retrieveDevicesButton.disabled = !hasToken;
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
});