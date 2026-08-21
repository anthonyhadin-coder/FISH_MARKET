/**
 * phone.ts — Phone number utilities
 */

/**
 * Sanitizes and normalizes a phone number.
 * Ensures the number has a +91 prefix for India.
 */
export const cleanPhoneNumber = (phone: string) => {
    // 1. Remove all non-numeric characters EXCEPT '+'
    const raw = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
    
    // 2. Handle 10-digit numbers (prepend +91)
    if (/^\d{10}$/.test(raw)) return `+91${raw}`;
    
    // 3. Handle 12-digit numbers starting with 91 (prepend +)
    if (/^91\d{10}$/.test(raw)) return `+${raw}`;
    
    // 4. Handle leading 0 (replace with +91)
    if (/^0\d{10}$/.test(raw)) return `+91${raw.substring(1)}`;
    
    // 5. If it already starts with +91, return as is
    if (raw.startsWith('+91')) return raw;
    
    return raw; // Fallback
};
