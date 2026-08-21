'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Legacy /customer route — redirects to the new (buyer)/marketplace route group.
 * Kept for backward compatibility with any existing bookmarks / deeplinks.
 */
export default function CustomerRedirectPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/marketplace');
    }, [router]);
    return null;
}
