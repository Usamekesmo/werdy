
// ============================================================
// ختمتي - التطبيق الاحترافي المتكامل
// الإصدار 7.4 - إصلاح مشكلة رسالة المشاركة
// ============================================================

// ==================== تكوين Firebase ====================
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAWLfavj6BWQOUVOzzGXOvxrDa05q2m5X8",
    authDomain: "quranparts-d6af3.firebaseapp.com",
    projectId: "quranparts-d6af3",
    storageBucket: "quranparts-d6af3.firebasestorage.app",
    messagingSenderId: "763536516319",
    appId: "1:763536516319:web:6796a74b95aa12c60c356a"
};

const VAPID_KEY = 'BGpXqZ5kQ9v3Ld2FgH7jK1mN4pR6sT8uVwXyZ2aBcDeFgHiJkLmNoPqRsTuVwXyZ';
const TOTAL_JUZ = 30;

const ROLES = {
    SUPER_ADMIN: 'superadmin',
    CIRCLE_SUPERVISOR: 'supervisor',
    CIRCLE_ADMIN: 'circleadmin',
    MEMBER: 'member',
    GUEST: 'guest'
};

// ==================== تهيئة Firebase ====================
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();
const db = firebase.firestore();
const messaging = firebase.messaging();

// ==================== حالة التطبيق ====================
class AppState {
    constructor() {
        this.user = null;
        this.circleId = null;
        this.memberData = null;
        this.memberId = null;
        this.role = ROLES.GUEST;
        this.supervisedCircles = [];
        this.gender = null;
        this.adminEmail = null;
        this.adminPassword = null;
        this.juzChart = null;
        this.audioPlayer = null;
        this.deferredPrompt = null;
        this.isGuest = false;
        this.settings = {
            maxCircleMembers: 30,
            maxExtraPerDay: 1,
            maxAbsenceDays: 3,
            reminderHour: 20
        };
        this.loadFromStorage();
    }
    
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('khatmaAppState');
            if (saved) {
                const data = JSON.parse(saved);
                if (data.user) {
                    this.user = {
                        uid: data.user.uid,
                        email: data.user.email,
                        displayName: data.user.displayName,
                        isGuest: data.user.isGuest || false
                    };
                }
                this.circleId = data.circleId || null;
                this.memberId = data.memberId || null;
                this.role = data.role || ROLES.GUEST;
                this.gender = data.gender || null;
                this.isGuest = data.isGuest || false;
            }
            const settings = localStorage.getItem('khatmaSettings');
            if (settings) {
                this.settings = { ...this.settings, ...JSON.parse(settings) };
            }
        } catch (e) {
            console.warn('فشل تحميل الحالة المخزنة:', e);
        }
    }
    
    saveToStorage() {
        try {
            const data = {
                user: this.user ? {
                    uid: this.user.uid,
                    email: this.user.email,
                    displayName: this.user.displayName,
                    isGuest: this.user.isGuest || false
                } : null,
                circleId: this.circleId,
                memberId: this.memberId,
                role: this.role,
                gender: this.gender,
                isGuest: this.isGuest
            };
            localStorage.setItem('khatmaAppState', JSON.stringify(data));
            localStorage.setItem('khatmaSettings', JSON.stringify(this.settings));
        } catch (e) {
            console.warn('فشل حفظ الحالة:', e);
        }
    }
    
    clear() {
        this.user = null;
        this.circleId = null;
        this.memberData = null;
        this.memberId = null;
        this.role = ROLES.GUEST;
        this.supervisedCircles = [];
        this.isGuest = false;
        localStorage.removeItem('khatmaAppState');
        localStorage.removeItem('khatmaAuth');
    }
}

const state = new AppState();

// ==================== الأدوات المساعدة ====================
const Utils = {
    toDate: function(value) {
        if (!value) return null;
        if (value.toDate) return value.toDate();
        if (value instanceof Date) return value;
        return new Date(value);
    },
    
    formatDate: function(date) {
        if (!date) return '-';
        const d = this.toDate(date);
        if (!d || isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' });
    },
    
    formatDateShort: function(date) {
        if (!date) return '-';
        const d = this.toDate(date);
        if (!d || isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('ar', { day: 'numeric', month: 'short' });
    },
    
    getTodayString: function() {
        return new Date().toDateString();
    },
    
    isSameDay: function(date1, date2) {
        if (!date1 || !date2) return false;
        const d1 = this.toDate(date1);
        const d2 = this.toDate(date2);
        if (!d1 || !d2) return false;
        return d1.toDateString() === d2.toDateString();
    },
    
    daysDifference: function(date1, date2) {
        if (!date1 || !date2) return 999;
        const d1 = this.toDate(date1);
        const d2 = this.toDate(date2);
        if (!d1 || !d2) return 999;
        return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
    },
    
    calculateKhatmas: function(parts) {
        return Math.floor((parts || 0) / 30);
    },
    
    escapeHtml: function(text) {
        if (!text) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    },
    
    generateCode: function(length) {
        length = length || 6;
        return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
    },
    
    delay: function(ms) {
        return new Promise(function(resolve) { setTimeout(resolve, ms); });
    },
    
    isValidEmail: function(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },
    
    isValidUsername: function(username) {
        return /^[a-zA-Z0-9_]{3,20}$/.test(username);
    },
    
    getUserStatus: function(memberData) {
        if (!memberData) {
            return { status: 'offline', color: '#ef4444', label: '🔴 غير متصل' };
        }
        const today = this.getTodayString();
        const lastRead = memberData.lastReadDate ? this.toDate(memberData.lastReadDate) : null;
        const lastReadStr = lastRead ? lastRead.toDateString() : null;
        
        if (memberData.isFrozen) {
            return { status: 'frozen', color: '#9ca3af', label: '⏸️ مجمد' };
        }
        if (lastReadStr === today) {
            return { status: 'online', color: '#22c55e', label: '🟢 متصل' };
        }
        const diff = this.daysDifference(lastReadStr, today);
        if (diff <= 2) {
            return { status: 'away', color: '#f59e0b', label: '🟠 غائب' };
        }
        return { status: 'offline', color: '#ef4444', label: '🔴 غائب' };
    },
    
    showToast: function(message, isError, duration) {
        isError = isError || false;
        duration = duration || 3000;
        const existing = document.querySelector('.toast-notification');
        if (existing) existing.remove();
        
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:' + (isError ? '#ef4444' : '#1a4739') + ';color:white;padding:15px 25px;border-radius:15px;z-index:9999;max-width:90%;box-shadow:0 10px 40px rgba(0,0,0,0.2);animation:slideIn 0.3s ease;font-size:15px;direction:rtl;';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(function() {
            if (toast.parentNode) toast.remove();
        }, duration);
    },
    
    showMessage: function(elementId, message, isError) {
        isError = isError || true;
        const el = document.getElementById(elementId);
        if (!el) return;
        el.textContent = message;
        el.className = 'message ' + (isError ? 'error' : 'success');
        el.style.display = 'block';
        setTimeout(function() {
            el.textContent = '';
            el.className = 'message';
            el.style.display = 'none';
        }, 4000);
    },
    
    showScreen: function(screenId) {
        document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
        const el = document.getElementById(screenId);
        if (el) {
            el.classList.add('active');
            const loading = document.getElementById('loadingScreen');
            if (loading) loading.classList.remove('active');
        }
    },
    
    getCurrentTab: function() {
        const active = document.querySelector('.main-tab-btn.active');
        return active ? active.dataset.tab : 'dashboard';
    },
    
    syncUserData: function() {
        try {
            if (!this.user || !this.memberData) return false;
            if (this.user.displayName && this.memberData.userName !== this.user.displayName) {
                this.memberData.userName = this.user.displayName;
                state.saveToStorage();
                return true;
            }
            return false;
        } catch (error) {
            console.warn('خطأ في مزامنة البيانات:', error);
            return false;
        }
    },
    
    refreshUserData: async function() {
        try {
            if (!state.user) return false;
            const userDoc = await db.collection('users').doc(state.user.uid).get();
            if (!userDoc.exists) {
                console.warn('⚠️ المستخدم غير موجود في قاعدة البيانات');
                return false;
            }
            const data = userDoc.data();
            state.user.displayName = data.displayName || data.name || state.user.displayName || 'مستخدم';
            state.gender = data.gender || state.gender || 'mixed';
            
            if (state.memberId) {
                const memberDoc = await db.collection('circleMembers').doc(state.memberId).get();
                if (memberDoc.exists) {
                    const memberData = memberDoc.data();
                    state.memberData = memberData;
                    state.memberData.userName = memberData.userName || state.user.displayName;
                    state.memberData.userEmail = memberData.userEmail || state.user.email;
                    state.memberData.userGender = memberData.userGender || state.gender;
                }
            }
            state.saveToStorage();
            return true;
        } catch (error) {
            console.error('❌ خطأ في تحديث بيانات المستخدم:', error);
            return false;
        }
    },
    
    updateDisplayName: async function(newName) {
        if (!state.user) return false;
        try {
            await db.collection('users').doc(state.user.uid).update({
                displayName: newName,
                updatedAt: new Date()
            });
            
            if (state.memberId) {
                await db.collection('circleMembers').doc(state.memberId).update({
                    userName: newName,
                    updatedAt: new Date()
                });
                if (state.memberData) {
                    state.memberData.userName = newName;
                }
            }
            
            state.user.displayName = newName;
            state.saveToStorage();
            await updateUI();
            document.getElementById('userName').textContent = newName;
            
            return true;
        } catch (error) {
            console.error('خطأ في تحديث الاسم المعروض:', error);
            return false;
        }
    }
};

// ==================== مدير الإعدادات ====================
class SettingsManager {
    constructor() {
        this.db = firebase.firestore();
        this.settings = {
            maxCircleMembers: 30,
            maxExtraPerDay: 1,
            maxAbsenceDays: 3,
            reminderHour: 20
        };
        this.loaded = false;
    }
    
    async load() {
        if (this.loaded) return;
        try {
            const doc = await this.db.collection('appSettings').doc('config').get();
            if (doc.exists) {
                const data = doc.data();
                this.settings = {
                    maxCircleMembers: data.maxCircleMembers || 30,
                    maxExtraPerDay: data.maxExtraPerDay || 1,
                    maxAbsenceDays: data.maxAbsenceDays || 3,
                    reminderHour: parseInt(localStorage.getItem('reminderHour')) || data.reminderHour || 20
                };
            }
            this.loaded = true;
            state.settings = this.settings;
        } catch (error) {
            console.error('خطأ في تحميل الإعدادات:', error);
        }
    }
    
    async update(key, value) {
        try {
            await this.db.collection('appSettings').doc('config').set({
                [key]: value,
                updatedAt: new Date()
            }, { merge: true });
            this.settings[key] = value;
            state.settings[key] = value;
            localStorage.setItem('khatmaSettings', JSON.stringify(state.settings));
            return true;
        } catch (error) {
            console.error('خطأ في تحديث الإعداد:', error);
            return false;
        }
    }
    
    get(key) {
        return this.settings[key];
    }
}

const settingsManager = new SettingsManager();

// ==================== مدير المدير العام ====================
class AdminManager {
    constructor() {
        this.db = firebase.firestore();
        this.email = null;
        this.password = null;
        this.loaded = false;
    }
    
    async load() {
        if (this.loaded) return;
        try {
            const doc = await this.db.collection('adminConfig').doc('admin').get();
            if (doc.exists) {
                const data = doc.data();
                this.email = data.email;
                this.password = data.password;
            }
            this.loaded = true;
        } catch (error) {
            console.error('خطأ في تحميل بيانات المدير:', error);
        }
    }
    
    async update(email, password) {
        try {
            await this.db.collection('adminConfig').doc('admin').set({
                email: email,
                password: password,
                role: 'super_admin',
                isActive: true,
                updatedAt: new Date()
            }, { merge: true });
            this.email = email;
            this.password = password;
            return true;
        } catch (error) {
            console.error('خطأ في تحديث المدير:', error);
            return false;
        }
    }
}

const adminManager = new AdminManager();

// ==================== مصادقة المستخدم ====================
class AuthService {
    constructor() {
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.persistSession();
    }
    
    async persistSession() {
        try {
            await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            console.log('✅ تم تفعيل حفظ الجلسة');
        } catch (error) {
            console.warn('⚠️ فشل تفعيل حفظ الجلسة:', error.message);
        }
    }
    
    async loginWithEmail(email, password) {
        try {
            const result = await this.auth.signInWithEmailAndPassword(email, password);
            state.isGuest = false;
            await this.syncUserDisplayName(result.user.uid);
            state.saveToStorage();
            return result.user;
        } catch (error) {
            throw this.handleError(error);
        }
    }
    
    async loginWithUsername(username, password) {
        try {
            const snapshot = await this.db.collection('users')
                .where('username', '==', username.toLowerCase())
                .limit(1)
                .get();
            if (snapshot.empty) throw new Error('اسم المستخدم غير موجود');
            const userData = snapshot.docs[0].data();
            const result = await this.loginWithEmail(userData.email, password);
            return result;
        } catch (error) {
            throw this.handleError(error);
        }
    }
    
    async register(email, username, password, gender, displayName) {
        try {
            const usernameCheck = await this.db.collection('users')
                .where('username', '==', username.toLowerCase())
                .limit(1)
                .get();
            if (!usernameCheck.empty) throw new Error('اسم المستخدم مستخدم');
            const result = await this.auth.createUserWithEmailAndPassword(email, password);
            await this.db.collection('users').doc(result.user.uid).set({
                username: username.toLowerCase(),
                email: email,
                gender: gender,
                role: 'member',
                createdAt: new Date(),
                displayName: displayName || username,
                emailVerified: false
            });
            await result.user.sendEmailVerification();
            return result.user;
        } catch (error) {
            throw this.handleError(error);
        }
    }
    
    async loginWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await this.auth.signInWithPopup(provider);
            state.isGuest = false;
            const displayName = result.user.displayName || result.user.email.split('@')[0];
            const userDoc = await this.db.collection('users').doc(result.user.uid).get();
            if (!userDoc.exists) {
                await this.db.collection('users').doc(result.user.uid).set({
                    username: result.user.email.split('@')[0].toLowerCase(),
                    email: result.user.email,
                    gender: 'mixed',
                    role: 'member',
                    createdAt: new Date(),
                    displayName: displayName,
                    emailVerified: true
                });
            } else {
                const data = userDoc.data();
                if (!data.displayName || data.displayName === data.username) {
                    await this.db.collection('users').doc(result.user.uid).update({
                        displayName: displayName,
                        updatedAt: new Date()
                    });
                }
            }
            await this.syncUserDisplayName(result.user.uid);
            state.saveToStorage();
            return result.user;
        } catch (error) {
            throw this.handleError(error);
        }
    }
    
    async syncUserDisplayName(uid) {
        try {
            const userDoc = await this.db.collection('users').doc(uid).get();
            if (userDoc.exists) {
                const data = userDoc.data();
                if (data.displayName && auth.currentUser) {
                    try {
                        await auth.currentUser.updateProfile({
                            displayName: data.displayName
                        });
                    } catch (e) {}
                    state.user.displayName = data.displayName;
                }
            }
            return true;
        } catch (error) {
            console.warn('خطأ في مزامنة الاسم:', error);
            return false;
        }
    }
    
    handleError(error) {
        const messages = {
            'auth/user-not-found': 'المستخدم غير موجود',
            'auth/wrong-password': 'كلمة السر غير صحيحة',
            'auth/email-already-in-use': 'البريد الإلكتروني مستخدم',
            'auth/invalid-email': 'البريد الإلكتروني غير صحيح',
            'auth/weak-password': 'كلمة السر ضعيفة (6 أحرف على الأقل)',
            'auth/too-many-requests': 'محاولات كثيرة، حاول لاحقاً',
            'auth/network-request-failed': 'فشل الاتصال بالإنترنت'
        };
        return new Error(messages[error.code] || error.message || 'حدث خطأ');
    }
}

const authService = new AuthService();

// ==================== دوال الصلاحيات ====================
async function checkUserRole(user) {
    if (!user) return ROLES.GUEST;
    await adminManager.load();
    if (adminManager.email && user.email === adminManager.email) {
        return ROLES.SUPER_ADMIN;
    }
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) return ROLES.MEMBER;
        const userData = userDoc.data();
        if (userData.role === 'supervisor') {
            state.supervisedCircles = userData.supervisedCircles || [];
            return ROLES.CIRCLE_SUPERVISOR;
        }
        const memberSnap = await db.collection('circleMembers')
            .where('userId', '==', user.uid)
            .where('isActive', '==', true)
            .get();
        for (const doc of memberSnap.docs) {
            if (doc.data().isCircleAdmin === true) {
                return ROLES.CIRCLE_ADMIN;
            }
        }
        return ROLES.MEMBER;
    } catch (e) {
        console.error('خطأ في التحقق من الصلاحيات:', e);
        return ROLES.MEMBER;
    }
}

function hasPermission(requiredRole) {
    const roleLevel = {
        [ROLES.GUEST]: 0,
        [ROLES.MEMBER]: 1,
        [ROLES.CIRCLE_ADMIN]: 2,
        [ROLES.CIRCLE_SUPERVISOR]: 3,
        [ROLES.SUPER_ADMIN]: 4
    };
    return (roleLevel[state.role] || 0) >= (roleLevel[requiredRole] || 0);
}

// ==================== نظام الثقة ====================
const TrustSystem = {
    calculateScore: function(memberData) {
        if (!memberData) return 50;
        let score = 50;
        const streak = memberData.streakDays || 0;
        if (streak > 30) score += 20;
        else if (streak > 7) score += 10;
        else if (streak > 1) score += 5;
        const khatmas = Utils.calculateKhatmas(memberData.totalPartsRead || 0);
        if (khatmas >= 10) score += 20;
        else if (khatmas >= 5) score += 10;
        else if (khatmas >= 1) score += 5;
        const absence = memberData.absenceCount || 0;
        if (absence >= 3) score -= 20;
        else if (absence >= 1) score -= 10;
        return Math.max(0, Math.min(100, score));
    },
    
    getLevel: function(score) {
        if (score >= 80) return { id: 'high', name: '🟢 موثوق', min: 80 };
        if (score >= 50) return { id: 'medium', name: '🟡 متوسط', min: 50 };
        return { id: 'low', name: '🔴 أساسي', min: 0 };
    }
};

// ==================== نظام الإشعارات ====================
class NotificationManager {
    constructor() {
        this.enabled = false;
        this.token = null;
        this.initialized = false;
    }
    
    async init() {
        if (this.initialized) return;
        this.initialized = true;
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                this.enabled = true;
            }
        } catch (error) {
            console.warn('⚠️ فشل تهيئة الإشعارات:', error);
        }
    }
    
    async sendToUser(userId, title, body, type, senderId, senderName, data) {
        type = type || 'general';
        senderId = senderId || state.user ? state.user.uid : 'system';
        senderName = senderName || (state.user ? state.user.displayName : 'النظام');
        data = data || {};
        try {
            const notification = {
                userId: userId,
                title: title,
                body: body,
                type: type,
                senderId: senderId,
                senderName: senderName,
                data: data,
                read: false,
                createdAt: new Date(),
                isBroadcast: false
            };
            await db.collection('notifications').add(notification);
            await this.updateUnreadCount(userId);
            console.log('✅ تم إرسال إشعار للمستخدم ' + userId + ': ' + title);
            return notification;
        } catch (error) {
            console.error('خطأ في إرسال الإشعار:', error);
            return null;
        }
    }
    
    async updateUnreadCount(userId) {
        try {
            const snapshot = await db.collection('notifications')
                .where('userId', '==', userId)
                .where('read', '==', false)
                .get();
            const count = snapshot.size;
            await db.collection('users').doc(userId).set({
                unreadNotifications: count,
                lastNotificationCheck: new Date()
            }, { merge: true });
            return count;
        } catch (error) {
            console.error('خطأ في تحديث عداد الإشعارات:', error);
            return 0;
        }
    }
    
    async getUserNotifications(userId, limit) {
        limit = limit || 50;
        try {
            const snapshot = await db.collection('notifications')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();
            const notifications = [];
            snapshot.forEach(function(doc) {
                notifications.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            return notifications;
        } catch (error) {
            console.error('خطأ في جلب الإشعارات:', error);
            return [];
        }
    }
    
    async markAsRead(notificationId) {
        try {
            await db.collection('notifications').doc(notificationId).update({
                read: true,
                readAt: new Date()
            });
            if (state.user) {
                await this.updateUnreadCount(state.user.uid);
            }
            return true;
        } catch (error) {
            console.error('خطأ في تحديد الإشعار كمقروء:', error);
            return false;
        }
    }
    
    async markAllAsRead(userId) {
        try {
            const snapshot = await db.collection('notifications')
                .where('userId', '==', userId)
                .where('read', '==', false)
                .get();
            const batch = db.batch();
            snapshot.forEach(function(doc) {
                batch.update(doc.ref, { read: true, readAt: new Date() });
            });
            await batch.commit();
            await this.updateUnreadCount(userId);
            return snapshot.size;
        } catch (error) {
            console.error('خطأ في تحديد جميع الإشعارات كمقروءة:', error);
            return 0;
        }
    }
    
    async deleteNotification(notificationId) {
        try {
            await db.collection('notifications').doc(notificationId).delete();
            if (state.user) {
                await this.updateUnreadCount(state.user.uid);
            }
            return true;
        } catch (error) {
            console.error('خطأ في حذف الإشعار:', error);
            return false;
        }
    }
    
    async deleteAllRead(userId) {
        try {
            const snapshot = await db.collection('notifications')
                .where('userId', '==', userId)
                .where('read', '==', true)
                .get();
            const batch = db.batch();
            snapshot.forEach(function(doc) {
                batch.delete(doc.ref);
            });
            await batch.commit();
            return snapshot.size;
        } catch (error) {
            console.error('خطأ في حذف الإشعارات المقروءة:', error);
            return 0;
        }
    }
}

const notifications = new NotificationManager();

// ==================== حساب الوقت المنقضي ====================
function getTimeAgo(date) {
    if (!date) return '';
    
    let d;
    if (date.toDate) {
        d = date.toDate();
    } else if (date instanceof Date) {
        d = date;
    } else {
        d = new Date(date);
    }
    
    if (isNaN(d.getTime())) return '';
    
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    
    if (diff < 60) return 'الآن';
    if (diff < 3600) return Math.floor(diff / 60) + ' دقيقة';
    if (diff < 86400) return Math.floor(diff / 3600) + ' ساعة';
    if (diff < 2592000) return Math.floor(diff / 86400) + ' يوم';
    if (diff < 31536000) return Math.floor(diff / 2592000) + ' شهر';
    return Math.floor(diff / 31536000) + ' سنة';
}

// ==================== دوال الإشعارات للمستخدم ====================
async function loadUserNotifications() {
    if (!state.user) {
        console.log('⚠️ لا يوجد مستخدم مسجل');
        return;
    }
    
    var container = document.getElementById('notificationsList');
    if (!container) {
        console.log('⚠️ عنصر notificationsList غير موجود');
        return;
    }
    
    try {
        console.log('🔄 جاري تحميل إشعارات المستخدم:', state.user.uid);
        
        const snapshot = await db.collection('notifications')
            .where('userId', '==', state.user.uid)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        
        console.log('📊 عدد الإشعارات المسترجعة:', snapshot.size);
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="empty-notifications">
                    <span class="empty-icon">📭</span>
                    <p>لا توجد إشعارات</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        let unreadCount = 0;
        
        snapshot.forEach(function(doc) {
            const notif = doc.data();
            const notifId = doc.id;
            
            if (!notif.title && !notif.body) {
                console.warn('⚠️ إشعار بدون عنوان أو نص:', notifId);
                return;
            }
            
            const isRead = notif.read === true;
            if (!isRead) unreadCount++;
            
            const timeAgo = getTimeAgo(notif.createdAt);
            const senderName = notif.senderName || 'النظام';
            const title = notif.title || 'إشعار';
            const body = notif.body || '';
            const isBroadcast = notif.isBroadcast ? '📢 ' : '';
            
            let senderIcon = '📨';
            if (notif.fromSuperAdmin) senderIcon = '👑';
            else if (notif.fromSupervisor) senderIcon = '👤';
            else if (notif.fromCircleAdmin) senderIcon = '👑';
            
            html += `
                <div class="notification-item ${isRead ? 'read' : 'unread'}" data-id="${notifId}">
                    <div class="notification-header">
                        <span class="notification-sender">${senderIcon} ${isBroadcast}${Utils.escapeHtml(senderName)}</span>
                        <span class="notification-time">${timeAgo}</span>
                    </div>
                    <div class="notification-body">
                        <strong>${Utils.escapeHtml(title)}</strong>
                        ${body ? `<p>${Utils.escapeHtml(body)}</p>` : ''}
                    </div>
                    <div class="notification-actions">
                        ${!isRead ? `<button class="btn-mark-read" onclick="window.markNotificationRead('${notifId}')">📖 تحديد كمقروء</button>` : ''}
                        <button class="btn-delete-notification" onclick="window.deleteNotification('${notifId}')">🗑️ حذف</button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        
        document.querySelectorAll('.notification-item').forEach(function(item) {
            const id = item.dataset.id;
            item.addEventListener('click', async function(e) {
                if (e.target.tagName === 'BUTTON') return;
                
                if (this.classList.contains('unread')) {
                    await notifications.markAsRead(id);
                    this.classList.remove('unread');
                    this.classList.add('read');
                    const btn = this.querySelector('.btn-mark-read');
                    if (btn) btn.remove();
                    await updateNotificationBadge();
                }
            });
        });
        
        await updateNotificationBadge();
        
        console.log('✅ تم تحميل ' + snapshot.size + ' إشعار (' + unreadCount + ' غير مقروء)');
        
    } catch (error) {
        console.error('❌ خطأ في تحميل الإشعارات:', error);
        container.innerHTML = `
            <div class="error-message" style="text-align:center;padding:20px;color:#ef4444;">
                <p>⚠️ حدث خطأ في تحميل الإشعارات</p>
                <p style="font-size:12px;color:#6c757d;">${error.message}</p>
                <button onclick="window.loadUserNotifications()" class="btn-retry" style="margin-top:10px;padding:8px 20px;background:#3b82f6;color:white;border:none;border-radius:20px;cursor:pointer;">🔄 إعادة المحاولة</button>
            </div>
        `;
    }
}

async function updateNotificationBadge() {
    if (!state.user) {
        console.log('⚠️ لا يوجد مستخدم لتحديث العداد');
        return;
    }
    
    try {
        const snapshot = await db.collection('notifications')
            .where('userId', '==', state.user.uid)
            .where('read', '==', false)
            .get();
        
        const count = snapshot.size;
        console.log('📊 عدد الإشعارات غير المقروءة:', count);
        
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count;
                badge.style.display = 'inline-block';
            } else {
                badge.textContent = '';
                badge.style.display = 'none';
            }
        }
        
        await db.collection('users').doc(state.user.uid).set({
            unreadNotifications: count,
            lastNotificationCheck: new Date()
        }, { merge: true });
        
        return count;
    } catch (error) {
        console.error('❌ خطأ في تحديث عداد الإشعارات:', error);
        return 0;
    }
}

window.markNotificationRead = async function(notificationId) {
    if (!notificationId) {
        console.warn('⚠️ معرف الإشعار غير موجود');
        return;
    }
    
    try {
        console.log('📖 تحديد الإشعار كمقروء:', notificationId);
        
        await db.collection('notifications').doc(notificationId).update({
            read: true,
            readAt: new Date()
        });
        
        await updateNotificationBadge();
        await loadUserNotifications();
        
        Utils.showToast('✅ تم تحديد الإشعار كمقروء', false);
        
    } catch (error) {
        console.error('❌ خطأ في تحديد الإشعار كمقروء:', error);
        Utils.showToast('⚠️ حدث خطأ', true);
    }
};

window.deleteNotification = async function(notificationId) {
    if (!notificationId) {
        console.warn('⚠️ معرف الإشعار غير موجود');
        return;
    }
    
    if (!confirm('⚠️ هل أنت متأكد من حذف هذا الإشعار؟')) return;
    
    try {
        console.log('🗑️ حذف الإشعار:', notificationId);
        
        await db.collection('notifications').doc(notificationId).delete();
        
        await updateNotificationBadge();
        await loadUserNotifications();
        
        Utils.showToast('✅ تم حذف الإشعار', false);
        
    } catch (error) {
        console.error('❌ خطأ في حذف الإشعار:', error);
        Utils.showToast('⚠️ حدث خطأ', true);
    }
};

window.markAllNotificationsRead = async function() {
    if (!state.user) return;
    
    try {
        const count = await notifications.markAllAsRead(state.user.uid);
        Utils.showToast('✅ تم تحديد ' + count + ' إشعار كمقروء', false);
        await loadUserNotifications();
    } catch (error) {
        console.error('خطأ في تحديد الكل كمقروء:', error);
        Utils.showToast('⚠️ حدث خطأ', true);
    }
};

window.deleteAllReadNotifications = async function() {
    if (!state.user) return;
    
    if (!confirm('⚠️ هل أنت متأكد من حذف جميع الإشعارات المقروءة؟')) return;
    
    try {
        const count = await notifications.deleteAllRead(state.user.uid);
        Utils.showToast('✅ تم حذف ' + count + ' إشعار مقروء', false);
        await loadUserNotifications();
    } catch (error) {
        console.error('خطأ في حذف الإشعارات المقروءة:', error);
        Utils.showToast('⚠️ حدث خطأ', true);
    }
};

// ==================== دوال الإشعارات للمدير العام ====================
window.loadAdminNotifications = async function() {
    try {
        console.log('🔄 جاري تحميل إشعارات المدير العام...');
        
        const snapshot = await db.collection('notifications')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        
        const container = document.getElementById('adminNotificationsList');
        if (!container) {
            console.warn('⚠️ عنصر adminNotificationsList غير موجود');
            return;
        }
        
        console.log('📊 عدد الإشعارات الكلي:', snapshot.size);
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="empty-plan">📭 لا توجد إشعارات مرسلة</div>';
            return;
        }
        
        let html = '<h4>📨 الإشعارات المرسلة (' + snapshot.size + ')</h4>';
        
        snapshot.forEach(function(doc) {
            const n = doc.data();
            const date = n.createdAt ? Utils.formatDate(n.createdAt) : '-';
            const time = n.createdAt ? new Date(n.createdAt.toDate()).toLocaleTimeString('ar') : '';
            
            let senderType = '📨 نظام';
            if (n.fromSuperAdmin) senderType = '👑 مدير عام';
            else if (n.fromSupervisor) senderType = '👤 مشرف';
            else if (n.fromCircleAdmin) senderType = '👑 مدير حلقة';
            
            let recipientLabel = '👥 مستخدم';
            if (n.data && n.data.recipientType === 'admins') recipientLabel = '👑 مدراء';
            else if (n.data && n.data.recipientType === 'members') recipientLabel = '👥 أعضاء';
            else if (n.data && n.data.recipientType === 'supervisors') recipientLabel = '👤 مشرفين';
            else if (n.isBroadcast) recipientLabel = '📢 الكل';
            
            const isBroadcast = n.isBroadcast ? '📢' : '📨';
            
            html += `
                <div class="admin-list-item">
                    <div style="flex:1;">
                        <strong>${isBroadcast} ${Utils.escapeHtml(n.title || 'بدون عنوان')}</strong>
                        <span style="font-size:11px; color:#8b5cf6; margin-right:8px;">${senderType}</span>
                        <br>
                        <small style="color:#6c757d;">${Utils.escapeHtml(n.body || '')}</small>
                        <br>
                        <small style="color:#94a3b8;">📅 ${date} ${time} | 👤 ${Utils.escapeHtml(n.senderName || 'النظام')}</small>
                        <br>
                        <small style="color:#8b5cf6;">📌 ${recipientLabel}</small>
                        <br>
                        <small style="color:#94a3b8;font-size:11px;">🆔 ${doc.id}</small>
                    </div>
                    <div>
                        <button onclick="window.deleteAdminNotification('${doc.id}')" class="btn-small danger">🗑️</button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        console.log('✅ تم تحميل ' + snapshot.size + ' إشعار في لوحة المدير');
        
    } catch (error) {
        console.error('❌ خطأ في تحميل إشعارات المدير:', error);
        const container = document.getElementById('adminNotificationsList');
        if (container) {
            container.innerHTML = `
                <div class="error-message" style="text-align:center;padding:20px;color:#ef4444;">
                    <p>⚠️ حدث خطأ في تحميل الإشعارات</p>
                    <p style="font-size:12px;color:#6c757d;">${error.message}</p>
                    <button onclick="window.loadAdminNotifications()" class="btn-retry" style="margin-top:10px;padding:8px 20px;background:#3b82f6;color:white;border:none;border-radius:20px;cursor:pointer;">🔄 إعادة المحاولة</button>
                </div>
            `;
        }
    }
};

window.deleteAdminNotification = async function(notificationId) {
    if (!confirm('⚠️ هل أنت متأكد من حذف هذا الإشعار؟')) return;
    try {
        await db.collection('notifications').doc(notificationId).delete();
        Utils.showToast('✅ تم حذف الإشعار', false);
        await window.loadAdminNotifications();
    } catch (error) {
        console.error('خطأ في حذف الإشعار:', error);
        Utils.showToast('حدث خطأ', true);
    }
};

window.clearAllAdminNotifications = async function() {
    if (!confirm('⚠️ هل أنت متأكد من حذف جميع الإشعارات؟')) return;
    if (!confirm('⚠️ تأكيد نهائي؟')) return;
    try {
        const snapshot = await db.collection('notifications').get();
        const batch = db.batch();
        snapshot.forEach(function(doc) {
            batch.delete(doc.ref);
        });
        await batch.commit();
        Utils.showToast('✅ تم حذف جميع الإشعارات', false);
        await window.loadAdminNotifications();
    } catch (error) {
        console.error('خطأ في مسح الإشعارات:', error);
        Utils.showToast('حدث خطأ', true);
    }
};

// ==================== دوال الإشعارات للمشرف ====================
window.loadSupervisorNotifications = async function() {
    try {
        console.log('🔄 جاري تحميل إشعارات المشرف...');
        
        const snapshot = await db.collection('notifications')
            .where('fromSupervisor', '==', true)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        
        const container = document.getElementById('supervisorNotificationsList');
        if (!container) {
            console.warn('⚠️ عنصر supervisorNotificationsList غير موجود');
            return;
        }
        
        console.log('📊 عدد إشعارات المشرف:', snapshot.size);
        
        if (snapshot.empty) {
            container.innerHTML = '<div class="empty-plan">📭 لا توجد إشعارات مرسلة</div>';
            return;
        }
        
        let html = '<h4>📨 إشعاراتي المرسلة (' + snapshot.size + ')</h4>';
        
        snapshot.forEach(function(doc) {
            const n = doc.data();
            const date = n.createdAt ? Utils.formatDate(n.createdAt) : '-';
            const time = n.createdAt ? new Date(n.createdAt.toDate()).toLocaleTimeString('ar') : '';
            
            let recipientLabel = '📢 الكل';
            if (n.data && n.data.recipientType === 'admins') recipientLabel = '👑 مدراء';
            else if (n.data && n.data.recipientType === 'members') recipientLabel = '👥 أعضاء';
            
            let circleLabel = '🌐 جميع الحلقات';
            if (n.data && n.data.circleId && n.data.circleId !== 'all') {
                circleLabel = '🔄 حلقة محددة';
            }
            
            html += `
                <div class="admin-list-item">
                    <div style="flex:1;">
                        <strong>📨 ${Utils.escapeHtml(n.title || 'بدون عنوان')}</strong>
                        <br>
                        <small style="color:#6c757d;">${Utils.escapeHtml(n.body || '')}</small>
                        <br>
                        <small style="color:#94a3b8;">📅 ${date} ${time}</small>
                        <br>
                        <small style="color:#8b5cf6;">📌 ${recipientLabel} | ${circleLabel}</small>
                        <br>
                        <small style="color:#94a3b8;font-size:11px;">🆔 ${doc.id}</small>
                    </div>
                    <div>
                        <button onclick="window.deleteSupervisorNotification('${doc.id}')" class="btn-small danger">🗑️</button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
        console.log('✅ تم تحميل ' + snapshot.size + ' إشعار في لوحة المشرف');
        
    } catch (error) {
        console.error('❌ خطأ في تحميل إشعارات المشرف:', error);
        const container = document.getElementById('supervisorNotificationsList');
        if (container) {
            container.innerHTML = `
                <div class="error-message" style="text-align:center;padding:20px;color:#ef4444;">
                    <p>⚠️ حدث خطأ في تحميل الإشعارات</p>
                    <p style="font-size:12px;color:#6c757d;">${error.message}</p>
                    <button onclick="window.loadSupervisorNotifications()" class="btn-retry" style="margin-top:10px;padding:8px 20px;background:#3b82f6;color:white;border:none;border-radius:20px;cursor:pointer;">🔄 إعادة المحاولة</button>
                </div>
            `;
        }
    }
};

window.deleteSupervisorNotification = async function(notificationId) {
    if (!confirm('⚠️ هل أنت متأكد من حذف هذا الإشعار؟')) return;
    try {
        await db.collection('notifications').doc(notificationId).delete();
        Utils.showToast('✅ تم حذف الإشعار', false);
        await window.loadSupervisorNotifications();
    } catch (error) {
        console.error('خطأ في حذف الإشعار:', error);
        Utils.showToast('حدث خطأ', true);
    }
};

// ==================== دوال إرسال الإشعارات ====================
window.sendAdminNotification = async function() {
    var title = document.getElementById('notificationTitle') ? document.getElementById('notificationTitle').value.trim() : '';
    var msg = document.getElementById('notificationMessage') ? document.getElementById('notificationMessage').value.trim() : '';
    var recipient = document.getElementById('notificationRecipient') ? document.getElementById('notificationRecipient').value : 'all';
    
    if (!title || !msg) {
        Utils.showToast('⚠️ املأ العنوان والنص', true);
        return;
    }
    
    if (!confirm('⚠️ هل أنت متأكد من إرسال الإشعار: "' + title + '"؟')) return;
    
    var resultDiv = document.getElementById('adminNotificationResult');
    if (resultDiv) {
        resultDiv.textContent = '⏳ جاري الإرسال...';
        resultDiv.className = 'message';
        resultDiv.style.display = 'block';
    }
    
    try {
        var count = 0;
        var senderId = state.user ? state.user.uid : 'system';
        var senderName = state.user ? state.user.displayName : 'المدير العام';
        var users = [];
        
        if (recipient === 'supervisors') {
            const snap = await db.collection('users').where('role', '==', 'supervisor').get();
            snap.forEach(function(d) { 
                if (d.id !== senderId) users.push({ id: d.id, ...d.data() });
            });
        } else if (recipient === 'admins') {
            const snap = await db.collection('circleMembers').where('isCircleAdmin', '==', true).where('isActive', '==', true).get();
            for (const doc of snap.docs) {
                const m = doc.data();
                if (m.userId !== senderId) {
                    const userDoc = await db.collection('users').doc(m.userId).get();
                    if (userDoc.exists) {
                        users.push({ id: m.userId, ...userDoc.data() });
                    }
                }
            }
        } else if (recipient === 'members') {
            const snap = await db.collection('circleMembers').where('isActive', '==', true).get();
            for (const doc of snap.docs) {
                const m = doc.data();
                if (!m.isCircleAdmin && m.userId !== senderId) {
                    const userDoc = await db.collection('users').doc(m.userId).get();
                    if (userDoc.exists) {
                        users.push({ id: m.userId, ...userDoc.data() });
                    }
                }
            }
        } else {
            const snap = await db.collection('circleMembers').where('isActive', '==', true).get();
            for (const doc of snap.docs) {
                const m = doc.data();
                if (m.userId !== senderId) {
                    const userDoc = await db.collection('users').doc(m.userId).get();
                    if (userDoc.exists) {
                        users.push({ id: m.userId, ...userDoc.data() });
                    }
                }
            }
        }
        
        for (const user of users) {
            try {
                const notification = {
                    userId: user.id,
                    title: title,
                    body: msg,
                    type: 'admin_broadcast',
                    senderId: senderId,
                    senderName: senderName,
                    data: { 
                        recipientType: recipient,
                        fromAdmin: true
                    },
                    read: false,
                    createdAt: new Date(),
                    isBroadcast: true,
                    fromSuperAdmin: true
                };
                await db.collection('notifications').add(notification);
                count++;
            } catch (err) {
                console.error('❌ فشل إرسال للمستخدم:', user.id, err);
            }
        }
        
        for (const user of users) {
            try {
                await notifications.updateUnreadCount(user.id);
            } catch (err) {}
        }
        
        if (resultDiv) {
            resultDiv.textContent = '✅ تم إرسال الإشعار إلى ' + count + ' مستخدم';
            resultDiv.className = 'message success';
        }
        Utils.showToast('✅ تم إرسال الإشعار إلى ' + count + ' مستخدم', false);
        
        document.getElementById('notificationTitle').value = '';
        document.getElementById('notificationMessage').value = '';
        
        await window.loadAdminNotifications();
        
    } catch (error) {
        console.error('❌ خطأ في إرسال الإشعار:', error);
        if (resultDiv) {
            resultDiv.textContent = '❌ حدث خطأ: ' + error.message;
            resultDiv.className = 'message error';
        }
        Utils.showToast('❌ حدث خطأ: ' + error.message, true);
    }
};

window.sendSupervisorNotification = async function() {
    var title = document.getElementById('supervisorNotificationTitle').value.trim();
    var msg = document.getElementById('supervisorNotificationMessage').value.trim();
    var recipient = document.getElementById('supervisorNotificationRecipient').value;
    var circleId = document.getElementById('supervisorNotificationCircle').value;
    
    if (!title || !msg) {
        Utils.showToast('⚠️ املأ العنوان والنص', true);
        return;
    }
    
    if (!confirm('⚠️ هل أنت متأكد من إرسال الإشعار: "' + title + '"؟')) return;
    
    var btn = document.querySelector('#supervisorNotificationsTab .btn-admin-action');
    var origText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري الإرسال...'; }
    
    try {
        var senderId = state.user ? state.user.uid : 'system';
        var senderName = state.user ? state.user.displayName : 'مشرف';
        var count = 0;
        var users = [];
        
        if (recipient === 'admins') {
            const snap = await db.collection('circleMembers')
                .where('isCircleAdmin', '==', true)
                .where('isActive', '==', true)
                .get();
            for (const doc of snap.docs) {
                const m = doc.data();
                if (m.userId !== senderId) {
                    const userDoc = await db.collection('users').doc(m.userId).get();
                    if (userDoc.exists) {
                        users.push({ id: m.userId, ...userDoc.data(), circleId: m.circleId });
                    }
                }
            }
        } else if (recipient === 'members') {
            let query = db.collection('circleMembers').where('isActive', '==', true);
            if (circleId !== 'all') {
                query = query.where('circleId', '==', circleId);
            }
            const snap = await query.get();
            for (const doc of snap.docs) {
                const m = doc.data();
                if (!m.isCircleAdmin && m.userId !== senderId) {
                    const userDoc = await db.collection('users').doc(m.userId).get();
                    if (userDoc.exists) {
                        users.push({ id: m.userId, ...userDoc.data(), circleId: m.circleId });
                    }
                }
            }
        } else {
            let query = db.collection('circleMembers').where('isActive', '==', true);
            if (circleId !== 'all') {
                query = query.where('circleId', '==', circleId);
            }
            const snap = await query.get();
            for (const doc of snap.docs) {
                const m = doc.data();
                if (m.userId !== senderId) {
                    const userDoc = await db.collection('users').doc(m.userId).get();
                    if (userDoc.exists) {
                        users.push({ id: m.userId, ...userDoc.data(), circleId: m.circleId });
                    }
                }
            }
        }
        
        for (const user of users) {
            try {
                const notification = {
                    userId: user.id,
                    title: title,
                    body: msg,
                    type: 'supervisor_broadcast',
                    senderId: senderId,
                    senderName: senderName,
                    data: { 
                        circleId: circleId || 'all',
                        recipientType: recipient
                    },
                    read: false,
                    createdAt: new Date(),
                    isBroadcast: true,
                    fromSupervisor: true
                };
                await db.collection('notifications').add(notification);
                count++;
            } catch (err) {
                console.error('❌ فشل إرسال للمستخدم:', user.id, err);
            }
        }
        
        for (const user of users) {
            try {
                await notifications.updateUnreadCount(user.id);
            } catch (err) {}
        }
        
        Utils.showToast('✅ تم إرسال الإشعار إلى ' + count + ' مستخدم', false);
        
        document.getElementById('supervisorNotificationTitle').value = '';
        document.getElementById('supervisorNotificationMessage').value = '';
        
        await window.loadSupervisorNotifications();
        
    } catch (error) {
        console.error('❌ خطأ في إرسال الإشعار:', error);
        Utils.showToast('❌ حدث خطأ: ' + error.message, true);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = origText || '📨 إرسال إشعار'; }
    }
};

window.sendCircleAdminMessage = async function() {
    var subject = document.getElementById('messageSubject').value.trim();
    var content = document.getElementById('messageContent').value.trim();
    var recipientType = document.getElementById('messageRecipientType').value;
    var specificMember = document.getElementById('specificMemberList').value;
    
    if (!content) {
        Utils.showToast('⚠️ أدخل نص الرسالة', true);
        return;
    }
    
    var resultDiv = document.getElementById('messageResult');
    resultDiv.textContent = '⏳ جاري الإرسال...';
    resultDiv.className = 'message';
    resultDiv.style.display = 'block';
    
    try {
        var query = db.collection('circleMembers')
            .where('circleId', '==', state.circleId)
            .where('isActive', '==', true);
        
        if (recipientType === 'active') {
            var today = Utils.getTodayString();
            var members = await query.get();
            var activeIds = [];
            members.forEach(function(d) {
                var m = d.data();
                var lastRead = m.lastReadDate ? Utils.toDate(m.lastReadDate) : null;
                if (lastRead ? lastRead.toDateString() === today : false) activeIds.push(d.id);
            });
            if (activeIds.length === 0) {
                resultDiv.textContent = '⚠️ لا يوجد أعضاء نشطاء اليوم';
                resultDiv.className = 'message error';
                return;
            }
            query = db.collection('circleMembers')
                .where('circleId', '==', state.circleId)
                .where('isActive', '==', true)
                .where('__name__', 'in', activeIds);
        } else if (recipientType === 'inactive') {
            var today2 = Utils.getTodayString();
            var members2 = await query.get();
            var inactiveIds = [];
            members2.forEach(function(d) {
                var m = d.data();
                var lastRead = m.lastReadDate ? Utils.toDate(m.lastReadDate) : null;
                if ((lastRead ? lastRead.toDateString() : null) !== today2) inactiveIds.push(d.id);
            });
            if (inactiveIds.length === 0) {
                resultDiv.textContent = '⚠️ لا يوجد أعضاء غائبون';
                resultDiv.className = 'message error';
                return;
            }
            query = db.collection('circleMembers')
                .where('circleId', '==', state.circleId)
                .where('isActive', '==', true)
                .where('__name__', 'in', inactiveIds);
        } else if (recipientType === 'specific' && specificMember) {
            query = db.collection('circleMembers')
                .where('circleId', '==', state.circleId)
                .where('isActive', '==', true)
                .where('__name__', '==', specificMember);
        }
        
        var members3 = await query.get();
        var senderId = state.user ? state.user.uid : 'system';
        var senderName = state.user ? state.user.displayName : 'مدير الحلقة';
        var count = 0;
        
        for (var d of members3.docs) {
            var m = d.data();
            if (m.userId && m.userId !== state.user.uid) {
                try {
                    const notification = {
                        userId: m.userId,
                        title: subject || '📨 رسالة من مدير الحلقة',
                        body: content,
                        type: 'circle_message',
                        senderId: senderId,
                        senderName: senderName,
                        data: { 
                            circleId: state.circleId,
                            recipientType: recipientType
                        },
                        read: false,
                        createdAt: new Date(),
                        isBroadcast: false,
                        fromCircleAdmin: true
                    };
                    await db.collection('notifications').add(notification);
                    count++;
                    await notifications.updateUnreadCount(m.userId);
                } catch (err) {
                    console.error('فشل إرسال للمستخدم:', m.userId, err);
                }
            }
        }
        
        resultDiv.textContent = '✅ تم إرسال الرسالة إلى ' + count + ' عضو';
        resultDiv.className = 'message success';
        document.getElementById('messageSubject').value = '';
        document.getElementById('messageContent').value = '';
        
    } catch (error) {
        console.error('خطأ في إرسال الرسالة:', error);
        resultDiv.textContent = '⚠️ حدث خطأ أثناء إرسال الرسالة';
        resultDiv.className = 'message error';
    }
};

async function loadSupervisorCirclesForNotification() {
    try {
        const select = document.getElementById('supervisorNotificationCircle');
        if (!select) return;
        
        const currentValue = select.value;
        select.innerHTML = '<option value="all">جميع الحلقات</option>';
        
        if (state.supervisedCircles && state.supervisedCircles.length > 0) {
            for (const circleId of state.supervisedCircles) {
                const doc = await db.collection('circles').doc(circleId).get();
                if (doc.exists) {
                    const c = doc.data();
                    const option = document.createElement('option');
                    option.value = circleId;
                    option.textContent = c.circleName || 'حلقة';
                    select.appendChild(option);
                }
            }
        }
        
        if (currentValue) {
            select.value = currentValue;
        }
    } catch (error) {
        console.error('خطأ في تحميل حلقات المشرف:', error);
    }
}

// ==================== دوال عرض الحلقات المتاحة ====================
async function showAvailableCircles(userData) {
    state.gender = userData.gender;
    try {
        const snap = await db.collection('circles').get();
        const circles = [];
        snap.forEach(function(doc) {
            const c = doc.data();
            circles.push({
                id: doc.id,
                name: c.circleName,
                inviteCode: c.inviteCode,
                memberCount: c.memberCount || 0,
                gender: c.gender || 'mixed',
                isFull: (c.memberCount || 0) >= (settingsManager.get('maxCircleMembers') || 30),
                createdAt: c.createdAt
            });
        });
        circles.sort(function(a, b) {
            return (a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : 0) : 0) - (b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : 0) : 0);
        });
        filterCirclesUI(circles);
    } catch (error) {
        console.error('خطأ في showAvailableCircles:', error);
        Utils.showToast('حدث خطأ في تحميل الحلقات', true);
    }
}

function filterCirclesUI(circles) {
    var searchTerm = document.getElementById('searchCircleInput') ? document.getElementById('searchCircleInput').value.toLowerCase() : '';
    var activeFilter = document.querySelector('.filter-gender-btn.active');
    var filtered = circles.slice();
    if (activeFilter) {
        var filterText = activeFilter.textContent;
        if (filterText.includes('نسائية')) {
            filtered = filtered.filter(function(c) { return c.gender === 'female' || c.gender === 'mixed'; });
        } else if (filterText.includes('رجالية')) {
            filtered = filtered.filter(function(c) { return c.gender === 'male' || c.gender === 'mixed'; });
        }
    }
    if (searchTerm) {
        filtered = filtered.filter(function(c) { return c.name.toLowerCase().includes(searchTerm); });
    }
    var container = document.getElementById('availableCirclesList');
    if (!container) return;
    if (filtered.length === 0) {
        container.innerHTML = '<div class="circle-card empty"><h4>لا توجد حلقات متاحة</h4><p>يمكنك الانضمام برمز الحلقة من الأعلى</p><button onclick="window.refreshCircles()" class="btn-refresh">🔄 تحديث</button></div>';
        Utils.showScreen('selectCircleScreen');
        return;
    }
    container.innerHTML = '';
    for (var i = 0; i < filtered.length; i++) {
        var circle = filtered[i];
        var card = document.createElement('div');
        var genderClass = circle.gender === 'female' ? 'female' : (circle.gender === 'male' ? 'male' : 'mixed');
        card.className = 'circle-card ' + genderClass;
        var genderBadge = circle.gender === 'female' ? '👩 نسائي' : (circle.gender === 'male' ? '👨 رجالي' : '👥 مختلط');
        card.innerHTML = '<h4>🔄 ' + Utils.escapeHtml(circle.name) + '</h4><p>👥 ' + circle.memberCount + '/' + settingsManager.get('maxCircleMembers') + '</p><span class="badge ' + circle.gender + '">' + genderBadge + '</span><p class="code-hint">📌 للانضمام، استخدم رمز الحلقة في الأعلى</p>';
        container.appendChild(card);
    }
    Utils.showScreen('selectCircleScreen');
}

window.selectCircle = async function(circleId) {
    try {
        await showAvailableJuz(circleId);
    } catch (error) {
        console.error('خطأ في اختيار الحلقة:', error);
        Utils.showToast('حدث خطأ، حاول مرة أخرى', true);
    }
};

window.showAvailableJuz = async function(circleId) {
    try {
        const doc = await db.collection('circleAvailableJuz').doc(circleId).get();
        var taken = {}, avail = [];
        if (doc.exists) {
            avail = doc.data().availableJuz || [];
            taken = doc.data().takenJuz || {};
        } else {
            avail = [];
            for (var i = 1; i <= 30; i++) avail.push(i);
            await db.collection('circleAvailableJuz').doc(circleId).set({
                circleId: circleId,
                availableJuz: avail,
                takenJuz: taken,
                createdAt: new Date()
            });
        }
        var container = document.getElementById('juzGrid');
        if (!container) {
            Utils.showToast('عنصر عرض الأجزاء غير موجود', true);
            return;
        }
        container.innerHTML = '';
        for (var j = 1; j <= 30; j++) {
            var isTaken = taken[j] && taken[j] !== (state.user ? state.user.uid : null);
            var btn = document.createElement('button');
            btn.className = 'juz-btn' + (isTaken ? ' taken' : '');
            btn.textContent = j;
            btn.disabled = isTaken;
            if (!isTaken) {
                btn.onclick = (function(juz) {
                    return function() { window.selectJuz(circleId, juz); };
                })(j);
            }
            container.appendChild(btn);
        }
        Utils.showScreen('selectJuzScreen');
    } catch (error) {
        console.error('خطأ في تحميل الأجزاء:', error);
        Utils.showToast('حدث خطأ في تحميل الأجزاء', true);
    }
};

window.selectJuz = async function(circleId, juz) {
    if (!state.user) {
        Utils.showMessage('juzSelectionMessage', 'خطأ: يرجى تسجيل الدخول أولاً', true);
        return;
    }
    try {
        const existingMemberCheck = await db.collection('circleMembers')
            .where('userId', '==', state.user.uid)
            .where('isActive', '==', true)
            .get();
        if (!existingMemberCheck.empty) {
            Utils.showMessage('juzSelectionMessage', '⚠️ أنت بالفعل عضو في حلقة', true);
            return;
        }
        const userDoc = await db.collection('users').doc(state.user.uid).get();
        const userName = userDoc.exists ? (userDoc.data().displayName || userDoc.data().username) : 'مستخدم';
        const availRef = db.collection('circleAvailableJuz').doc(circleId);
        var takenJuzList = [];
        await db.runTransaction(async function(t) {
            const d = await t.get(availRef);
            const data = d.data() || { availableJuz: [], takenJuz: {} };
            if (data.takenJuz[juz] && data.takenJuz[juz] !== state.user.uid) {
                throw new Error('الجزء مأخوذ');
            }
            var newTaken = { ...data.takenJuz };
            newTaken[juz] = state.user.uid;
            var newAvail = data.availableJuz.filter(function(j) { return j !== juz; });
            t.update(availRef, { takenJuz: newTaken, availableJuz: newAvail });
            takenJuzList = Object.keys(newTaken).map(Number);
        });
        const circleRef = db.collection('circles').doc(circleId);
        const cDoc = await circleRef.get();
        await circleRef.update({ memberCount: (cDoc.data().memberCount || 0) + 1 });
        const membersCount = await db.collection('circleMembers')
            .where('circleId', '==', circleId)
            .where('isActive', '==', true)
            .get();
        var isFirstMember = membersCount.size === 0;
        var memberDoc = {
            circleId: circleId,
            userId: state.user.uid,
            userName: userName,
            userEmail: state.user.email || '',
            userGender: state.gender || 'mixed',
            joinedAt: new Date(),
            selectedJuz: juz,
            currentJuz: juz,
            totalPartsRead: 0,
            completedKhatmas: 0,
            lastReadDate: null,
            absenceCount: 0,
            streakDays: 0,
            isActive: true,
            isCircleAdmin: isFirstMember,
            isFrozen: false,
            frozenUntil: null,
            frozenBy: null,
            frozenByName: null,
            frozenAt: null,
            freezeReason: null,
            trustScore: 50,
            extraReadingsPlan: [],
            totalExtraJuz: 0,
            takenJuzList: takenJuzList,
            readJuzList: [],
            extraReadJuzList: []
        };
        const memberRef = await db.collection('circleMembers').add(memberDoc);
        state.memberData = memberDoc;
        state.memberId = memberRef.id;
        state.circleId = circleId;
        state.role = isFirstMember ? ROLES.CIRCLE_ADMIN : ROLES.MEMBER;
        state.saveToStorage();
        Utils.showMessage('juzSelectionMessage', '✅ تم اختيار الجزء ' + juz + (isFirstMember ? ' 👑 أنت الآن مدير الحلقة!' : ''), false);
        await updateUI();
        await Promise.all([loadCircleInfo(), loadExtraProgress(), loadMyJuzList(), loadAchievements(), loadUserNotifications()]);
        updateJuzProgressChart();
        Utils.showScreen('mainScreen');
        Utils.showToast('🎉 مرحباً بك في الحلقة!' + (isFirstMember ? ' أنت مدير الحلقة!' : ''), false);
    } catch (error) {
        console.error('خطأ في اختيار الجزء:', error);
        Utils.showMessage('juzSelectionMessage', error.message || 'حدث خطأ، حاول مرة أخرى', true);
    }
};

// ==================== تحميل بيانات المستخدم ====================
async function loadUserData() {
    if (!state.user) return;
    try {
        const userDoc = await db.collection('users').doc(state.user.uid).get();
        if (!userDoc.exists) {
            await db.collection('users').doc(state.user.uid).set({
                name: state.user.displayName || state.user.email ? state.user.email.split('@')[0] : 'مستخدم',
                username: state.user.displayName || state.user.email ? state.user.email.split('@')[0] : 'مستخدم',
                email: state.user.email || '',
                gender: 'mixed',
                role: 'member',
                createdAt: new Date(),
                displayName: state.user.displayName || state.user.email ? state.user.email.split('@')[0] : 'مستخدم'
            });
        }
        const userData = userDoc.exists ? userDoc.data() : {};
        state.gender = userData.gender || 'mixed';
        state.user.displayName = userData.displayName || userData.name || state.user.displayName || 'مستخدم';
        state.user.email = userData.email || state.user.email;
        
        const members = await db.collection('circleMembers')
            .where('userId', '==', state.user.uid)
            .where('isActive', '==', true)
            .get();
        
        if (members.empty) {
            await showAvailableCircles({
                userId: state.user.uid,
                email: state.user.email || '',
                name: state.user.displayName || 'مستخدم',
                gender: state.gender
            });
            return;
        }
        
        const mDoc = members.docs[0];
        const memberData = mDoc.data();
        if (memberData.userName !== state.user.displayName) {
            await db.collection('circleMembers').doc(mDoc.id).update({
                userName: state.user.displayName
            });
            memberData.userName = state.user.displayName;
        }
        state.memberData = memberData;
        state.memberId = mDoc.id;
        state.circleId = state.memberData.circleId;
        state.role = state.memberData.isCircleAdmin ? ROLES.CIRCLE_ADMIN : ROLES.MEMBER;
        state.saveToStorage();
        await updateAbsenceCount();
        
        if (state.memberData.isFrozen && state.memberData.frozenUntil) {
            const frozenUntil = Utils.toDate(state.memberData.frozenUntil);
            if (frozenUntil && frozenUntil > new Date()) {
                Utils.showToast('⏸️ أنت مجمد حتى ' + Utils.formatDate(frozenUntil), true);
                document.getElementById('completeDailyJuzBtn').disabled = true;
                document.getElementById('completeDailyJuzBtn').textContent = '⏸️ مجمد مؤقتاً';
            } else {
                await db.collection('circleMembers').doc(state.memberId).update({
                    isFrozen: false,
                    frozenUntil: null,
                    frozenBy: null,
                    frozenByName: null,
                    frozenAt: null,
                    freezeReason: null
                });
                state.memberData.isFrozen = false;
            }
        }
        
        // ===== تحميل رسالة المشاركة =====
        await loadShareMessage();
        // ================================
        
        await updateUI();
        await Promise.all([loadCircleInfo(), loadExtraProgress(), loadMyJuzList(), loadAchievements(), loadUserNotifications()]);
        updateJuzProgressChart();
        Utils.showScreen('mainScreen');
        updateExtraLimitBadge();
        await notifications.init();
    } catch (error) {
        console.error('❌ خطأ في loadUserData:', error);
        Utils.showToast('حدث خطأ في تحميل البيانات، جاري إعادة المحاولة...', true);
        setTimeout(async function() {
            try {
                await Utils.refreshUserData();
                Utils.showToast('✅ تم إعادة تحميل البيانات بنجاح', false);
                await loadUserData();
            } catch (retryError) {
                console.error('❌ فشل إعادة تحميل البيانات:', retryError);
                Utils.showToast('❌ فشل إعادة تحميل البيانات، يرجى تسجيل الخروج والدخول مرة أخرى', true);
            }
        }, 2000);
    }
}

// ==================== تحديث أيام الغياب ====================
async function updateAbsenceCount() {
    if (!state.memberData || !state.memberId) return;
    try {
        const today = Utils.getTodayString();
        const lastRead = state.memberData.lastReadDate ? Utils.toDate(state.memberData.lastReadDate) : null;
        const lastReadStr = lastRead ? lastRead.toDateString() : null;
        if (!lastReadStr) {
            const joinedDate = state.memberData.joinedAt ? Utils.toDate(state.memberData.joinedAt) : null;
            const joinedStr = joinedDate ? joinedDate.toDateString() : null;
            const daysSinceJoin = Utils.daysDifference(joinedStr, today);
            if (daysSinceJoin > 0) {
                await updateAbsenceInDatabase(daysSinceJoin);
            }
            return;
        }
        if (lastReadStr === today) {
            if (state.memberData.absenceCount !== 0) {
                await updateAbsenceInDatabase(0);
            }
            return;
        }
        const daysDiff = Utils.daysDifference(lastReadStr, today);
        if (daysDiff > 0) {
            await updateAbsenceInDatabase(daysDiff);
        }
    } catch (error) {
        console.error('خطأ في updateAbsenceCount:', error);
    }
}

async function updateAbsenceInDatabase(newAbsenceCount) {
    try {
        const memberRef = db.collection('circleMembers').doc(state.memberId);
        await memberRef.update({
            absenceCount: newAbsenceCount,
            updatedAt: new Date()
        });
        state.memberData.absenceCount = newAbsenceCount;
        const maxAbsence = settingsManager.get('maxAbsenceDays') || 3;
        if (newAbsenceCount >= maxAbsence && !state.memberData.isFrozen) {
            await autoRemoveMember();
        }
    } catch (error) {
        console.error('خطأ في updateAbsenceInDatabase:', error);
    }
}

async function autoRemoveMember() {
    if (!state.memberData || !state.memberId) return;
    try {
        const freezeUntil = new Date();
        freezeUntil.setDate(freezeUntil.getDate() + 7);
        await db.collection('circleMembers').doc(state.memberId).update({
            isFrozen: true,
            frozenUntil: freezeUntil,
            frozenBy: 'system',
            frozenByName: 'النظام',
            frozenAt: new Date(),
            freezeReason: 'غياب متكرر (' + (settingsManager.get('maxAbsenceDays') || 3) + ' أيام)'
        });
        state.memberData.isFrozen = true;
        state.memberData.frozenUntil = freezeUntil;
        Utils.showToast('⏸️ تم تجميد حسابك بسبب الغياب', true);
        await updateUI();
    } catch (error) {
        console.error('خطأ في autoRemoveMember:', error);
    }
}

// ==================== إكمال الورد اليومي ====================
window.completeDaily = async function() {
    if (!state.user || !state.memberData) {
        Utils.showToast('⚠️ يرجى تسجيل الدخول أولاً', true);
        return;
    }
    if (state.memberData.isFrozen) {
        Utils.showToast('⚠️ حسابك مجمد، لا يمكنك تسجيل القراءة', true);
        return;
    }
    var today = Utils.getTodayString();
    var lastRead = state.memberData.lastReadDate ? Utils.toDate(state.memberData.lastReadDate) : null;
    var lastReadStr = lastRead ? lastRead.toDateString() : null;
    if (lastReadStr === today) {
        Utils.showToast('⚠️ أتممت اليوم بالفعل', true);
        return;
    }
    var btn = document.getElementById('completeDailyJuzBtn');
    var origText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري...'; }
    try {
        var q = await db.collection('circleMembers').where('userId', '==', state.user.uid).get();
        if (q.empty) throw new Error('المستخدم غير موجود');
        var ref = q.docs[0].ref;
        var readJuzToday = state.memberData.currentJuz || state.memberData.selectedJuz || 1;
        var currentJuz = state.memberData.currentJuz || state.memberData.selectedJuz || 1;
        var newJuz = (currentJuz % 30) + 1;
        var newTotalParts = (state.memberData.totalPartsRead || 0) + 1;
        var oldKhatmas = Utils.calculateKhatmas(state.memberData.totalPartsRead || 0);
        var newKhatmas = Utils.calculateKhatmas(newTotalParts);
        var yesterday = new Date(Date.now() - 86400000).toDateString();
        var newStreak = (state.memberData.streakDays || 0) + 1;
        if (lastReadStr !== yesterday && lastReadStr !== null) newStreak = 1;
        await ref.update({
            currentJuz: newJuz,
            totalPartsRead: newTotalParts,
            lastReadDate: new Date(),
            streakDays: newStreak,
            absenceCount: 0,
            readJuzList: firebase.firestore.FieldValue.arrayUnion(readJuzToday),
            trustScore: TrustSystem.calculateScore({
                ...state.memberData,
                totalPartsRead: newTotalParts,
                streakDays: newStreak
            })
        });
        state.memberData.currentJuz = newJuz;
        state.memberData.totalPartsRead = newTotalParts;
        state.memberData.lastReadDate = new Date();
        state.memberData.streakDays = newStreak;
        state.memberData.absenceCount = 0;
        Utils.showToast('✅ تم تسجيل وردك - الجزء ' + readJuzToday, false);
        if (newKhatmas > oldKhatmas) {
            Utils.showToast('🎉 ختمة جديدة! رقم ' + newKhatmas, false);
            await notifications.sendToUser(state.user.uid, '🎉 ختمة', 'ختمة رقم ' + newKhatmas, 'achievement');
        }
        await updateUI();
        await loadExtraProgress();
        updateJuzProgressChart();
        await loadMyJuzList();
        await loadAchievements();
        updateShareButton();
        if (btn) { btn.disabled = false; btn.textContent = origText || '✅ أنهيت وردي اليوم'; }
    } catch (error) {
        console.error('خطأ في completeDaily:', error);
        Utils.showToast('حدث خطأ', true);
        if (btn) { btn.disabled = false; btn.textContent = origText || '✅ أنهيت وردي اليوم'; }
    }
};

// ==================== تحديث الواجهة ====================
async function updateUI() {
    if (!state.memberData) return;
    Utils.syncUserData();
    var displayName = state.memberData.userName || (state.user ? state.user.displayName : null) || 'مستخدم';
    document.getElementById('userName').textContent = displayName;
    document.getElementById('userAvatar').textContent = state.gender === 'female' ? '👩' : '👤';
    var isAdmin = state.role === ROLES.CIRCLE_ADMIN || state.role === ROLES.SUPER_ADMIN;
    var reportBtn = document.getElementById('showReportBtn');
    var distributeBtn = document.getElementById('manualDistributeBtn');
    if (reportBtn) {
        reportBtn.style.display = isAdmin ? 'inline-block' : 'none';
    }
    if (distributeBtn) {
        distributeBtn.style.display = isAdmin ? 'inline-block' : 'none';
    }
    var totalParts = state.memberData.totalPartsRead || 0;
    var currentJuzNum = state.memberData.currentJuz || state.memberData.selectedJuz || 1;
    var progressInKhatma = totalParts % 30;
    var currentKhatma = Math.floor(totalParts / 30) + 1;
    var today = Utils.getTodayString();
    var lastRead = state.memberData.lastReadDate ? Utils.toDate(state.memberData.lastReadDate) : null;
    var lastReadStr = lastRead ? lastRead.toDateString() : null;
    var hasReadToday = lastReadStr === today;
    var readJuz = state.memberData.readJuzList || [];
    var readTodayJuz = hasReadToday && readJuz.length > 0 ? readJuz[readJuz.length - 1] : null;
    var displayJuz = readTodayJuz || currentJuzNum;
    document.getElementById('currentJuz').textContent = displayJuz;
    var trustScore = TrustSystem.calculateScore(state.memberData);
    var trustLevel = TrustSystem.getLevel(trustScore);
    if (hasReadToday && readTodayJuz) {
        document.getElementById('juzStatus').innerHTML = '✅ قرأت اليوم الجزء ' + readTodayJuz + ' | الختمة ' + currentKhatma + '<br><small>🔒 مستوى الثقة: ' + trustLevel.name + ' (' + trustScore + '%)</small>';
    } else {
        document.getElementById('juzStatus').innerHTML = 'الختمة ' + currentKhatma + ' - الجزء ' + displayJuz + ' من 30<br><small>🔒 مستوى الثقة: ' + trustLevel.name + ' (' + trustScore + '%)</small>';
    }
    document.getElementById('khatmaProgress').style.width = (progressInKhatma / 30 * 100) + '%';
    document.getElementById('totalPartsCount').textContent = (state.memberData.totalPartsRead || 0) + (state.memberData.totalExtraJuz || 0);
    document.getElementById('khatmasCount').textContent = Utils.calculateKhatmas(totalParts);
    document.getElementById('joinDateDisplay').textContent = Utils.formatDate(state.memberData.joinedAt);
    var btn = document.getElementById('completeDailyJuzBtn');
    if (state.memberData.isFrozen) {
        btn.disabled = true;
        btn.textContent = '⏸️ مجمد مؤقتاً';
        btn.style.background = '#9ca3af';
        btn.style.color = 'white';
    } else if (hasReadToday) {
        btn.disabled = true;
        btn.textContent = '✅ تم إكمال الورد';
        btn.style.background = '#9ca3af';
        btn.style.color = 'white';
    } else {
        btn.disabled = false;
        btn.textContent = '✅ أنهيت وردي اليوم';
        btn.style.background = '#fbbf24';
        btn.style.color = '#1a4739';
    }
    document.getElementById('userInfo').innerHTML = '📧 ' + (state.memberData.userEmail || 'غير مسجل') + ' | 📅 انضم: ' + Utils.formatDate(state.memberData.joinedAt) + ' | 📊 ' + ((state.memberData.totalPartsRead || 0) + (state.memberData.totalExtraJuz || 0)) + ' جزء' + (hasReadToday && readTodayJuz ? ' | ✅ قرأت الجزء ' + readTodayJuz : ' | ❌ لم تقرأ اليوم') + (state.role === ROLES.CIRCLE_ADMIN ? ' | 👑 مدير الحلقة' : '') + (state.memberData.isFrozen ? ' | ⏸️ مجمد' : '');
    var warningDiv = document.getElementById('warningMessage');
    var absenceDays = state.memberData.absenceCount || 0;
    var maxAbsence = settingsManager.get('maxAbsenceDays') || 3;
    if (state.memberData.isFrozen) {
        warningDiv.style.display = 'block';
        var frozenBy = state.memberData.frozenByName || state.memberData.frozenBy || 'النظام';
        warningDiv.innerHTML = '⏸️ حسابك مجمد حتى ' + Utils.formatDate(state.memberData.frozenUntil) + ' (بواسطة: ' + frozenBy + ')';
        warningDiv.className = 'warning-message warning-frozen';
    } else if (absenceDays >= 1 && absenceDays < maxAbsence) {
        warningDiv.style.display = 'block';
        warningDiv.innerHTML = '⚠️ أنت غائب عن القراءة منذ ' + absenceDays + ' يوم! إذا وصلت إلى ' + maxAbsence + ' أيام، سيتم تجميد حسابك.';
        warningDiv.className = 'warning-message warning-absent';
    } else if (absenceDays >= maxAbsence) {
        warningDiv.style.display = 'block';
        warningDiv.innerHTML = '⏸️ تم تجميد حسابك بسبب الغياب لمدة ' + maxAbsence + ' أيام متتالية.';
        warningDiv.className = 'warning-message warning-frozen';
    } else {
        warningDiv.style.display = 'none';
    }
    await updateNotificationBadge();
}

// ==================== تحديث الرسم البياني ====================
function updateJuzProgressChart() {
    if (!state.memberData) return;
    var totalParts = state.memberData.totalPartsRead || 0;
    var progressInCurrentKhatma = totalParts % 30;
    var percent = (progressInCurrentKhatma / 30) * 100;
    document.getElementById('juzProgressPercent').textContent = Math.round(percent) + '%';
    var canvas = document.getElementById('juzProgressChart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (state.juzChart) state.juzChart.destroy();
    state.juzChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [percent, 100 - percent],
                backgroundColor: ['#fbbf24', '#e5e7eb'],
                borderWidth: 0
            }]
        },
        options: {
            cutout: '70%',
            plugins: {
                tooltip: { enabled: false },
                legend: { display: false }
            }
        }
    });
}

// ==================== تحميل معلومات الحلقة ====================
async function loadCircleInfo() {
    try {
        var circ = await db.collection('circles').doc(state.circleId).get();
        if (!circ.exists) return;
        var c = circ.data();
        var icon = c.gender === 'female' ? '👩' : (c.gender === 'male' ? '👨' : '👥');
        var isAdmin = state.role === ROLES.CIRCLE_ADMIN || state.role === ROLES.SUPER_ADMIN;
        document.getElementById('circleInfo').innerHTML = '<div class="circle-info-card"><h3>🔄 ' + Utils.escapeHtml(c.circleName) + ' ' + icon + '</h3><p>👥 ' + (c.memberCount || 0) + '/' + settingsManager.get('maxCircleMembers') + '</p><p>📖 جزئك: ' + state.memberData.selectedJuz + '</p>' + (state.role === ROLES.CIRCLE_ADMIN ? '<p class="admin-badge">👑 أنت مدير الحلقة</p>' : '') + '</div>';
        document.getElementById('circleActions').innerHTML = (isAdmin ? '<button onclick="window.openCircleManagement()" class="btn-action purple">⚙️ إدارة الحلقة</button>' : '') + '<button onclick="window.leaveCircle()" class="btn-action danger">🚪 مغادرة</button>';
        var members = await db.collection('circleMembers')
            .where('circleId', '==', state.circleId)
            .where('isActive', '==', true)
            .get();
        var list = document.getElementById('circleMembersList');
        list.innerHTML = '<h4>👥 الأعضاء:</h4>';
        members.forEach(function(d) {
            var m = d.data();
            var totalParts = (m.totalPartsRead || 0) + (m.totalExtraJuz || 0);
            var today = Utils.getTodayString();
            var lastRead = m.lastReadDate ? Utils.toDate(m.lastReadDate) : null;
            var hasReadToday = lastRead ? lastRead.toDateString() === today : false;
            var trustScore = TrustSystem.calculateScore(m);
            var status = Utils.getUserStatus(m);
            var isCurrentUser = m.userId === (state.user ? state.user.uid : null);
            list.innerHTML += '<div class="member-item ' + (hasReadToday ? 'active' : 'inactive') + '"><div class="member-info"><span class="member-name">' + Utils.escapeHtml(m.userName) + (isCurrentUser ? ' (أنت)' : '') + '</span><span class="member-badges">' + (m.isCircleAdmin ? '👑 ' : '') + (m.isFrozen ? '⏸️ ' : '') + (hasReadToday ? '✅' : '❌') + '</span></div><div class="member-details"><span>الجزء ' + m.selectedJuz + '</span><span>📊 ' + totalParts + ' جزء</span><span>' + status.label + '</span><span>🔒 ' + trustScore + '%</span></div></div>';
        });
    } catch (error) {
        console.error('خطأ في loadCircleInfo:', error);
    }
}

// ==================== دوال الأجزاء الإضافية ====================
async function loadExtraProgress() {
    var container = document.getElementById('extraProgressList');
    if (!container) return;
    if (!state.memberData) {
        container.innerHTML = '<div class="empty-plan">لا توجد بيانات</div>';
        return;
    }
    var plan = state.memberData.extraReadingsPlan || [];
    var today = Utils.getTodayString();
    if (plan.length === 0) {
        container.innerHTML = '<div class="empty-plan">📝 لا توجد أجزاء إضافية في خطتك اليوم<br><button onclick="window.showExtraJuzModal()" class="btn-add-extra-sm">📦 أضف جزءاً</button></div>';
        return;
    }
    var todayPlan = plan.filter(function(p) {
        var addedDate = p.addedAt ? Utils.toDate(p.addedAt) : null;
        return addedDate ? addedDate.toDateString() === today : false;
    });
    if (todayPlan.length === 0) {
        container.innerHTML = '<div class="empty-plan">📝 لا توجد أجزاء إضافية اليوم<br><button onclick="window.showExtraJuzModal()" class="btn-add-extra-sm">📦 أضف جزءاً</button></div>';
        return;
    }
    todayPlan.sort(function(a, b) { return a.juz - b.juz; });
    container.innerHTML = '';
    for (var i = 0; i < todayPlan.length; i++) {
        var item = todayPlan[i];
        var isComp = item.status === 'completed';
        var div = document.createElement('div');
        div.className = 'progress-item ' + (isComp ? 'completed' : 'pending');
        div.innerHTML = '<div class="progress-info"><span>📖 الجزء ' + item.juz + ' (من المخزون العام)</span><span class="status-badge">' + (isComp ? '✅ تم' : '⏳ في الانتظار') + '</span></div><div class="progress-action">' + (!isComp ? '<button onclick="window.completeExtraJuz(' + item.juz + ')" class="btn-complete-extra">📌 أنهيت</button>' : '<span class="completed-badge">✅ مكتمل</span>') + '</div>';
        container.appendChild(div);
    }
}

window.completeExtraJuz = async function(juz) {
    var plan = state.memberData.extraReadingsPlan || [];
    var item = plan.find(function(p) { return p.juz === juz && p.status === 'pending'; });
    if (!item) {
        Utils.showToast('⚠️ هذا الجزء غير موجود أو تم إكماله مسبقاً', true);
        return;
    }
    try {
        var memberRef = db.collection('circleMembers').doc(state.memberId);
        var updatedPlan = plan.map(function(p) {
            if (p.juz === juz && p.status === 'pending') {
                return { ...p, status: 'completed', completedAt: new Date() };
            }
            return p;
        });
        var newTotalExtra = (state.memberData.totalExtraJuz || 0) + 1;
        await memberRef.update({
            extraReadingsPlan: updatedPlan,
            totalExtraJuz: newTotalExtra,
            extraReadJuzList: firebase.firestore.FieldValue.arrayUnion(juz)
        });
        state.memberData.extraReadingsPlan = updatedPlan;
        state.memberData.totalExtraJuz = newTotalExtra;
        Utils.showToast('✅ الجزء ' + juz + ' من المخزون', false);
        await loadExtraProgress();
        await updateUI();
    } catch (error) {
        console.error('خطأ في completeExtraJuz:', error);
        Utils.showToast('حدث خطأ', true);
    }
};

// ==================== دوال أجزائي والإنجازات ====================
async function loadMyJuzList() {
    var container = document.getElementById('myJuzList');
    if (!container || !state.memberData) return;
    var takenJuz = state.memberData.takenJuzList || [];
    var readJuz = state.memberData.readJuzList || [];
    var extraReadJuz = state.memberData.extraReadJuzList || [];
    var allReadJuz = Array.from(new Set([...readJuz, ...extraReadJuz])).sort(function(a, b) { return a - b; });
    var today = Utils.getTodayString();
    var lastRead = state.memberData.lastReadDate ? Utils.toDate(state.memberData.lastReadDate) : null;
    var readToday = (lastRead ? lastRead.toDateString() === today : false) && readJuz.length > 0 ? readJuz[readJuz.length - 1] : '-';
    var trustScore = TrustSystem.calculateScore(state.memberData);
    var html = '<div class="juz-summary"><div class="summary-item"><span>📖 الجزء المقروء اليوم:</span><strong>' + (readToday !== '-' ? 'الجزء ' + readToday : 'لم تقرأ اليوم') + '</strong></div><div class="summary-item"><span>📦 الأجزاء المأخوذة:</span><strong>' + (takenJuz.length > 0 ? takenJuz.join(', ') : 'لا يوجد') + '</strong></div><div class="summary-item"><span>📖 جميع الأجزاء المقروءة:</span><strong>' + (allReadJuz.length > 0 ? allReadJuz.join(', ') : 'لا يوجد') + '</strong></div><div class="summary-item"><span>📊 إجمالي الأجزاء المقروءة:</span><strong>' + ((state.memberData.totalPartsRead || 0) + (state.memberData.totalExtraJuz || 0)) + '</strong></div><div class="summary-item"><span>🏆 عدد الختمات:</span><strong>' + Utils.calculateKhatmas(state.memberData.totalPartsRead || 0) + '</strong></div><div class="summary-item"><span>🔒 نسبة الثقة:</span><strong>' + trustScore + '%</strong></div><div class="summary-item"><span>📅 تاريخ الانضمام:</span><strong>' + Utils.formatDate(state.memberData.joinedAt) + '</strong></div></div>';
    html += '<div class="juz-details"><h4>📋 تفاصيل الأجزاء المأخوذة:</h4><div class="juz-details-grid">';
    for (var i = 0; i < takenJuz.length; i++) {
        var juz = takenJuz[i];
        var isRead = allReadJuz.includes(juz);
        var isExtra = extraReadJuz.includes(juz);
        var status = '⏳ في الانتظار';
        var statusClass = 'pending';
        if (isRead && isExtra) {
            status = '✅ مقروء (إضافي)';
            statusClass = 'extra-completed';
        } else if (isRead) {
            status = '✅ مقروء (أساسي)';
            statusClass = 'completed';
        }
        html += '<div class="juz-detail-item ' + statusClass + '"><span class="juz-number-small">الجزء ' + juz + '</span><span class="juz-status">' + status + '</span></div>';
    }
    html += '</div></div>';
    container.innerHTML = html;
}

async function loadAchievements() {
    var container = document.getElementById('achievementsList');
    if (!container || !state.memberData) return;
    var totalParts = (state.memberData.totalPartsRead || 0) + (state.memberData.totalExtraJuz || 0);
    var khatmas = Utils.calculateKhatmas(state.memberData.totalPartsRead || 0);
    var streak = state.memberData.streakDays || 0;
    var readJuz = state.memberData.readJuzList || [];
    var extraReadJuz = state.memberData.extraReadJuzList || [];
    var allReadJuz = Array.from(new Set([...readJuz, ...extraReadJuz]));
    var trustScore = TrustSystem.calculateScore(state.memberData);
    var achievements = [
        { id: 'first_read', icon: '📖', name: 'أول قراءة', desc: 'قرأت أول جزء', condition: totalParts >= 1 },
        { id: 'five_read', icon: '📚', name: 'خمسة أجزاء', desc: 'قرأت 5 أجزاء', condition: totalParts >= 5 },
        { id: 'ten_read', icon: '📚', name: 'عشرة أجزاء', desc: 'قرأت 10 أجزاء', condition: totalParts >= 10 },
        { id: 'twenty_read', icon: '📚', name: 'عشرون جزءاً', desc: 'قرأت 20 جزءاً', condition: totalParts >= 20 },
        { id: 'thirty_read', icon: '📚', name: 'ثلاثون جزءاً', desc: 'أكملت الختمة الأولى', condition: totalParts >= 30 },
        { id: 'first_khatma', icon: '🏆', name: 'أول ختمة', desc: 'أتممت ختمة كاملة', condition: khatmas >= 1 },
        { id: 'five_khatma', icon: '🏆', name: 'خمس ختمات', desc: 'أتممت 5 ختمات', condition: khatmas >= 5 },
        { id: 'ten_khatma', icon: '🏆', name: 'عشر ختمات', desc: 'أتممت 10 ختمات', condition: khatmas >= 10 },
        { id: 'streak_7', icon: '🔥', name: 'أسبوع متواصل', desc: 'قرأت 7 أيام متتالية', condition: streak >= 7 },
        { id: 'streak_30', icon: '🔥', name: 'شهر متواصل', desc: 'قرأت 30 يوم متتالية', condition: streak >= 30 },
        { id: 'streak_100', icon: '🔥', name: '100 يوم متواصل', desc: 'قرأت 100 يوم متتالية', condition: streak >= 100 },
        { id: 'all_juz', icon: '🌟', name: 'ختمة كاملة', desc: 'قرأت جميع الأجزاء الـ 30', condition: allReadJuz.length >= 30 },
        { id: 'trust_high', icon: '🔒', name: 'موثوق', desc: 'نسبة ثقة عالية (80%+)', condition: trustScore >= 80 }
    ];
    container.innerHTML = '';
    for (var i = 0; i < achievements.length; i++) {
        var ach = achievements[i];
        var earned = ach.condition;
        var div = document.createElement('div');
        div.className = 'achievement-card ' + (earned ? 'earned' : '');
        div.innerHTML = '<div class="achievement-icon">' + ach.icon + '</div><div class="achievement-name">' + ach.name + '</div><div class="achievement-desc">' + ach.desc + '</div><div class="achievement-status">' + (earned ? '✅ مكتمل' : '⏳ قيد الإنجاز') + '</div>';
        container.appendChild(div);
    }
}

// ==================== دوال المشاركة ====================
function checkReadStatus() {
    if (!state.memberData) return false;
    var today = Utils.getTodayString();
    var lastRead = state.memberData.lastReadDate ? Utils.toDate(state.memberData.lastReadDate) : null;
    var lastReadStr = lastRead ? lastRead.toDateString() : null;
    return lastReadStr === today;
}

function updateShareButton() {
    var shareBtn = document.getElementById('shareJuzBtn');
    if (!shareBtn) return;
    var hasRead = checkReadStatus();
    if (hasRead) {
        shareBtn.disabled = false;
        shareBtn.textContent = '📱 مشاركة';
        shareBtn.style.opacity = '1';
        shareBtn.style.cursor = 'pointer';
        shareBtn.style.background = '#25D366';
        shareBtn.style.color = 'white';
    } else {
        shareBtn.disabled = true;
        shareBtn.textContent = '🔒 أنهِ وردك أولاً';
        shareBtn.style.opacity = '0.5';
        shareBtn.style.cursor = 'not-allowed';
        shareBtn.style.background = '#6c757d';
        shareBtn.style.color = 'white';
    }
}

// ===== متغير رسالة المشاركة (يتم تحميله من قاعدة البيانات) =====
var shareMessageText = '📖 أنا أقرأ الجزء {juz} من القرآن الكريم في تطبيق ختمتي! 🕌\n\nانضم إلينا وشارك في الختمة الجماعية 📚\n\n#ختمتي #القرآن_الكريم';

// ==================== تحميل رسالة المشاركة ====================
async function loadShareMessage() {
    try {
        const doc = await db.collection('appSettings').doc('shareMessage').get();
        if (doc.exists) {
            const data = doc.data();
            shareMessageText = data.message || '';
            console.log('✅ تم تحميل رسالة المشاركة من قاعدة البيانات:', shareMessageText);
        } else {
            console.log('ℹ️ لا توجد رسالة مشاركة محفوظة، استخدام الرسالة الافتراضية');
        }
        // تحديث المعاينة في لوحة المدير
        updateSharePreview();
    } catch (error) {
        console.error('❌ خطأ في تحميل رسالة المشاركة:', error);
    }
}

function updateSharePreview() {
    var preview = document.getElementById('shareMessagePreview');
    if (!preview) return;
    var text = document.getElementById('shareMessageText') ? document.getElementById('shareMessageText').value : shareMessageText;
    var previewText = text.replace(/{juz}/g, '10').replace(/{name}/g, 'اسم المستخدم');
    preview.innerHTML = previewText.replace(/\n/g, '<br>');
}

window.saveShareMessage = async function() {
    var text = document.getElementById('shareMessageText').value;
    if (!text) { Utils.showToast('⚠️ أدخل نص الرسالة', true); return; }
    try {
        await db.collection('appSettings').doc('shareMessage').set({ message: text, updatedAt: new Date() });
        shareMessageText = text;
        Utils.showToast('✅ تم حفظ رسالة المشاركة', false);
        updateSharePreview();
    } catch (error) {
        console.error('خطأ في حفظ رسالة المشاركة:', error);
        Utils.showToast('❌ حدث خطأ في حفظ الرسالة', true);
    }
};

// ==================== فتح مودال المشاركة ====================
window.openShareModal = function() {
    if (!checkReadStatus()) {
        Utils.showToast('⚠️ يجب أن تنهي وردك اليومي أولاً', true);
        return;
    }
    var modal = document.getElementById('shareModal');
    
    // ===== معلومات المستخدم =====
    var userName = state.user ? state.user.displayName : 'مستخدم';
    var juz = state.memberData ? (state.memberData.selectedJuz || 1) : 1;
    var totalParts = (state.memberData ? state.memberData.totalPartsRead || 0 : 0) + (state.memberData ? state.memberData.totalExtraJuz || 0 : 0);
    var khatmas = Utils.calculateKhatmas(state.memberData ? state.memberData.totalPartsRead || 0 : 0);
    var streak = state.memberData ? state.memberData.streakDays || 0 : 0;
    var trustScore = state.memberData ? TrustSystem.calculateScore(state.memberData) : 0;
    
    // التاريخ والوقت
    var now = new Date();
    var currentDate = now.toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' });
    var currentTime = now.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
    var currentDay = now.toLocaleDateString('ar', { weekday: 'long' });
    
    // ===== قراءة النص من المتغير العام (الذي تم تحميله من قاعدة البيانات) =====
    var text = shareMessageText || '📖 {name} يقرأ الجزء {juz} من القرآن الكريم في تطبيق ختمتي! 🕌\n\n📊 إحصائياتي:\n• إجمالي الأجزاء: {total}\n• عدد الختمات: {khatma}\n• أيام الاستمرار: {streak}\n• نسبة الثقة: {trust}%\n\n📅 {date} - {time}\n\nانضم إلينا وشارك في الختمة الجماعية 📚\n\n#ختمتي #القرآن_الكريم';
    
    // ===== استبدال جميع الرموز =====
    var finalText = text
        .replace(/{name}/g, userName)
        .replace(/{juz}/g, juz)
        .replace(/{total}/g, totalParts)
        .replace(/{khatma}/g, khatmas)
        .replace(/{streak}/g, streak)
        .replace(/{trust}/g, trustScore)
        .replace(/{date}/g, currentDate)
        .replace(/{time}/g, currentTime)
        .replace(/{day}/g, currentDay);
    
    document.getElementById('shareMessageDisplay').textContent = finalText;
    modal.style.display = 'flex';
};

// ==================== أزرار المشاركة ====================
window.shareToWhatsApp = function() {
    var text = document.getElementById('shareMessageDisplay').textContent;
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
};

window.shareToTelegram = function() {
    var text = document.getElementById('shareMessageDisplay').textContent;
    window.open('https://t.me/share/url?url=&text=' + encodeURIComponent(text), '_blank');
};

window.shareToTwitter = function() {
    var text = document.getElementById('shareMessageDisplay').textContent;
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text), '_blank');
};

window.copyShareText = function() {
    var text = document.getElementById('shareMessageDisplay').textContent;
    navigator.clipboard.writeText(text).then(function() {
        Utils.showToast('✅ تم نسخ النص', false);
    }).catch(function() {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        Utils.showToast('✅ تم نسخ النص', false);
    });
};

// ==================== دوال عرض النص والاستماع ====================
window.showJuzText = async function(juzNumber) {
    if (!juzNumber || juzNumber < 1 || juzNumber > 30) {
        Utils.showToast('رقم جزء غير صالح', true);
        return;
    }
    var viewer = document.getElementById('juzTextViewer');
    var content = document.getElementById('juzTextContent');
    var juzDisplay = document.getElementById('viewerJuzNumber');
    viewer.style.display = 'block';
    juzDisplay.textContent = juzNumber;
    content.innerHTML = '⏳ جاري تحميل النص...';
    document.getElementById('currentPageDisplay').textContent = 'جاري التحميل...';
    try {
        var response = await fetch('https://api.alquran.cloud/v1/juz/' + juzNumber + '/ar.alafasy');
        if (!response.ok) throw new Error('فشل تحميل النص');
        var data = await response.json();
        if (data.code !== 200 || !data.data) throw new Error('بيانات غير صالحة');
        var verses = data.data.ayahs || [];
        var html = '<div class="quran-text">';
        for (var i = 0; i < verses.length; i++) {
            var verse = verses[i];
            html += '<span class="ayah-container"><span class="ayah-text">' + verse.text + '</span><span class="ayah-number">' + verse.numberInSurah + '</span></span>';
        }
        html += '</div>';
        content.innerHTML = html;
        document.getElementById('currentPageDisplay').textContent = 'الجزء ' + juzNumber + ' - ' + verses.length + ' آية';
        Utils.showToast('✅ تم تحميل الجزء ' + juzNumber, false);
    } catch (error) {
        console.error('خطأ في تحميل النص:', error);
        content.innerHTML = '<div class="error-message"><p>⚠️ فشل تحميل النص</p><p style="font-size:14px;color:#666;margin-top:10px;">يرجى التحقق من اتصالك بالإنترنت</p><button onclick="window.showJuzText(' + juzNumber + ')" class="btn-retry">🔄 إعادة المحاولة</button></div>';
        Utils.showToast('فشل تحميل النص', true);
    }
};

window.openAudioPlayer = function(juzNumber) {
    if (!juzNumber || juzNumber < 1 || juzNumber > 30) {
        Utils.showToast('رقم جزء غير صالح', true);
        return;
    }
    var modal = document.getElementById('audioPlayerModal');
    var audio = document.getElementById('quranAudio');
    var source = document.getElementById('audioSource');
    var status = document.getElementById('audioStatus');
    if (!audio || !source) {
        Utils.showToast('عناصر الصوت غير موجودة', true);
        return;
    }
    if (state.audioPlayer) {
        state.audioPlayer.pause();
        state.audioPlayer = null;
    }
    audio.pause();
    audio.src = '';
    audio.removeAttribute('src');
    audio.load();
    document.getElementById('audioJuzNumber').textContent = juzNumber;
    status.textContent = '⏳ جاري تحميل الجزء...';
    status.style.color = '#f59e0b';
    
    var audioSources = [
        'https://usamekesmo.github.io/khitmahaudio/audio/' + juzNumber + '.mp3',
        'https://cdn.islamic.network/quran/audio/128/ar.alafasy/' + juzNumber + '.mp3',
        'https://server8.mp3quran.net/afs/' + String(juzNumber).padStart(3, '0') + '.mp3'
    ];
    
    var currentSourceIndex = 0;
    
    function tryNextSource() {
        if (currentSourceIndex >= audioSources.length) {
            status.textContent = '⚠️ جميع مصادر الصوت غير متاحة';
            status.style.color = '#ef4444';
            Utils.showToast('فشل تحميل الصوت من جميع المصادر', true);
            return;
        }
        var url = audioSources[currentSourceIndex];
        console.log('🔄 محاولة تحميل الصوت من:', url);
        status.textContent = '⏳ جاري التحميل من المصدر ' + (currentSourceIndex + 1) + '/' + audioSources.length + '...';
        source.src = url;
        audio.load();
        currentSourceIndex++;
    }
    
    audio.oncanplay = function() {
        status.textContent = '✅ الجزء جاهز للتشغيل';
        status.style.color = '#22c55e';
        state.audioPlayer = audio;
        audio.play().catch(function() {
            status.textContent = '⚠️ اضغط على زر التشغيل';
            status.style.color = '#f59e0b';
        });
    };
    
    audio.onerror = function() {
        console.warn('⚠️ فشل تحميل الصوت من المصدر الحالي، تجربة المصدر التالي...');
        tryNextSource();
    };
    
    audio.onended = function() {
        status.textContent = '⏹️ انتهى التشغيل';
        status.style.color = '#6c757d';
    };
    
    tryNextSource();
    modal.style.display = 'flex';
};

window.stopAudioPlayback = function() {
    var audio = document.getElementById('quranAudio');
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }
    document.getElementById('audioStatus').textContent = '⏹️ تم الإيقاف';
    document.getElementById('audioStatus').style.color = '#6c757d';
};

// ==================== دوال التجميد وفك التجميد ====================
window.freezeMember = async function(memberId) {
    if (state.role !== ROLES.CIRCLE_ADMIN && state.role !== ROLES.SUPER_ADMIN) {
        Utils.showToast('⚠️ ليس لديك صلاحية', true);
        return;
    }
    var days = prompt('⏸️ عدد أيام التجميد (1-7):', '3');
    if (!days) return;
    var numDays = parseInt(days);
    if (isNaN(numDays) || numDays < 1 || numDays > 7) {
        Utils.showToast('⚠️ أدخل عدد أيام صحيح (1-7)', true);
        return;
    }
    try {
        var memberDoc = await db.collection('circleMembers').doc(memberId).get();
        var member = memberDoc.data();
        var freezeUntil = new Date();
        freezeUntil.setDate(freezeUntil.getDate() + numDays);
        await db.collection('circleMembers').doc(memberId).update({
            isFrozen: true,
            frozenUntil: freezeUntil,
            frozenBy: state.user.uid,
            frozenByName: state.user.displayName || 'مدير',
            frozenAt: new Date(),
            freezeReason: 'تجميد يدوي لمدة ' + numDays + ' أيام'
        });
        if (member.userId) {
            await notifications.sendToUser(member.userId, '⏸️ تم تجميد حسابك', 'تم تجميد حسابك لمدة ' + numDays + ' أيام بواسطة ' + (state.user.displayName || 'المدير'), 'freeze');
        }
        Utils.showToast('✅ تم تجميد العضو لمدة ' + numDays + ' أيام', false);
        await loadCircleManagementData();
        await loadCircleInfo();
    } catch (error) {
        console.error(error);
        Utils.showToast('حدث خطأ', true);
    }
};

window.unfreezeMember = async function(memberId) {
    if (state.role !== ROLES.CIRCLE_ADMIN && state.role !== ROLES.SUPER_ADMIN) {
        Utils.showToast('⚠️ ليس لديك صلاحية', true);
        return;
    }
    if (!confirm('⚠️ هل أنت متأكد من إلغاء تجميد هذا العضو؟')) return;
    try {
        var memberRef = db.collection('circleMembers').doc(memberId);
        var memberDoc = await memberRef.get();
        var member = memberDoc.data();
        await memberRef.update({
            isFrozen: false,
            frozenUntil: null,
            frozenBy: null,
            frozenByName: null,
            frozenAt: null,
            freezeReason: null,
            unfrozenBy: state.user.uid,
            unfrozenByName: state.user.displayName || 'مدير',
            unfrozenAt: new Date()
        });
        if (member.userId === (state.user ? state.user.uid : null)) {
            state.memberData.isFrozen = false;
            state.memberData.frozenUntil = null;
            await updateUI();
        }
        if (member.userId) {
            await notifications.sendToUser(member.userId, '▶️ تم فك تجميد حسابك', 'تم فك تجميد حسابك بواسطة ' + (state.user.displayName || 'المدير'), 'unfreeze');
        }
        Utils.showToast('✅ تم إلغاء التجميد', false);
        await loadCircleManagementData();
        await loadCircleInfo();
    } catch (error) {
        console.error('خطأ في فك التجميد:', error);
        Utils.showToast('حدث خطأ أثناء فك التجميد', true);
    }
};

// ==================== دوال الملف الشخصي ====================
window.openProfileModal = function() {
    document.getElementById('profileModal').style.display = 'flex';
    loadProfileData();
};

async function loadProfileData() {
    if (!state.user) return;
    try {
        var userDoc = await db.collection('users').doc(state.user.uid).get();
        if (userDoc.exists) {
            var data = userDoc.data();
            document.getElementById('profileDisplayName').value = data.displayName || data.name || '';
            document.getElementById('profileUsername').value = data.username || '';
            document.getElementById('profileEmail').value = data.email || '';
            document.getElementById('profileGender').value = data.gender || 'mixed';
        }
    } catch (error) {
        console.error('خطأ في تحميل بيانات الملف الشخصي:', error);
        Utils.showToast('حدث خطأ في تحميل البيانات', true);
    }
}

window.saveProfile = async function() {
    var displayName = document.getElementById('profileDisplayName').value.trim();
    var username = document.getElementById('profileUsername').value.trim().toLowerCase();
    var gender = document.getElementById('profileGender').value;
    var newPassword = document.getElementById('profileNewPassword').value;
    var confirmPassword = document.getElementById('profileConfirmPassword').value;
    if (!displayName) { Utils.showToast('⚠️ أدخل الاسم المعروض', true); return; }
    if (!username) { Utils.showToast('⚠️ أدخل اسم المستخدم', true); return; }
    if (!Utils.isValidUsername(username)) {
        Utils.showToast('⚠️ اسم المستخدم يجب أن يكون 3-20 حرف (أحرف إنجليزية أو أرقام أو _)', true);
        return;
    }
    var btn = document.getElementById('saveProfileBtn');
    var origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = '⏳ جاري الحفظ...';
    try {
        var usernameCheck = await db.collection('users')
            .where('username', '==', username)
            .get();
        if (!usernameCheck.empty) {
            var existing = usernameCheck.docs[0];
            if (existing.id !== state.user.uid) {
                Utils.showToast('⚠️ اسم المستخدم مستخدم من قبل', true);
                btn.disabled = false;
                btn.textContent = origText;
                return;
            }
        }
        await db.collection('users').doc(state.user.uid).update({
            displayName: displayName,
            username: username,
            gender: gender,
            updatedAt: new Date()
        });
        if (newPassword) {
            if (newPassword.length < 6) {
                Utils.showToast('⚠️ كلمة السر الجديدة يجب أن تكون 6 أحرف على الأقل', true);
                btn.disabled = false;
                btn.textContent = origText;
                return;
            }
            if (newPassword !== confirmPassword) {
                Utils.showToast('⚠️ كلمة السر غير متطابقة', true);
                btn.disabled = false;
                btn.textContent = origText;
                return;
            }
            if (auth.currentUser) {
                await auth.currentUser.updatePassword(newPassword);
            }
        }
        if (state.memberId) {
            await db.collection('circleMembers').doc(state.memberId).update({
                userName: displayName,
                userGender: gender,
                updatedAt: new Date()
            });
            if (state.memberData) {
                state.memberData.userName = displayName;
                state.memberData.userGender = gender;
            }
        }
        state.user.displayName = displayName;
        state.gender = gender;
        state.saveToStorage();
        await updateUI();
        document.getElementById('userName').textContent = displayName;
        Utils.showToast('✅ تم تحديث الملف الشخصي بنجاح', false);
        document.getElementById('profileModal').style.display = 'none';
        await Utils.refreshUserData();
    } catch (error) {
        console.error('خطأ في حفظ الملف الشخصي:', error);
        Utils.showToast(error.message || 'حدث خطأ في حفظ البيانات', true);
    } finally {
        btn.disabled = false;
        btn.textContent = origText;
    }
};

// ==================== دوال إدارة الحلقة ====================
window.openCircleManagement = function() {
    if (!state.circleId) {
        Utils.showToast('⚠️ أنت لست في حلقة', true);
        return;
    }
    if (state.role !== ROLES.CIRCLE_ADMIN && state.role !== ROLES.SUPER_ADMIN) {
        Utils.showToast('⚠️ ليس لديك صلاحية لإدارة هذه الحلقة', true);
        return;
    }
    document.getElementById('circleManagementModal').style.display = 'flex';
    loadCircleManagementData();
};

async function loadCircleManagementData() {
    try {
        var circleDoc = await db.collection('circles').doc(state.circleId).get();
        if (circleDoc.exists) {
            document.getElementById('circleInviteCodeDisplay').value = circleDoc.data().inviteCode || '';
        }
        var members = await db.collection('circleMembers')
            .where('circleId', '==', state.circleId)
            .where('isActive', '==', true)
            .get();
        var list = document.getElementById('circleMembersManagementList');
        list.innerHTML = '';
        var today = Utils.getTodayString();
        members.forEach(function(d) {
            var m = d.data();
            var lastRead = m.lastReadDate ? Utils.toDate(m.lastReadDate) : null;
            var hasReadToday = lastRead ? lastRead.toDateString() === today : false;
            var totalParts = (m.totalPartsRead || 0) + (m.totalExtraJuz || 0);
            var trustScore = TrustSystem.calculateScore(m);
            var status = Utils.getUserStatus(m);
            var isFrozen = m.isFrozen || false;
            var div = document.createElement('div');
            div.className = 'admin-list-item';
            div.style.borderRight = '4px solid ' + (isFrozen ? '#9ca3af' : status.color);
            div.innerHTML = '<div class="member-info"><strong>' + Utils.escapeHtml(m.userName) + '</strong>' + (m.isCircleAdmin ? ' 👑' : '') + (isFrozen ? ' ⏸️ مجمد' : '') + '<br><small>📧 ' + (m.userEmail || 'غير مسجل') + '</small><br><small>📖 ' + totalParts + ' جزء | ' + status.label + '</small><br><small>⚠️ غياب: ' + (m.absenceCount || 0) + ' يوم</small><br><small>🔒 ثقة: ' + trustScore + '%</small>' + (isFrozen ? '<br><small>⏸️ مجمد بواسطة: ' + (m.frozenByName || m.frozenBy || 'غير معروف') + '</small>' : '') + (isFrozen ? '<br><small>📅 حتى: ' + Utils.formatDate(m.frozenUntil) + '</small>' : '') + '</div><div class="member-actions">' + (!m.isCircleAdmin && !isFrozen ? '<button onclick="window.makeCircleAdmin(\'' + d.id + '\')" class="btn-small purple">👑 جعل مدير</button>' : '') + (!isFrozen ? '<button onclick="window.freezeMember(\'' + d.id + '\')" class="btn-small warning">⏸️ تجميد</button>' : '<button onclick="window.unfreezeMember(\'' + d.id + '\')" class="btn-small success">▶️ فك التجميد</button>') + '<button onclick="window.removeFromCircle(\'' + d.id + '\')" class="btn-small danger">🗑️ حذف</button></div>';
            list.appendChild(div);
        });
        if (members.size === 0) {
            list.innerHTML = '<div class="empty-plan">لا يوجد أعضاء في الحلقة</div>';
        }
        updateSpecificMemberList(members);
    } catch (error) {
        console.error('خطأ في تحميل بيانات الحلقة:', error);
        Utils.showToast('حدث خطأ أثناء تحميل البيانات', true);
    }
}

function updateSpecificMemberList(members) {
    var select = document.getElementById('specificMemberList');
    select.innerHTML = '';
    members.forEach(function(d) {
        var m = d.data();
        var option = document.createElement('option');
        option.value = d.id;
        option.textContent = m.userName + ' (' + (m.userEmail || 'غير مسجل') + ')';
        select.appendChild(option);
    });
}

window.regenerateInviteCode = async function() {
    if (state.role !== ROLES.CIRCLE_ADMIN && state.role !== ROLES.SUPER_ADMIN) {
        Utils.showToast('⚠️ ليس لديك صلاحية', true);
        return;
    }
    if (!confirm('⚠️ هل أنت متأكد من تغيير رمز الحلقة؟ سيتم إبطال الرمز القديم.')) return;
    try {
        var newCode = Utils.generateCode(6);
        await db.collection('circles').doc(state.circleId).update({
            inviteCode: newCode,
            updatedAt: new Date()
        });
        document.getElementById('circleInviteCodeDisplay').value = newCode;
        Utils.showToast('✅ تم تغيير رمز الحلقة بنجاح', false);
    } catch (error) {
        console.error(error);
        Utils.showToast('حدث خطأ أثناء تغيير الرمز', true);
    }
};

window.makeCircleAdmin = async function(memberId) {
    if (state.role !== ROLES.CIRCLE_ADMIN && state.role !== ROLES.SUPER_ADMIN) {
        Utils.showToast('⚠️ ليس لديك صلاحية', true);
        return;
    }
    if (!confirm('⚠️ هل أنت متأكد من جعل هذا العضو مديراً للحلقة؟')) return;
    try {
        var memberDoc = await db.collection('circleMembers').doc(memberId).get();
        var member = memberDoc.data();
        if (!member) { Utils.showToast('العضو غير موجود', true); return; }
        var allMembers = await db.collection('circleMembers')
            .where('circleId', '==', member.circleId)
            .where('isActive', '==', true)
            .get();
        for (var doc of allMembers.docs) {
            await doc.ref.update({ isCircleAdmin: false });
        }
        await db.collection('circleMembers').doc(memberId).update({
            isCircleAdmin: true,
            assignedBy: state.user.uid,
            assignedAt: new Date()
        });
        Utils.showToast('✅ تم تعيين ' + member.userName + ' كمدير للحلقة', false);
        await loadCircleManagementData();
        await loadCircleInfo();
    } catch (error) {
        console.error(error);
        Utils.showToast('حدث خطأ', true);
    }
};

window.removeFromCircle = async function(memberId) {
    if (state.role !== ROLES.CIRCLE_ADMIN && state.role !== ROLES.SUPER_ADMIN) {
        Utils.showToast('⚠️ ليس لديك صلاحية', true);
        return;
    }
    if (!confirm('⚠️ هل أنت متأكد من حذف هذا العضو من الحلقة؟')) return;
    try {
        var memberDoc = await db.collection('circleMembers').doc(memberId).get();
        var member = memberDoc.data();
        if (!member) { Utils.showToast('العضو غير موجود', true); return; }
        var availRef = db.collection('circleAvailableJuz').doc(state.circleId);
        await db.runTransaction(async function(t) {
            var d = await t.get(availRef);
            var data = d.data();
            if (data) {
                var newTaken = { ...data.takenJuz };
                delete newTaken[member.selectedJuz];
                var newAvail = (data.availableJuz || []).concat([member.selectedJuz]).sort(function(a, b) { return a - b; });
                t.update(availRef, { takenJuz: newTaken, availableJuz: newAvail });
            }
        });
        await db.collection('circleMembers').doc(memberId).update({
            isActive: false,
            removedBy: state.user.uid,
            removedAt: new Date()
        });
        var circleRef = db.collection('circles').doc(state.circleId);
        var circleDoc = await circleRef.get();
        await circleRef.update({ memberCount: (circleDoc.data().memberCount || 1) - 1 });
        Utils.showToast('✅ تم حذف العضو من الحلقة', false);
        await loadCircleManagementData();
        await loadCircleInfo();
    } catch (error) {
        console.error(error);
        Utils.showToast('حدث خطأ أثناء حذف العضو', true);
    }
};

// ==================== دوال المدير العام ====================
window.loadAdminData = async function() {
    if (!hasPermission(ROLES.SUPER_ADMIN)) {
        Utils.showToast('⚠️ ليس لديك صلاحية', true);
        return;
    }
    await loadAdminCircles();
    await loadAdminUsers();
    await loadSupervisorsList();
    await refreshExtraPoolStats();
    await loadSettings();
    await loadShareMessage();
    await window.loadAdminNotifications();
};

async function loadAdminCircles() {
    try {
        var circles = await db.collection('circles').get();
        var container = document.getElementById('circlesList');
        if (!container) return;
        container.innerHTML = '';
        for (var doc of circles.docs) {
            var c = doc.data();
            var membersSnap = await db.collection('circleMembers')
                .where('circleId', '==', doc.id)
                .where('isActive', '==', true)
                .get();
            var activeCount = membersSnap.size;
            var adminName = 'لا يوجد مدير';
            for (var mDoc of membersSnap.docs) {
                if (mDoc.data().isCircleAdmin) {
                    adminName = mDoc.data().userName || 'مدير';
                    break;
                }
            }
            container.innerHTML += '<div class="admin-list-item"><div><strong>🔄 ' + Utils.escapeHtml(c.circleName) + '</strong><br><small>🔑 ' + c.inviteCode + ' | 👥 ' + activeCount + '/' + settingsManager.get('maxCircleMembers') + '</small><br><small>👑 المدير: ' + Utils.escapeHtml(adminName) + '</small><br><small>📅 ' + Utils.formatDate(c.createdAt) + '</small><button onclick="window.openChangeCodeModal(\'' + doc.id + '\')" class="btn-small warning" style="margin-top:5px;">🔑 تغيير الرمز</button></div><div style="display:flex; flex-direction:column; gap:5px;"><button onclick="window.editCircle(\'' + doc.id + '\')" class="btn-small primary">✏️ تعديل</button><button onclick="window.deleteCircle(\'' + doc.id + '\')" class="btn-small danger">🗑️ حذف</button><button onclick="window.showCircleAdmins(\'' + doc.id + '\')" class="btn-small purple">👑 إدارة</button></div></div>';
        }
        if (circles.size === 0) {
            container.innerHTML = '<div class="empty-plan">لا توجد حلقات بعد</div>';
        }
    } catch (error) {
        console.error('خطأ في تحميل الحلقات:', error);
    }
}

window.editCircle = async function(id) {
    try {
        var c = (await db.collection('circles').doc(id).get()).data();
        if (!c) return;
        var newName = prompt('الاسم الجديد:', c.circleName);
        if (newName && newName.trim()) {
            await db.collection('circles').doc(id).update({ circleName: newName.trim() });
            await loadAdminCircles();
            Utils.showToast('✅ تم التعديل', false);
        }
    } catch (error) {
        console.error(error);
        Utils.showToast('حدث خطأ', true);
    }
};

window.deleteCircle = async function(id) {
    if (!confirm('⚠️ حذف الحلقة؟ سيتم حذف جميع الأعضاء والبيانات المرتبطة')) return;
    try {
        var members = await db.collection('circleMembers').where('circleId', '==', id).get();
        for (var m of members.docs) await m.ref.delete();
        await db.collection('circleAvailableJuz').doc(id).delete();
        await db.collection('circles').doc(id).delete();
        await loadAdminCircles();
        Utils.showToast('✅ تم الحذف', false);
    } catch (error) {
        console.error(error);
        Utils.showToast('حدث خطأ', true);
    }
};

async function loadAdminUsers() {
    try {
        var snap = await db.collection('circleMembers').get();
        var container = document.getElementById('usersList');
        if (!container) return;
        container.innerHTML = '';
        var count = 0;
        snap.forEach(function(d) {
            var m = d.data();
            if (m.isActive !== false) {
                count++;
                var status = Utils.getUserStatus(m);
                var isFrozen = m.isFrozen || false;
                container.innerHTML += '<div class="admin-list-item" style="border-right:4px solid ' + (isFrozen ? '#9ca3af' : status.color) + ';"><div><strong>' + Utils.escapeHtml(m.userName) + '</strong>' + (m.isCircleAdmin ? ' 👑' : '') + '<span style="font-size:12px; ' + (status.status === 'online' ? 'color:#22c55e;' : 'color:#ef4444;') + '">' + status.label + '</span>' + (isFrozen ? ' ⏸️ مجمد' : '') + '<br><small>📧 ' + (m.userEmail || '-') + '</small><br><small>📖 الجزء ' + (m.currentJuz || m.selectedJuz) + '</small><br><small>⚠️ غياب: ' + (m.absenceCount || 0) + ' يوم</small>' + (isFrozen ? '<br><small>⏸️ مجمد حتى: ' + Utils.formatDate(m.frozenUntil) + ' (بواسطة: ' + (m.frozenByName || m.frozenBy || 'غير معروف') + ')</small>' : '') + '</div><div style="display:flex; flex-direction:column; gap:4px;"><button onclick="window.editUser(\'' + d.id + '\')" class="btn-small primary">✏️</button><button onclick="window.deleteUser(\'' + d.id + '\')" class="btn-small danger">🗑️</button>' + (!isFrozen ? '<button onclick="window.adminFreezeMember(\'' + d.id + '\')" class="btn-small warning">⏸️ تجميد</button>' : '<button onclick="window.adminUnfreezeMember(\'' + d.id + '\')" class="btn-small success">▶️ فك التجميد</button>') + '</div></div>';
            }
        });
        if (count === 0) container.innerHTML = '<div class="empty-plan">لا يوجد مستخدمين</div>';
    } catch (error) {
        console.error('خطأ في تحميل المستخدمين:', error);
    }
}

window.editUser = async function(id) {
    try {
        var u = (await db.collection('circleMembers').doc(id).get()).data();
        if (!u) return;
        var newName = prompt('الاسم الجديد:', u.userName);
        if (newName && newName.trim()) {
            await db.collection('circleMembers').doc(id).update({ userName: newName.trim() });
            await loadAdminUsers();
            Utils.showToast('✅ تم التعديل', false);
        }
    } catch (error) {
        console.error(error);
        Utils.showToast('حدث خطأ', true);
    }
};

window.deleteUser = async function(id) {
    if (!confirm('⚠️ حذف المستخدم؟')) return;
    try {
        await db.collection('circleMembers').doc(id).delete();
        await loadAdminUsers();
        Utils.showToast('✅ تم الحذف', false);
    } catch (error) {
        console.error(error);
        Utils.showToast('حدث خطأ', true);
    }
};

// ==================== دوال المدير العام - التجميد ====================
window.adminFreezeMember = async function(memberId) {
    if (state.role !== ROLES.SUPER_ADMIN) {
        Utils.showToast('⚠️ ليس لديك صلاحية', true);
        return;
    }
    var days = prompt('⏸️ عدد أيام التجميد (1-7):', '3');
    if (!days) return;
    var numDays = parseInt(days);
    if (isNaN(numDays) || numDays < 1 || numDays > 7) {
        Utils.showToast('⚠️ أدخل عدد أيام صحيح (1-7)', true);
        return;
    }
    try {
        var memberDoc = await db.collection('circleMembers').doc(memberId).get();
        var member = memberDoc.data();
        var freezeUntil = new Date();
        freezeUntil.setDate(freezeUntil.getDate() + numDays);
        await db.collection('circleMembers').doc(memberId).update({
            isFrozen: true,
            frozenUntil: freezeUntil,
            frozenBy: state.user.uid,
            frozenByName: state.user.displayName || 'المدير العام',
            frozenAt: new Date(),
            freezeReason: 'تجميد يدوي لمدة ' + numDays + ' أيام بواسطة المدير العام'
        });
        if (member.userId) {
            await notifications.sendToUser(member.userId, '⏸️ تم تجميد حسابك', 'تم تجميد حسابك لمدة ' + numDays + ' أيام بواسطة المدير العام', 'freeze');
        }
        Utils.showToast('✅ تم تجميد العضو لمدة ' + numDays + ' أيام', false);
        await loadAdminUsers();
        await loadAdminCircles();
    } catch (error) {
        console.error(error);
        Utils.showToast('حدث خطأ', true);
    }
};

window.adminUnfreezeMember = async function(memberId) {
    if (state.role !== ROLES.SUPER_ADMIN) {
        Utils.showToast('⚠️ ليس لديك صلاحية', true);
        return;
    }
    if (!confirm('⚠️ هل أنت متأكد من إلغاء تجميد هذا العضو؟')) return;
    try {
        var memberRef = db.collection('circleMembers').doc(memberId);
        var memberDoc = await memberRef.get();
        var member = memberDoc.data();
        await memberRef.update({
            isFrozen: false,
            frozenUntil: null,
            frozenBy: null,
            frozenByName: null,
            frozenAt: null,
            freezeReason: null,
            unfrozenBy: state.user.uid,
            unfrozenByName: state.user.displayName || 'المدير العام',
            unfrozenAt: new Date()
        });
        if (member.userId === (state.user ? state.user.uid : null)) {
            state.memberData.isFrozen = false;
            state.memberData.frozenUntil = null;
            await updateUI();
        }
        if (member.userId) {
            await notifications.sendToUser(member.userId, '▶️ تم فك تجميد حسابك', 'تم فك تجميد حسابك بواسطة المدير العام', 'unfreeze');
        }
        Utils.showToast('✅ تم إلغاء التجميد', false);
        await loadAdminUsers();
        await loadAdminCircles();
    } catch (error) {
        console.error('خطأ في فك التجميد:', error);
        Utils.showToast('حدث خطأ أثناء فك التجميد', true);
    }
};

// ==================== دوال المدير العام - إدارة المدراء ====================
window.showCircleAdmins = async function(circleId) {
    try {
        var circleDoc = await db.collection('circles').doc(circleId).get();
        if (!circleDoc.exists) { Utils.showToast('⚠️ الحلقة غير موجودة', true); return; }
        var circle = circleDoc.data();
        var members = await db.collection('circleMembers')
            .where('circleId', '==', circleId)
            .where('isActive', '==', true)
            .get();
        var currentAdmin = null;
        var memberList = [];
        for (var doc of members.docs) {
            var m = doc.data();
            if (m.isCircleAdmin) currentAdmin = { id: doc.id, ...m };
            memberList.push({ id: doc.id, ...m });
        }
        document.getElementById('adminCircleModalTitle').textContent = '👑 إدارة مدير حلقة: ' + circle.circleName;
        document.getElementById('adminCircleCurrentAdmin').textContent = currentAdmin ? '👑 ' + currentAdmin.userName : 'لا يوجد مدير';
        document.getElementById('adminCircleCurrentAdmin').style.background = currentAdmin ? '#dcfce7' : '#f1f5f9';
        var select = document.getElementById('adminCircleMemberSelect');
        select.innerHTML = '<option value="">-- اختر عضواً --</option>';
        memberList.filter(function(m) { return !m.isCircleAdmin && !m.isFrozen; }).forEach(function(m) {
            var opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.userName;
            select.appendChild(opt);
        });
        document.getElementById('adminCircleModal').style.display = 'flex';
        window._adminCircleId = circleId;
    } catch (error) {
        console.error('خطأ في عرض إدارة المدير:', error);
        Utils.showToast('حدث خطأ', true);
    }
};

window.assignAdminFromAdminPanel = async function() {
    var select = document.getElementById('adminCircleMemberSelect');
    var memberId = select.value;
    var circleId = window._adminCircleId;
    if (!memberId) { Utils.showToast('⚠️ اختر عضواً أولاً', true); return; }
    if (!confirm('⚠️ هل أنت متأكد من تعيين هذا العضو كمدير للحلقة؟')) return;
    try {
        var allMembers = await db.collection('circleMembers')
            .where('circleId', '==', circleId)
            .where('isActive', '==', true)
            .get();
        for (var doc of allMembers.docs) {
            await doc.ref.update({ isCircleAdmin: false });
        }
        var memberDoc = await db.collection('circleMembers').doc(memberId).get();
        var member = memberDoc.data();
        await db.collection('circleMembers').doc(memberId).update({
            isCircleAdmin: true,
            assignedBy: state.user.uid,
            assignedAt: new Date()
        });
        Utils.showToast('✅ تم تعيين ' + member.userName + ' كمدير للحلقة', false);
        document.getElementById('adminCircleModal').style.display = 'none';
        await loadAdminCircles();
    } catch (error) {
        console.error('خطأ في تعيين المدير:', error);
        Utils.showToast('حدث خطأ', true);
    }
};

window.removeAdminFromAdminPanel = async function() {
    var circleId = window._adminCircleId;
    if (!circleId) { Utils.showToast('⚠️ لم يتم تحديد حلقة', true); return; }
    try {
        var members = await db.collection('circleMembers')
            .where('circleId', '==', circleId)
            .where('isActive', '==', true)
            .get();
        var adminId = null, adminName = '';
        for (var doc of members.docs) {
            if (doc.data().isCircleAdmin) {
                adminId = doc.id;
                adminName = doc.data().userName;
                break;
            }
        }
        if (!adminId) { Utils.showToast('⚠️ لا يوجد مدير للحلقة', true); return; }
        if (!confirm('⚠️ هل أنت متأكد من إزالة صلاحيات المدير من ' + adminName + '؟')) return;
        await db.collection('circleMembers').doc(adminId).update({
            isCircleAdmin: false,
            removedBy: state.user.uid,
            removedAt: new Date()
        });
        Utils.showToast('✅ تم إزالة صلاحيات المدير من ' + adminName, false);
        document.getElementById('adminCircleModal').style.display = 'none';
        await loadAdminCircles();
    } catch (error) {
        console.error('خطأ في إزالة المدير:', error);
        Utils.showToast('حدث خطأ', true);
    }
};

// ==================== دوال تغيير رمز الحلقة ====================
window.openChangeCodeModal = function(circleId) {
    if (state.role !== ROLES.SUPER_ADMIN) {
        Utils.showToast('⚠️ ليس لديك صلاحية', true);
        return;
    }
    document.getElementById('changeCircleCodeModal').style.display = 'flex';
    document.getElementById('newCircleCode').value = '';
    window._changeCircleId = circleId;
};

window.generateCircleCode = function() {
    var code = Utils.generateCode(6);
    document.getElementById('newCircleCode').value = code;
    Utils.showToast('🔄 تم توليد رمز جديد', false);
};

window.saveCircleCode = async function() {
    var circleId = window._changeCircleId;
    if (!circleId) { Utils.showToast('⚠️ لم يتم تحديد حلقة', true); return; }
    var code = document.getElementById('newCircleCode').value.trim().toUpperCase();
    if (!code) { Utils.showToast('⚠️ أدخل رمزاً أو استخدم التوليد التلقائي', true); return; }
    if (code.length !== 6) { Utils.showToast('⚠️ الرمز يجب أن يكون 6 أحرف', true); return; }
    if (!confirm('⚠️ هل أنت متأكد من تغيير رمز الحلقة إلى: ' + code + '؟')) return;
    try {
        var check = await db.collection('circles')
            .where('inviteCode', '==', code)
            .get();
        if (!check.empty) {
            var existing = check.docs[0];
            if (existing.id !== circleId) {
                Utils.showToast('⚠️ هذا الرمز مستخدم من قبل حلقة أخرى', true);
                return;
            }
        }
        await db.collection('circles').doc(circleId).update({
            inviteCode: code,
            updatedAt: new Date()
        });
        Utils.showToast('✅ تم تغيير رمز الحلقة بنجاح', false);
        document.getElementById('changeCircleCodeModal').style.display = 'none';
        await loadAdminCircles();
    } catch (error) {
        console.error('خطأ في تغيير رمز الحلقة:', error);
        Utils.showToast('حدث خطأ', true);
    }
};

// ==================== دوال المشرفين ====================

window.filterSupervisorMembers = function() {
    var circleFilter = document.getElementById('supervisorCircleFilter') ? document.getElementById('supervisorCircleFilter').value : 'all';
    var statusFilter = document.getElementById('supervisorStatusFilter') ? document.getElementById('supervisorStatusFilter').value : 'all';
    var search = document.getElementById('supervisorSearchInput') ? document.getElementById('supervisorSearchInput').value.toLowerCase() : '';
    var members = window._supervisorMembers || [];
    var filtered = members.filter(function(m) {
        if (circleFilter !== 'all' && m.circleId !== circleFilter) return false;
        var status = Utils.getUserStatus(m);
        if (statusFilter !== 'all' && status.status !== statusFilter) return false;
        if (search && !m.userName.toLowerCase().includes(search) && !m.circleName.toLowerCase().includes(search)) return false;
        return true;
    });
    filtered.sort(function(a, b) {
        var statusA = Utils.getUserStatus(a);
        var statusB = Utils.getUserStatus(b);
        var order = { online: 0, away: 1, offline: 2, frozen: 3 };
        if (order[statusA.status] !== order[statusB.status]) {
            return order[statusA.status] - order[statusB.status];
        }
        return a.circleName.localeCompare(b.circleName || '') || 0;
    });
    var tbody = document.getElementById('supervisorMembersBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    filtered.forEach(function(m, i) {
        var status = Utils.getUserStatus(m);
        var lastRead = m.lastReadDate ? Utils.toDate(m.lastReadDate) : null;
        var totalParts = (m.totalPartsRead || 0) + (m.totalExtraJuz || 0);
        var trustScore = TrustSystem.calculateScore(m);
        var isFrozen = m.isFrozen || false;
        var tr = document.createElement('tr');
        tr.style.background = status.status === 'online' ? '#dcfce7' : (status.status === 'away' ? '#fef3c7' : (status.status === 'frozen' ? '#f1f5f9' : '#fee2e2'));
        
        tr.innerHTML = '<td>' + (i + 1) + '</td>' +
                       '<td><strong>' + Utils.escapeHtml(m.circleName) + '</strong></td>' +
                       '<td>' + Utils.escapeHtml(m.userName) + (m.isCircleAdmin ? ' 👑' : '') + '</td>' +
                       '<td>' + (m.selectedJuz || '-') + '</td>' +
                       '<td>' + (lastRead ? Utils.formatDate(lastRead) : 'لم يقرأ') + '</td>' +
                       '<td><span style="color:' + status.color + ';font-weight:bold;">' + status.label + '</span></td>' +
                       '<td>' + trustScore + '%</td>' +
                       '<td style="display:flex; flex-wrap:wrap; gap:2px; justify-content:center;">' + 
                           (!isFrozen ? '<button onclick="window.supervisorFreezeMember(\'' + m.id + '\')" class="btn-small warning" title="تجميد">⏸️</button>' : 
                                         '<button onclick="window.supervisorUnfreezeMember(\'' + m.id + '\')" class="btn-small success" title="فك التجميد">▶️</button>') + 
                           '<button onclick="window.supervisorViewMember(\'' + m.id + '\')" class="btn-small primary" title="عرض">👁️</button>' + 
                           (!m.isCircleAdmin && !isFrozen ? '<button onclick="window.supervisorAssignAdmin(\'' + m.id + '\')" class="btn-small purple" title="تعيين مدير">👑</button>' : '') + 
                           (m.isCircleAdmin ? '<button onclick="window.supervisorRemoveAdmin(\'' + m.id + '\')" class="btn-small danger" title="إزالة المدير">🗑️👑</button>' : '') + 
                       '</td>';
        tbody.appendChild(tr);
    });
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;">لا يوجد أعضاء مطابقين للفلترة</td></tr>';
    }
};

window.supervisorFreezeMember = async function(memberId) {
    if (state.role !== ROLES.CIRCLE_SUPERVISOR) {
        Utils.showToast('⚠️ ليس لديك صلاحية', true);
        return;
    }
    var days = prompt('⏸️ عدد أيام التجميد (1-7):', '3');
    if (!days) return;
    var numDays = parseInt(days);
    if (isNaN(numDays) || numDays < 1 || numDays > 7) {
        Utils.showToast('⚠️ أدخل عدد أيام صحيح (1-7)', true);
        return;
    }
    try {
        var memberDoc = await db.collection('circleMembers').doc(memberId).get();
        var member = memberDoc.data();
        if (!state.supervisedCircles.includes(member.circleId)) {
            Utils.showToast('⚠️ هذه الحلقة ليست ضمن إشرافك', true);
            return;
        }
        var freezeUntil = new Date();
        freezeUntil.setDate(freezeUntil.getDate() + numDays);
        await db.collection('circleMembers').doc(memberId).update({
            isFrozen: true,
            frozenUntil: freezeUntil,
            frozenBy: state.user.uid,
            frozenByName: state.user.displayName || 'مشرف',
            frozenAt: new Date(),
            freezeReason: 'تجميد يدوي لمدة ' + numDays + ' أيام بواسطة المشرف'
        });
        if (member.userId) {
            await notifications.sendToUser(member.userId, '⏸️ تم تجميد حسابك', 'تم تجميد حسابك لمدة ' + numDays + ' أيام بواسطة المشرف', 'freeze');
        }
        Utils.showToast('✅ تم تجميد العضو لمدة ' + numDays + ' أيام', false);
        await loadSupervisorDashboard();
    } catch (error) {
        console.error(error);
        Utils.showToast('حدث خطأ', true);
    }
};

window.supervisorUnfreezeMember = async function(memberId) {
    if (state.role !== ROLES.CIRCLE_SUPERVISOR) {
        Utils.showToast('⚠️ ليس لديك صلاحية', true);
        return;
    }
    if (!confirm('⚠️ هل أنت متأكد من إلغاء تجميد هذا العضو؟')) return;
    try {
        var memberRef = db.collection('circleMembers').doc(memberId);
        var memberDoc = await memberRef.get();
        var member = memberDoc.data();
        if (!state.supervisedCircles.includes(member.circleId)) {
            Utils.showToast('⚠️ هذه الحلقة ليست ضمن إشرافك', true);
            return;
        }
        await memberRef.update({
            isFrozen: false,
            frozenUntil: null,
            frozenBy: null,
            frozenByName: null,
            frozenAt: null,
            freezeReason: null,
            unfrozenBy: state.user.uid,
            unfrozenByName: state.user.displayName || 'مشرف',
            unfrozenAt: new Date()
        });
        if (member.userId === (state.user ? state.user.uid : null)) {
            state.memberData.isFrozen = false;
            state.memberData.frozenUntil = null;
            await updateUI();
        }
        if (member.userId) {
            await notifications.sendToUser(member.userId, '▶️ تم فك تجميد حسابك', 'تم فك تجميد حسابك بواسطة المشرف', 'unfreeze');
        }
        Utils.showToast('✅ تم إلغاء التجميد', false);
        await loadSupervisorDashboard();
    } catch (error) {
        console.error('خطأ في فك التجميد:', error);
        Utils.showToast('حدث خطأ أثناء فك التجميد', true);
    }
};
window.loadSupervisorDashboard = async function() {
    if (state.role !== ROLES.CIRCLE_SUPERVISOR) {
        Utils.showToast('⚠️ ليس لديك صلاحية', true);
        return;
    }
    var container = document.getElementById('supervisorDashboardContent');
    if (!container) return;
    container.innerHTML = '<div class="loading">⏳ جاري تحميل البيانات...</div>';
    try {
        var circles = [];
        for (var circleId of state.supervisedCircles) {
            var doc = await db.collection('circles').doc(circleId).get();
            if (doc.exists) {
                circles.push({ id: circleId, ...doc.data() });
            }
        }
        if (circles.length === 0) {
            container.innerHTML = '<div class="empty-plan">⚠️ لم يتم تعيينك على أي حلقة بعد</div>';
            return;
        }
        var allMembers = [];
        for (var circle of circles) {
            var members = await db.collection('circleMembers')
                .where('circleId', '==', circle.id)
                .where('isActive', '==', true)
                .get();
            members.forEach(function(doc) {
                var m = doc.data();
                allMembers.push({ id: doc.id, ...m, circleName: circle.circleName, circleId: circle.id });
            });
        }
        var today = Utils.getTodayString();
        var onlineCount = allMembers.filter(function(m) {
            var lastRead = m.lastReadDate ? Utils.toDate(m.lastReadDate) : null;
            return lastRead ? lastRead.toDateString() === today && !m.isFrozen : false;
        }).length;
        var html = '<div class="supervisor-stats-grid"><div class="stat-card"><span>🔄 الحلقات</span><strong>' + circles.length + '</strong></div><div class="stat-card"><span>👥 الأعضاء</span><strong>' + allMembers.length + '</strong></div><div class="stat-card"><span>🟢 متصلون اليوم</span><strong style="color:#22c55e;">' + onlineCount + '</strong></div><div class="stat-card"><span>🔴 غير متصل</span><strong style="color:#ef4444;">' + (allMembers.length - onlineCount) + '</strong></div></div><div class="supervisor-filters"><select id="supervisorCircleFilter" onchange="window.filterSupervisorMembers()"><option value="all">جميع الحلقات</option>' + circles.map(function(c) { return '<option value="' + c.id + '">' + Utils.escapeHtml(c.circleName) + '</option>'; }).join('') + '</select><select id="supervisorStatusFilter" onchange="window.filterSupervisorMembers()"><option value="all">الكل</option><option value="online">🟢 متصلون</option><option value="away">🟠 غائبون</option><option value="offline">🔴 غائبون</option><option value="frozen">⏸️ مجمدون</option></select><input type="text" id="supervisorSearchInput" placeholder="🔍 بحث..." oninput="window.filterSupervisorMembers()"></div><div class="supervisor-actions"><button onclick="window.exportSupervisorReport()" class="btn-admin-action">📊 تقرير شامل</button><button onclick="window.exportSupervisorExcel()" class="btn-admin-action" style="background:#0ea5e9;">📊 Excel</button><button onclick="window.exportSupervisorPDF()" class="btn-admin-action" style="background:#dc2626;">📄 PDF</button></div><div class="supervisor-members-table"><h4>📋 قائمة جميع الأعضاء</h4><div style="overflow-x:auto;"><table id="supervisorMembersTable"><thead><tr><th>#</th><th>الحلقة</th><th>الاسم</th><th>📊 الأجزاء</th><th>📅 آخر قراءة</th><th>الحالة</th><th>🔒 الثقة</th><th>إجراءات</th></tr></thead><tbody id="supervisorMembersBody"></tbody></table></div></div>';
        container.innerHTML = html;
        window._supervisorMembers = allMembers;
        window._supervisorCircles = circles;
        window.filterSupervisorMembers();
        await loadSupervisorCirclesForNotification();
    } catch (error) {
        console.error('خطأ في تحميل لوحة المشرف:', error);
        container.innerHTML = '<div class="error">حدث خطأ في تحميل البيانات</div>';
    }
};
window.supervisorViewMember = async function(memberId) {
    try {
        var doc = await db.collection('circleMembers').doc(memberId).get();
        if (!doc.exists) { Utils.showToast('العضو غير موجود', true); return; }
        var m = doc.data();
        var status = Utils.getUserStatus(m);
        var totalParts = (m.totalPartsRead || 0) + (m.totalExtraJuz || 0);
        var trustScore = TrustSystem.calculateScore(m);
        var frozenInfo = m.isFrozen ? '⏸️ مجمد بواسطة: ' + (m.frozenByName || m.frozenBy || 'غير معروف') + '\n📅 حتى: ' + Utils.formatDate(m.frozenUntil) + '\n📝 السبب: ' + (m.freezeReason || 'غير محدد') + '\n' : '';
        alert('📋 معلومات العضو\n\nالاسم: ' + m.userName + '\nالبريد: ' + (m.userEmail || 'غير مسجل') + '\nالحلقة: ' + (m.circleName || 'غير معروف') + '\nالجزء الحالي: ' + (m.currentJuz || m.selectedJuz || '-') + '\nالحالة: ' + status.label + '\nآخر قراءة: ' + (m.lastReadDate ? Utils.formatDate(m.lastReadDate) : 'لم يقرأ بعد') + '\nإجمالي الأجزاء: ' + totalParts + '\nعدد الختمات: ' + Utils.calculateKhatmas(m.totalPartsRead || 0) + '\nأيام الغياب: ' + (m.absenceCount || 0) + '\nنسبة الثقة: ' + trustScore + '%\nمدير الحلقة: ' + (m.isCircleAdmin ? 'نعم' : 'لا') + '\nمجمد: ' + (m.isFrozen ? 'نعم' : 'لا') + '\n' + frozenInfo);
    } catch (error) {
        console.error(error);
        Utils.showToast('حدث خطأ', true);
    }
};

window.supervisorAssignAdmin = async function(memberId) {
    if (state.role !== ROLES.CIRCLE_SUPERVISOR) {
        Utils.showToast('⚠️ ليس لديك صلاحية', true);
        return;
    }
    try {
        var memberDoc = await db.collection('circleMembers').doc(memberId).get();
        if (!memberDoc.exists) { Utils.showToast('⚠️ العضو غير موجود', true); return; }
        var member = memberDoc.data();
        if (!state.supervisedCircles.includes(member.circleId)) {
            Utils.showToast('⚠️ هذه الحلقة ليست ضمن إشرافك', true);
            return;
        }
        if (member.isCircleAdmin) { Utils.showToast('⚠️ هذا العضو مدير بالفعل', true); return; }
        if (member.isFrozen) { Utils.showToast('⚠️ لا يمكن تعيين عضو مجمد كمدير', true); return; }
        if (!confirm('⚠️ هل أنت متأكد من تعيين ' + member.userName + ' كمدير للحلقة؟')) return;
        var allMembers = await db.collection('circleMembers')
            .where('circleId', '==', member.circleId)
            .where('isActive', '==', true)
            .get();
        for (var doc of allMembers.docs) {
            await doc.ref.update({ isCircleAdmin: false });
        }
        await db.collection('circleMembers').doc(memberId).update({
            isCircleAdmin: true,
            assignedBy: state.user.uid,
            assignedAt: new Date()
        });
        Utils.showToast('✅ تم تعيين ' + member.userName + ' كمدير للحلقة', false);
        await notifications.sendToUser(member.userId, '👑 تعيين كمدير حلقة', 'تم تعيينك كمدير لحلقة ' + member.circleName + ' بواسطة المشرف', 'supervisor');
        await loadSupervisorDashboard();
    } catch (error) {
        console.error('خطأ في تعيين المدير:', error);
        Utils.showToast('حدث خطأ في تعيين المدير', true);
    }
};

window.supervisorRemoveAdmin = async function(memberId) {
    if (state.role !== ROLES.CIRCLE_SUPERVISOR) {
        Utils.showToast('⚠️ ليس لديك صلاحية', true);
        return;
    }
    try {
        var memberDoc = await db.collection('circleMembers').doc(memberId).get();
        if (!memberDoc.exists) { Utils.showToast('⚠️ العضو غير موجود', true); return; }
        var member = memberDoc.data();
        if (!state.supervisedCircles.includes(member.circleId)) {
            Utils.showToast('⚠️ هذه الحلقة ليست ضمن إشرافك', true);
            return;
        }
        if (!member.isCircleAdmin) { Utils.showToast('⚠️ هذا العضو ليس مديراً', true); return; }
        if (!confirm('⚠️ هل أنت متأكد من إزالة صلاحيات المدير من ' + member.userName + '؟')) return;
        await db.collection('circleMembers').doc(memberId).update({
            isCircleAdmin: false,
            removedBy: state.user.uid,
            removedAt: new Date()
        });
        Utils.showToast('✅ تم إزالة صلاحيات المدير من ' + member.userName, false);
        await notifications.sendToUser(member.userId, '🗑️ إزالة صلاحيات المدير', 'تم إزالة صلاحياتك كمدير لحلقة ' + member.circleName + ' بواسطة المشرف', 'supervisor');
        await loadSupervisorDashboard();
    } catch (error) {
        console.error('خطأ في إزالة المدير:', error);
        Utils.showToast('حدث خطأ في إزالة المدير', true);
    }
};

// ==================== دوال تقارير المشرف ====================
window.exportSupervisorReport = async function() {
    var members = window._supervisorMembers || [];
    if (members.length === 0) { Utils.showToast('لا توجد بيانات', true); return; }
    var circles = window._supervisorCircles || [];
    var today = Utils.getTodayString();
    var onlineCount = members.filter(function(m) {
        var lastRead = m.lastReadDate ? Utils.toDate(m.lastReadDate) : null;
        return lastRead ? lastRead.toDateString() === today && !m.isFrozen : false;
    }).length;
    var report = '📊 تقرير المشرف - جميع الحلقات\n';
    report += '📅 ' + Utils.formatDate(new Date()) + '\n\n';
    report += '🔄 عدد الحلقات: ' + circles.length + '\n';
    report += '👥 عدد الأعضاء: ' + members.length + '\n';
    report += '🟢 المتصلون اليوم: ' + onlineCount + '\n';
    report += '🔴 غير المتصل: ' + (members.length - onlineCount) + '\n\n';
    report += '─'.repeat(50) + '\n\n';
    for (var circle of circles) {
        var circleMembers = members.filter(function(m) { return m.circleId === circle.id; });
        var circleOnline = circleMembers.filter(function(m) {
            var lastRead = m.lastReadDate ? Utils.toDate(m.lastReadDate) : null;
            return lastRead ? lastRead.toDateString() === today && !m.isFrozen : false;
        }).length;
        report += '🔄 ' + circle.circleName + '\n';
        report += '   👥 ' + circleMembers.length + ' عضو\n';
        report += '   🟢 ' + circleOnline + ' متصل\n';
        report += '   🔴 ' + (circleMembers.length - circleOnline) + ' غير متصل\n';
        var admin = circleMembers.find(function(m) { return m.isCircleAdmin; });
        report += '   👑 المدير: ' + (admin ? admin.userName : 'لا يوجد') + '\n\n';
    }
    report += '─'.repeat(50) + '\n\n';
    report += '📋 قائمة جميع الأعضاء:\n\n';
    members.forEach(function(m, i) {
        var status = Utils.getUserStatus(m);
        var lastRead = m.lastReadDate ? Utils.toDate(m.lastReadDate) : null;
        report += (i + 1) + '. ' + m.userName + (m.isCircleAdmin ? ' 👑' : '') + ' | ' + m.circleName + ' | الجزء ' + (m.currentJuz || m.selectedJuz) + ' | ' + status.label + ' | ' + (lastRead ? Utils.formatDate(lastRead) : 'لم يقرأ') + '\n';
    });
    if (confirm('📋 هل تريد نسخ التقرير أم حفظه كملف؟\n(OK = نسخ، Cancel = حفظ كملف)')) {
        navigator.clipboard.writeText(report).then(function() { Utils.showToast('✅ تم نسخ التقرير', false); });
    } else {
        var blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'تقرير_المشرف_' + new Date().toLocaleDateString('ar') + '.txt';
        link.click();
        URL.revokeObjectURL(link.href);
        Utils.showToast('✅ تم حفظ التقرير', false);
    }
};

window.exportSupervisorExcel = async function() {
    var members = window._supervisorMembers || [];
    if (members.length === 0) { Utils.showToast('لا توجد بيانات', true); return; }
    try {
        var data = members.map(function(m) {
            var status = Utils.getUserStatus(m);
            var totalParts = (m.totalPartsRead || 0) + (m.totalExtraJuz || 0);
            var trustScore = TrustSystem.calculateScore(m);
            var lastRead = m.lastReadDate ? Utils.toDate(m.lastReadDate) : null;
            return {
                'الحلقة': m.circleName || 'غير معروف',
                'الاسم': m.userName || 'مستخدم',
                'مدير': m.isCircleAdmin ? 'نعم' : 'لا',
                'الجزء المختار': m.selectedJuz || '-',
                'إجمالي الأجزاء المقروءة': totalParts,
                'آخر قراءة': lastRead ? Utils.formatDate(lastRead) : 'لم يقرأ',
                'الحالة': status.label,
                'الختمات': Utils.calculateKhatmas(m.totalPartsRead || 0),
                'أيام الغياب': m.absenceCount || 0,
                'نسبة الثقة': trustScore + '%',
                'مجمد': m.isFrozen ? 'نعم' : 'لا'
            };
        });
        var ws = XLSX.utils.json_to_sheet(data);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'جميع الأعضاء');
        XLSX.writeFile(wb, 'تقرير_المشرف_' + new Date().toLocaleDateString('ar') + '.xlsx');
        Utils.showToast('✅ تم تصدير التقرير Excel', false);
    } catch (error) {
        console.error(error);
        Utils.showToast('حدث خطأ في التصدير', true);
    }
};

window.exportSupervisorPDF = async function() {
    var members = window._supervisorMembers || [];
    if (members.length === 0) { Utils.showToast('لا توجد بيانات', true); return; }
    try {
        var doc = new window.jspdf.jsPDF('p', 'mm', 'a4');
        doc.setFontSize(18);
        doc.text('📊 تقرير المشرف - جميع الحلقات', 105, 25, { align: 'center' });
        doc.setFontSize(12);
        doc.text('📅 ' + Utils.formatDate(new Date()), 105, 35, { align: 'center' });
        var circles = window._supervisorCircles || [];
        var today = Utils.getTodayString();
        var onlineCount = members.filter(function(m) {
            var lastRead = m.lastReadDate ? Utils.toDate(m.lastReadDate) : null;
            return lastRead ? lastRead.toDateString() === today && !m.isFrozen : false;
        }).length;
        doc.setFontSize(14);
        doc.text('📈 الإحصائيات العامة:', 20, 50);
        doc.setFontSize(12);
        doc.text('🔄 عدد الحلقات: ' + circles.length, 25, 58);
        doc.text('👥 عدد الأعضاء: ' + members.length, 25, 65);
        doc.text('🟢 المتصلون اليوم: ' + onlineCount, 25, 72);
        doc.text('🔴 غير المتصل: ' + (members.length - onlineCount), 25, 79);
        var tableData = members.map(function(m) {
            var status = Utils.getUserStatus(m);
            var lastRead = m.lastReadDate ? Utils.toDate(m.lastReadDate) : null;
            return [
                m.circleName || '-',
                m.userName || '-',
                m.isCircleAdmin ? '👑' : '-',
                m.currentJuz || m.selectedJuz || '-',
                lastRead ? Utils.formatDate(lastRead) : 'لم يقرأ',
                status.label,
                (m.totalPartsRead || 0) + (m.totalExtraJuz || 0),
                m.absenceCount || 0
            ];
        });
        doc.autoTable({
            startY: 90,
            head: [['الحلقة', 'الاسم', 'مدير', 'الجزء', 'آخر قراءة', 'الحالة', 'الأجزاء', 'الغياب']],
            body: tableData,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 3, halign: 'right' },
            headStyles: { fillColor: [26, 71, 57], textColor: [255, 255, 255], halign: 'right' }
        });
        doc.save('تقرير_المشرف_' + new Date().toLocaleDateString('ar') + '.pdf');
        Utils.showToast('✅ تم تصدير التقرير PDF', false);
    } catch (error) {
        console.error(error);
        Utils.showToast('حدث خطأ في تصدير PDF', true);
    }
};

// ==================== دوال المشرفين - تعيين وإزالة ====================
window.showAssignSupervisorModal = async function() {
    var modal = document.getElementById('assignSupervisorModal');
    var userSelect = document.getElementById('supervisorUserSelect');
    var circlesDiv = document.getElementById('supervisorCirclesCheckboxes');
    try {
        var usersSnap = await db.collection('users')
            .where('role', '!=', 'supervisor')
            .get();
        userSelect.innerHTML = '';
        usersSnap.forEach(function(doc) {
            var data = doc.data();
            if (data.email !== adminManager.email) {
                var option = document.createElement('option');
                option.value = doc.id;
                option.textContent = (data.displayName || data.name) + ' (' + data.email + ')';
                userSelect.appendChild(option);
            }
        });
        var circlesSnap = await db.collection('circles').get();
        circlesDiv.innerHTML = '';
        circlesSnap.forEach(function(doc) {
            var data = doc.data();
            var label = document.createElement('label');
            label.style.display = 'block';
            label.style.padding = '5px 0';
            label.innerHTML = '<input type="checkbox" value="' + doc.id + '"> ' + data.circleName + ' (👥 ' + (data.memberCount || 0) + ')';
            circlesDiv.appendChild(label);
        });
        modal.style.display = 'flex';
    } catch (error) {
        console.error(error);
        Utils.showToast('حدث خطأ', true);
    }
};

window.confirmAssignSupervisor = async function() {
    var userId = document.getElementById('supervisorUserSelect').value;
    var checkedBoxes = document.querySelectorAll('#supervisorCirclesCheckboxes input:checked');
    var circleIds = Array.from(checkedBoxes).map(function(cb) { return cb.value; });
    if (!userId) { Utils.showToast('⚠️ اختر مستخدم أولاً', true); return; }
    if (circleIds.length === 0) { Utils.showToast('⚠️ اختر حلقة واحدة على الأقل', true); return; }
    if (!confirm('⚠️ هل أنت متأكد من تعيين هذا المستخدم مشرفاً على ' + circleIds.length + ' حلقة؟')) return;
    try {
        await db.collection('users').doc(userId).update({
            role: 'supervisor',
            supervisedCircles: circleIds,
            updatedAt: new Date()
        });
        Utils.showToast('✅ تم تعيين مشرف', false);
        document.getElementById('assignSupervisorModal').style.display = 'none';
        await loadSupervisorsList();
    } catch (error) {
        console.error(error);
        Utils.showToast('حدث خطأ في التعيين', true);
    }
};

async function loadSupervisorsList() {
    try {
        var snap = await db.collection('users').where('role', '==', 'supervisor').get();
        var container = document.getElementById('supervisorsList');
        if (!container) return;
        container.innerHTML = '<h4>👑 مشرفو الحلقات</h4>';
        if (snap.empty) {
            container.innerHTML += '<div class="empty-plan">لا يوجد مشرفون</div>';
            return;
        }
        snap.forEach(function(doc) {
            var sup = doc.data();
            container.innerHTML += '<div class="admin-list-item"><div><strong>' + Utils.escapeHtml(sup.displayName || sup.name || sup.username) + '</strong><br><small>📧 ' + (sup.email || '-') + '</small><br><small>🔄 ' + (sup.supervisedCircles ? sup.supervisedCircles.length : 0) + ' حلقة</small></div><div><button onclick="window.removeSupervisor(\'' + doc.id + '\')" class="btn-small danger">🗑️ إلغاء</button></div></div>';
        });
    } catch (error) {
        console.error('خطأ في تحميل المشرفين:', error);
    }
}

window.removeSupervisor = async function(userId) {
    if (!confirm('⚠️ هل أنت متأكد من إلغاء صلاحيات المشرف؟')) return;
    try {
        await db.collection('users').doc(userId).update({
            role: 'member',
            supervisedCircles: []
        });
        Utils.showToast('✅ تم إلغاء صلاحيات المشرف', false);
        await loadSupervisorsList();
    } catch (error) {
        console.error(error);
        Utils.showToast('حدث خطأ', true);
    }
};

// ==================== دوال الإعدادات ====================
async function loadSettings() {
    await settingsManager.load();
    var s = settingsManager.settings;
    document.getElementById('currentMaxCircleMembers').textContent = s.maxCircleMembers || 30;
    document.getElementById('currentMaxExtraPerDay').textContent = s.maxExtraPerDay || 1;
    document.getElementById('currentMaxAbsenceDays').textContent = s.maxAbsenceDays || 3;
    document.getElementById('maxCircleMembers').value = s.maxCircleMembers || 30;
    document.getElementById('maxExtraPerDay').value = s.maxExtraPerDay || 1;
    document.getElementById('maxAbsenceDays').value = s.maxAbsenceDays || 3;
    var reminderHour = localStorage.getItem('reminderHour') || s.reminderHour || '20';
    document.getElementById('reminderHour').value = reminderHour;
    document.getElementById('currentReminderHour').textContent = reminderHour.toString().padStart(2, '0') + ':00';
}

window.updateSetting = async function(key) {
    var input = document.getElementById(key);
    var value = parseInt(input.value);
    if (isNaN(value) || value < 1) { Utils.showToast('⚠️ أدخل قيمة صحيحة', true); return; }
    try {
        var success = await settingsManager.update(key, value);
        if (success) {
            document.getElementById('current' + key.charAt(0).toUpperCase() + key.slice(1)).textContent = value;
            Utils.showToast('✅ تم تحديث الإعداد', false);
        }
    } catch (error) {
        console.error(error);
        Utils.showToast('حدث خطأ', true);
    }
};

window.updateReminderTime = function() {
    var input = document.getElementById('reminderHour');
    var hour = parseInt(input.value);
    if (isNaN(hour) || hour < 0 || hour > 23) {
        Utils.showToast('⚠️ أدخل ساعة صحيحة (0-23)', true);
        return;
    }
    localStorage.setItem('reminderHour', hour.toString());
    settingsManager.settings.reminderHour = hour;
    document.getElementById('currentReminderHour').textContent = hour.toString().padStart(2, '0') + ':00';
    Utils.showToast('✅ تم تحديث وقت التذكير', false);
};

window.confirmClearAllData = function() {
    if (!confirm('⚠️ تحذير: هذا الإجراء سيحذف جميع البيانات. هل أنت متأكد؟')) return;
    if (!confirm('⚠️ تأكيد نهائي: هل أنت متأكد تماماً؟')) return;
    Utils.showToast('⏳ جاري مسح البيانات...', false, 5000);
    db.collection('circleMembers').get().then(function(snap) {
        snap.forEach(function(d) { d.ref.delete(); });
        return db.collection('circles').get();
    }).then(function(snap) {
        snap.forEach(function(d) { d.ref.delete(); });
        return db.collection('globalExtraJuz').doc('globalPool').delete();
    }).then(function() {
        Utils.showToast('✅ تم مسح جميع البيانات', false);
        loadAdminData();
    }).catch(function(e) {
        console.error(e);
        Utils.showToast('حدث خطأ', true);
    });
};

window.resetAllSettings = function() {
    if (!confirm('⚠️ هل أنت متأكد من إعادة ضبط الإعدادات؟')) return;
    db.collection('appSettings').doc('config').set({
        maxExtraPerDay: 1,
        maxCircleMembers: 30,
        maxAbsenceDays: 3,
        updatedAt: new Date()
    }).then(function() {
        settingsManager.settings = {
            maxCircleMembers: 30,
            maxExtraPerDay: 1,
            maxAbsenceDays: 3,
            reminderHour: 20
        };
        state.settings = settingsManager.settings;
        Utils.showToast('✅ تم إعادة ضبط الإعدادات', false);
        loadSettings();
    }).catch(function(e) {
        console.error(e);
        Utils.showToast('حدث خطأ', true);
    });
};

// ==================== دوال رسالة المشاركة ====================
// تم نقل هذه الدوال إلى أعلى (قبل دالة openShareModal)

// ==================== دوال المدير العام - المصادقة ====================
window.adminLogin = async function() {
    var email = document.getElementById('adminEmailInput').value.trim();
    var password = document.getElementById('adminPasswordInput').value.trim();
    if (!email || !password) { Utils.showToast('⚠️ أدخل البريد وكلمة السر', true); return; }
    try {
        await adminManager.load();
        if (adminManager.email && email === adminManager.email) {
            await auth.signInWithEmailAndPassword(email, password);
        } else {
            Utils.showToast('❌ هذا البريد ليس مديراً عاماً', true);
        }
    } catch (error) {
        Utils.showToast(error.message || 'حدث خطأ', true);
    }
};

window.toggleAdminSection = function() {
    var section = document.getElementById('adminLoginSection');
    if (section) {
        section.style.display = section.style.display === 'none' || section.style.display === '' ? 'block' : 'none';
    }
};

window.changeAdminCredentials = async function() {
    var email = document.getElementById('newAdminEmail').value.trim();
    var password = document.getElementById('newAdminPassword').value.trim();
    if (!email || !password) { Utils.showToast('⚠️ أدخل البريد وكلمة السر', true); return; }
    if (password.length < 6) { Utils.showToast('⚠️ كلمة السر 6 أحرف على الأقل', true); return; }
    if (!confirm('⚠️ هل أنت متأكد من تغيير المدير العام إلى:\n📧 ' + email)) return;
    try {
        var success = await adminManager.update(email, password);
        if (success) {
            var user = auth.currentUser;
            if (user && user.email === adminManager.email) {
                try {
                    await user.updateEmail(email);
                    await user.updatePassword(password);
                } catch (authError) {
                    console.warn('⚠️ خطأ في تحديث Auth:', authError.message);
                }
            }
            Utils.showToast('✅ تم تغيير المدير العام بنجاح', false);
            document.getElementById('newAdminEmail').value = '';
            document.getElementById('newAdminPassword').value = '';
        }
    } catch (error) {
        console.error(error);
        Utils.showToast('حدث خطأ', true);
    }
};

// ==================== دوال إنشاء الحلقة ====================
window.createCircle = function() {
    if (state.role !== ROLES.SUPER_ADMIN) {
        Utils.showToast('⚠️ ليس لديك صلاحية', true);
        return;
    }
    var name = prompt('اسم الحلقة:', 'حلقة جديدة');
    if (!name) return;
    var genderInput = prompt('نوع الحلقة (ذكر/أنثى/مختلط):', 'مختلط');
    var gender = 'mixed';
    if (genderInput === 'ذكر' || genderInput === 'male') gender = 'male';
    else if (genderInput === 'أنثى' || genderInput === 'female') gender = 'female';
    var code = Utils.generateCode(6);
    db.collection('circles').add({
        circleName: name.trim(),
        inviteCode: code,
        gender: gender,
        createdBy: auth.currentUser ? auth.currentUser.uid : null,
        createdAt: new Date(),
        memberCount: 0
    }).then(function() {
        Utils.showToast('✅ تم إنشاء الحلقة', false);
        loadAdminCircles();
    }).catch(function(error) {
        console.error(error);
        Utils.showToast('حدث خطأ', true);
    });
};

// ==================== دوال نسخ الرمز ====================
window.copyInviteCode = function() {
    if (state.role !== ROLES.CIRCLE_ADMIN && state.role !== ROLES.SUPER_ADMIN && state.role !== ROLES.CIRCLE_SUPERVISOR) {
        Utils.showToast('⚠️ ليس لديك صلاحية', true);
        return;
    }
    db.collection('circles').doc(state.circleId).get().then(function(doc) {
        if (doc.exists) {
            navigator.clipboard.writeText(doc.data().inviteCode);
            Utils.showToast('✅ تم نسخ الرمز', false);
        }
    });
};

// ==================== دوال المخزون العام ====================
window.refillGlobalExtraJuz = async function() {
    if (!confirm('⚠️ هل أنت متأكد من تجديد المخزون العام؟')) return;
    var poolRef = db.collection('globalExtraJuz').doc('globalPool');
    await poolRef.set({
        availableJuz: Array.from({ length: 30 }, function(_, i) { return i + 1; }),
        takenJuz: {},
        lastRefillDate: new Date(),
        refillCount: firebase.firestore.FieldValue.increment(1)
    });
    Utils.showToast('✅ تم تجديد المخزون العام', false);
    refreshExtraPoolStats();
};

async function refreshExtraPoolStats() {
    try {
        var poolRef = db.collection('globalExtraJuz').doc('globalPool');
        var doc = await poolRef.get();
        if (doc.exists) {
            var data = doc.data();
            document.getElementById('availableExtraJuzCount').textContent = data.availableJuz ? data.availableJuz.length : 0;
            document.getElementById('takenExtraJuzCount').textContent = data.takenJuz ? Object.keys(data.takenJuz).length : 0;
            document.getElementById('lastRefillDate').textContent = data.lastRefillDate ? Utils.formatDate(data.lastRefillDate) : '-';
        }
    } catch (error) {
        console.error('خطأ في تحديث إحصائيات المخزون:', error);
    }
}

// ==================== دوال التوزيع اليدوي ====================
window.showManualDistribution = function() {
    if (!state.circleId) { Utils.showToast('⚠️ أنت لست في حلقة', true); return; }
    if (state.role !== ROLES.CIRCLE_ADMIN && state.role !== ROLES.SUPER_ADMIN) {
        Utils.showToast('⚠️ ليس لديك صلاحية', true);
        return;
    }
    document.getElementById('manualDistributionModal').style.display = 'flex';
    loadMembersForDistribution();
};

async function loadMembersForDistribution() {
    try {
        var members = await db.collection('circleMembers')
            .where('circleId', '==', state.circleId)
            .where('isActive', '==', true)
            .get();
        var container = document.getElementById('distributionMembersList');
        container.innerHTML = '';
        members.forEach(function(doc) {
            var m = doc.data();
            if (m.isFrozen) return;
            var div = document.createElement('div');
            div.className = 'distribution-member-item';
            div.innerHTML = '<input type="checkbox" class="member-checkbox" value="' + doc.id + '" data-name="' + Utils.escapeHtml(m.userName) + '"><span>' + Utils.escapeHtml(m.userName) + ' (الجزء ' + (m.currentJuz || m.selectedJuz || '?') + ')</span>';
            container.appendChild(div);
        });
        var grid = document.getElementById('distributionJuzGrid');
        grid.innerHTML = '';
        for (var i = 1; i <= 30; i++) {
            (function(juz) {
                var btn = document.createElement('button');
                btn.className = 'juz-btn';
                btn.textContent = juz;
                btn.onclick = function() { selectDistributionJuz(juz); };
                grid.appendChild(btn);
            })(i);
        }
    } catch (error) {
        console.error('خطأ في تحميل الأعضاء:', error);
        Utils.showToast('حدث خطأ في تحميل الأعضاء', true);
    }
}

var selectedDistributionJuz = null;

function selectDistributionJuz(juz) {
    selectedDistributionJuz = juz;
    document.querySelectorAll('#distributionJuzGrid .juz-btn').forEach(function(b) {
        b.classList.toggle('selected', parseInt(b.textContent) === juz);
    });
}

window.executeDistribution = async function() {
    if (!selectedDistributionJuz) { Utils.showToast('⚠️ اختر جزءاً أولاً', true); return; }
    var checked = document.querySelectorAll('.member-checkbox:checked');
    if (checked.length === 0) { Utils.showToast('⚠️ اختر عضواً واحداً على الأقل', true); return; }
    var isExtra = document.getElementById('distributionAsExtra').checked;
    if (!confirm('⚠️ هل أنت متأكد من توزيع الجزء ' + selectedDistributionJuz + ' على ' + checked.length + ' عضو' + (isExtra ? ' كورد إضافي' : '') + '؟')) return;
    var btn = document.getElementById('executeDistributionBtn');
    var orig = btn.textContent;
    btn.textContent = '⏳ جاري...';
    btn.disabled = true;
    try {
        var successCount = 0;
        for (var i = 0; i < checked.length; i++) {
            var cb = checked[i];
            var memberId = cb.value;
            try {
                if (isExtra) {
                    var memberRef = db.collection('circleMembers').doc(memberId);
                    var doc = await memberRef.get();
                    var data = doc.data();
                    var plan = data.extraReadingsPlan || [];
                    plan.push({
                        juz: selectedDistributionJuz,
                        status: 'pending',
                        addedAt: new Date(),
                        assignedBy: state.user.uid
                    });
                    await memberRef.update({ extraReadingsPlan: plan });
                    await notifications.sendToUser(data.userId, '📦 جزء إضافي', 'تم توزيع الجزء ' + selectedDistributionJuz + ' عليك كورد إضافي بواسطة ' + (state.user.displayName || 'المدير'), 'extra_juz');
                } else {
                    var memberRef2 = db.collection('circleMembers').doc(memberId);
                    var doc2 = await memberRef2.get();
                    var data2 = doc2.data();
                    var availRef = db.collection('circleAvailableJuz').doc(state.circleId);
                    var availDoc = await availRef.get();
                    if (availDoc.exists) {
                        var availData = availDoc.data();
                        var oldJuz = data2.currentJuz || data2.selectedJuz;
                        if (oldJuz) {
                            var newAvail = (availData.availableJuz || []).concat([oldJuz]).sort(function(a, b) { return a - b; });
                            var newTaken = { ...(availData.takenJuz || {}) };
                            delete newTaken[oldJuz];
                            await availRef.update({ availableJuz: newAvail, takenJuz: newTaken });
                        }
                    }
                    await memberRef2.update({
                        currentJuz: selectedDistributionJuz,
                        selectedJuz: selectedDistributionJuz
                    });
                    await availRef.update({
                        availableJuz: firebase.firestore.FieldValue.arrayRemove(selectedDistributionJuz),
                        ['takenJuz.' + selectedDistributionJuz]: data2.userId
                    });
                    await notifications.sendToUser(data2.userId, '🔄 تغيير الورد اليومي', 'تم تغيير وردك اليومي إلى الجزء ' + selectedDistributionJuz + ' بواسطة ' + (state.user.displayName || 'المدير'), 'juz_change');
                }
                successCount++;
            } catch (err) {
                console.error('خطأ في توزيع على عضو:', err);
            }
        }
        Utils.showToast('✅ تم توزيع الجزء ' + selectedDistributionJuz + ' على ' + successCount + ' عضو', false);
        document.getElementById('manualDistributionModal').style.display = 'none';
        await loadCircleInfo();
    } catch (error) {
        console.error('خطأ في التوزيع:', error);
        Utils.showToast('حدث خطأ في التوزيع', true);
    } finally {
        btn.textContent = orig;
        btn.disabled = false;
    }
};

// ==================== دوال التقارير للمدير العام ====================
window.generateFullReport = function() {
    Utils.showToast('⏳ جاري إنشاء التقرير...', false, 2000);
    var container = document.getElementById('reportContent');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:40px;">جاري التحميل...</div>';
    db.collection('circleMembers').get().then(function(snap) {
        var html = '<h4>📊 تقرير شامل</h4><div class="report-stats">';
        var total = 0, online = 0, admins = 0;
        snap.forEach(function(d) {
            var m = d.data();
            if (m.isActive !== false) {
                total++;
                var status = Utils.getUserStatus(m);
                if (status.status === 'online') online++;
                if (m.isCircleAdmin) admins++;
            }
        });
        html += '<div class="report-stat"><div class="label">👥 إجمالي المستخدمين</div><div class="value">' + total + '</div></div><div class="report-stat"><div class="label">🟢 متصلون</div><div class="value" style="color:#22c55e;">' + online + '</div></div><div class="report-stat"><div class="label">🔴 غير متصل</div><div class="value" style="color:#ef4444;">' + (total - online) + '</div></div><div class="report-stat"><div class="label">👑 المدراء</div><div class="value" style="color:#8b5cf6;">' + admins + '</div></div>';
        html += '</div>';
        container.innerHTML = html;
        Utils.showToast('✅ تم إنشاء التقرير', false);
    }).catch(function(e) {
        console.error(e);
        container.innerHTML = '<div class="error">حدث خطأ في إنشاء التقرير</div>';
        Utils.showToast('حدث خطأ', true);
    });
};

window.exportCirclesToExcel = function() {
    db.collection('circles').get().then(async function(snap) {
        var data = [];
        for (var doc of snap.docs) {
            var c = doc.data();
            var members = await db.collection('circleMembers')
                .where('circleId', '==', doc.id)
                .where('isActive', '==', true)
                .get();
            var adminName = 'لا يوجد';
            for (var mDoc of members.docs) {
                if (mDoc.data().isCircleAdmin) {
                    adminName = mDoc.data().userName || 'مدير';
                    break;
                }
            }
            data.push({
                'اسم الحلقة': c.circleName,
                'رمز الدعوة': c.inviteCode,
                'النوع': c.gender === 'female' ? 'نسائي' : (c.gender === 'male' ? 'رجالي' : 'مختلط'),
                'عدد الأعضاء': c.memberCount || 0,
                'المدير': adminName,
                'تاريخ الإنشاء': Utils.formatDate(c.createdAt)
            });
        }
        if (data.length === 0) { Utils.showToast('لا توجد حلقات', true); return; }
        var ws = XLSX.utils.json_to_sheet(data);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'الحلقات');
        XLSX.writeFile(wb, 'حلقات_ختمتي_' + new Date().toLocaleDateString('ar') + '.xlsx');
        Utils.showToast('✅ تم تصدير بيانات الحلقات', false);
    }).catch(function(e) {
        console.error(e);
        Utils.showToast('خطأ في التصدير', true);
    });
};

window.exportUsersFullCSV = function() {
    Utils.showToast('⏳ جاري إنشاء التقرير...', false, 2000);
    db.collection('circleMembers').get().then(function(snap) {
        var data = [];
        snap.forEach(function(d) {
            var m = d.data();
            if (m.isActive !== false) {
                var status = Utils.getUserStatus(m);
                data.push({
                    'الاسم': m.userName || '',
                    'البريد': m.userEmail || '',
                    'مدير': m.isCircleAdmin ? 'نعم' : 'لا',
                    'الحلقة': m.circleId || '',
                    'الجزء': m.currentJuz || m.selectedJuz || '',
                    'الحالة': status.label,
                    'الأجزاء': (m.totalPartsRead || 0) + (m.totalExtraJuz || 0),
                    'الغياب': m.absenceCount || 0
                });
            }
        });
        if (data.length === 0) { Utils.showToast('لا توجد بيانات', true); return; }
        var ws = XLSX.utils.json_to_sheet(data);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'المستخدمين');
        XLSX.writeFile(wb, 'تقرير_المستخدمين_' + new Date().toLocaleDateString('ar') + '.xlsx');
        Utils.showToast('✅ تم تصدير ' + data.length + ' مستخدم', false);
    }).catch(function(e) {
        console.error(e);
        Utils.showToast('حدث خطأ أثناء التصدير', true);
    });
};

window.exportActiveUsersToWhatsApp = function() {
    Utils.showToast('⏳ جاري التحميل...', false, 2000);
    db.collection('circleMembers').where('isActive', '==', true).get().then(function(snap) {
        var today = Utils.getTodayString();
        var message = '📊 قائمة الأعضاء النشطاء (قرأوا اليوم):\n\n';
        var count = 0;
        snap.forEach(function(d) {
            var m = d.data();
            var lastRead = m.lastReadDate ? Utils.toDate(m.lastReadDate) : null;
            if (lastRead ? lastRead.toDateString() === today : false) {
                count++;
                message += count + '. ' + m.userName + (m.isCircleAdmin ? ' 👑' : '') + ' | الجزء ' + (m.currentJuz || m.selectedJuz) + '\n';
            }
        });
        if (count === 0) { Utils.showToast('لا يوجد أعضاء نشطاء اليوم', true); return; }
        window.open('https://wa.me/?text=' + encodeURIComponent(message), '_blank');
    }).catch(function(e) {
        console.error(e);
        Utils.showToast('حدث خطأ', true);
    });
};

window.exportInactiveUsersToWhatsApp = function() {
    Utils.showToast('⏳ جاري التحميل...', false, 2000);
    db.collection('circleMembers').where('isActive', '==', true).get().then(function(snap) {
        var today = Utils.getTodayString();
        var message = '📊 قائمة الأعضاء الغائبين (لم يقرأوا اليوم):\n\n';
        var count = 0;
        snap.forEach(function(d) {
            var m = d.data();
            var lastRead = m.lastReadDate ? Utils.toDate(m.lastReadDate) : null;
            if ((lastRead ? lastRead.toDateString() : null) !== today) {
                count++;
                message += count + '. ' + m.userName + (m.isCircleAdmin ? ' 👑' : '') + ' | غائب ' + (m.absenceCount || 0) + ' يوم\n';
            }
        });
        if (count === 0) { Utils.showToast('لا يوجد أعضاء غائبون اليوم', true); return; }
        window.open('https://wa.me/?text=' + encodeURIComponent(message), '_blank');
    }).catch(function(e) {
        console.error(e);
        Utils.showToast('حدث خطأ', true);
    });
};

// ==================== دوال عرض التقرير ====================
window.showCircleReport = async function() {
    if (!state.circleId) {
        Utils.showToast('⚠️ أنت لست في حلقة', true);
        return;
    }
    if (state.role !== ROLES.CIRCLE_ADMIN && state.role !== ROLES.SUPER_ADMIN) {
        Utils.showToast('⚠️ ليس لديك صلاحية', true);
        return;
    }
    var report = await generateCircleReport(state.circleId);
    if (!report) return;
    var container = document.getElementById('circleReportContainer');
    container.style.display = 'block';
    var html = '<div class="report-header"><h3>📊 تقرير حلقة: ' + Utils.escapeHtml(report.circleName) + '</h3><p>📅 ' + Utils.formatDate(report.generatedAt) + '</p></div><div class="report-stats-grid"><div class="stat-card"><span>👥 الأعضاء</span><strong>' + report.memberCount + '</strong></div><div class="stat-card"><span>📖 الأجزاء</span><strong>' + report.totalParts + '</strong></div><div class="stat-card"><span>🏆 الختمات</span><strong>' + report.totalKhatmas + '</strong></div><div class="stat-card"><span>✅ قرأوا اليوم</span><strong style="color:#22c55e;">' + report.readToday + '</strong></div><div class="stat-card"><span>❌ لم يقرأوا</span><strong style="color:#ef4444;">' + (report.memberCount - report.readToday) + '</strong></div></div><div class="report-members-table"><h4>📋 قائمة الأعضاء</h4><div style="overflow-x:auto;"><table><thead><tr><th>#</th><th>الاسم</th><th>الجزء</th><th>آخر قراءة</th><th>الحالة</th><th>الأجزاء</th><th>الغياب</th><th>الثقة</th></tr></thead><tbody>';
    for (var i = 0; i < report.members.length; i++) {
        var m = report.members[i];
        var status = Utils.getUserStatus(m);
        html += '<tr style="' + (m.hasReadToday ? 'background:#dcfce7;' : (m.isFrozen ? 'background:#f1f5f9;' : 'background:#fee2e2;')) + '"><td>' + (i + 1) + '</td><td>' + Utils.escapeHtml(m.name) + (m.isCircleAdmin ? ' 👑' : '') + (m.isFrozen ? ' ⏸️' : '') + '</td><td>' + m.currentJuz + '</td><td>' + (m.lastRead !== 'لم يقرأ بعد' ? Utils.formatDate(m.lastRead) : 'لم يقرأ بعد') + '</td><td><span style="color:' + status.color + ';font-weight:bold;">' + status.label + '</span></td><td>' + m.totalParts + '</td><td style="color:' + (m.absenceDays >= (settingsManager.get('maxAbsenceDays') || 3) ? '#ef4444' : (m.absenceDays > 0 ? '#f59e0b' : '#22c55e')) + ';">' + m.absenceDays + '</td><td>' + m.trustScore + '%</td></tr>';
    }
    html += '</tbody></table></div></div><div class="report-actions"><button onclick="window.exportReportPDF()" class="btn-admin-action">📄 PDF</button><button onclick="window.exportReportExcel()" class="btn-admin-action" style="background:#0ea5e9;">📊 Excel</button><button onclick="window.exportReportCSV()" class="btn-admin-action" style="background:#8b5cf6;">📋 CSV</button><button onclick="window.exportReportImage()" class="btn-admin-action" style="background:#f59e0b;">🖼️ صورة</button></div>';
    container.innerHTML = html;
    window._currentReportData = report;
};

async function generateCircleReport(circleId) {
    try {
        var circleDoc = await db.collection('circles').doc(circleId).get();
        if (!circleDoc.exists) { Utils.showToast('⚠️ الحلقة غير موجودة', true); return null; }
        var circle = circleDoc.data();
        var members = await db.collection('circleMembers')
            .where('circleId', '==', circleId)
            .where('isActive', '==', true)
            .get();
        var today = Utils.getTodayString();
        var totalParts = 0, totalKhatmas = 0, readToday = 0;
        var memberList = [];
        members.forEach(function(doc) {
            var m = doc.data();
            var total = (m.totalPartsRead || 0) + (m.totalExtraJuz || 0);
            var khatmas = Utils.calculateKhatmas(m.totalPartsRead || 0);
            var lastRead = m.lastReadDate ? Utils.toDate(m.lastReadDate) : null;
            var hasReadToday = lastRead ? lastRead.toDateString() === today : false;
            var status = Utils.getUserStatus(m);
            totalParts += total;
            totalKhatmas += khatmas;
            if (hasReadToday) readToday++;
            memberList.push({
                id: doc.id,
                name: m.userName || 'مستخدم',
                currentJuz: m.currentJuz || m.selectedJuz || '-',
                lastRead: lastRead ? Utils.formatDate(lastRead) : 'لم يقرأ بعد',
                hasReadToday: hasReadToday,
                status: status,
                totalParts: total,
                khatmas: khatmas,
                absenceDays: m.absenceCount || 0,
                trustScore: TrustSystem.calculateScore(m),
                isCircleAdmin: m.isCircleAdmin || false,
                isFrozen: m.isFrozen || false
            });
        });
        memberList.sort(function(a, b) {
            if (a.isCircleAdmin && !b.isCircleAdmin) return -1;
            if (!a.isCircleAdmin && b.isCircleAdmin) return 1;
            if (a.hasReadToday && !b.hasReadToday) return -1;
            if (!a.hasReadToday && b.hasReadToday) return 1;
            return a.name.localeCompare(b.name);
        });
        return {
            circleName: circle.circleName || 'حلقة بدون اسم',
            memberCount: members.size,
            totalParts: totalParts,
            totalKhatmas: totalKhatmas,
            readToday: readToday,
            members: memberList,
            generatedAt: new Date()
        };
    } catch (error) {
        console.error('خطأ في إنشاء التقرير:', error);
        Utils.showToast('حدث خطأ في إنشاء التقرير', true);
        return null;
    }
}

// ==================== دوال تصدير التقارير ====================
window.exportReportPDF = function() {
    var report = window._currentReportData;
    if (!report) { Utils.showToast('⚠️ لا توجد بيانات تقرير', true); return; }
    try {
        var doc = new window.jspdf.jsPDF('p', 'mm', 'a4');
        doc.setFontSize(20);
        doc.text('تقرير حلقة: ' + report.circleName, 105, 25, { align: 'center' });
        doc.setFontSize(12);
        doc.text('📅 ' + Utils.formatDate(report.generatedAt), 105, 35, { align: 'center' });
        doc.setFontSize(14);
        doc.text('📊 الإحصائيات:', 20, 50);
        doc.setFontSize(12);
        doc.text('👥 عدد الأعضاء: ' + report.memberCount, 25, 58);
        doc.text('📖 إجمالي الأجزاء: ' + report.totalParts, 25, 65);
        doc.text('🏆 عدد الختمات: ' + report.totalKhatmas, 25, 72);
        doc.text('✅ قرأوا اليوم: ' + report.readToday, 25, 79);
        doc.text('❌ لم يقرأوا: ' + (report.memberCount - report.readToday), 25, 86);
        var tableData = report.members.map(function(m) {
            return [m.name, m.currentJuz, m.lastRead, m.status.label, m.totalParts, m.absenceDays, m.trustScore + '%'];
        });
        doc.autoTable({
            startY: 95,
            head: [['الاسم', 'الجزء', 'آخر قراءة', 'الحالة', 'الأجزاء', 'الغياب', 'الثقة']],
            body: tableData,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 3, halign: 'right' },
            headStyles: { fillColor: [26, 71, 57], textColor: [255, 255, 255], halign: 'right' }
        });
        doc.save('تقرير_' + report.circleName + '_' + new Date().toLocaleDateString('ar') + '.pdf');
        Utils.showToast('✅ تم تصدير التقرير PDF', false);
    } catch (error) {
        console.error('خطأ في تصدير PDF:', error);
        Utils.showToast('حدث خطأ في تصدير PDF', true);
    }
};

window.exportReportExcel = function() {
    var report = window._currentReportData;
    if (!report) { Utils.showToast('⚠️ لا توجد بيانات تقرير', true); return; }
    try {
        var data = report.members.map(function(m) {
            return {
                'الاسم': m.name,
                'مدير': m.isCircleAdmin ? 'نعم' : 'لا',
                'الجزء الحالي': m.currentJuz,
                'آخر قراءة': m.lastRead,
                'الحالة': m.status.label,
                'إجمالي الأجزاء': m.totalParts,
                'الختمات': m.khatmas,
                'أيام الغياب': m.absenceDays,
                'نسبة الثقة': m.trustScore + '%',
                'مجمد': m.isFrozen ? 'نعم' : 'لا'
            };
        });
        var ws = XLSX.utils.json_to_sheet(data);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'تقرير الحلقة');
        XLSX.writeFile(wb, 'تقرير_' + report.circleName + '_' + new Date().toLocaleDateString('ar') + '.xlsx');
        Utils.showToast('✅ تم تصدير التقرير Excel', false);
    } catch (error) {
        console.error('خطأ في تصدير Excel:', error);
        Utils.showToast('حدث خطأ في تصدير Excel', true);
    }
};

window.exportReportCSV = function() {
    var report = window._currentReportData;
    if (!report) { Utils.showToast('⚠️ لا توجد بيانات تقرير', true); return; }
    try {
        var csv = 'الاسم,مدير,الجزء الحالي,آخر قراءة,الحالة,إجمالي الأجزاء,الختمات,أيام الغياب,نسبة الثقة,مجمد\n';
        report.members.forEach(function(m) {
            csv += m.name + ',' + (m.isCircleAdmin ? 'نعم' : 'لا') + ',' + m.currentJuz + ',' + m.lastRead + ',' + m.status.label + ',' + m.totalParts + ',' + m.khatmas + ',' + m.absenceDays + ',' + m.trustScore + '%,' + (m.isFrozen ? 'نعم' : 'لا') + '\n';
        });
        var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        var link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'تقرير_' + report.circleName + '_' + new Date().toLocaleDateString('ar') + '.csv';
        link.click();
        URL.revokeObjectURL(link.href);
        Utils.showToast('✅ تم تصدير التقرير CSV', false);
    } catch (error) {
        console.error('خطأ في تصدير CSV:', error);
        Utils.showToast('حدث خطأ في تصدير CSV', true);
    }
};

window.exportReportImage = function() {
    var report = window._currentReportData;
    if (!report) { Utils.showToast('⚠️ لا توجد بيانات تقرير', true); return; }
    var container = document.getElementById('circleReportContainer');
    if (!container) return;
    var footer = document.createElement('div');
    footer.className = 'report-footer';
    footer.textContent = 'ختمتي - تقرير الحلقة';
    footer.style.cssText = 'text-align:center;padding:10px;font-size:12px;color:#666;margin-top:10px;';
    container.appendChild(footer);
    var scale = window.innerWidth < 500 ? 1.2 : 1.8;
    html2canvas(container, {
        scale: scale,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: Math.min(container.scrollWidth, 800),
        height: Math.min(container.scrollHeight, 1200)
    }).then(function(canvas) {
        var link = document.createElement('a');
        link.download = 'تقرير_' + report.circleName + '_' + new Date().toLocaleDateString('ar') + '.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
        footer.remove();
        Utils.showToast('✅ تم تصدير التقرير كصورة', false);
    }).catch(function(error) {
        console.error('خطأ في تصدير الصورة:', error);
        footer.remove();
        Utils.showToast('حدث خطأ في تصدير الصورة', true);
    });
};

// ==================== دوال الأجزاء الإضافية ====================
window.showExtraJuzModal = async function() {
    if (!state.memberData) { Utils.showToast('يرجى تسجيل الدخول أولاً', true); return; }
    if (state.memberData.isFrozen) {
        Utils.showToast('⚠️ حسابك مجمد، لا يمكنك إضافة أجزاء', true);
        return;
    }
    var todayAdded = (state.memberData.extraReadingsPlan || []).filter(function(p) {
        var addedDate = p.addedAt ? Utils.toDate(p.addedAt) : null;
        return addedDate ? addedDate.toDateString() === Utils.getTodayString() : false;
    });
    var maxExtra = settingsManager.get('maxExtraPerDay') || 1;
    if (todayAdded.length >= maxExtra) {
        Utils.showToast('⚠️ مسموح فقط بـ ' + maxExtra + ' جزء إضافي يومياً.', true);
        return;
    }
    var poolRef = db.collection('globalExtraJuz').doc('globalPool');
    var poolDoc = await poolRef.get();
    if (!poolDoc.exists) { Utils.showToast('المخزون العام غير متاح حالياً', true); return; }
    var availableJuz = poolDoc.data().availableJuz || [];
    if (availableJuz.length === 0) {
        Utils.showToast('❗ لا توجد أجزاء متاحة في المخزون العام حالياً.', true);
        return;
    }
    var modal = document.getElementById('extraJuzModal');
    var grid = document.getElementById('extraJuzGrid');
    var msgSpan = document.getElementById('availableExtraCountMsg');
    msgSpan.innerHTML = '📦 الأجزاء المتاحة: ' + availableJuz.length + ' جزء | الحد اليومي: ' + maxExtra + ' جزء';
    grid.innerHTML = '';
    for (var i = 1; i <= 30; i++) {
        var isAvailable = availableJuz.includes(i);
        var btn = document.createElement('button');
        btn.className = 'juz-btn' + (!isAvailable ? ' disabled' : '');
        btn.textContent = i;
        btn.disabled = !isAvailable;
        if (isAvailable) {
            (function(juz) {
                btn.onclick = function() { reserveExtraJuzFromPool(juz); };
            })(i);
        }
        grid.appendChild(btn);
    }
    modal.style.display = 'flex';
};

async function reserveExtraJuzFromPool(juz) {
    var poolRef = db.collection('globalExtraJuz').doc('globalPool');
    try {
        await db.runTransaction(async function(t) {
            var poolDoc = await t.get(poolRef);
            if (!poolDoc.exists) throw new Error('المخزون غير موجود');
            var data = poolDoc.data();
            var available = data.availableJuz || [];
            var taken = data.takenJuz || {};
            if (!available.includes(juz)) throw new Error('الجزء غير متاح');
            if (taken[juz]) throw new Error('الجزء محجوز مسبقاً');
            var newAvailable = available.filter(function(j) { return j !== juz; });
            var newTaken = { ...taken };
            newTaken[juz] = state.user.uid;
            t.update(poolRef, { availableJuz: newAvailable, takenJuz: newTaken });
        });
        var memberRef = db.collection('circleMembers').doc(state.memberId);
        var currentPlan = state.memberData.extraReadingsPlan || [];
        var newPlan = currentPlan.concat([{
            juz: juz,
            status: 'pending',
            addedAt: new Date()
        }]);
        await memberRef.update({ extraReadingsPlan: newPlan });
        state.memberData.extraReadingsPlan = newPlan;
        document.getElementById('extraJuzModal').style.display = 'none';
        Utils.showToast('✅ تم إضافة الجزء ' + juz + ' من المخزون العام', false);
        await loadExtraProgress();
    } catch (error) {
        console.error(error);
        Utils.showToast(error.message || 'حدث خطأ', true);
    }
}

// ==================== دوال متنوعة ====================
window.refreshCircles = function() {
    if (state.user) {
        db.collection('users').doc(state.user.uid).get().then(function(doc) {
            if (doc.exists) {
                showAvailableCircles({
                    userId: state.user.uid,
                    email: state.user.email || '',
                    name: doc.data().displayName || doc.data().username,
                    gender: doc.data().gender
                });
            }
        });
    }
};

window.exitToAuth = function() {
    if (state.isGuest) {
        state.clear();
        Utils.showScreen('authScreen');
        return;
    }
    if (confirm('⚠️ هل أنت متأكد من تسجيل الخروج؟')) {
        auth.signOut().then(function() {
            state.clear();
            Utils.showScreen('authScreen');
            Utils.showToast('👋 تم تسجيل الخروج', false);
        });
    }
};

window.leaveCircle = function() {
    if (!confirm('⚠️ هل أنت متأكد من مغادرة الحلقة؟')) return;
    db.collection('circleMembers').doc(state.memberId).update({
        isActive: false,
        leftAt: new Date()
    }).then(function() {
        Utils.showToast('✅ تم المغادرة', false);
        setTimeout(function() {
            auth.signOut();
            window.location.reload();
        }, 2000);
    });
};

window.joinCircleByCode = async function(code) {
    if (!state.user || state.isGuest) {
        Utils.showToast('⚠️ يرجى تسجيل الدخول أولاً', true);
        return;
    }
    try {
        var snapshot = await db.collection('circles')
            .where('inviteCode', '==', code.toUpperCase())
            .limit(1)
            .get();
        if (snapshot.empty) {
            Utils.showToast('⚠️ رمز الحلقة غير صحيح', true);
            return;
        }
        var circle = snapshot.docs[0];
        var circleData = circle.data();
        if (circleData.gender === 'female' && state.gender === 'male') {
            Utils.showToast('⚠️ هذه الحلقة نسائية فقط', true);
            return;
        }
        if (circleData.gender === 'male' && state.gender === 'female') {
            Utils.showToast('⚠️ هذه الحلقة رجالية فقط', true);
            return;
        }
        var membersCount = await db.collection('circleMembers')
            .where('circleId', '==', circle.id)
            .where('isActive', '==', true)
            .get();
        var maxMembers = settingsManager.get('maxCircleMembers') || 30;
        if (membersCount.size >= maxMembers) {
            Utils.showToast('⚠️ الحلقة مكتملة (الحد الأقصى للأعضاء)', true);
            return;
        }
        var existingMember = await db.collection('circleMembers')
            .where('userId', '==', state.user.uid)
            .where('isActive', '==', true)
            .get();
        if (!existingMember.empty) {
            Utils.showToast('⚠️ أنت بالفعل عضو في حلقة', true);
            return;
        }
        Utils.showToast('🔑 تم العثور على الحلقة، جاري التوجيه...', false);
        await window.selectCircle(circle.id);
    } catch (error) {
        console.error('خطأ في الانضمام برمز الحلقة:', error);
        Utils.showToast('حدث خطأ في الانضمام', true);
    }
};

function updateExtraLimitBadge() {
    var badge = document.getElementById('extraLimitBadge');
    if (badge) badge.textContent = '(الحد الأقصى: ' + (settingsManager.get('maxExtraPerDay') || 1) + ' جزء/يوم)';
}

// ==================== الوضع الليلي وحجم الخط ====================
function initDarkMode() {
    var saved = localStorage.getItem('darkMode');
    if (saved === 'enabled') {
        document.body.classList.add('dark-mode');
        updateDarkModeButtons(true);
    }
}

function updateDarkModeButtons(isDark) {
    var btns = document.querySelectorAll('#darkModeToggleCircle, #darkModeToggleMain, #darkModeToggleAdmin, #darkModeToggleSupervisor');
    btns.forEach(function(btn) { if (btn) btn.textContent = isDark ? '☀️' : '🌙'; });
}

window.toggleDarkMode = function() {
    var isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
    updateDarkModeButtons(isDark);
};

function initFontSize() {
    var saved = localStorage.getItem('fontSize') || 'medium';
    document.body.classList.add('font-' + saved);
    var btns = document.querySelectorAll('.font-size-options .btn-size');
    btns.forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.size === saved);
    });
}

window.setFontSize = function(size) {
    document.body.classList.remove('font-small', 'font-medium', 'font-large');
    document.body.classList.add('font-' + size);
    localStorage.setItem('fontSize', size);
    var btns = document.querySelectorAll('.font-size-options .btn-size');
    btns.forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.size === size);
    });
    document.getElementById('fontSizeModal').style.display = 'none';
};

window.showFontSizeModal = function() {
    document.getElementById('fontSizeModal').style.display = 'flex';
};

// ==================== تهيئة التطبيق ====================
async function initApp() {
    console.log('🚀 بدء تهيئة تطبيق ختمتي...');
    setTimeout(function() {
        var loading = document.getElementById('loadingScreen');
        if (loading && loading.classList.contains('active')) {
            loading.classList.remove('active');
            console.log('⚠️ تم إخفاء شاشة التحميل (طوارئ)');
            if (!document.querySelector('.screen.active')) {
                Utils.showScreen('authScreen');
            }
        }
    }, 5000);
    try {
        await settingsManager.load();
        await adminManager.load();
        
        // ===== تحميل رسالة المشاركة =====
        await loadShareMessage();
        // ================================
        
        try {
            var poolRef = db.collection('globalExtraJuz').doc('globalPool');
            var poolDoc = await poolRef.get();
            if (!poolDoc.exists) {
                await poolRef.set({
                    availableJuz: Array.from({ length: 30 }, function(_, i) { return i + 1; }),
                    takenJuz: {},
                    lastRefillDate: new Date(),
                    refillCount: 0
                });
            }
        } catch (error) {
            console.error('خطأ في تهيئة المخزون العام:', error);
        }
        initDarkMode();
        initFontSize();
        auth.onAuthStateChanged(async function(user) {
            if (user) {
                console.log('👤 مستخدم مسجل:', user.email);
                state.user = user;
                state.isGuest = false;
                state.saveToStorage();
                await Utils.refreshUserData();
                var role = await checkUserRole(user);
                state.role = role;
                if (role === ROLES.SUPER_ADMIN) {
                    Utils.showScreen('adminScreen');
                    await window.loadAdminData();
                } else if (role === ROLES.CIRCLE_SUPERVISOR) {
                    Utils.showScreen('supervisorScreen');
                    await window.loadSupervisorDashboard();
                    await window.loadSupervisorNotifications();
                } else {
                    await loadUserData();
                    await loadUserNotifications();
                }
            } else {
                console.log('👤 لا يوجد مستخدم مسجل');
                state.clear();
                Utils.showScreen('authScreen');
            }
        });
        bindEvents();
        console.log('✅ تم تهيئة التطبيق بنجاح');
    } catch (error) {
        console.error('❌ خطأ في تهيئة التطبيق:', error);
        Utils.showScreen('authScreen');
        Utils.showToast('حدث خطأ في تهيئة التطبيق، يرجى إعادة المحاولة', true);
    }
}

// ==================== ربط الأحداث ====================
function bindEvents() {
    // تبويبات المصادقة
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var tab = this.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            document.querySelectorAll('.auth-form').forEach(function(f) { f.classList.remove('active'); });
            var form = document.getElementById(tab + 'Form');
            if (form) form.classList.add('active');
        });
    });
    
    // نموذج تسجيل الدخول
    var loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var username = document.getElementById('loginUsername').value.trim();
            var password = document.getElementById('loginPassword').value;
            if (!username || !password) {
                Utils.showMessage('authMessage', '⚠️ أدخل اسم المستخدم وكلمة السر', true);
                return;
            }
            try {
                if (username.includes('@') && Utils.isValidEmail(username)) {
                    await authService.loginWithEmail(username, password);
                } else {
                    await authService.loginWithUsername(username, password);
                }
            } catch (error) {
                Utils.showMessage('authMessage', error.message || '❌ فشل تسجيل الدخول', true);
            }
        });
        console.log('✅ تم ربط نموذج تسجيل الدخول');
    }
    
    // نموذج التسجيل
    var registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            var username = document.getElementById('regName').value.trim();
            var displayName = document.getElementById('regDisplayName').value.trim();
            var email = document.getElementById('regEmail').value.trim();
            var gender = document.getElementById('regGender').value;
            var password = document.getElementById('regPassword').value;
            var confirm = document.getElementById('regConfirmPassword').value;
            if (password !== confirm) {
                Utils.showMessage('authMessage', '⚠️ كلمة السر غير متطابقة', true);
                return;
            }
            if (password.length < 6) {
                Utils.showMessage('authMessage', '⚠️ كلمة السر 6 أحرف على الأقل', true);
                return;
            }
            if (!Utils.isValidUsername(username)) {
                Utils.showMessage('authMessage', '⚠️ اسم المستخدم 3-20 حرف (أحرف إنجليزية أو أرقام أو _)', true);
                return;
            }
            if (!displayName) {
                Utils.showMessage('authMessage', '⚠️ أدخل الاسم المعروض', true);
                return;
            }
            if (!Utils.isValidEmail(email)) {
                Utils.showMessage('authMessage', '⚠️ البريد الإلكتروني غير صحيح', true);
                return;
            }
            if (!gender) {
                Utils.showMessage('authMessage', '⚠️ اختر الجنس', true);
                return;
            }
            try {
                await authService.register(email, username, password, gender, displayName);
                Utils.showMessage('authMessage', '✅ تم التسجيل بنجاح! تم إرسال رابط التفعيل إلى بريدك.', false);
                document.getElementById('regName').value = '';
                document.getElementById('regDisplayName').value = '';
                document.getElementById('regEmail').value = '';
                document.getElementById('regGender').value = '';
                document.getElementById('regPassword').value = '';
                document.getElementById('regConfirmPassword').value = '';
                document.querySelector('.tab-btn[data-tab="login"]').click();
            } catch (error) {
                Utils.showMessage('authMessage', error.message || '❌ حدث خطأ في التسجيل', true);
            }
        });
        console.log('✅ تم ربط نموذج التسجيل');
    }
    
    // زر Google
    var googleBtn = document.getElementById('googleFullBtn');
    if (googleBtn) {
        googleBtn.addEventListener('click', async function() {
            try {
                await authService.loginWithGoogle();
            } catch (error) {
                Utils.showToast(error.message || 'فشل الدخول عبر Google', true);
            }
        });
        console.log('✅ تم ربط زر Google');
    }
    
    // زر الضيف
    var guestBtn = document.getElementById('guestLoginBtn');
    if (guestBtn) {
        guestBtn.addEventListener('click', function() {
            state.user = { uid: 'guest_' + Date.now(), email: null, displayName: 'ضيف', isGuest: true };
            state.role = ROLES.GUEST;
            state.isGuest = true;
            state.saveToStorage();
            Utils.showScreen('selectCircleScreen');
            Utils.showToast('👤 مرحباً بك كضيف! الميزات محدودة.', false);
            document.getElementById('availableCirclesList').innerHTML = '<div class="guest-notice"><h4>👤 أنت في وضع الضيف</h4><p>يمكنك تصفح الحلقات والنصوص، لكن لا يمكنك الانضمام أو التسجيل.</p><button onclick="Utils.showScreen(\'authScreen\')" class="btn-primary">🔑 سجل دخول</button></div>';
        });
        console.log('✅ تم ربط زر الضيف');
    }
    
    // زر نسيت كلمة السر
    var forgotLink = document.getElementById('forgotPasswordLink');
    if (forgotLink) {
        forgotLink.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('resetModal').style.display = 'flex';
        });
    }
    
    // زر إرسال رابط إعادة التعيين
    var sendResetBtn = document.getElementById('sendResetBtn');
    if (sendResetBtn) {
        sendResetBtn.addEventListener('click', async function() {
            var email = document.getElementById('resetEmail').value.trim();
            var msg = document.getElementById('resetMessage');
            if (!email) { msg.innerHTML = '⚠️ أدخل البريد'; return; }
            try {
                await auth.sendPasswordResetEmail(email);
                msg.innerHTML = '✅ تم إرسال رابط إعادة التعيين إلى بريدك';
                msg.style.color = '#16a34a';
                setTimeout(function() { document.getElementById('resetModal').style.display = 'none'; }, 3000);
            } catch (error) {
                msg.innerHTML = '❌ البريد غير موجود أو حدث خطأ';
                msg.style.color = '#dc2626';
            }
        });
    }
    
    // أزرار الإغلاق للمودالات
    document.querySelectorAll('.close-modal, .close').forEach(function(el) {
        el.addEventListener('click', function() {
            var modal = this.closest('.modal');
            if (modal) modal.style.display = 'none';
        });
    });
    
    // إغلاق المودالات بالنقر خارجها
    document.querySelectorAll('.modal').forEach(function(modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) this.style.display = 'none';
        });
    });
    
    // تبويبات الصفحة الرئيسية
    document.querySelectorAll('.main-tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var tab = this.dataset.tab;
            document.querySelectorAll('.main-tab-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            document.querySelectorAll('.main-tab-content').forEach(function(c) { c.classList.remove('active'); });
            var content = document.getElementById(tab + 'Tab');
            if (content) content.classList.add('active');
            if (tab === 'notifications') {
                loadUserNotifications();
            }
        });
    });
    
    // تبويبات المدير العام
    document.querySelectorAll('.admin-tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var tab = this.dataset.adminTab;
            document.querySelectorAll('.admin-tab-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            document.querySelectorAll('.admin-tab-content').forEach(function(c) { c.classList.remove('active'); });
            var content = document.getElementById('admin' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab');
            if (content) content.classList.add('active');
        });
    });
    
    // قائمة منسدلة للمدير العام على الموبايل
    var adminTabSelect = document.getElementById('adminTabSelect');
    if (adminTabSelect) {
        adminTabSelect.addEventListener('change', function() {
            var tab = this.value;
            document.querySelectorAll('.admin-tab-btn').forEach(function(b) {
                b.classList.toggle('active', b.dataset.adminTab === tab);
            });
            document.querySelectorAll('.admin-tab-content').forEach(function(c) { c.classList.remove('active'); });
            var content = document.getElementById('admin' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab');
            if (content) content.classList.add('active');
        });
    }
    
    // ===== ربط تبويبات المشرف =====
    document.querySelectorAll('[data-supervisor-tab]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var tab = this.dataset.supervisorTab;
            document.querySelectorAll('[data-supervisor-tab]').forEach(function(b) { 
                b.classList.remove('active'); 
            });
            this.classList.add('active');
            document.querySelectorAll('#supervisorScreen .admin-tab-content').forEach(function(c) { 
                c.classList.remove('active'); 
            });
            var content = document.getElementById('supervisor' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab');
            if (content) content.classList.add('active');
            
            if (tab === 'notifications') {
                window.loadSupervisorNotifications();
                window.loadSupervisorCirclesForNotification();
            }
        });
    });
    
    // قائمة منسدلة للمشرف
    var supervisorTabSelect = document.getElementById('supervisorTabSelect');
    if (supervisorTabSelect) {
        supervisorTabSelect.addEventListener('change', function() {
            var tab = this.value;
            document.querySelectorAll('[data-supervisor-tab]').forEach(function(b) {
                b.classList.toggle('active', b.dataset.supervisorTab === tab);
            });
            document.querySelectorAll('#supervisorScreen .admin-tab-content').forEach(function(c) {
                c.classList.remove('active');
            });
            var content = document.getElementById('supervisor' + tab.charAt(0).toUpperCase() + tab.slice(1) + 'Tab');
            if (content) content.classList.add('active');
            
            if (tab === 'notifications') {
                window.loadSupervisorNotifications();
                window.loadSupervisorCirclesForNotification();
            }
        });
    }
    
    // زر إكمال الورد اليومي
    var completeDailyBtn = document.getElementById('completeDailyJuzBtn');
    if (completeDailyBtn) {
        completeDailyBtn.addEventListener('click', window.completeDaily);
    }
    
    // زر عرض نص الجزء
    var viewTextBtn = document.getElementById('viewJuzTextBtn');
    if (viewTextBtn) {
        viewTextBtn.addEventListener('click', function() {
            var juz = state.memberData ? (state.memberData.currentJuz || 1) : 1;
            window.showJuzText(juz);
        });
    }
    
    // زر استماع للجزء
    var listenBtn = document.getElementById('listenJuzBtn');
    if (listenBtn) {
        listenBtn.addEventListener('click', function() {
            var juz = state.memberData ? (state.memberData.currentJuz || 1) : 1;
            window.openAudioPlayer(juz);
        });
    }
    
    // زر مشاركة
    var shareBtn = document.getElementById('shareJuzBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', window.openShareModal);
    }
    
    // زر إغلاق عارض النص
    var closeViewerBtn = document.getElementById('closeTextViewer');
    if (closeViewerBtn) {
        closeViewerBtn.addEventListener('click', function() {
            document.getElementById('juzTextViewer').style.display = 'none';
        });
    }
    
    // أزرار التنقل في النص
    var prevPageBtn = document.getElementById('prevPageBtn');
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', function() {
            var content = document.getElementById('juzTextContent');
            if (content) content.scrollBy({ top: -200, behavior: 'smooth' });
        });
    }
    var nextPageBtn = document.getElementById('nextPageBtn');
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', function() {
            var content = document.getElementById('juzTextContent');
            if (content) content.scrollBy({ top: 200, behavior: 'smooth' });
        });
    }
    
    // زر إضافة جزء إضافي
    var addExtraBtn = document.getElementById('addExtraJuzBtn');
    if (addExtraBtn) {
        addExtraBtn.addEventListener('click', window.showExtraJuzModal);
    }
    
    // زر تجديد المخزون العام
    var refillBtn = document.getElementById('refillExtraPoolBtn');
    if (refillBtn) {
        refillBtn.addEventListener('click', window.refillGlobalExtraJuz);
    }
    
    // زر إنشاء حلقة
    var createCircleBtn = document.getElementById('createCircleBtn');
    if (createCircleBtn) {
        createCircleBtn.addEventListener('click', window.createCircle);
    }
    
    // زر عرض التقرير
    var showReportBtn = document.getElementById('showReportBtn');
    if (showReportBtn) {
        showReportBtn.addEventListener('click', window.showCircleReport);
    }
    
    // زر التوزيع اليدوي
    var manualDistBtn = document.getElementById('manualDistributeBtn');
    if (manualDistBtn) {
        manualDistBtn.addEventListener('click', window.showManualDistribution);
    }
    
    // زر التوزيع في المودال
    var executeDistBtn = document.getElementById('executeDistributionBtn');
    if (executeDistBtn) {
        executeDistBtn.addEventListener('click', window.executeDistribution);
    }
    
    // أزرار الوضع الليلي
    var darkBtns = document.querySelectorAll('#darkModeToggleCircle, #darkModeToggleMain, #darkModeToggleAdmin, #darkModeToggleSupervisor');
    darkBtns.forEach(function(btn) {
        if (btn) btn.addEventListener('click', window.toggleDarkMode);
    });
    
    // زر حجم الخط
    var fontSizeBtn = document.getElementById('fontSizeBtn');
    if (fontSizeBtn) {
        fontSizeBtn.addEventListener('click', window.showFontSizeModal);
    }
    
    // أزرار حجم الخط في المودال
    var sizeBtns = document.querySelectorAll('.font-size-options .btn-size');
    sizeBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            window.setFontSize(this.dataset.size);
        });
    });
    
    // زر تسجيل الخروج
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (state.isGuest) {
                state.clear();
                Utils.showScreen('authScreen');
                Utils.showToast('👋 تم تسجيل الخروج', false);
                return;
            }
            if (confirm('⚠️ هل أنت متأكد من تسجيل الخروج؟')) {
                auth.signOut().then(function() {
                    state.clear();
                    Utils.showScreen('authScreen');
                    Utils.showToast('👋 تم تسجيل الخروج', false);
                });
            }
        });
    }
    
    // زر تسجيل الخروج من المدير
    var adminLogoutBtn = document.getElementById('adminLogoutBtn');
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', function() {
            if (confirm('⚠️ هل أنت متأكد من تسجيل الخروج؟')) {
                auth.signOut().then(function() {
                    state.clear();
                    Utils.showScreen('authScreen');
                    Utils.showToast('👋 تم تسجيل الخروج', false);
                });
            }
        });
    }
    
    var supervisorLogoutBtn = document.getElementById('supervisorLogoutBtn');
    if (supervisorLogoutBtn) {
        supervisorLogoutBtn.addEventListener('click', function() {
            if (confirm('⚠️ هل أنت متأكد من تسجيل الخروج؟')) {
                auth.signOut().then(function() {
                    state.clear();
                    Utils.showScreen('authScreen');
                    Utils.showToast('👋 تم تسجيل الخروج', false);
                });
            }
        });
    }
    
    // زر العودة من لوحة المدير
    var backToUserBtn = document.getElementById('backToUserBtn');
    if (backToUserBtn) {
        backToUserBtn.addEventListener('click', function() {
            Utils.showScreen('mainScreen');
        });
    }
    
    // زر العودة من اختيار الجزء
    var backToCirclesBtn = document.getElementById('backToCirclesBtn');
    if (backToCirclesBtn) {
        backToCirclesBtn.addEventListener('click', function() {
            Utils.showScreen('selectCircleScreen');
        });
    }
    
    // زر الخروج من شاشة اختيار الحلقة
    var exitToAuthBtn = document.getElementById('exitToAuthBtn');
    if (exitToAuthBtn) {
        exitToAuthBtn.addEventListener('click', function() {
            if (state.isGuest) {
                state.clear();
                Utils.showScreen('authScreen');
                return;
            }
            if (confirm('⚠️ هل أنت متأكد من تسجيل الخروج؟')) {
                auth.signOut().then(function() {
                    state.clear();
                    Utils.showScreen('authScreen');
                });
            }
        });
    }
    
    // زر تحديث الحلقات
    var refreshCirclesBtn = document.getElementById('refreshCirclesBtn');
    if (refreshCirclesBtn) {
        refreshCirclesBtn.addEventListener('click', window.refreshCircles);
    }
    
    // فلترة الحلقات
    var filterBtns = document.querySelectorAll('.filter-gender-btn');
    filterBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-gender-btn').forEach(function(b) {
                b.classList.remove('active');
                b.setAttribute('aria-checked', 'false');
            });
            this.classList.add('active');
            this.setAttribute('aria-checked', 'true');
            window.refreshCircles();
        });
    });
    
    // البحث في الحلقات
    var searchInput = document.getElementById('searchCircleInput');
    if (searchInput) {
        searchInput.addEventListener('input', window.refreshCircles);
    }
    
    // الانضمام برمز الحلقة
    var joinByCodeBtn = document.getElementById('joinByCodeDirectBtn');
    if (joinByCodeBtn) {
        joinByCodeBtn.addEventListener('click', function() {
            var code = document.getElementById('circleCodeInput').value.trim().toUpperCase();
            if (!code) { Utils.showToast('⚠️ أدخل رمز الحلقة', true); return; }
            window.joinCircleByCode(code);
        });
    }
    
    // تبديل إظهار/إخفاء كلمة السر
    var toggleBtns = document.querySelectorAll('.toggle-password');
    toggleBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
            var input = this.closest('.password-input-wrapper').querySelector('input');
            if (input) {
                input.type = input.type === 'password' ? 'text' : 'password';
                this.textContent = input.type === 'password' ? '👁️' : '🙈';
            }
        });
    });
    
    // تحديد نوع المستلم في رسائل الحلقة
    var recipientType = document.getElementById('messageRecipientType');
    if (recipientType) {
        recipientType.addEventListener('change', function() {
            var specificDiv = document.getElementById('specificMemberSelect');
            specificDiv.style.display = this.value === 'specific' ? 'block' : 'none';
        });
    }
    
    // زر الملف الشخصي
    var profileBtn = document.getElementById('profileBtnMain');
    if (profileBtn) {
        profileBtn.addEventListener('click', window.openProfileModal);
    }
    
    // حفظ الملف الشخصي
    var saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', window.saveProfile);
    }
    
    // زر تحديد جميع الإشعارات كمقروءة
    var markAllReadBtn = document.getElementById('markAllNotificationsRead');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', window.markAllNotificationsRead);
    }
    
    // زر حذف الإشعارات المقروءة
    var deleteAllReadBtn = document.getElementById('deleteAllReadNotifications');
    if (deleteAllReadBtn) {
        deleteAllReadBtn.addEventListener('click', window.deleteAllReadNotifications);
    }
    
    console.log('✅ تم ربط جميع الأحداث بنجاح');
}

// ==================== تشغيل التطبيق ====================
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

// ==================== تصدير الدوال للاستخدام في HTML ====================
window.Utils = Utils;
window.state = state;
window.ROLES = ROLES;
window.settingsManager = settingsManager;
window.adminManager = adminManager;
window.authService = authService;
window.hasPermission = hasPermission;
window.loadUserData = loadUserData;
window.updateUI = updateUI;
window.updateJuzProgressChart = updateJuzProgressChart;
window.loadCircleInfo = loadCircleInfo;
window.loadExtraProgress = loadExtraProgress;
window.loadMyJuzList = loadMyJuzList;
window.loadAchievements = loadAchievements;
window.loadUserNotifications = loadUserNotifications;
window.loadAdminData = loadAdminData;
window.loadSupervisorDashboard = loadSupervisorDashboard;
window.filterSupervisorMembers = filterSupervisorMembers;
window.refreshCircles = refreshCircles;
window.exitToAuth = exitToAuth;
window.updateExtraLimitBadge = updateExtraLimitBadge;
window.toggleDarkMode = toggleDarkMode;
window.setFontSize = setFontSize;
window.showFontSizeModal = showFontSizeModal;
window.joinCircleByCode = joinCircleByCode;
window.openProfileModal = openProfileModal;
window.saveProfile = saveProfile;
window.markNotificationRead = markNotificationRead;
window.deleteNotification = deleteNotification;
window.markAllNotificationsRead = markAllNotificationsRead;
window.deleteAllReadNotifications = deleteAllReadNotifications;
window.freezeMember = freezeMember;
window.unfreezeMember = unfreezeMember;
window.adminFreezeMember = adminFreezeMember;
window.adminUnfreezeMember = adminUnfreezeMember;
window.showJuzText = showJuzText;
window.openAudioPlayer = openAudioPlayer;
window.stopAudioPlayback = stopAudioPlayback;
window.openShareModal = openShareModal;
window.shareToWhatsApp = shareToWhatsApp;
window.shareToTelegram = shareToTelegram;
window.shareToTwitter = shareToTwitter;
window.copyShareText = copyShareText;
window.leaveCircle = leaveCircle;
window.showExtraJuzModal = showExtraJuzModal;
window.completeExtraJuz = completeExtraJuz;
window.openCircleManagement = openCircleManagement;
window.regenerateInviteCode = regenerateInviteCode;
window.makeCircleAdmin = makeCircleAdmin;
window.removeFromCircle = removeFromCircle;
window.editCircle = editCircle;
window.deleteCircle = deleteCircle;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.showCircleAdmins = showCircleAdmins;
window.assignAdminFromAdminPanel = assignAdminFromAdminPanel;
window.removeAdminFromAdminPanel = removeAdminFromAdminPanel;
window.openChangeCodeModal = openChangeCodeModal;
window.generateCircleCode = generateCircleCode;
window.saveCircleCode = saveCircleCode;
window.supervisorFreezeMember = supervisorFreezeMember;
window.supervisorUnfreezeMember = supervisorUnfreezeMember;
window.supervisorViewMember = supervisorViewMember;
window.supervisorAssignAdmin = supervisorAssignAdmin;
window.supervisorRemoveAdmin = supervisorRemoveAdmin;
window.exportSupervisorReport = exportSupervisorReport;
window.exportSupervisorExcel = exportSupervisorExcel;
window.exportSupervisorPDF = exportSupervisorPDF;
window.showAssignSupervisorModal = showAssignSupervisorModal;
window.confirmAssignSupervisor = confirmAssignSupervisor;
window.removeSupervisor = removeSupervisor;
window.loadSettings = loadSettings;
window.loadShareMessage = loadShareMessage;
window.saveShareMessage = saveShareMessage;
window.adminLogin = adminLogin;
window.toggleAdminSection = toggleAdminSection;
window.changeAdminCredentials = changeAdminCredentials;
window.createCircle = createCircle;
window.copyInviteCode = copyInviteCode;
window.sendAdminNotification = sendAdminNotification;
window.sendSupervisorNotification = sendSupervisorNotification;
window.sendCircleAdminMessage = sendCircleAdminMessage;
window.loadAdminNotifications = loadAdminNotifications;
window.loadSupervisorNotifications = loadSupervisorNotifications;
window.deleteAdminNotification = deleteAdminNotification;
window.deleteSupervisorNotification = deleteSupervisorNotification;
window.clearAllAdminNotifications = clearAllAdminNotifications;
window.exportCirclesToExcel = exportCirclesToExcel;
window.exportUsersFullCSV = exportUsersFullCSV;
window.exportActiveUsersToWhatsApp = exportActiveUsersToWhatsApp;
window.exportInactiveUsersToWhatsApp = exportInactiveUsersToWhatsApp;
window.generateFullReport = generateFullReport;
window.updateSetting = updateSetting;
window.updateReminderTime = updateReminderTime;
window.confirmClearAllData = confirmClearAllData;
window.resetAllSettings = resetAllSettings;
window.exportReportPDF = exportReportPDF;
window.exportReportExcel = exportReportExcel;
window.exportReportCSV = exportReportCSV;
window.exportReportImage = exportReportImage;
window.showCircleReport = showCircleReport;

console.log('✅ تم تحميل تطبيق ختمتي - الإصدار 7.4 مع إصلاح مشكلة رسالة المشاركة');
