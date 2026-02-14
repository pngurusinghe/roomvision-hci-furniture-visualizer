/**
 * RoomVision - Enhanced Validation Module
 * Centralized validation logic for room configuration
 * HCI Coursework - Demonstrates separation of concerns and reusability
 */

/**
 * Validates a dimension value (width, length, or height)
 * 
 * @param {number} value - The dimension value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @param {number} min - Minimum allowed value (default: 2)
 * @param {number} max - Maximum allowed value (default: 20)
 * @returns {Object} Validation result {isValid: boolean, message: string}
 */
export function validateDimension(value, fieldName, min = 2, max = 20) {
    // Check if value is a valid number
    if (isNaN(value) || value === null || value === undefined) {
        return {
            isValid: false,
            message: `${fieldName} must be a valid number`
        };
    }
    
    // Check for negative values
    if (value < 0) {
        return {
            isValid: false,
            message: `${fieldName} cannot be negative`
        };
    }
    
    // Check for zero
    if (value === 0) {
        return {
            isValid: false,
            message: `${fieldName} cannot be zero`
        };
    }
    
    // Check minimum value
    if (value < min) {
        return {
            isValid: false,
            message: `${fieldName} must be at least ${min}m`
        };
    }
    
    // Check maximum value
    if (value > max) {
        return {
            isValid: false,
            message: `${fieldName} cannot exceed ${max}m`
        };
    }
    
    // Check for reasonable precision (max 2 decimal places)
    const decimalPlaces = (value.toString().split('.')[1] || '').length;
    if (decimalPlaces > 2) {
        return {
            isValid: false,
            message: `${fieldName} should have at most 2 decimal places`
        };
    }
    
    // All validations passed
    return {
        isValid: true,
        message: ''
    };
}

/**
 * Validates complete room data object
 * Ensures all required fields are present and valid
 * 
 * @param {Object} roomData - Complete room configuration object
 * @returns {Object} Validation result with detailed errors
 */
export function validateRoomData(roomData) {
    const errors = [];
    
    // Validate width
    if (!roomData.width) {
        errors.push('Width is required');
    } else {
        const widthValidation = validateDimension(roomData.width, 'Width');
        if (!widthValidation.isValid) {
            errors.push(widthValidation.message);
        }
    }
    
    // Validate length
    if (!roomData.length) {
        errors.push('Length is required');
    } else {
        const lengthValidation = validateDimension(roomData.length, 'Length');
        if (!lengthValidation.isValid) {
            errors.push(lengthValidation.message);
        }
    }
    
    // Validate height (optional, but if provided must be valid)
    if (roomData.height) {
        const heightValidation = validateDimension(roomData.height, 'Height', 2, 6);
        if (!heightValidation.isValid) {
            errors.push(heightValidation.message);
        }
    }
    
    // Validate shape
    const validShapes = ['rectangular', 'square'];
    if (!validShapes.includes(roomData.shape)) {
        errors.push('Invalid room shape selected');
    }
    
    // Validate square dimensions if shape is square
    if (roomData.shape === 'square' && roomData.width && roomData.length) {
        if (roomData.width !== roomData.length) {
            errors.push('Square rooms must have equal width and length');
        }
    }
    
    // Validate colors (basic format check)
    if (!roomData.wallColor || !isValidColor(roomData.wallColor)) {
        errors.push('Invalid wall color');
    }
    
    if (!roomData.floorColor || !isValidColor(roomData.floorColor)) {
        errors.push('Invalid floor color');
    }
    
    // Validate room type
    const validRoomTypes = [
        'living-room', 
        'bedroom', 
        'dining-room', 
        'office', 
        'kitchen', 
        'bathroom', 
        'study', 
        'kids-room', 
        'guest-room'
    ];
    if (!validRoomTypes.includes(roomData.roomType)) {
        errors.push('Invalid room type selected');
    }
    
    // Additional business logic validations
    if (roomData.width && roomData.length) {
        const area = roomData.width * roomData.length;
        
        // Warn if area is unusually small (less than 4 m²)
        if (area < 4) {
            errors.push('Room area is very small. Please verify dimensions');
        }
        
        // Warn if area is unusually large (more than 400 m²)
        if (area > 400) {
            errors.push('Room area is very large. Please verify dimensions');
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors,
        message: errors.length > 0 ? errors[0] : '' // Return first error for display
    };
}

/**
 * Validates color format (hex color)
 * 
 * @param {string} color - Color value to validate
 * @returns {boolean} True if valid hex color
 */
function isValidColor(color) {
    // Check if it's a valid hex color
    const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    return hexPattern.test(color);
}

/**
 * Validates that square rooms have equal width and length
 * 
 * @param {number} width - Room width
 * @param {number} length - Room length
 * @param {string} shape - Room shape
 * @returns {Object} Validation result
 */
export function validateSquareShape(width, length, shape) {
    if (shape === 'square') {
        if (!width || !length) {
            return {
                isValid: false,
                message: 'Please enter both width and length for square room'
            };
        }
        
        if (width !== length) {
            return {
                isValid: false,
                message: 'Square rooms must have equal width and length'
            };
        }
    }
    
    return {
        isValid: true,
        message: ''
    };
}

/**
 * Validates room proportions for aesthetic and practical purposes
 * 
 * @param {number} width - Room width
 * @param {number} length - Room length
 * @returns {Object} Validation result with warnings
 */
export function validateRoomProportions(width, length) {
    if (!width || !length) {
        return {
            isValid: true,
            message: '',
            warning: null
        };
    }
    
    const ratio = Math.max(width, length) / Math.min(width, length);
    
    // Warn if room is very elongated (ratio > 3:1)
    if (ratio > 3) {
        return {
            isValid: true,
            message: '',
            warning: 'This room has unusual proportions (very elongated). This is valid but uncommon.'
        };
    }
    
    return {
        isValid: true,
        message: '',
        warning: null
    };
}

/**
 * Sanitizes user input to prevent injection attacks
 * 
 * @param {string} input - User input string
 * @returns {string} Sanitized string
 */
export function sanitizeInput(input) {
    if (typeof input !== 'string') {
        return input;
    }
    
    // Remove any HTML tags
    return input.replace(/<[^>]*>/g, '').trim();
}

/**
 * Validates numeric input in real-time
 * 
 * @param {string} input - User input
 * @param {Object} constraints - Validation constraints
 * @returns {Object} Validation result
 */
export function validateNumericInput(input, constraints = {}) {
    const {
        min = 0,
        max = Infinity,
        decimals = 2,
        required = false
    } = constraints;
    
    // Check if input is empty
    if (!input || input.trim() === '') {
        if (required) {
            return {
                isValid: false,
                message: 'This field is required'
            };
        }
        return {
            isValid: true,
            message: ''
        };
    }
    
    // Check if it's a valid number
    const value = parseFloat(input);
    if (isNaN(value)) {
        return {
            isValid: false,
            message: 'Please enter a valid number'
        };
    }
    
    // Check range
    if (value < min) {
        return {
            isValid: false,
            message: `Value must be at least ${min}`
        };
    }
    
    if (value > max) {
        return {
            isValid: false,
            message: `Value cannot exceed ${max}`
        };
    }
    
    // Check decimal places
    const inputDecimals = (input.split('.')[1] || '').length;
    if (inputDecimals > decimals) {
        return {
            isValid: false,
            message: `Maximum ${decimals} decimal places allowed`
        };
    }
    
    return {
        isValid: true,
        message: '',
        value: value
    };
}

/**
 * Batch validates all room inputs
 * Returns object with field-specific errors
 * 
 * @param {Object} inputs - Object containing all input values
 * @returns {Object} Validation results for each field
 */
export function batchValidateInputs(inputs) {
    const results = {
        width: validateDimension(inputs.width, 'Width'),
        length: validateDimension(inputs.length, 'Length'),
        height: inputs.height ? validateDimension(inputs.height, 'Height', 2, 6) : { isValid: true, message: '' },
        isValid: true,
        errors: []
    };
    
    // Collect all errors
    Object.keys(results).forEach(key => {
        if (key !== 'isValid' && key !== 'errors' && !results[key].isValid) {
            results.isValid = false;
            results.errors.push(results[key].message);
        }
    });
    
    return results;
}

/**
 * Formats a dimension value for display
 * 
 * @param {number} value - Dimension value
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted value
 */
export function formatDimension(value, decimals = 2) {
    if (!value || isNaN(value)) {
        return '0.00';
    }
    
    return Number(value).toFixed(decimals);
}

/**
 * Calculates room metrics
 * 
 * @param {Object} dimensions - Room dimensions
 * @returns {Object} Calculated metrics
 */
export function calculateRoomMetrics(dimensions) {
    const { width, length, height = 2.8 } = dimensions;
    
    if (!width || !length) {
        return null;
    }
    
    return {
        area: Number((width * length).toFixed(2)),
        volume: Number((width * length * height).toFixed(2)),
        perimeter: Number((2 * (width + length)).toFixed(2)),
        wallArea: Number((2 * height * (width + length)).toFixed(2))
    };
}