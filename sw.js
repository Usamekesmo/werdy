// ============================================================
// ختمتي - Service Worker محسن
// الإصدار 7.0
// ============================================================

const CACHE_NAME = 'khatma-v7.0';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/offline.html'
];

const DYNAMIC_CACHE = 'khatma-dynamic-v7';
const API_CACHE = 'khatma-api-v7';

// ==================== التثبيت ====================
self.addEventListener('install', event => {
    console.log('[SW] تثبيت Service Worker...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] تخزين الملفات الأساسية');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[SW] تم التثبيت بنجاح');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('[SW] خطأ في التثبيت:', error);
            })
    );
});

// ==================== التفعيل ====================
self.addEventListener('activate', event => {
    console.log('[SW] تفعيل Service Worker...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME && 
                            cacheName !== DYNAMIC_CACHE && 
                            cacheName !== API_CACHE) {
                            console.log('[SW] حذف الكاش القديم:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] تم التفعيل بنجاح');
                return self.clients.claim();
            })
    );
});

// ==================== التعامل مع الطلبات ====================
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    
    // استراتيجية مختلفة للـ API
    if (url.pathname.includes('/api/') || url.pathname.includes('/firestore/')) {
        return event.respondWith(handleAPIRequest(request));
    }
    
    // استراتيجية Cache First مع تحديث في الخلفية
    event.respondWith(
        caches.match(request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    // تحديث الكاش في الخلفية
                    event.waitUntil(
                        fetch(request)
                            .then(response => {
                                if (response && response.status === 200) {
                                    const cache = caches.open(DYNAMIC_CACHE);
                                    cache.then(c => c.put(request, response.clone()));
                                }
                                return response;
                            })
                            .catch(() => {})
                    );
                    return cachedResponse;
                }
                
                // محاولة جلب من الشبكة
                return fetch(request)
                    .then(response => {
                        if (response && response.status === 200) {
                            const responseClone = response.clone();
                            caches.open(DYNAMIC_CACHE)
                                .then(cache => {
                                    cache.put(request, responseClone);
                                })
                                .catch(() => {});
                        }
                        return response;
                    })
                    .catch(() => {
                        // عرض صفحة عدم الاتصال
                        return caches.match('/offline.html');
                    });
            })
    );
});

// ==================== معالجة طلبات API ====================
async function handleAPIRequest(request) {
    try {
        // محاولة الجلب من الشبكة أولاً
        const response = await fetch(request);
        if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(API_CACHE)
                .then(cache => {
                    cache.put(request, responseClone);
                })
                .catch(() => {});
            return response;
        }
        throw new Error('فشل الجلب');
    } catch (error) {
        // محاولة من الكاش
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        throw error;
    }
}

// ==================== الإشعارات ====================
self.addEventListener('push', event => {
    console.log('[SW] استلام إشعار:', event);
    
    let data = {
        title: 'ختمتي',
        body: 'لديك إشعار جديد',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        vibrate: [200, 100, 200],
        data: {
            url: '/'
        }
    };
    
    if (event.data) {
        try {
            const payload = event.data.json();
            data = { ...data, ...payload };
        } catch (e) {
            data.body = event.data.text();
        }
    }
    
    const options = {
        body: data.body,
        icon: data.icon || '/icons/icon-192.png',
        badge: data.badge || '/icons/icon-72.png',
        vibrate: data.vibrate || [200, 100, 200],
        data: data.data || { url: '/' },
        actions: data.actions || [
            {
                action: 'open',
                title: '📖 فتح التطبيق'
            },
            {
                action: 'read',
                title: '📝 سجل الورد'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || 'ختمتي', options)
    );
});

// ==================== التفاعل مع الإشعارات ====================
self.addEventListener('notificationclick', event => {
    console.log('[SW] نقرة على الإشعار:', event);
    
    const notification = event.notification;
    const action = event.action;
    const data = notification.data || {};
    
    notification.close();
    
    let url = data.url || '/';
    
    if (action === 'read') {
        url = '/?action=read';
    }
    
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(clients => {
                for (const client of clients) {
                    if (client.url.includes('/') && 'focus' in client) {
                        client.postMessage({
                            type: 'notification-click',
                            action: action,
                            data: data
                        });
                        return client.focus();
                    }
                }
                return self.clients.openWindow(url);
            })
            .catch(() => {
                return self.clients.openWindow(url);
            })
    );
});

// ==================== رسائل من الصفحة ====================
self.addEventListener('message', event => {
    console.log('[SW] استلام رسالة:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                event.ports[0].postMessage({ success: true });
            })
            .catch(() => {
                event.ports[0].postMessage({ success: false });
            });
    }
});

// ==================== تحديث التطبيق ====================
self.addEventListener('periodicsync', event => {
    if (event.tag === 'update-cache') {
        event.waitUntil(updateStaticAssets());
    }
});

async function updateStaticAssets() {
    try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(STATIC_ASSETS);
        console.log('[SW] تم تحديث الكاش');
    } catch (error) {
        console.error('[SW] خطأ في تحديث الكاش:', error);
    }
}

console.log('[SW] Service Worker جاهز');