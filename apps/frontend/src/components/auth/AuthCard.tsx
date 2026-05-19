import React from 'react';

interface AuthCardProps {
  children: React.ReactNode;
}

export default function AuthCard({ children }: AuthCardProps) {
  return (
    <div className="bg-white md:rounded-2xl md:shadow-xl md:shadow-slate-200/50 p-6 sm:p-8 md:p-10 w-full border-transparent md:border-slate-100 border">
      {children}
    </div>
  );
}
