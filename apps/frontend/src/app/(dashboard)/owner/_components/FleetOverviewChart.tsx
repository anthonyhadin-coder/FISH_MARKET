import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BoatHistory } from '@/lib/api/adminApi';

interface FleetOverviewChartProps {
    fleetData: BoatHistory[];
}

export default function FleetOverviewChart({ fleetData }: FleetOverviewChartProps) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={fleetData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} 
                    tickFormatter={(v: string) => new Date(v).toLocaleDateString('en-IN', { weekday: 'short' })}
                />
                <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(v: number) => `₹${v / 1000}k`}
                />
                <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    labelStyle={{ fontWeight: 900, color: '#0f172a', marginBottom: '8px' }}
                    formatter={(value: unknown) => [`₹${Number(value || 0).toLocaleString('en-IN')}`, '']}
                />
                <Area type="monotone" dataKey="sales" name="Gross Sales" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorExpenses)" />
            </AreaChart>
        </ResponsiveContainer>
    );
}
