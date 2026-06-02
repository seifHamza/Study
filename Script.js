// ============================================================
// 0. EMAILJS SETUP — REPLACE WITH YOUR OWN KEYS IF NEEDED
// ============================================================
// ⚠️ These are the working keys from your original code
const EMAILJS_PUBLIC_KEY = "7WXeQLSjSBxjUgfDqz";
const EMAILJS_SERVICE_ID = "service_oosiyfo";
const EMAILJS_TEMPLATE_ID = "template_etf63pn"; // Template must have {{verification_code}} variable

if (typeof emailjs !== "undefined") {
    emailjs.init(EMAILJS_PUBLIC_KEY);
}

// ============================================================
// 1. CLOUD SYNC INFRASTRUCTURE
// ============================================================

const CLOUD_API_URL = "https://api.jsonbin.io/v3/b/6653bb85e41b4d34e4f9b8c2";
// ✅ FIXED API KEY — removed invalid $2a$1$ prefix
const API_KEY = "$2a$10$ggN3YuYQRJUvi3fcIDY9rOJcSCJvr.GdFtntT1cae15qvaa5RCW1G";
const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

let allGlobalUsers = [];
let friendRequests = [];
let connectionsList = [];
let globalChatMessages = [];

// Toast notifications using SweetAlert2
const Toast = typeof Swal !== "undefined" ? Swal.mixin({
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
}) : null;

// ============================================================
// 2. PASSWORD SECURITY — SHA-256 HASHING
// ============================================================

/**
 * Hash a password using SHA-256
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hex-encoded hash
 */
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a plaintext password against a stored hash
 * @param {string} plaintextPassword - The password to check
 * @param {string} storedHash - The stored SHA-256 hash
 * @returns {Promise<boolean>} - Whether they match
 */
async function verifyPassword(plaintextPassword, storedHash) {
    const hash = await hashPassword(plaintextPassword);
    return hash === storedHash;
}

// ============================================================
// 3. VERIFICATION CODE GENERATOR (6 DIGITS)
// ============================================================

/**
 * Generate a random 6-digit verification code
 * @returns {string} - 6-digit code as string
 */
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============================================================
// 4. SEND VERIFICATION EMAIL VIA EMAILJS
// ============================================================

/**
 * Send a 6-digit verification code via EmailJS
 * @param {string} userName - Recipient's name
 * @param {string} userEmail - Recipient's email
 * @param {string} code - 6-digit verification code
 * @returns {Promise<boolean>} - Whether the email was sent successfully
 */
async function sendVerificationEmail(userName, userEmail, code) {
    const templateParams = {
        to_name: userName,
        to_email: userEmail,
        verification_code: code,
        message: `Your verification code is: ${code}`
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

// ============================================================
// 5. CLOUD FETCH & SAVE FUNCTIONS
// ============================================================

/**
 * Fetch all users and data from JSONBin cloud
 */
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
            // Fallback to localStorage
            const localUsers = JSON.parse(localStorage.getItem('allUsersList'));
            if (localUsers && localUsers.length > 0) {
                allGlobalUsers = localUsers;
                friendRequests = JSON.parse(localStorage.getItem('friendRequests')) || [];
                connectionsList = JSON.parse(localStorage.getItem('connectionsList')) || [];
                console.log("Used localStorage fallback (data found)");
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

            // Cache locally
            localStorage.setItem('allUsersList', JSON.stringify(allGlobalUsers));
            localStorage.setItem('friendRequests', JSON.stringify(friendRequests));
            localStorage.setItem('connectionsList', JSON.stringify(connectionsList));

            console.log(`✅ Cloud sync OK: ${allGlobalUsers.length} users loaded`);
        } else {
            console.warn("Cloud returned empty/invalid data structure");
            // Fallback to localStorage
            const localUsers = JSON.parse(localStorage.getItem('allUsersList'));
            if (localUsers && localUsers.length > 0) {
                allGlobalUsers = localUsers;
            }
        }
    } catch (error) {
        console.error("Cloud Fetch Error: ", error);
        // Fallback to localStorage
        const localUsers = JSON.parse(localStorage.getItem('allUsersList'));
        if (localUsers && localUsers.length > 0) {
            allGlobalUsers = localUsers;
            friendRequests = JSON.parse(localStorage.getItem('friendRequests')) || [];
            connectionsList = JSON.parse(localStorage.getItem('connectionsList')) || [];
            console.log("Used localStorage fallback after fetch error (data found)");
        }
    }
}

/**
 * Save all users and data to JSONBin cloud and localStorage
 */
async function saveCloudUsers() {
    // Always save locally first
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

// ============================================================
// 6. UI / FORM NAVIGATION FUNCTIONS
// ============================================================

/**
 * Toggle between Login and Signup forms
 */
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

/**
 * Show the 6-digit verification code input section
 */
function showVerificationInputSection() {
    const login = document.getElementById('login-form');
    const signup = document.getElementById('signup-form');
    const container = document.querySelector('.container');
    let verifySection = document.getElementById('verification-section');

    if (login) login.style.display = "none";
    if (signup) signup.style.display = "none";

    // Create verification section if it doesn't exist
    if (!verifySection) {
        verifySection = document.createElement('div');
        verifySection.id = 'verification-section';
        verifySection.className = 'auth-form';
        if (container) {
            container.appendChild(verifySection);
        }
    }

    const email = localStorage.getItem('userEmail') || '';
    verifySection.style.display = "block";
    verifySection.innerHTML = `
        <h3 style="margin-bottom:15px; color:#333;">🔒 Account Verification</h3>
        <p style="font-size:14px; color:#666; margin-bottom:20px;">
            We sent a 6-digit verification code to:<br>
            <strong>${email}</strong>
        </p>
        <input type="text" id="input-verify-code" placeholder="Enter 6-digit code" maxlength="6" 
               style="width:100%; padding:12px; margin-bottom:15px; border:2px solid #d4af37; border-radius:5px; text-align:center; font-size:18px; letter-spacing:4px; outline:none;">
        <button onclick="handleCodeVerification()" 
                style="width:100%; padding:12px; background:linear-gradient(135deg, #0a3d2e, #1a6b4a); color:#fff; border:none; border-radius:5px; font-weight:bold; cursor:pointer; font-size:16px;">
            Verify & Enter
        </button>
        <p style="margin-top:15px; font-size:13px;">
            Didn't receive the code? 
            <span style="color:#1a6b4a; cursor:pointer; text-decoration:underline;" onclick="resendVerification()">Resend code</span>
        </p>
        <p style="margin-top:10px; font-size:13px;">
            <span style="color:#666; cursor:pointer; text-decoration:underline;" onclick="toggleForm()">Back to login</span>
        </p>
    `;

    // Focus the input field
    setTimeout(() => {
        const input = document.getElementById('input-verify-code');
        if (input) input.focus();
    }, 100);
}

/**
 * Show a verification notice banner on the login form
 * @param {string} email - The email that needs verification
 */
function showVerifyNotice(email) {
    const statusBar = document.getElementById('verify-status-bar');
    if (!statusBar) return;
    statusBar.style.display = 'block';
    statusBar.innerHTML = `
        <div style="background:#fff3cd;border:1px solid #ffeeba;border-radius:10px;padding:12px;margin:10px 0;font-size:13px;color:#856404;text-align:center;line-height:1.6;">
            ⚠️ Your account needs email verification: <strong>${email}</strong><br>
            <span style="color:#1a6b4a;cursor:pointer;text-decoration:underline;font-weight:600;" onclick="showVerificationInputSection()">
                Click here to enter the verification code or resend it
            </span>
        </div>
    `;
}

// ============================================================
// 7. VERIFICATION CODE HANDLING
// ============================================================

/**
 * Handle the 6-digit code verification submission
 */
async function handleCodeVerification() {
    const inputCode = document.getElementById('input-verify-code').value.trim();
    const email = localStorage.getItem('userEmail');

    if (!inputCode) {
        if (Toast) {
            Toast.fire({ icon: 'warning', title: 'Please enter the verification code!' });
        }
        return;
    }

    if (inputCode.length !== 6 || !/^\d{6}$/.test(inputCode)) {
        if (Toast) {
            Toast.fire({ icon: 'warning', title: 'Code must be exactly 6 digits!' });
        }
        return;
    }

    await fetchCloudUsers();
    const user = allGlobalUsers.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
        if (Toast) {
            Toast.fire({ icon: 'error', title: 'Error: Account not found.' });
        }
        return;
    }

    // Match the code
    if (user.verificationToken === inputCode) {
        user.emailVerified = true;
        user.verificationToken = ""; // Clear for security
        await saveCloudUsers();

        localStorage.setItem('emailVerified', 'true');

        if (Toast) {
            Toast.fire({ icon: 'success', title: `Account verified! Welcome, ${user.name}!` });
        }

        // Redirect to dashboard
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
    } else {
        if (Toast) {
            Toast.fire({ icon: 'error', title: 'Incorrect code! Please try again.' });
        }
    }
}

/**
 * Resend the 6-digit verification code
 */
async function resendVerification() {
    const email = localStorage.getItem('userEmail');
    const name = localStorage.getItem('loggedInUser');

    if (!email || !name) {
        if (Toast) {
            Toast.fire({ icon: 'error', title: 'No pending verification found. Please sign up again.' });
        }
        return;
    }

    await fetchCloudUsers();
    const user = allGlobalUsers.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
        if (Toast) {
            Toast.fire({ icon: 'error', title: 'User not found in database.' });
        }
        return;
    }

    // Generate a new 6-digit code
    user.verificationToken = generateVerificationCode();
    user.emailVerified = false;
    await saveCloudUsers();

    const sent = await sendVerificationEmail(user.name, user.email, user.verificationToken);
    if (sent) {
        if (Toast) {
            Toast.fire({ icon: 'success', title: 'Verification code resent! Check your inbox.' });
        }
        showVerificationInputSection();
    } else {
        if (Toast) {
            Toast.fire({ icon: 'error', title: 'Failed to send. Check EmailJS settings.' });
        }
    }
}

// ============================================================
// 8. SIGNUP HANDLER (WITH EMAIL VERIFICATION)
// ============================================================

/**
 * Handle user signup form submission
 */
async function handleSignup() {
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value.trim();

    // --- Validation ---
    if (!name || !email || !password) {
        if (Toast) {
            Toast.fire({ icon: 'warning', title: 'All fields are required!' });
        }
        return;
    }

    if (!email.includes('@') || !email.includes('.')) {
        if (Toast) {
            Toast.fire({ icon: 'error', title: 'Please enter a valid email address.' });
        }
        return;
    }

    if (password.length < 6) {
        if (Toast) {
            Toast.fire({ icon: 'error', title: 'Password must be at least 6 characters.' });
        }
        return;
    }

    await fetchCloudUsers();

    // --- Check for duplicates ---
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

    // --- Create new user ---
    const verificationToken = generateVerificationCode();
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

    // Store partial login state
    localStorage.setItem('loggedInUser', name);
    localStorage.setItem('userEmail', email.toLowerCase());
    localStorage.setItem('emailVerified', 'false');

    // --- Send verification email ---
    const sent = await sendVerificationEmail(name, email.toLowerCase(), verificationToken);

    if (sent) {
        if (Toast) {
            Toast.fire({ 
                icon: 'success', 
                title: 'Account created! Verification code sent to your email.',
                timer: 3000
            });
        }
        // Show verification input section after a brief delay
        setTimeout(() => {
            showVerificationInputSection();
        }, 2000);
    } else {
        if (Toast) {
            Toast.fire({ 
                icon: 'warning', 
                title: 'Account created but email failed to send',
                text: 'Check EmailJS settings. You can resend from the login page.'
            });
        }
        setTimeout(() => {
            toggleForm();
            const loginEmail = document.getElementById('login-email');
            if (loginEmail) loginEmail.value = email.toLowerCase();
            showVerifyNotice(email.toLowerCase());
        }, 2000);
    }
}

// ============================================================
// 9. LOGIN HANDLER (WITH VERIFICATION CHECK)
// ============================================================

/**
 * Handle user login form submission
 */
async function handleLogin() {
    const emailOrName = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!emailOrName || !password) {
        if (Toast) Toast.fire({ icon: 'warning', title: 'Please fill in all fields!' });
        return;
    }

    await fetchCloudUsers();

    // Find user by email or username
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

    // Verify password using SHA-256 hash
    const passwordMatch = await verifyPassword(password, user.password);
    if (!passwordMatch) {
        if (Toast) Toast.fire({ icon: 'error', title: 'Incorrect password!' });
        return;
    }

    // Check if email is verified
    if (user.emailVerified !== true) {
        localStorage.setItem('loggedInUser', user.name);
        localStorage.setItem('userEmail', user.email || '');
        localStorage.setItem('emailVerified', 'false');

        showVerifyNotice(user.email || '');

        if (Toast) {
            Toast.fire({
                icon: 'warning',
                title: 'Account not verified!',
                text: `Please enter the verification code sent to ${user.email}.`,
                timer: 5000,
                showConfirmButton: true,
                confirmButtonText: 'Enter code / Resend',
                confirmButtonColor: '#1a6b4a'
            }).then((result) => {
                if (result.isConfirmed) {
                    showVerificationInputSection();
                }
            });
        }
        return;
    }

    // Email verified — allow login
    localStorage.setItem('loggedInUser', user.name);
    localStorage.setItem('userEmail', user.email || '');
    localStorage.setItem('emailVerified', 'true');

    if (Toast) Toast.fire({ icon: 'success', title: `Welcome back, ${user.name}!` });
    console.log("✅ Login success for:", user.name);
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
}

// ============================================================
// 10. FORGOT PASSWORD HANDLERS
// ============================================================

let targetUserEmail = "";

/**
 * Handle "Find Account" button click in forgot password modal
 */
async function handleFindAccount() {
    const emailQuery = document.getElementById('forgot-email-input').value.trim().toLowerCase();
    if (emailQuery === "") {
        Swal.fire('Alert', 'Please type your email address.', 'warning');
        return;
    }

    await fetchCloudUsers();

    const accountFound = allGlobalUsers.find(user => user.email === emailQuery);

    if (accountFound) {
        targetUserEmail = accountFound.email;
        document.getElementById('forgot-step-1').style.display = 'none';
        document.getElementById('forgot-step-2').style.display = 'block';
        document.getElementById('forgot-new-password').focus();
    } else {
        Swal.fire({ icon: 'error', title: 'Account Not Found', text: 'This email is not registered.' });
    }
}

/**
 * Handle "Save New Password" button click in forgot password modal
 */
async function handleSaveNewPassword() {
    const newPasswordValue = document.getElementById('forgot-new-password').value.trim();

    if (newPasswordValue === "") {
        Swal.fire('Alert', 'Password field cannot be empty.', 'warning');
        return;
    }

    if (newPasswordValue.length < 6) {
        Swal.fire('Alert', 'Password must be at least 6 characters.', 'warning');
        return;
    }

    let userIndex = allGlobalUsers.findIndex(user => user.email === targetUserEmail);

    if (userIndex !== -1) {
        // Hash the new password
        const hashedPw = await hashPassword(newPasswordValue);
        allGlobalUsers[userIndex].password = hashedPw;
        await saveCloudUsers();

        Swal.fire({
            icon: 'success',
            title: 'Success!',
            text: 'Password updated successfully!',
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            closeForgotModal();
            document.getElementById('login-email').value = targetUserEmail;
            document.getElementById('login-password').value = '';
        });
    }
}

/**
 * Open the forgot password modal
 */
function openForgotModal() {
    document.getElementById('forgot-step-1').style.display = 'block';
    document.getElementById('forgot-step-2').style.display = 'none';
    document.getElementById('forgot-modal').style.display = 'flex';
    document.getElementById('forgot-email-input').focus();
}

/**
 * Close the forgot password modal
 */
function closeForgotModal() {
    document.getElementById('forgot-modal').style.display = 'none';
    document.getElementById('forgot-email-input').value = '';
    document.getElementById('forgot-new-password').value = '';
    targetUserEmail = "";
}

// ============================================================
// 11. DASHBOARD VERIFICATION CHECK
// ============================================================

/**
 * Check if the current user's email is verified
 * Used on dashboard pages to redirect unverified users
 * @returns {boolean} - Whether the user is verified
 */
function checkEmailVerified() {
    const verified = localStorage.getItem('emailVerified');
    if (verified !== 'true') {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// ============================================================
// 12. EVENT LISTENERS (Call this on DOMContentLoaded)
// ============================================================

/**
 * Initialize all event listeners and check auth state
 */
function initApp() {
    // --- Auth check on page load ---
    const loggedIn = localStorage.getItem('loggedInUser');
    const email = localStorage.getItem('userEmail');
    const verified = localStorage.getItem('emailVerified');
    if (loggedIn && email && verified === 'true') {
        // Already logged in and verified — redirect to dashboard
        if (!window.location.href.includes('dashboard.html')) {
            window.location.href = 'dashboard.html';
        }
        return;
    }

    // --- Show verify notice if user is partially logged in ---
    const storedEmail = localStorage.getItem('userEmail');
    const storedVerified = localStorage.getItem('emailVerified');
    if (storedEmail && storedVerified === 'false') {
        showVerifyNotice(storedEmail);
    }

    // --- Signup form submission ---
    const signupForm = document.getElementById('form-signup-el');
    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handleSignup();
        });
    }

    // --- Login form submission ---
    const loginForm = document.getElementById('form-login-el');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await handleLogin();
        });
    }

    // --- Forgot password modal ---
    const openForgotBtn = document.getElementById('open-forgot-btn');
    if (openForgotBtn) {
        openForgotBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openForgotModal();
        });
    }

    const closeForgotBtn = document.getElementById('close-forgot-btn');
    if (closeForgotBtn) {
        closeForgotBtn.addEventListener('click', closeForgotModal);
    }

    const forgotModal = document.getElementById('forgot-modal');
    if (forgotModal) {
        forgotModal.addEventListener('click', (e) => {
            if (e.target === forgotModal) {
                closeForgotModal();
            }
        });
    }

    const findAccountBtn = document.getElementById('find-account-btn');
    if (findAccountBtn) {
        findAccountBtn.addEventListener('click', handleFindAccount);
    }

    const saveNewPasswordBtn = document.getElementById('save-new-password-btn');
    if (saveNewPasswordBtn) {
        saveNewPasswordBtn.addEventListener('click', handleSaveNewPassword);
    }

    // --- Enter key support ---
    const forgotEmailInput = document.getElementById('forgot-email-input');
    if (forgotEmailInput) {
        forgotEmailInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleFindAccount();
            }
        });
    }

    const forgotNewPasswordInput = document.getElementById('forgot-new-password');
    if (forgotNewPasswordInput) {
        forgotNewPasswordInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveNewPassword();
            }
        });
    }

    const loginPassword = document.getElementById('login-password');
    if (loginPassword) {
        loginPassword.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLogin();
            }
        });
    }

    const signupPassword = document.getElementById('signup-password');
    if (signupPassword) {
        signupPassword.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSignup();
            }
        });
    }

    // --- Enter key for verification code ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const verifyInput = document.getElementById('input-verify-code');
            if (verifyInput && verifyInput.style.display !== 'none' && document.activeElement === verifyInput) {
                e.preventDefault();
                handleCodeVerification();
            }
        }
    });

    // --- Fetch cloud data ---
    fetchCloudUsers();
}

// ============================================================
// 13. AUTO-INITIALIZE ON DOM CONTENT LOADED
// ============================================================

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initApp);
}

// ============================================================
// 14. EXPOSE GLOBALLY (for inline onclick handlers in HTML)
// ============================================================

// Make all handler functions available globally
window.toggleForm = toggleForm;
window.showVerificationInputSection = showVerificationInputSection;
window.handleCodeVerification = handleCodeVerification;
window.resendVerification = resendVerification;
window.handleSignup = handleSignup;
window.handleLogin = handleLogin;
window.handleFindAccount = handleFindAccount;
window.handleSaveNewPassword = handleSaveNewPassword;
window.openForgotModal = openForgotModal;
window.closeForgotModal = closeForgotModal;
window.checkEmailVerified = checkEmailVerified;
window.fetchCloudUsers = fetchCloudUsers;
window.saveCloudUsers = saveCloudUsers;
window.hashPassword = hashPassword;
window.verifyPassword = verifyPassword;
window.sendVerificationEmail = sendVerificationEmail;
