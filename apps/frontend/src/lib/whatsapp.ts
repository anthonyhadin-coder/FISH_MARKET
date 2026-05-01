/**
 * Formats and generates a WhatsApp sharing link.
 * 
 * @param phone - The recipient's phone number (with or without country code)
 * @param message - The text message to pre-fill
 * @returns A formatted wa.me URL
 */
export const generateWhatsAppLink = (phone: string, message: string): string => {
    // Basic cleaning of phone number
    let cleanedPhone = phone.replace(/\D/g, '');
    
    // Add default country code if missing (assuming India +91 if length is 10)
    if (cleanedPhone.length === 10) {
        cleanedPhone = '91' + cleanedPhone;
    }

    const encodedMessage = encodeURIComponent(message);
    return `https://wa.me/${cleanedPhone}?text=${encodedMessage}`;
};

/**
 * Opens the WhatsApp link in a new window/tab.
 */
export const shareToWhatsApp = (phone: string, message: string) => {
    const link = generateWhatsAppLink(phone, message);
    window.open(link, '_blank');
};
