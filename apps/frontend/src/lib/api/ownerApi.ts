import api from './api';

export interface Boat {
    id: number;
    name: string;
    owner_id: number;
    agent_id: number | null;
    status: 'active' | 'inactive' | 'pending';
    requested_by: number | null;
    agent_name?: string;
    created_at?: string;
}

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
