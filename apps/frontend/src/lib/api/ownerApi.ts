import api from './api';
import type { Boat } from '@fishmarket/shared-types';
export type { Boat };

export const fetchMyBoats = () =>
    api.get<Boat[]>('/boats').then(r => r.data);

export const createBoat = (data: { name: string }) =>
    api.post<Boat>('/boats', data).then(r => r.data);

export const approveBoatLink = (data: { 
    boatId: number; 
    agentId: number; 
    action: 'approve' | 'reject' 
}) => api.post('/boats/approve-link', data).then(r => r.data);

export const deleteBoat = (id: number) =>
    api.delete(`/boats/${id}`).then(r => r.data);
