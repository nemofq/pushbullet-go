chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message) {
  if (message.target !== 'offscreen-doc') {
    return;
  }

  switch (message.type) {
    case 'PLAY_ALERT_SOUND':
      await handleAudioPlayback();
      break;
    default:
      console.warn(`Unexpected message type received: '${message.type}'.`);
  }
}

async function handleAudioPlayback() {
  try {
    const audio = document.getElementById('alertSound');
    await audio.play();
    console.log('Alert sound played successfully');
  } catch (error) {
    console.error('Error playing alert sound:', error);
  }
  // Don't close window for audio - let it persist for multiple notifications
}

// Signal the service worker that the message listener above is live. Awaiting
// createDocument() is not enough on the SW side: it resolves when the document
// is created, not when this script has run, so an immediate playback request
// can arrive before the listener exists and be silently dropped.
chrome.runtime.sendMessage({ type: 'OFFSCREEN_READY' });