// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAwED6Sq3-6cUPJ4QcCdj6xAqEiXfP0J9c",
  authDomain: "nexo-7fc25.firebaseapp.com",
  projectId: "nexo-7fc25",
  storageBucket: "nexo-7fc25.firebasestorage.app",
  messagingSenderId: "592565521792",
  appId: "1:592565521792:web:0842ec948362df3e720565",
  measurementId: "G-11HMWKHPJY"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// Helper function to get icon URL (convert relative to absolute if needed)
const getIconUrl = (icon, baseUrl = self.location.origin) => {
  if (!icon) {
    return `${baseUrl}/android-chrome-192x192.png`;
  }
  // If already absolute URL, return as is
  if (icon.startsWith('http://') || icon.startsWith('https://')) {
    return icon;
  }
  // Convert relative to absolute
  return icon.startsWith('/') ? `${baseUrl}${icon}` : `${baseUrl}/${icon}`;
};

// Helper function to get icon based on notification type
const getNotificationIcon = (type, customIcon) => {
  // If custom icon is provided, use it
  if (customIcon) {
    return getIconUrl(customIcon);
  }
  
  // Default icons based on notification type
  const iconMap = {
    'new-notification': '/android-chrome-192x192.png',
    'booking': '/android-chrome-192x192.png',
    'job': '/android-chrome-192x192.png',
    'alert': '/android-chrome-192x192.png',
    'message': '/android-chrome-192x192.png',
    'info': '/android-chrome-192x192.png',
    'success': '/android-chrome-192x192.png',
    'warning': '/android-chrome-192x192.png',
    'error': '/android-chrome-192x192.png',
    'test_notification': '/android-chrome-192x192.png'
  };
  
  return getIconUrl(iconMap[type] || '/android-chrome-192x192.png');
};

// Play notification sound in service worker
const playNotificationSound = () => {
  try {
    // Try to use Web Audio API if available
    if (self.AudioContext || self.webkitAudioContext) {
      const audioContext = new (self.AudioContext || self.webkitAudioContext)();
      
      // Check if audio context state is suspended (requires user interaction)
      if (audioContext.state === 'suspended') {
        // Try to resume - this might work if user has interacted with the page
        audioContext.resume().catch(() => {
          // AudioContext suspended, browser will use default notification sound
        });
      }
      
      // Create oscillator for the beep sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Configure sound
      oscillator.frequency.value = 800; // Frequency in Hz
      oscillator.type = 'sine';
      
      // Set volume envelope
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      // Play sound
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
      
      // Clean up
      oscillator.onended = () => {
        try {
          audioContext.close();
        } catch (e) {
          // Ignore cleanup errors
        }
      };
    }
  } catch (error) {
    // Could not play notification sound via Web Audio API, browser will use default sound
  }
};

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  // Play notification sound
  playNotificationSound();
  
  const notificationTitle = payload.notification?.title || payload.data?.title || 'New Notification';
  const notificationBody = payload.notification?.body || payload.data?.message || 'You have a new notification';
  const notificationType = payload.data?.type || payload.notification?.type || 'new-notification';
  const notificationIcon = payload.notification?.icon || payload.data?.icon;
  const notificationImage = payload.notification?.image || payload.data?.image;
  
  const iconUrl = getNotificationIcon(notificationType, notificationIcon);
  const badgeUrl = getIconUrl('/android-chrome-192x192.png');
  const imageUrl = notificationImage ? (notificationImage.startsWith('http') ? notificationImage : `${self.location.origin}${notificationImage.startsWith('/') ? notificationImage : '/' + notificationImage}`) : null;

  const notificationOptions = {
    body: notificationBody,
    icon: iconUrl,
    badge: badgeUrl,
    tag: notificationType,
    data: payload.data,
    requireInteraction: false,
    silent: false, // CRITICAL: Must be false for sound to play
    sound: payload.notification?.sound || payload.data?.sound || 'default', // Use sound from payload or default
    timestamp: Date.now(),
    vibrate: [200, 100, 200],
    renotify: true, // Re-notify if same tag exists
    // Add image if available (for rich notifications)
    ...(imageUrl && { image: imageUrl })
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Handle the notification click
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

