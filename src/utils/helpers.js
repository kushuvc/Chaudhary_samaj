// Utility functions for the application
/**
 * Format date to a readable string
 */
export const formatDate = (date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};
/**
 * Format date and time
 */
export const formatDateTime = (date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};
/**
 * Format currency
 */
export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
    }).format(amount);
};
/**
 * Format phone number
 */
export const formatPhone = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `+91-${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
    }
    return phone;
};
/**
 * Truncate text
 */
export const truncateText = (text, length) => {
    if (text.length <= length)
        return text;
    return text.slice(0, length) + '...';
};
/**
 * Generate random ID
 */
export const generateId = () => {
    return Math.random().toString(36).substring(2, 9);
};
/**
 * Capitalize first letter
 */
export const capitalize = (text) => {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};
/**
 * Check if value is empty
 */
export const isEmpty = (value) => {
    if (value === null || value === undefined)
        return true;
    if (typeof value === 'string')
        return value.trim() === '';
    if (Array.isArray(value))
        return value.length === 0;
    if (typeof value === 'object')
        return Object.keys(value).length === 0;
    return false;
};
/**
 * Deep clone object
 */
export const deepClone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
};
/**
 * Get initials from name
 */
export const getInitials = (name) => {
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
};
