document.addEventListener('DOMContentLoaded', function() {
  const accessTokenInput = document.getElementById('accessToken');
  const localDeviceIdInput = document.getElementById('localDeviceId');
  const remoteDeviceIdInput = document.getElementById('remoteDeviceId');
  const saveButton = document.getElementById('save');
  const status = document.getElementById('status');

  chrome.storage.sync.get(['accessToken', 'localDeviceId', 'remoteDeviceId'], function(data) {
    accessTokenInput.value = data.accessToken || '';
    localDeviceIdInput.value = data.localDeviceId || '';
    remoteDeviceIdInput.value = data.remoteDeviceId || '';
  });

  saveButton.addEventListener('click', function() {
    const accessToken = accessTokenInput.value.trim();
    const localDeviceId = localDeviceIdInput.value.trim();
    const remoteDeviceId = remoteDeviceIdInput.value.trim();

    const saveData = { 
      accessToken: accessToken || '',
      localDeviceId: localDeviceId || '',
      remoteDeviceId: remoteDeviceId || ''
    };

    chrome.storage.sync.set(saveData, function() {
      showSaveSuccess();
      chrome.runtime.sendMessage({ type: 'token_updated' });
    });
  });

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