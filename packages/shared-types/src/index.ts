export interface ApiError {
  message?: string;
  code?: string;
  response?: { 
    status?: number;
    data?: { 
      message?: string; 
      errors?: Array<{ path: string | string[]; message: string }> 
    } 
  };
}

export interface User {
    id: string;
    name: string;
    role: 'owner' | 'agent' | 'buyer' | 'admin' | 'viewer';
    language?: string;
}

export interface Boat {
    id: number;
    name: string;
    owner_id: number;
    agent_id: number;
    status: 'active' | 'pending';
    ownerPhone?: string;
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

export interface DailyReport {
    date: string;
    totalSales: number;
    totalExpenses: number;
    expenseBreakdown?: { type: string; total: number; notes?: string }[];
    boatPayments: number;
    cashWithAgent: number;
    boatProfit: number;
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

export interface AppNotification {
    id: string | number;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    timestamp: number;
    read: boolean;
}
