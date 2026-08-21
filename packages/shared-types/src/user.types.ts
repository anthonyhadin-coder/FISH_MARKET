// ─── User Types ─────────────────────────────────────────────────────────────

export type UserRole = 'owner' | 'agent' | 'buyer' | 'admin' | 'viewer';

export interface User {
    id: string;
    name: string;
    role: UserRole;
    email?: string;
    phone?: string;
    language?: string;
    avatar_url?: string;
    is_active?: boolean;
    is_verified?: boolean;
    created_at?: string;
}

export interface AppNotification {
    id: string | number;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    timestamp: number;
    read: boolean;
}
