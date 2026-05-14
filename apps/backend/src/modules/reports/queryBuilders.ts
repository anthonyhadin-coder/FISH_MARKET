export type Role = 'agent' | 'owner' | 'admin';

export interface FilterOptions {
    role: Role;
    userId: number;
    date?: string;
    boatId?: string;
    daysRange?: number;
    dateRange?: { start: string; end: string };
    skipDate?: boolean;
}

export function buildAgentOrOwnerFilter(options: FilterOptions) {
    const { role, userId, date, boatId, daysRange } = options;
    const CLAUSE_ALLOW_LIST = {
        agentFilter: 'agent_id = ?',
        ownerFilter: 'boat_id IN (SELECT id FROM boats WHERE owner_id = ?)',
        all: '1=1',
    };

    let baseFilter = '';
    const params: any[] = [];

    if (role === 'agent') {
        baseFilter = CLAUSE_ALLOW_LIST.agentFilter;
        params.push(userId);
    } else if (role === 'owner') {
        baseFilter = CLAUSE_ALLOW_LIST.ownerFilter;
        params.push(userId);
    } else if (role === 'admin') {
        baseFilter = CLAUSE_ALLOW_LIST.all;
    } else {
        throw new Error('Invalid role');
    }

    let dateFilter = '';
    if (!options.skipDate) {
        if (daysRange) {
            dateFilter = ' AND date >= DATE_SUB(CURRENT_DATE, INTERVAL ? DAY)';
            params.push(daysRange);
        } else if (options.dateRange) {
            dateFilter = ' AND date BETWEEN ? AND ?';
            params.push(options.dateRange.start, options.dateRange.end);
        } else if (date) {
            dateFilter = ' AND date = ?';
            params.push(date);
        } else {
            dateFilter = ' AND date = CURRENT_DATE';
        }
    }

    let boatFilter = '';
    if (boatId) {
        boatFilter = ' AND boat_id = ?';
        params.push(boatId);
    }

    const fullFilter = `${baseFilter}${dateFilter}${boatFilter}`;

    return {
        filterString: fullFilter,
        params
    };
}
