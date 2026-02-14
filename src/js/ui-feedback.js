/**
 * RoomVision - Enhanced UI Feedback Module
 * Centralized functions for user interface feedback
 * HCI Coursework - Demonstrates clear user communication and error handling
 */

/**
 * Displays an error message for a specific input field
 * HCI Principle: Immediate Feedback
 * 
 * @param {HTMLElement} inputElement - The input element with the error
 * @param {HTMLElement} errorElement - The element to display the error message
 * @param {string} message - Error message to display
 */
export function showError(inputElement, errorElement, message) {
    // Add error class to input with animation
    inputElement.classList.add('error');
    inputElement.setAttribute('aria-invalid', 'true');
    
    // Shake animation for visual feedback
    inputElement.style.animation = 'shake 0.4s ease-in-out';
    setTimeout(() => {
        inputElement.style.animation = '';
    }, 400);
    
    // Display error message with fade-in
    errorElement.textContent = message;
    errorElement.style.display = 'flex';
    errorElement.style.opacity = '0';
    errorElement.style.transform = 'translateY(-4px)';
    
    // Announce error to screen readers
    errorElement.setAttribute('role', 'alert');
    errorElement.setAttribute('aria-live', 'assertive');
    
    // Animate error message appearance
    requestAnimationFrame(() => {
        errorElement.style.transition = 'all 0.3s ease-out';
        errorElement.style.opacity = '1';
        errorElement.style.transform = 'translateY(0)';
    });
}

/**
 * Clears error state from an input field
 * 
 * @param {HTMLElement} inputElement - The input element to clear
 * @param {HTMLElement} errorElement - The error message element to clear
 */
export function clearError(inputElement, errorElement) {
    // Remove error class with smooth transition
    inputElement.classList.remove('error');
    inputElement.setAttribute('aria-invalid', 'false');
    
    // Fade out error message
    errorElement.style.transition = 'all 0.2s ease-out';
    errorElement.style.opacity = '0';
    errorElement.style.transform = 'translateY(-4px)';
    
    setTimeout(() => {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
        errorElement.removeAttribute('role');
        errorElement.removeAttribute('aria-live');
    }, 200);
}

/**
 * Shows a success message to the user
 * HCI Principle: Visibility of System Status
 * 
 * @param {string} message - Success message to display
 * @param {number} duration - How long to show the message (ms)
 */
export function showSuccess(message, duration = 3000) {
    // Create success notification element
    const successDiv = document.createElement('div');
    successDiv.className = 'notification success-notification';
    successDiv.setAttribute('role', 'status');
    successDiv.setAttribute('aria-live', 'polite');
    
    successDiv.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
            <path d="M22 4L12 14.01l-3-3"/>
        </svg>
        <span>${escapeHtml(message)}</span>
    `;
    
    // Entry animation
    successDiv.style.animation = 'notifIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1)';
    
    // Append to body
    document.body.appendChild(successDiv);
    
    // Haptic feedback (if supported)
    if (navigator.vibrate) {
        navigator.vibrate(200);
    }
    
    // Remove after duration
    setTimeout(() => {
        successDiv.style.animation = 'notifOut 300ms ease-in forwards';
        setTimeout(() => {
            if (successDiv.parentNode) {
                document.body.removeChild(successDiv);
            }
        }, 300);
    }, duration);
}

/**
 * Shows a loading overlay
 * HCI Principle: Visibility of System Status
 * 
 * @param {HTMLElement} overlayElement - The loading overlay element
 */
export function showLoading(overlayElement) {
    if (overlayElement) {
        overlayElement.style.display = 'flex';
        overlayElement.style.opacity = '0';
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Fade in animation
        requestAnimationFrame(() => {
            overlayElement.style.transition = 'opacity 0.2s ease-out';
            overlayElement.style.opacity = '1';
        });
        
        // Announce to screen readers
        const loadingText = overlayElement.querySelector('p');
        if (loadingText) {
            loadingText.setAttribute('role', 'status');
            loadingText.setAttribute('aria-live', 'polite');
        }
    }
}

/**
 * Hides the loading overlay
 * 
 * @param {HTMLElement} overlayElement - The loading overlay element
 */
export function hideLoading(overlayElement) {
    if (overlayElement) {
        // Fade out animation
        overlayElement.style.transition = 'opacity 0.2s ease-out';
        overlayElement.style.opacity = '0';
        
        setTimeout(() => {
            overlayElement.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 200);
    }
}

/**
 * Shows a warning message
 * 
 * @param {string} message - Warning message to display
 * @param {number} duration - How long to show the message (ms)
 */
export function showWarning(message, duration = 4000) {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'notification warning-notification';
    warningDiv.setAttribute('role', 'alert');
    warningDiv.setAttribute('aria-live', 'assertive');
    
    warningDiv.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>${escapeHtml(message)}</span>
    `;
    
    // Entry animation
    warningDiv.style.animation = 'notifIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1)';
    
    document.body.appendChild(warningDiv);
    
    // Haptic feedback (if supported)
    if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
    }
    
    setTimeout(() => {
        warningDiv.style.animation = 'notifOut 300ms ease-in forwards';
        setTimeout(() => {
            if (warningDiv.parentNode) {
                document.body.removeChild(warningDiv);
            }
        }, 300);
    }, duration);
}

/**
 * Shows an info message
 * 
 * @param {string} message - Info message to display
 * @param {number} duration - How long to show the message (ms)
 */
export function showInfo(message, duration = 3000) {
    const infoDiv = document.createElement('div');
    infoDiv.className = 'notification';
    infoDiv.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
    infoDiv.setAttribute('role', 'status');
    infoDiv.setAttribute('aria-live', 'polite');
    
    infoDiv.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <span>${escapeHtml(message)}</span>
    `;
    
    // Entry animation
    infoDiv.style.animation = 'notifIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1)';
    
    document.body.appendChild(infoDiv);
    
    setTimeout(() => {
        infoDiv.style.animation = 'notifOut 300ms ease-in forwards';
        setTimeout(() => {
            if (infoDiv.parentNode) {
                document.body.removeChild(infoDiv);
            }
        }, 300);
    }, duration);
}

/**
 * Validates and provides feedback for a form field
 * Combines validation check with immediate UI feedback
 * 
 * @param {HTMLElement} inputElement - Input to validate
 * @param {HTMLElement} errorElement - Error display element
 * @param {Function} validationFn - Validation function to run
 * @returns {boolean} Whether validation passed
 */
export function validateAndFeedback(inputElement, errorElement, validationFn) {
    const value = inputElement.value;
    const result = validationFn(value);
    
    if (!result.isValid) {
        showError(inputElement, errorElement, result.message);
        return false;
    } else {
        clearError(inputElement, errorElement);
        
        // Add success visual feedback
        inputElement.style.borderColor = 'var(--success)';
        setTimeout(() => {
            if (inputElement !== document.activeElement) {
                inputElement.style.borderColor = '';
            }
        }, 1000);
        
        return true;
    }
}

/**
 * Creates a progress toast for multi-step operations
 * 
 * @param {string} message - Progress message
 * @returns {Object} Progress toast controller
 */
export function createProgressToast(message) {
    const progressDiv = document.createElement('div');
    progressDiv.className = 'notification';
    progressDiv.style.background = 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)';
    progressDiv.setAttribute('role', 'status');
    progressDiv.setAttribute('aria-live', 'polite');
    
    progressDiv.innerHTML = `
        <div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>
        <span>${escapeHtml(message)}</span>
    `;
    
    progressDiv.style.animation = 'notifIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1)';
    document.body.appendChild(progressDiv);
    
    return {
        update: (newMessage) => {
            const span = progressDiv.querySelector('span');
            if (span) span.textContent = newMessage;
        },
        complete: (finalMessage) => {
            progressDiv.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                    <path d="M22 4L12 14.01l-3-3"/>
                </svg>
                <span>${escapeHtml(finalMessage)}</span>
            `;
            progressDiv.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            
            setTimeout(() => {
                progressDiv.style.animation = 'notifOut 300ms ease-in forwards';
                setTimeout(() => {
                    if (progressDiv.parentNode) {
                        document.body.removeChild(progressDiv);
                    }
                }, 300);
            }, 2000);
        },
        error: (errorMessage) => {
            progressDiv.innerHTML = `
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <span>${escapeHtml(errorMessage)}</span>
            `;
            progressDiv.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            
            setTimeout(() => {
                progressDiv.style.animation = 'notifOut 300ms ease-in forwards';
                setTimeout(() => {
                    if (progressDiv.parentNode) {
                        document.body.removeChild(progressDiv);
                    }
                }, 300);
            }, 3000);
        },
        dismiss: () => {
            progressDiv.style.animation = 'notifOut 300ms ease-in forwards';
            setTimeout(() => {
                if (progressDiv.parentNode) {
                    document.body.removeChild(progressDiv);
                }
            }, 300);
        }
    };
}

/**
 * Escapes HTML to prevent XSS attacks
 * 
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add CSS animations for shake effect
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
        20%, 40%, 60%, 80% { transform: translateX(4px); }
    }
`;
document.head.appendChild(style);