/**
 * RoomVision - Enhanced Room Setup Controller with Dark Mode
 * Handles UI interactions, validation, and data flow
 * HCI Coursework - Demonstrates proper separation of concerns
 */

import { validateDimension, validateRoomData } from './validation.js';
import { saveRoomToFirestore, saveRoomToProject } from './storage.js';
import { showError, clearError, showLoading, hideLoading, showWarning, showSuccess } from './ui-feedback.js';

// ============================================
// STATE MANAGEMENT
// ============================================

const roomState = {
    width: null,
    length: null,
    height: 2.8, // Default height
    shape: 'rectangular',
    wallColor: '#FFFFFF',
    floorColor: '#F5DEB3',
    roomType: 'living-room'
};

// ============================================
// CAPTURE PROJECT CONTEXT FROM URL
// ============================================

(function captureProjectContext() {
    try {
        const params = new URLSearchParams(window.location.search);
        const pid = params.get('projectId');
        if (pid) {
            roomState.projectId = pid;
            console.log('📂 Room setup opened for project:', pid);
            
            // Update breadcrumb to link back to project details
            const breadcrumbLink = document.getElementById('breadcrumbProjectsLink');
            const breadcrumbProject = document.getElementById('breadcrumbProject');
            if (breadcrumbLink) {
                breadcrumbLink.href = `project-details.html?projectId=${pid}`;
                breadcrumbLink.textContent = 'Project Rooms';
            }
            if (breadcrumbProject) {
                breadcrumbProject.textContent = 'New Room';
            }
        }
    } catch (e) {
        console.error('Error capturing project context:', e);
    }
})();

// ============================================
// DOM ELEMENTS
// ============================================

const elements = {
    form: document.getElementById('roomSetupForm'),
    widthInput: document.getElementById('roomWidth'),
    lengthInput: document.getElementById('roomLength'),
    heightInput: document.getElementById('roomHeight'),
    continueBtn: document.getElementById('continueBtn'),
    backBtn: document.getElementById('backBtn'),
    saveDraftBtn: document.getElementById('saveDraftBtn'),
    previewInfo: document.getElementById('previewInfo'),
    previewText: document.getElementById('previewText'),
    widthError: document.getElementById('widthError'),
    lengthError: document.getElementById('lengthError'),
    heightError: document.getElementById('heightError'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    themeToggle: document.getElementById('themeToggle')
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeEventListeners();
    updatePreview(); // Initial preview state
    addEntranceAnimations();
});

// ============================================
// THEME MANAGEMENT
// ============================================

function initializeTheme() {
    // Check for saved theme preference or default to light mode
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Set up theme toggle
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', toggleTheme);
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Add transition effect
    document.body.style.transition = 'background-color 0.3s ease, color 0.3s ease';
    
    // Show feedback
    showSuccess(`Switched to ${newTheme} mode`, 2000);
}

// ============================================
// ENTRANCE ANIMATIONS
// ============================================

function addEntranceAnimations() {
    // Animate form sections on scroll
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    document.querySelectorAll('.form-section').forEach(section => {
        observer.observe(section);
    });
}

// ============================================
// EVENT LISTENERS
// ============================================

function initializeEventListeners() {
    // Dimension inputs - real-time validation and preview
    elements.widthInput.addEventListener('input', handleWidthInput);
    elements.lengthInput.addEventListener('input', handleLengthInput);
    elements.heightInput.addEventListener('input', handleHeightInput);

    // Preset buttons
    const presetButtons = document.querySelectorAll('.preset-btn');
    presetButtons.forEach(btn => {
        btn.addEventListener('click', handlePresetClick);
    });

    // Shape selection
    const shapeInputs = document.querySelectorAll('input[name="shape"]');
    shapeInputs.forEach(input => {
        input.addEventListener('change', handleShapeChange);
    });

    // Color selections
    const wallColorInputs = document.querySelectorAll('input[name="wallColor"]');
    wallColorInputs.forEach(input => {
        input.addEventListener('change', handleWallColorChange);
    });

    // Custom color picker for walls
    const wallPicker = document.getElementById('wallColorPicker');
    const wallPreview = document.getElementById('wallColorPreview');
    if (wallPicker && wallPreview) {
        wallPicker.addEventListener('input', (e) => {
            wallPreview.style.backgroundColor = e.target.value;
            roomState.wallColor = e.target.value;
            
            // Uncheck all radio wall colors
            document.querySelectorAll('input[name="wallColor"][type="radio"]').forEach(radio => {
                radio.checked = false;
            });
        });
        
        // Click on preview to trigger color picker
        wallPreview.addEventListener('click', () => {
            wallPicker.click();
        });
    }

    const floorColorInputs = document.querySelectorAll('input[name="floorColor"]');
    floorColorInputs.forEach(input => {
        input.addEventListener('change', handleFloorColorChange);
    });

    // Custom color picker for floor
    const floorPicker = document.getElementById('floorColorPicker');
    const floorPreview = document.getElementById('floorColorPreview');
    if (floorPicker && floorPreview) {
        floorPicker.addEventListener('input', (e) => {
            floorPreview.style.backgroundColor = e.target.value;
            roomState.floorColor = e.target.value;
            
            // Uncheck all radio floor colors
            document.querySelectorAll('input[name="floorColor"][type="radio"]').forEach(radio => {
                radio.checked = false;
            });
        });
        
        // Click on preview to trigger color picker
        floorPreview.addEventListener('click', () => {
            floorPicker.click();
        });
    }

    // Room type selection
    const roomTypeInputs = document.querySelectorAll('input[name="roomType"]');
    roomTypeInputs.forEach(input => {
        input.addEventListener('change', handleRoomTypeChange);
    });

    // Form submission
    elements.form.addEventListener('submit', handleFormSubmit);

    // Navigation buttons
    elements.backBtn.addEventListener('click', handleBackClick);
    elements.saveDraftBtn.addEventListener('click', handleSaveDraft);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// ============================================
// INPUT HANDLERS
// ============================================

/**
 * HCI Principle: Immediate Feedback
 * Validates width input in real-time and updates UI accordingly
 */
function handleWidthInput(e) {
    const value = parseFloat(e.target.value);
    
    // Clear previous error
    clearError(elements.widthInput, elements.widthError);
    
    // Validate if value exists
    if (e.target.value) {
        const validation = validateDimension(value, 'Width');
        
        if (!validation.isValid) {
            showError(elements.widthInput, elements.widthError, validation.message);
            roomState.width = null;
        } else {
            roomState.width = value;
            // Add success visual feedback
            elements.widthInput.style.borderColor = 'var(--success)';
            setTimeout(() => {
                if (elements.widthInput !== document.activeElement) {
                    elements.widthInput.style.borderColor = '';
                }
            }, 500);
        }
    } else {
        roomState.width = null;
    }
    
    updatePreview();
    updateContinueButton();
}

/**
 * HCI Principle: Immediate Feedback
 * Validates length input in real-time and updates UI accordingly
 */
function handleLengthInput(e) {
    const value = parseFloat(e.target.value);
    
    clearError(elements.lengthInput, elements.lengthError);
    
    if (e.target.value) {
        const validation = validateDimension(value, 'Length');
        
        if (!validation.isValid) {
            showError(elements.lengthInput, elements.lengthError, validation.message);
            roomState.length = null;
        } else {
            roomState.length = value;
            // Add success visual feedback
            elements.lengthInput.style.borderColor = 'var(--success)';
            setTimeout(() => {
                if (elements.lengthInput !== document.activeElement) {
                    elements.lengthInput.style.borderColor = '';
                }
            }, 500);
        }
    } else {
        roomState.length = null;
    }
    
    updatePreview();
    updateContinueButton();
}

/**
 * Optional height input - uses default if not provided
 */
function handleHeightInput(e) {
    const value = parseFloat(e.target.value);
    
    clearError(elements.heightInput, elements.heightError);
    
    if (e.target.value) {
        const validation = validateDimension(value, 'Height', 2, 6);
        
        if (!validation.isValid) {
            showError(elements.heightInput, elements.heightError, validation.message);
            roomState.height = 2.8; // Reset to default
        } else {
            roomState.height = value;
            // Add success visual feedback
            elements.heightInput.style.borderColor = 'var(--success)';
            setTimeout(() => {
                if (elements.heightInput !== document.activeElement) {
                    elements.heightInput.style.borderColor = '';
                }
            }, 500);
        }
    } else {
        roomState.height = 2.8; // Use default
    }
    
    updatePreview();
}

/**
 * HCI Principle: Recognition rather than Recall
 * Preset buttons allow users to quickly select common room sizes
 */
function handlePresetClick(e) {
    const btn = e.currentTarget;
    const width = parseFloat(btn.dataset.width);
    const length = parseFloat(btn.dataset.length);
    const height = parseFloat(btn.dataset.height);
    
    // Update form inputs
    elements.widthInput.value = width;
    elements.lengthInput.value = length;
    elements.heightInput.value = height;
    
    // Update state
    roomState.width = width;
    roomState.length = length;
    roomState.height = height;
    
    // Clear any errors
    clearError(elements.widthInput, elements.widthError);
    clearError(elements.lengthInput, elements.lengthError);
    clearError(elements.heightInput, elements.heightError);
    
    // Update UI
    updatePreview();
    updateContinueButton();
    
    // Enhanced visual feedback with ripple effect
    const ripple = document.createElement('span');
    ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: rgba(37, 99, 235, 0.3);
        width: 0;
        height: 0;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        animation: ripple 0.6s ease-out;
    `;
    
    btn.style.position = 'relative';
    btn.style.overflow = 'hidden';
    btn.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
    
    // Show success feedback
    showSuccess('Preset applied successfully!', 2000);
}

// ============================================
// SELECTION HANDLERS
// ============================================

function handleShapeChange(e) {
    roomState.shape = e.target.value;
    updatePreview();
    
    // Add subtle animation to the selected shape
    const selectedCard = e.target.nextElementSibling;
    selectedCard.style.transform = 'scale(1.05)';
    setTimeout(() => {
        selectedCard.style.transform = '';
    }, 200);
}

function handleWallColorChange(e) {
    roomState.wallColor = e.target.value;
    
    // Add subtle animation to the selected color
    const selectedSwatch = e.target.nextElementSibling;
    selectedSwatch.style.transform = 'scale(1.15) translateY(-4px)';
    setTimeout(() => {
        selectedSwatch.style.transform = '';
    }, 200);
}

function handleFloorColorChange(e) {
    roomState.floorColor = e.target.value;
    
    // Add subtle animation to the selected color
    const selectedSwatch = e.target.nextElementSibling;
    selectedSwatch.style.transform = 'scale(1.15) translateY(-4px)';
    setTimeout(() => {
        selectedSwatch.style.transform = '';
    }, 200);
}

function handleRoomTypeChange(e) {
    roomState.roomType = e.target.value;
    
    // Add subtle animation to the selected room type
    const selectedCard = e.target.nextElementSibling;
    selectedCard.style.transform = 'translateY(-6px) scale(1.02)';
    setTimeout(() => {
        selectedCard.style.transform = '';
    }, 200);
}

// ============================================
// PREVIEW UPDATE
// ============================================

/**
 * HCI Principle: Visibility of System Status
 * Real-time preview shows users the impact of their inputs
 */
function updatePreview() {
    const { width, length, height } = roomState;
    
    if (width && length) {
        const area = (width * length).toFixed(2);
        const volume = height ? (width * length * height).toFixed(2) : null;
        
        let previewHTML = `<strong>Total floor area:</strong> ${area} m²`;
        
        if (volume) {
            previewHTML += ` | <strong>Volume:</strong> ${volume} m³`;
        }
        
        elements.previewText.innerHTML = previewHTML;
        elements.previewInfo.style.background = 'linear-gradient(135deg, var(--primary-light), rgba(59, 130, 246, 0.1))';
        elements.previewInfo.style.borderColor = 'var(--primary-blue)';
        
        // Add a subtle pulse animation to highlight the update
        elements.previewInfo.style.animation = 'pulse 0.5s ease-out';
        setTimeout(() => {
            elements.previewInfo.style.animation = '';
        }, 500);
    } else {
        elements.previewText.textContent = 'Enter dimensions to see room details';
        elements.previewInfo.style.background = 'var(--bg-tertiary)';
        elements.previewInfo.style.borderColor = 'var(--border-color)';
    }
}

// ============================================
// BUTTON STATE MANAGEMENT
// ============================================

/**
 * HCI Principle: Error Prevention
 * Disable submit button until all required fields are valid
 */
function updateContinueButton() {
    const validation = validateRoomData(roomState);
    
    if (validation.isValid) {
        elements.continueBtn.disabled = false;
        elements.continueBtn.style.opacity = '1';
        elements.continueBtn.style.transform = 'scale(1)';
    } else {
        elements.continueBtn.disabled = true;
        elements.continueBtn.style.opacity = '0.6';
        elements.continueBtn.style.transform = 'scale(0.98)';
    }
}

// ============================================
// FORM SUBMISSION
// ============================================

/**
 * Main form submission handler
 * Validates data and saves to Firestore before navigation
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Final validation check
    const validation = validateRoomData(roomState);
    
    if (!validation.isValid) {
        showWarning(validation.message || 'Please fix all errors before continuing.');
        return;
    }
    
    // Calculate area for storage
    const roomData = {
        ...roomState,
        area: roomState.width * roomState.length,
        createdAt: new Date().toISOString()
    };
    
    try {
        showLoading(elements.loadingOverlay);
        
        // Save to Firestore (use project if available)
        const docId = roomState.projectId 
            ? await saveRoomToProject(roomData) 
            : await saveRoomToFirestore(roomData);
        
        // Store room ID in sessionStorage for next page
        sessionStorage.setItem('currentRoomId', docId);
        sessionStorage.setItem('currentRoomData', JSON.stringify(roomData));
        
        hideLoading(elements.loadingOverlay);
        
        // Show success message before navigation
        showSuccess('Room configuration saved successfully!', 1500);
        
        // Navigate to 2D Editor after brief delay
        setTimeout(() => {
            window.location.href = 'furniture-shop.html';
        }, 1500);
        
    } catch (error) {
        hideLoading(elements.loadingOverlay);
        console.error('Save error:', error);
        showWarning('Error saving room configuration. Please try again.');
    }
}

// ============================================
// NAVIGATION HANDLERS
// ============================================

function handleBackClick() {
    // Check if there are unsaved changes
    const hasChanges = roomState.width || roomState.length;
    
    if (hasChanges && !confirm('Are you sure you want to go back? Unsaved changes will be lost.')) {
        return;
    }
    
    // If part of a project, go back to project details; otherwise go to manage designs
    if (roomState.projectId) {
        window.location.href = `project-details.html?projectId=${roomState.projectId}`;
    } else {
        window.location.href = 'manage-designs.html';
    }
}

async function handleSaveDraft() {
    const validation = validateRoomData(roomState);
    
    if (!validation.isValid) {
        showWarning('Please fill in valid dimensions before saving a draft.');
        return;
    }
    
    const roomData = {
        ...roomState,
        area: roomState.width * roomState.length,
        isDraft: true,
        createdAt: new Date().toISOString()
    };
    
    try {
        showLoading(elements.loadingOverlay);
        // Use saveRoomToProject if projectId is present, else save globally
        if (roomState.projectId) {
            await saveRoomToProject(roomData);
        } else {
            await saveRoomToFirestore(roomData);
        }
        hideLoading(elements.loadingOverlay);
        showSuccess('Draft saved successfully!');
    } catch (error) {
        hideLoading(elements.loadingOverlay);
        console.error('Draft save error:', error);
        showWarning('Error saving draft. Please try again.');
    }
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

function handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + S to save draft
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveDraft();
    }
    
    // Ctrl/Cmd + Enter to submit (if valid)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!elements.continueBtn.disabled) {
            elements.form.dispatchEvent(new Event('submit'));
        }
    }
    
    // Ctrl/Cmd + D to toggle dark mode
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        toggleTheme();
    }
}

// Add CSS for pulse and ripple animations
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.02); }
    }
    
    @keyframes ripple {
        to {
            width: 400px;
            height: 400px;
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);