import api from './api';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AdminUser {
    id: number;
    name: string;
    phone: string;
    role: 'owner' | 'agent' | 'buyer';
    created_at: string;
}

export interface AdminBoat {
    id: number;
    name: string;
    owner_id: number | null;
    agent_id: number | null;
    status: 'active' | 'inactive' | 'pending' | 'rejected';
    requested_by?: number | null;
    owner_name: string | null;
    owner_phone: string | null;
    agent_name: string | null;
    agent_phone: string | null;
}

export interface BoatHistory {
    date?: string;
    month?: number;
    sales: number;
    expenses: number;
    payments: number;
    profit: number;
}

export interface BoatReportResponse {
    boatId: string;
    boatName: string;
    year: string;
    month?: string;
    history: BoatHistory[];
}

export interface BoatReport {
    boatId: number;
    boatName: string;
    agentName: string;
    totalSales: number;
    totalExpenses: number;
    totalPayments: number;
    cashWithAgent: number;
    profit: number;
}

export interface ReportSummary {
    totalSales: number;
    totalExpenses: number;
    totalPayments: number;
    totalProfit: number;
}

export interface AdminReport {
    date: string;
    summary: ReportSummary;
    boats: BoatReport[];
}

// ─── User API ────────────────────────────────────────────────────────────────

export const fetchAllUsers = (role?: string) =>
    api.get<AdminUser[]>('/admin/users', { params: role ? { role } : {} }).then(r => r.data);

export const createUser = (data: { name: string; phone: string; role: string; password: string }) =>
    api.post<AdminUser>('/admin/users', data).then(r => r.data);

export const deleteUser = (id: number) =>
    api.delete(`/admin/users/${id}`).then(r => r.data);

// ─── Boat API ────────────────────────────────────────────────────────────────

export const fetchAllBoatsAdmin = () =>
    api.get<AdminBoat[]>('/admin/boats').then(r => r.data);

export const updateBoat = (id: number, data: { name?: string; agentId?: number | null; status?: 'active' | 'inactive' }) =>
    api.put<AdminBoat>(`/admin/boats/${id}`, data).then(r => r.data);

export const createBoatAdmin = (data: { name: string; agentId?: number | null }) =>
    api.post<AdminBoat>('/boats', data).then(r => r.data);

export const deleteBoat = (id: number) =>
    api.delete(`/admin/boats/${id}`).then(r => r.data);

export const approveBoatLink = (data: { boatId: number; agentId: number; action: 'approve' | 'reject' }) =>
    api.post('/boats/approve-link', data).then(r => r.data);

// ─── Report API ───────────────────────────────────────────────────────────────

export const fetchAdminReport = (date?: string) =>
    api.get<AdminReport>('/admin/reports', { params: date ? { date } : {} }).then(r => r.data);

export const fetchBoatMonthlyReport = (boatId: string, year: string, month: string) =>
    api.get<BoatReportResponse>('/admin/reports/boat-monthly', { params: { boatId, year, month } }).then(r => r.data);

export const fetchBoatYearlyReport = (boatId: string, year: string) =>
    api.get<BoatReportResponse>('/admin/reports/boat-yearly', { params: { boatId, year } }).then(r => r.data);

export const fetchBoatWeeklyReport = (boatId: string) =>
    api.get<BoatReportResponse>('/admin/reports/boat-weekly', { params: { boatId } }).then(r => r.data);

export const fetchFleetWeeklyReport = () =>
    api.get<BoatHistory[]>('/admin/reports/fleet-weekly').then(r => r.data);

export const fetchOwnerBoatWeeklyReport = (boatId: string, weekStart: string, weekEnd: string) =>
    api.get<unknown>('/reports/boat/owner-weekly', { params: { boat_id: boatId, week_start: weekStart, week_end: weekEnd } }).then(r => r.data);

export const fetchAgentBoatWeeklyReport = (boatId: string, weekStart: string, weekEnd: string) =>
    api.get<unknown>('/reports/boat/agent-weekly', { params: { boat_id: boatId, week_start: weekStart, week_end: weekEnd } }).then(r => r.data);
