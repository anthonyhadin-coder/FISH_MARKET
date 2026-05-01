import api from './api';
import { LayoutDashboard, Plus, Users, History } from 'lucide-react';

export const agentLinks = [
    { href: '/agent',             icon: LayoutDashboard, label: 'Overview' },
    { href: '/agent/record-sale', icon: Plus,            label: 'Record Sale' },
    { href: '/agent/buyers',      icon: Users,           label: 'Buyers List' },
    { href: '/agent/history',     icon: History,         label: 'Sales History' },
];

import { Buyer } from '@fishmarket/shared-types';
export type { Buyer };

export const fetchBuyers = () =>
    api.get<Buyer[]>('/buyers').then(r => r.data);

export const createBuyer = (data: { name: string; phone?: string }) =>
    api.post<Buyer>('/buyers', data).then(r => r.data);

export const recordBuyerPayment = (id: number, amount: number) =>
    api.post(`/buyers/${id}/payment`, { amount }).then(r => r.data);

export const recordSaleForm = (data: {
    boatId: number;
    fishName: string;
    weight: number;
    rate: number;
    buyerName?: string;
    amountPaid?: number;
    cashReceived?: boolean;
}) => api.post('/sales', data).then(r => r.data);

export const fetchBuyerHistory = (id: number) =>
    api.get(`/buyers/${id}/balance`).then(r => r.data);

export const createBoat = (data: { name: string; agentId?: number }) =>
    api.post('/boats', data).then(r => r.data);

export const findOwnerByContact = (contact: string) =>
    api.get<{ owner: unknown; boats: unknown[] }>('/boats/find-owner', { params: { contact } }).then(r => r.data);

export const requestBoatLink = (boatId: number) =>
    api.post('/boats/request-link', { boatId }).then(r => r.data);
