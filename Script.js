// ==========================================
// 0. EMAILJS SETUP
// ==========================================
const EMAILJS_PUBLIC_KEY = "7WXeQLSjSBxjUgfDqz";
const EMAILJS_SERVICE_ID = "service_oosiyfo";
const EMAILJS_TEMPLATE_ID = "template_etf63pn"; // تأكد أن التمبلت في EmailJS يحتوي على المتغير {{verification_code}}

if (typeof emailjs !== "undefined") {
    emailjs.init(EMAILJS_PUBLIC_KEY);
}

// ==========================================
// 1. Core Layout & Form Navigation Utilities
// ==========================================

function toggleForm() {
    const login = document.getElementById('login-form');
    const signup = document.getElementById('signup-form');
    const verifySection = document.getElementById('verification-section');

    if (login && signup) {
        if (login.style.display === "none") {
            login.style.display = "block";
            signup.style.display = "none";
            if (verifySection) verifySection.style.display = "none";
        } else {
            login.style.display = "none";
            signup.style.display = "block";
            if (verifySection) verifySection.style.display = "none";
        }
    }
}

// أداة تنقل مخصصة لإظهار واجهة إدخال الكود الرقمي
function showVerificationInputSection() {
    const login = document.getElementById('login-form');
    const signup = document.getElementById('signup-form');
    let verifySection = document.getElementById('verification-section');

    if (login) login.style.display = "none";
    if (signup) signup.style.display = "none";

    // إذا لم يكن صندوق التحقق موجوداً في الـ HTML، سيتم إنشاؤه تلقائياً
    if (!verifySection) {
        verifySection = document.createElement('div');
        verifySection.id = 'verification-section';
        verifySection.className = 'auth-form'; // لكي يأخذ نفس ستايل الفيس بوك أو التصميم الخاص بك
        verifySection.style.cssText = "max-width:400px; margin:20px auto; padding:20px; background:#fff; border-radius:10px; box-shadow:0 4px 12px rgba(0,0,0,0.1); text-align:center;";
        
        // إضافته بجانب الفورمز الأخرى
        const container = login ? login.parentNode : document.body;
        container.appendChild(verifySection);
    }

    const email = localStorage.getItem('userEmail') || '';
    verifySection.style.display = "block";
    verifySection.innerHTML = `
        <h3 style="margin-bottom:15px; color:#333;">🔒 تأكيد الحساب</h3>
        <p style="font-size:14px; color:#666; margin-bottom:20px;">لقد أرسلنا كود تفعيل مكون من 6 أرقام إلى:<br><strong>${email}</strong></p>
        <input type="text" id="input-verify-code" placeholder="أدخل الكود المكون من 6 أرقام" maxlength="6" style="width:100%; padding:12px; margin-bottom:15px; border:1px solid #ccc; border-radius:5px; text-align:center; font-size:18px; letter-spacing:4px;">
        <button onclick="handleCodeVerification()" style="width:100%; padding:12px; background:#1a6b4a; color:#fff; border:none; border-radius:5px; font-weight:bold; cursor:pointer; font-size:16px;">تأكيد الكود ودخول</button>
        <p style="margin-top:15px; font-size:13px;">لم يصلك الكود؟ <span style="color:#1a6b4a; cursor:pointer; text-decoration:underline;" onclick="resendVerification()">إعادة إرسال الكود</span></p>
        <p style="margin-top:10px; font-size:13px;"><span style="color:#666; cursor:pointer; text-decoration:underline;" onclick="toggleForm()">العودة لتسجيل الدخول</span></p>
    `;
}

// Configure Toast notifications using SweetAlert2
const Toast = typeof Swal !== "undefined" ? Swal.mixin({
    toast: true,
    position: "top-end", 
    showConfirmButton: false,
    timer: 3000, 
    timerProgressBar: true,
}) : null;

// ==========================================
// 1.5 Password Security - Hashing Utilities
// ==========================================

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(plaintextPassword, storedHash) {
    const hash = await hashPassword(plaintextPassword);
    return hash === storedHash;
}

// ==========================================
// 1.5b  Verification Code Generator (6 Digits)
// ==========================================

// تعديل الدالة لإنشاء كود مكون من 6 أرقام بدلاً من الرابط الطويل
function generateVerificationToken() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ==========================================
// 1.5c  Send Verification Email via EmailJS
// ==========================================

async function sendVerificationEmail(userName, userEmail, code) {
    // تعديل البرامترات لترسل الكود الرقمي مباشرة داخل الإيميل
    const templateParams = {
        to_name: userName,
        to_email: userEmail,
        verification_code: code, // تأكد إنك كاتب في تمبلت EmailJS هكذا: {{verification_code}}
        message: `كود التحقق الخاص بك هو: ${code}`
    };

    try {
        const response = await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            templateParams
        );
        console.log("✅ Verification email sent:", response.status, response.text);
        return true;
    } catch (error) {
        console.error("❌ Failed to send verification email:", error);
        return false;
    }
}

// ==========================================
// 1.5d  Resend Verification Email
// ==========================================

async function resendVerification() {
    const email = localStorage.getItem('userEmail');
    const name = localStorage.getItem('loggedInUser');
    
    if (!email || !name) {
        if (Toast) Toast.fire({ icon: 'error', title: 'No pending verification found. Please sign up again.' });
        return;
    }

    await fetchCloudUsers();
    const user = allGlobalUsers.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
        if (Toast) Toast.fire({ icon: 'error', title: 'User not found in database.' });
        return;
    }

    user.verificationToken = generateVerificationToken(); // إنشاء كود 6 أرقام جديد
    user.emailVerified = false;
    await saveCloudUsers();

    const sent = await sendVerificationEmail(user.name, user.email, user.verificationToken);
    if (sent) {
        if (Toast) Toast.fire({ icon: 'success', title: 'Verification code resent! Check your inbox.' });
        showVerificationInputSection(); // يفتح مربع الكود لو مش مفتوح
    } else {
        
    }
}

// ==========================================
// 1.5e  Handle Code Verification (التحقق من الكود الرقمي)
// ==========================================

async function handleCodeVerification() {
    const inputCode = document.getElementById('input-verify-code').value.trim();
    const email = localStorage.getItem('userEmail');

    if (!inputCode) {
        if (Toast) Toast.fire({ icon: 'warning', title: 'من فضلك أدخل كود التحقق أولاً!' });
        return;
    }

    await fetchCloudUsers();
    const user = allGlobalUsers.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
        if (Toast) Toast.fire({ icon: 'error', title: 'حدث خطأ، لم نجد الحساب.' });
        return;
    }

    // مطابقة الكود اللي المستخدم كتبه بالكود اللي مسجل في الحساب
    if (user.verificationToken === inputCode) {
        user.emailVerified = true;
        user.verificationToken = ""; // تنظيف الكود بعد الاستخدام للأمان
        await saveCloudUsers();

        localStorage.setItem('emailVerified', 'true');

        if (Toast) Toast.fire({ icon: 'success', title: `تم تفعيل حسابك بنجاح! أهلاً بك يا ${user.name}` });
        
        // التحويل إلى صفحة الداشبورد فوراً
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
    } else {
        if (Toast) Toast.fire({ icon: 'error', title: 'الكود غير صحيح! يرجى المحاولة مرة أخرى.' });
    }
}

// ==========================================
// 1.6 SIGNUP HANDLER (WITH EMAIL VERIFICATION)
// ==========================================

async function handleSignup() {
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();

    if (!name || !email || !password) {
        if (Toast) Toast.fire({ icon: 'warning', title: 'All fields are required!' });
        return;
    }

    if (!email.includes('@') || !email.includes('.')) {
        if (Toast) Toast.fire({ icon: 'error', title: 'Please enter a valid email address.' });
        return;
    }

    if (password.length < 6) {
        if (Toast) Toast.fire({ icon: 'error', title: 'Password must be at least 6 characters.' });
        return;
    }

    await fetchCloudUsers();

    const existingUser = allGlobalUsers.find(u => 
        u.name.toLowerCase() === name.toLowerCase() || 
        (u.email && u.email.toLowerCase() === email.toLowerCase())
    );

    if (existingUser) {
        if (existingUser.name.toLowerCase() === name.toLowerCase()) {
            if (Toast) Toast.fire({ icon: 'error', title: 'Username already taken!' });
        } else {
            if (Toast) Toast.fire({ icon: 'error', title: 'Email already registered!' });
        }
        return;
    }

    const verificationToken = generateVerificationToken(); // كود 6 أرقام عشوائي

    const hashedPw = await hashPassword(password);
    const newUser = {
        name: name,
        email: email.toLowerCase(),
        password: hashedPw,
        photo: DEFAULT_AVATAR,
        createdAt: new Date().toISOString(),
        verificationToken: verificationToken,
        emailVerified: false
    };

    allGlobalUsers.push(newUser);
    await saveCloudUsers();

    localStorage.setItem('loggedInUser', name);
    localStorage.setItem('userEmail', email.toLowerCase());
    localStorage.setItem('emailVerified', 'false');

    const sent = await sendVerificationEmail(name, email.toLowerCase(), verificationToken);

    if (sent) {
        if (Toast) Toast.fire({ 
            icon: 'success', 
            title: 'تم إنشاء الحساب! تم إرسال كود التفعيل لإيميلك.',
            text: 'برجاء كتابة الكود لتفعيل الحساب.'
        });
        // نقله فوراً لصفحة كتابة الكود بعد ثانيتين
        setTimeout(() => {
            showVerificationInputSection();
        }, 2000);
    } else {
        if (Toast) Toast.fire({ 
            icon: 'warning', 
            title: 'Account created but email failed to send',
            text: 'Check EmailJS settings. You can resend from the login page.'
        });
        setTimeout(() => {
            toggleForm();
            const loginEmail = document.getElementById('login-email');
            if (loginEmail) loginEmail.value = email.toLowerCase();
            showVerifyNotice(email.toLowerCase());
        }, 2000);
    }
}

// ==========================================
// 1.7 LOGIN HANDLER (WITH VERIFICATION CHECK)
// ==========================================

async function handleLogin() {
    const emailOrName = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!emailOrName || !password) {
        if (Toast) Toast.fire({ icon: 'warning', title: 'Please fill in all fields!' });
        return;
    }

    await fetchCloudUsers();

    const user = allGlobalUsers.find(u => 
        u.name.toLowerCase() === emailOrName.toLowerCase() ||
        (u.email && u.email.toLowerCase() === emailOrName.toLowerCase())
    );

    if (!user) {
        if (allGlobalUsers.length === 0) {
            if (Toast) Toast.fire({ 
                icon: 'error', 
                title: 'No users in database!', 
                text: 'The cloud sync returned empty. Try signing up first.'
            });
        } else {
            if (Toast) Toast.fire({ 
                icon: 'error', 
                title: 'User not found!', 
                text: 'Check your email/username. We have ' + allGlobalUsers.length + ' users registered.'
            });
        }
        return;
    }

    const passwordMatch = await verifyPassword(password, user.password);
    if (!passwordMatch) {
        if (Toast) Toast.fire({ icon: 'error', title: 'Incorrect password!' });
        return;
    }

    if (user.emailVerified !== true) {
        localStorage.setItem('loggedInUser', user.name);
        localStorage.setItem('userEmail', user.email || '');
        localStorage.setItem('emailVerified', 'false');

        showVerifyNotice(user.email || '');
        
        if (Toast) {
            Toast.fire({
                icon: 'warning',
                title: 'حسابك غير مفعل!',
                text: `يرجى إدخال كود التفعيل المرسل إلى ${user.email}.`,
                timer: 5000,
                showConfirmButton: true,
                confirmButtonText: 'إدخال الكود / إعادة إرسال',
                confirmButtonColor: '#1a6b4a'
            }).then((result) => {
                if (result.isConfirmed) {
                    // تحويل المستخدم مباشرة لواجهة إدخال الكود
                    showVerificationInputSection();
                }
            });
        }
        return;
    }

    localStorage.setItem('loggedInUser', user.name);
    localStorage.setItem('userEmail', user.email || '');
    localStorage.setItem('emailVerified', 'true');

    if (Toast) Toast.fire({ icon: 'success', title: `Welcome back, ${user.name}!` });
    console.log("✅ Login success for:", user.name);
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
}

// ==========================================
// 1.8  Show Verification Notice on Login Form
// ==========================================

function showVerifyNotice(email) {
    let noticeContainer = document.getElementById('verify-status-bar');
    if (!noticeContainer) {
        const loginForm = document.getElementById('login-form');
        if (!loginForm) return;
        noticeContainer = document.createElement('div');
        noticeContainer.id = 'verify-status-bar';
        loginForm.insertBefore(noticeContainer, loginForm.firstChild);
    }
    
    noticeContainer.style.display = 'block';
    noticeContainer.innerHTML = `
        <div style="background:#fff3cd;border:1px solid #ffeeba;border-radius:10px;padding:12px;margin:10px 0;font-size:13px;color:#856404;text-align:center;line-height:1.6;">
            ⚠️ حسابك بحاجة لتفعيل الإيميل: <strong>${email}</strong><br>
            <span style="color:#1a6b4a;cursor:pointer;text-decoration:underline;font-weight:600;" onclick="showVerificationInputSection()">اضغط هنا لإدخال كود التفعيل أو إعادة إرساله</span>
        </div>
    `;
}

// ==========================================
// 2. Cloud Synchronization Infrastructure
// ==========================================

const CLOUD_API_URL = "https://api.jsonbin.io/v3/b/6653bb85e41b4d34e4f9b8c2";
const API_KEY = "$2a$1$2a$10$ggN3YuYQRJUvi3fcIDY9rOJcSCJvr.GdFtntT1cae15qvaa5RCW1G";
const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

let allGlobalUsers = [];
let friendRequests = [];
let connectionsList = []; 
let globalChatMessages = []; 

let activeChatFriend = ""; 
let lastMessageCount = 0; 

async function fetchCloudUsers() {
    try {
        const response = await fetch(CLOUD_API_URL + "/latest?_ts=" + Date.now(), {
            method: "GET",
            mode: "cors",
            cache: "no-cache",
            headers: { 
                "X-Master-Key": API_KEY,
                "Accept": "application/json"
            }
        });
        
        if (!response.ok) {
            console.error("Cloud Fetch HTTP Error:", response.status, response.statusText);
            const localUsers = JSON.parse(localStorage.getItem('allUsersList'));
            if (localUsers && localUsers.length > 0) {
                allGlobalUsers = localUsers;
                friendRequests = JSON.parse(localStorage.getItem('friendRequests')) || [];
                connectionsList = JSON.parse(localStorage.getItem('connectionsList')) || [];
                console.log("Used localStorage fallback (data found)");
            } else {
                console.warn("No cloud OR localStorage data available");
            }
            return;
        }
        
        const resData = await response.json();
        const record = resData.record;
        
        if (record && record.allUsersList && Array.isArray(record.allUsersList)) {
            allGlobalUsers = record.allUsersList || [];
            friendRequests = record.friendRequests || [];
            connectionsList = record.connectionsList || [];
            globalChatMessages = record.globalChatMessages || [];
            
            localStorage.setItem('allUsersList', JSON.stringify(allGlobalUsers));
            localStorage.setItem('friendRequests', JSON.stringify(friendRequests));
            localStorage.setItem('connectionsList', JSON.stringify(connectionsList));
            
            console.log(`✅ Cloud sync OK: ${allGlobalUsers.length} users loaded`);
        } else {
            console.warn("Cloud returned empty/invalid data structure");
        }
    } catch (error) {
        console.error("Cloud Fetch Error: ", error);
        const localUsers = JSON.parse(localStorage.getItem('allUsersList'));
        if (localUsers && localUsers.length > 0) {
            allGlobalUsers = localUsers;
            friendRequests = JSON.parse(localStorage.getItem('friendRequests')) || [];
            connectionsList = JSON.parse(localStorage.getItem('connectionsList')) || [];
            console.log("Used localStorage fallback after fetch error (data found)");
        }
    }
}

async function saveCloudUsers() {
    localStorage.setItem('allUsersList', JSON.stringify(allGlobalUsers));
    localStorage.setItem('friendRequests', JSON.stringify(friendRequests));
    localStorage.setItem('connectionsList', JSON.stringify(connectionsList));
    
    try {
        const response = await fetch(CLOUD_API_URL, {
            method: "PUT",
            mode: "cors",
            cache: "no-store",
            headers: {
                "Content-Type": "application/json",
                "X-Master-Key": API_KEY
            },
            body: JSON.stringify({
                friendRequests: friendRequests,
                allUsersList: allGlobalUsers,
                connectionsList: connectionsList,
                globalChatMessages: globalChatMessages
            })
        });
        
        if (!response.ok) {
            console.error("Cloud Save HTTP Error:", response.status, response.statusText);
        } else {
            console.log("✅ Cloud save OK");
        }
    } catch (error) {
        console.error("Cloud Save Error: ", error);
    }
}

// ==========================================
// 3. Dashboard Verification Check
// ==========================================

function checkEmailVerified() {
    const verified = localStorage.getItem('emailVerified');
    if (verified !== 'true') {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// ==========================================
// 4. Auto-check verification status on page load
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    const email = localStorage.getItem('userEmail');
    const verified = localStorage.getItem('emailVerified');
    if (email && verified === 'false') {
        showVerifyNotice(email);
    }
});
