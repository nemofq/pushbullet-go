// Handle messages from the service worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PLAY_ALERT_SOUND') {
    const audio = document.getElementById('alertSound');
    
    // Play the sound
    audio.play()
      .then(() => {
        console.log('Alert sound played successfully');
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('Error playing alert sound:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Return true to indicate we will respond asynchronously
    return true;
  }
});

console.log('Offscreen document ready for audio playback');