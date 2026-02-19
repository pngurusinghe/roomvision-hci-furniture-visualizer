/**
 * RoomVision - Enhanced UI Feedback Module
 * Centralized functions for user interface feedback
 * HCI Coursework - Demonstrates clear user communication and error handling
 */

/**
 * Displays an error message for a specific input field
 * HCI Principle: Immediate Feedback
 * 
 * @param {HTMLElement|string} inputElementOrMessage - Input element OR error message string
 * @param {HTMLElement} errorElement - Error display element (optional if first param is string)
 * @param {string} message - Error message (only used if first param is element)
 */
export function showError(inputElementOrMessage, errorElement, message) {
    // If first parameter is a string, show it as a notification
    if (typeof inputElementOrMessage === 'string') {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'notification error-notification';
        errorDiv.setAttribute('role', 'alert');
        errorDiv.setAttribute('aria-live', 'assertive');
        
        errorDiv.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <span>${escapeHtml(inputElementOrMessage)}</span>
        `;
        
        errorDiv.style.animation = 'notifIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1)';
        document.body.appendChild(errorDiv);
        
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100, 50, 100]);
        }
        
        setTimeout(() => {
            errorDiv.style.animation = 'notifOut 300ms ease-in forwards';
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    document.body.removeChild(errorDiv);
                }
            }, 300);
        }, 5000);
        
        return;
    }
    
    // Otherwise, handle as input field error (original behavior)
    const inputElement = inputElementOrMessage;
    
    inputElement.classList.add('error');
    inputElement.setAttribute('aria-invalid', 'true');
    
    inputElement.style.animation = 'shake 0.4s ease-in-out';
    setTimeout(() => {
        inputElement.style.animation = '';
    }, 400);
    
    errorElement.textContent = message;
    errorElement.style.display = 'flex';
    errorElement.style.opacity = '0';
    errorElement.style.transform = 'translateY(-4px)';
    
    errorElement.setAttribute('role', 'alert');
    errorElement.setAttribute('aria-live', 'assertive');
    
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
    inputElement.classList.remove('error');
    inputElement.setAttribute('aria-invalid', 'false');
    
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
    
    successDiv.style.animation = 'notifIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1)';
    document.body.appendChild(successDiv);
    
    if (navigator.vibrate) {
        navigator.vibrate(200);
    }
    
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
 * Shows a loading overlay - UPDATED VERSION
 * Can accept either an HTML element OR a message string
 * 
 * @param {HTMLElement|string} param - Loading overlay element OR loading message
 */
export function showLoading(param) {
    // If parameter is a string or undefined, create global overlay
    if (typeof param === 'string' || param === undefined) {
        const message = param || 'Loading...';
        
        let overlay = document.getElementById('global-loading-overlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'global-loading-overlay';
            overlay.setAttribute('role', 'status');
            overlay.setAttribute('aria-live', 'polite');
            overlay.innerHTML = `
                <div class="global-loading-content">
                    <div class="global-spinner"></div>
                    <p class="global-loading-message">${escapeHtml(message)}</p>
                </div>
            `;
            document.body.appendChild(overlay);
        } else {
            const messageEl = overlay.querySelector('.global-loading-message');
            if (messageEl) messageEl.textContent = message;
        }
        
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
        });
        
        return;
    }
    
    // Otherwise handle as element (original behavior)
    const overlayElement = param;
    if (overlayElement) {
        overlayElement.style.display = 'flex';
        overlayElement.style.opacity = '0';
        document.body.style.overflow = 'hidden';
        
        requestAnimationFrame(() => {
            overlayElement.style.transition = 'opacity 0.2s ease-out';
            overlayElement.style.opacity = '1';
        });
        
        const loadingText = overlayElement.querySelector('p');
        if (loadingText) {
            loadingText.setAttribute('role', 'status');
            loadingText.setAttribute('aria-live', 'polite');
        }
    }
}

/**
 * Hides the loading overlay - UPDATED VERSION
 * Can accept an element or work without parameters
 * 
 * @param {HTMLElement} overlayElement - Optional loading overlay element
 */
export function hideLoading(overlayElement) {
    // If no parameter, hide global overlay
    if (!overlayElement) {
        const overlay = document.getElementById('global-loading-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
                document.body.style.overflow = 'auto';
            }, 300);
        }
        return;
    }
    
    // Otherwise handle as element (original behavior)
    if (overlayElement) {
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
    
    warningDiv.style.animation = 'notifIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1)';
    document.body.appendChild(warningDiv);
    
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

// Add CSS animations and styles
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
        20%, 40%, 60%, 80% { transform: translateX(4px); }
    }
    
    #global-loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.75);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    
    .global-loading-content {
        background: white;
        padding: 40px 60px;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        text-align: center;
    }
    
    .global-spinner {
        width: 60px;
        height: 60px;
        margin: 0 auto 24px;
        border: 5px solid #e5e7eb;
        border-top: 5px solid #2563eb;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    .global-loading-message {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #1e293b;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    
    .notification.error-notification {
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
    }
`;
document.head.appendChild(style);