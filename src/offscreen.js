// Sync listener wrapper: an async listener returns a Promise for every message,
// which Chrome treats as sendResponse(undefined). When the offscreen document
// is open, popup messages like get_status would otherwise race the background
// listener and resolve to undefined here. Only kick off async work for messages
// we actually handle; never return a value.
chrome.runtime.onMessage.addListener((message) => {
  if (message.target !== 'offscreen-doc') {
    return;
  }

  switch (message.type) {
    case 'PLAY_ALERT_SOUND':
      handleAudioPlayback(message.src);
      break;
    default:
      console.warn(`Unexpected message type received: '${message.type}'.`);
  }
});

const DEFAULT_SOUND_SRC = 'assets/alert.ogg';

// src is a user-chosen sound as a data URL, or null for the bundled alert.
// A custom sound that fails to load or play falls back to the bundled one.
async function handleAudioPlayback(src) {
  const audio = document.getElementById('alertSound');
  try {
    await playFrom(audio, src || DEFAULT_SOUND_SRC);
    console.log('Alert sound played successfully');
  } catch (error) {
    console.error('Error playing alert sound:', error);
    if (src) {
      try {
        await playFrom(audio, DEFAULT_SOUND_SRC);
      } catch (fallbackError) {
        console.error('Error playing fallback alert sound:', fallbackError);
      }
    }
  }
  // Don't close window for audio - let it persist for multiple notifications
}

// Only swap the source when it changed, so repeat alerts don't re-decode a
// custom data URL; rewind so back-to-back alerts each play from the start.
async function playFrom(audio, src) {
  if (audio.getAttribute('src') !== src) {
    audio.setAttribute('src', src);
  }
  audio.currentTime = 0;
  await audio.play();
}

// Signal the service worker that the message listener above is live. Awaiting
// createDocument() is not enough on the SW side: it resolves when the document
// is created, not when this script has run, so an immediate playback request
// can arrive before the listener exists and be silently dropped.
chrome.runtime.sendMessage({ type: 'OFFSCREEN_READY' });
