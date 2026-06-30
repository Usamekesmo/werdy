
// ============================================================
// Firebase Messaging Service Worker - للإشعارات الخارجية
// ============================================================

importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js');

// ===== تكوين Firebase (نفس المعلومات من index.html) =====
firebase.initializeApp({
    apiKey: "AIzaSyAWLfavj6BWQOUVOzzGXOvxrDa05q2m5X8",
    authDomain: "quranparts-d6af3.firebaseapp.com",
    projectId: "quranparts-d6af3",
    storageBucket: "quranparts-d6af3.firebasestorage.app",
    messagingSenderId: "763536516319",
    appId: "1:763536516319:web:6796a74b95aa12c60c356a"
});

const messaging = firebase.messaging();

// ===== معالجة الإشعارات في الخلفية (عندما يكون التطبيق مغلقاً) =====
messaging.onBackgroundMessage((payload) => {
    console.log('📨 إشعار في الخلفية:', payload);
    
    // استخراج البيانات
    const notificationTitle = payload.notification?.title || 'ختمتي';
    const notificationBody = payload.notification?.body || 'لديك إشعار جديد';
    const notificationIcon = payload.notification?.icon || '/icons/icon-192.png';
    const notificationBadge = payload.notification?.badge || '/icons/icon-72.png';
    const notificationData = payload.data || {};
    const notificationLink = notificationData.link || '/werdy/';
    
    // خيارات الإشعار
    const notificationOptions = {
        body: notificationBody,
        icon: notificationIcon,
        badge: notificationBadge,
        vibrate: [200, 100, 200],
        data: {
            ...notificationData,
            link: notificationLink,
            url: notificationLink
        },
        requireInteraction: true,
        tag: notificationData.tag || 'default',
        renotify: true,
        actions: [
            {
                action: 'open',
                title: '📖 فتح التطبيق'
            },
            {
                action: 'read',
                title: '📝 سجل الورد'
            },
            {
                action: 'dismiss',
                title: '❌ إغلاق'
            }
        ]
    };
    
    // عرض الإشعار
    self.registration.showNotification(notificationTitle, notificationOptions);
});

// ===== التعامل مع النقر على الإشعار =====
self.addEventListener('notificationclick', (event) => {
    console.log('📨 نقرة على الإشعار:', event);
    
    const notification = event.notification;
    const action = event.action;
    const data = notification.data || {};
    
    // إغلاق الإشعار
    notification.close();
    
    // تحديد الرابط حسب الإجراء
    let urlToOpen = data.link || '/werdy/';
    
    if (action === 'read') {
        urlToOpen = '/werdy/?action=daily';
    } else if (action === 'open') {
        urlToOpen = data.link || '/werdy/';
    } else if (action === 'dismiss') {
        return; // لا تفتح شيئاً
    }
    
    // فتح التطبيق
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(windowClients => {
                // البحث عن نافذة مفتوحة
                for (const client of windowClients) {
                    if (client.url.includes('/werdy/') && 'focus' in client) {
                        // توجيه النافذة المفتوحة
                        client.postMessage({
                            type: 'notification-click',
                            action: action,
                            data: data,
                            url: urlToOpen
                        });
                        return client.focus();
                    }
                }
                // فتح نافذة جديدة
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// ===== التعامل مع إغلاق الإشعار =====
self.addEventListener('notificationclose', (event) => {
    console.log('📨 تم إغلاق الإشعار:', event.notification);
});

console.log('✅ Firebase Messaging Service Worker جاهز');
