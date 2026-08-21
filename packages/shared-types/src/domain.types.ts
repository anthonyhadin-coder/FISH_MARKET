// ─── Fish Market Domain Types ────────────────────────────────────────────────

export interface Boat {
    id: number;
    name: string;
    owner_id: number;
    agent_id: number | null;
    status: 'active' | 'inactive' | 'pending';
    ownerPhone?: string;
    requested_by?: number | null;
    agent_name?: string;
    created_at?: string;
}

export interface Buyer {
    id: number;
    name: string;
    phone: string;
    created_at?: string;
    totalSales?: number;
    totalPaid?: number;
    balance?: number;
}

export interface SaleRow {
    id: string | number;
    fishName?: string;
    fish?: string;
    fish_name?: string;
    weight: string | number;
    rate: string | number;
    total?: number;
    buyer?: string;
    buyerName?: string;
    amountPaid?: number;
    balance?: number;
    date?: string;
    created_at?: string;
}

export interface Payment {
    id: string | number;
    amount?: number;
    amt?: number;
    amount_paid?: number;
    note?: string;
    date?: string;
    created_at?: string;
    time?: string;
    by?: string;
}

export interface DailyReport {
    date: string;
    totalSales: number;
    totalExpenses: number;
    expenseBreakdown?: { type: string; total: number; notes?: string }[];
    boatPayments: number;
    cashWithAgent: number;
    boatProfit: number;
}

export type QualityGrade = 'A' | 'B' | 'C' | 'REJECTED';

export interface Product {
    id: number;
    uuid?: string;
    seller_id: number;
    category_id: number;
    name: string;
    description?: string;
    price_per_kg: number;
    stock_kg: number;
    min_order_kg?: number;
    quality_grade?: QualityGrade;
    origin_location?: string;
    is_available: boolean;
    is_verified: boolean;
    images?: string[];
    created_at?: string;
    updated_at?: string;
}

export type OrderStatus =
    | 'PENDING'
    | 'CONFIRMED'
    | 'PREPARING'
    | 'SHIPPED'
    | 'DELIVERED'
    | 'CANCELLED'
    | 'REFUNDED';

export interface Order {
    id: number;
    uuid?: string;
    buyer_id: number;
    status: OrderStatus;
    total_amount: number;
    tax_amount?: number;
    shipping_amount?: number;
    discount_amount?: number;
    payment_status: 'UNPAID' | 'PAID' | 'FAILED' | 'REFUNDED';
    payment_method?: string;
    shipping_address: Record<string, string>;
    notes?: string;
    placed_at?: string;
    confirmed_at?: string;
    delivered_at?: string;
}
