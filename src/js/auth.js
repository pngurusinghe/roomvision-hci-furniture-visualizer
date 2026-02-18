import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// DOM Elements
const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const togglePassword = document.getElementById("togglePassword");
const passwordField = document.getElementById("password");
const emailField = document.getElementById("email");
const messageBox = document.getElementById("authMessage");

// Error display elements
const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");

// Validation functions
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showError(element, message, inputField) {
    element.textContent = message;
    element.classList.add('show');
    inputField.classList.add('error');
    inputField.setAttribute('aria-invalid', 'true');
}

function clearError(element, inputField) {
    element.textContent = '';
    element.classList.remove('show');
    inputField.classList.remove('error');
    inputField.setAttribute('aria-invalid', 'false');
}

function showMessage(message, type = 'error') {
    messageBox.textContent = message;
    messageBox.className = 'message-box ' + type;
    messageBox.style.display = 'block';
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 5000);
    }
}

function hideMessage() {
    messageBox.style.display = 'none';
}

function setLoading(isLoading) {
    const btnText = loginBtn.querySelector('.btn-text');
    const btnLoader = loginBtn.querySelector('.btn-loader');
    
    if (isLoading) {
        btnText.style.display = 'none';
        btnLoader.style.display = 'flex';
        loginBtn.disabled = true;
        loginForm.classList.add('loading');
    } else {
        btnText.style.display = 'block';
        btnLoader.style.display = 'none';
        loginBtn.disabled = false;
        loginForm.classList.remove('loading');
    }
}

// Toggle password visibility
togglePassword.addEventListener("click", () => {
    const eyeOpen = togglePassword.querySelector('.eye-open');
    const eyeClosed = togglePassword.querySelector('.eye-closed');
    
    if (passwordField.type === "password") {
        passwordField.type = "text";
        eyeOpen.style.display = 'none';
        eyeClosed.style.display = 'block';
        togglePassword.setAttribute('aria-label', 'Hide password');
    } else {
        passwordField.type = "password";
        eyeOpen.style.display = 'block';
        eyeClosed.style.display = 'none';
        togglePassword.setAttribute('aria-label', 'Show password');
    }
});

// Real-time validation
emailField.addEventListener('input', () => {
    clearError(emailError, emailField);
    hideMessage();
});

passwordField.addEventListener('input', () => {
    clearError(passwordError, passwordField);
    hideMessage();
});

// Clear errors on focus
emailField.addEventListener('focus', () => {
    clearError(emailError, emailField);
});

passwordField.addEventListener('focus', () => {
    clearError(passwordError, passwordField);
});

// Form submission
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = emailField.value.trim();
    const password = passwordField.value;
    
    // Clear previous errors
    clearError(emailError, emailField);
    clearError(passwordError, passwordField);
    hideMessage();
    
    let hasError = false;
    
    // Validate email
    if (!email) {
        showError(emailError, 'Email address is required', emailField);
        hasError = true;
    } else if (!validateEmail(email)) {
        showError(emailError, 'Please enter a valid email address', emailField);
        hasError = true;
    }
    
    // Validate password
    if (!password) {
        showError(passwordError, 'Password is required', passwordField);
        hasError = true;
    }
    
    if (hasError) {
        // Focus on first error field
        if (emailError.classList.contains('show')) {
            emailField.focus();
        } else if (passwordError.classList.contains('show')) {
            passwordField.focus();
        }
        return;
    }
    
    // Attempt login
    setLoading(true);
    
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // Store remember me preference
        const rememberMe = document.getElementById('rememberMe').checked;
        if (rememberMe) {
            localStorage.setItem('rememberEmail', email);
        } else {
            localStorage.removeItem('rememberEmail');
        }
        
        showMessage('Login successful! Redirecting...', 'success');

         if (email === 'admin@roomvision.com') {
        // Redirect to admin panel
        setTimeout(() => {
            window.location.href = "admin-furniture.html";
        }, 700);
    } else {
        // Redirect to normal user projects page
        setTimeout(() => {
            window.location.href = "projects.html";
        }, 700);
    }
        
    } catch (error) {
        setLoading(false);
        
        console.error('Login error:', error);
        
        let errorMessage = 'An error occurred during login. Please try again.';
        
        switch (error.code) {
            case 'auth/invalid-email':
                showError(emailError, 'Invalid email address', emailField);
                emailField.focus();
                return;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled. Please contact support.';
                break;
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email address.';
                showError(emailError, 'Email not found', emailField);
                emailField.focus();
                return;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password. Please try again.';
                showError(passwordError, 'Incorrect password', passwordField);
                passwordField.focus();
                return;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed login attempts. Please try again later.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Please check your internet connection.';
                break;
            case 'auth/invalid-credential':
                errorMessage = 'Invalid email or password. Please check your credentials.';
                break;
            default:
                errorMessage = error.message || errorMessage;
        }
        
        showMessage(errorMessage, 'error');
    }
});

// Check for remembered email
window.addEventListener('DOMContentLoaded', () => {
    const rememberedEmail = localStorage.getItem('rememberEmail');
    if (rememberedEmail) {
        emailField.value = rememberedEmail;
        document.getElementById('rememberMe').checked = true;
    }
});

// Forgot password handler (placeholder)
const forgotLink = document.querySelector('.forgot-link');
if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        showMessage('Password reset functionality will be implemented soon.', 'info');
    });
}

// Social login handlers (placeholders)
const googleBtn = document.querySelector('.google-btn');
const microsoftBtn = document.querySelector('.microsoft-btn');

if (googleBtn) {
    googleBtn.addEventListener('click', () => {
        showMessage('Google sign-in will be implemented soon.', 'info');
    });
}

if (microsoftBtn) {
    microsoftBtn.addEventListener('click', () => {
        showMessage('Microsoft sign-in will be implemented soon.', 'info');
    });
}