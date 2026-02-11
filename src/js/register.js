import { auth } from "./firebase-config.js";
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// DOM Elements
const registerForm = document.getElementById("registerForm");
const registerBtn = document.getElementById("registerBtn");
const messageBox = document.getElementById("registerMessage");

// Input fields
const firstNameField = document.getElementById("firstName");
const lastNameField = document.getElementById("lastName");
const emailField = document.getElementById("regEmail");
const companyField = document.getElementById("companyName");
const passwordField = document.getElementById("regPassword");
const confirmPasswordField = document.getElementById("confirmPassword");
const termsCheckbox = document.getElementById("termsAgree");

// Error display elements
const firstNameError = document.getElementById("firstNameError");
const lastNameError = document.getElementById("lastNameError");
const emailError = document.getElementById("emailError");
const companyError = document.getElementById("companyError");
const passwordError = document.getElementById("passwordError");
const confirmPasswordError = document.getElementById("confirmPasswordError");
const termsError = document.getElementById("termsError");

// Password strength elements
const passwordStrength = document.getElementById("passwordStrength");
const strengthFill = document.querySelector(".strength-fill");
const strengthText = document.querySelector(".strength-text");

// Password toggle buttons
const toggleRegPassword = document.getElementById("toggleRegPassword");
const toggleConfirmPassword = document.getElementById("toggleConfirmPassword");

// Validation functions
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validateName(name) {
    return name.length >= 2 && /^[a-zA-Z\s-']+$/.test(name);
}

function checkPasswordStrength(password) {
    let strength = 0;
    let feedback = [];
    
    // Length check
    if (password.length >= 8) strength += 1;
    else feedback.push("at least 8 characters");
    
    // Uppercase check
    if (/[A-Z]/.test(password)) strength += 1;
    else feedback.push("an uppercase letter");
    
    // Lowercase check
    if (/[a-z]/.test(password)) strength += 1;
    else feedback.push("a lowercase letter");
    
    // Number check
    if (/[0-9]/.test(password)) strength += 1;
    else feedback.push("a number");
    
    // Special character check (bonus)
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    
    // Determine level
    let level = 'weak';
    let message = 'Weak password';
    
    if (strength >= 4) {
        level = 'strong';
        message = 'Strong password';
    } else if (strength >= 3) {
        level = 'medium';
        message = 'Medium strength';
    } else if (feedback.length > 0) {
        message = `Add ${feedback.slice(0, 2).join(', ')}`;
    }
    
    return { level, message, strength };
}

function updatePasswordStrength() {
    const password = passwordField.value;
    
    if (password.length === 0) {
        passwordStrength.style.display = 'none';
        return;
    }
    
    passwordStrength.style.display = 'block';
    const result = checkPasswordStrength(password);
    
    // Update UI
    strengthFill.className = 'strength-fill ' + result.level;
    strengthText.className = 'strength-text ' + result.level;
    strengthText.textContent = result.message;
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
    const btnText = registerBtn.querySelector('.btn-text');
    const btnLoader = registerBtn.querySelector('.btn-loader');
    
    if (isLoading) {
        btnText.style.display = 'none';
        btnLoader.style.display = 'flex';
        registerBtn.disabled = true;
        registerForm.classList.add('loading');
    } else {
        btnText.style.display = 'block';
        btnLoader.style.display = 'none';
        registerBtn.disabled = false;
        registerForm.classList.remove('loading');
    }
}

// Password visibility toggles
function setupPasswordToggle(toggleBtn, passwordInput) {
    toggleBtn.addEventListener("click", () => {
        const eyeOpen = toggleBtn.querySelector('.eye-open');
        const eyeClosed = toggleBtn.querySelector('.eye-closed');
        
        if (passwordInput.type === "password") {
            passwordInput.type = "text";
            eyeOpen.style.display = 'none';
            eyeClosed.style.display = 'block';
            toggleBtn.setAttribute('aria-label', 'Hide password');
        } else {
            passwordInput.type = "password";
            eyeOpen.style.display = 'block';
            eyeClosed.style.display = 'none';
            toggleBtn.setAttribute('aria-label', 'Show password');
        }
    });
}

setupPasswordToggle(toggleRegPassword, passwordField);
setupPasswordToggle(toggleConfirmPassword, confirmPasswordField);

// Password strength indicator
passwordField.addEventListener('input', () => {
    updatePasswordStrength();
    clearError(passwordError, passwordField);
    hideMessage();
    
    // Also check confirm password if it has a value
    if (confirmPasswordField.value) {
        if (passwordField.value === confirmPasswordField.value) {
            clearError(confirmPasswordError, confirmPasswordField);
            confirmPasswordField.classList.add('success');
        } else {
            confirmPasswordField.classList.remove('success');
        }
    }
});

// Real-time validation
firstNameField.addEventListener('input', () => {
    clearError(firstNameError, firstNameField);
    hideMessage();
});

lastNameField.addEventListener('input', () => {
    clearError(lastNameError, lastNameField);
    hideMessage();
});

emailField.addEventListener('input', () => {
    clearError(emailError, emailField);
    hideMessage();
});

companyField.addEventListener('input', () => {
    clearError(companyError, companyField);
    hideMessage();
});

confirmPasswordField.addEventListener('input', () => {
    clearError(confirmPasswordError, confirmPasswordField);
    hideMessage();
    
    // Real-time password match check
    if (confirmPasswordField.value) {
        if (passwordField.value === confirmPasswordField.value) {
            confirmPasswordField.classList.add('success');
        } else {
            confirmPasswordField.classList.remove('success');
        }
    }
});

termsCheckbox.addEventListener('change', () => {
    clearError(termsError, termsCheckbox);
    hideMessage();
});

// Form submission
registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Get values
    const firstName = firstNameField.value.trim();
    const lastName = lastNameField.value.trim();
    const email = emailField.value.trim();
    const company = companyField.value.trim();
    const password = passwordField.value;
    const confirmPassword = confirmPasswordField.value;
    const termsAccepted = termsCheckbox.checked;
    
    // Clear previous errors
    clearError(firstNameError, firstNameField);
    clearError(lastNameError, lastNameField);
    clearError(emailError, emailField);
    clearError(companyError, companyField);
    clearError(passwordError, passwordField);
    clearError(confirmPasswordError, confirmPasswordField);
    clearError(termsError, termsCheckbox);
    hideMessage();
    
    let hasError = false;
    let firstErrorField = null;
    
    // Validate first name
    if (!firstName) {
        showError(firstNameError, 'First name is required', firstNameField);
        hasError = true;
        if (!firstErrorField) firstErrorField = firstNameField;
    } else if (!validateName(firstName)) {
        showError(firstNameError, 'Please enter a valid first name', firstNameField);
        hasError = true;
        if (!firstErrorField) firstErrorField = firstNameField;
    }
    
    // Validate last name
    if (!lastName) {
        showError(lastNameError, 'Last name is required', lastNameField);
        hasError = true;
        if (!firstErrorField) firstErrorField = lastNameField;
    } else if (!validateName(lastName)) {
        showError(lastNameError, 'Please enter a valid last name', lastNameField);
        hasError = true;
        if (!firstErrorField) firstErrorField = lastNameField;
    }
    
    // Validate email
    if (!email) {
        showError(emailError, 'Email address is required', emailField);
        hasError = true;
        if (!firstErrorField) firstErrorField = emailField;
    } else if (!validateEmail(email)) {
        showError(emailError, 'Please enter a valid email address', emailField);
        hasError = true;
        if (!firstErrorField) firstErrorField = emailField;
    }
    
    // Validate password
    if (!password) {
        showError(passwordError, 'Password is required', passwordField);
        hasError = true;
        if (!firstErrorField) firstErrorField = passwordField;
    } else {
        const strength = checkPasswordStrength(password);
        if (strength.strength < 3) {
            showError(passwordError, 'Password must be stronger. ' + strength.message, passwordField);
            hasError = true;
            if (!firstErrorField) firstErrorField = passwordField;
        }
    }
    
    // Validate confirm password
    if (!confirmPassword) {
        showError(confirmPasswordError, 'Please confirm your password', confirmPasswordField);
        hasError = true;
        if (!firstErrorField) firstErrorField = confirmPasswordField;
    } else if (password !== confirmPassword) {
        showError(confirmPasswordError, 'Passwords do not match', confirmPasswordField);
        hasError = true;
        if (!firstErrorField) firstErrorField = confirmPasswordField;
    }
    
    // Validate terms
    if (!termsAccepted) {
        showError(termsError, 'You must accept the Terms of Service and Privacy Policy', termsCheckbox);
        hasError = true;
    }
    
    if (hasError) {
        if (firstErrorField) {
            firstErrorField.focus();
        }
        return;
    }
    
    // Attempt registration
    setLoading(true);
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Update profile with display name
        await updateProfile(userCredential.user, {
            displayName: `${firstName} ${lastName}`
        });
        
        showMessage('Account created successfully! Redirecting to login...', 'success');
        
        // Redirect after a short delay
        setTimeout(() => {
            window.location.href = "index.html";
        }, 2000);
        
    } catch (error) {
        setLoading(false);
        
        console.error('Registration error:', error);
        
        let errorMessage = 'An error occurred during registration. Please try again.';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'This email is already registered. Please sign in instead.';
                showError(emailError, 'Email already in use', emailField);
                emailField.focus();
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address format.';
                showError(emailError, 'Invalid email format', emailField);
                emailField.focus();
                break;
            case 'auth/operation-not-allowed':
                errorMessage = 'Email/password accounts are not enabled. Please contact support.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak. Please use a stronger password.';
                showError(passwordError, 'Password too weak', passwordField);
                passwordField.focus();
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Please check your internet connection.';
                break;
            default:
                errorMessage = error.message || errorMessage;
        }
        
        showMessage(errorMessage, 'error');
    }
});

// Social registration handlers (placeholders)
const googleBtn = document.querySelector('.google-btn');
const microsoftBtn = document.querySelector('.microsoft-btn');

if (googleBtn) {
    googleBtn.addEventListener('click', () => {
        showMessage('Google sign-up will be implemented soon.', 'info');
    });
}

if (microsoftBtn) {
    microsoftBtn.addEventListener('click', () => {
        showMessage('Microsoft sign-up will be implemented soon.', 'info');
    });
}

// Terms links (placeholders)
const termsLinks = document.querySelectorAll('.checkbox-text a');
termsLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const linkText = link.textContent;
        showMessage(`${linkText} will open in a new window (placeholder).`, 'info');
    });
});