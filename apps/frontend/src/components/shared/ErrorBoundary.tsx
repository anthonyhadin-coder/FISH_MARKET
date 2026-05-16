'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logTelemetry } from '@/lib/api/api';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(_: Error): State {
        return { hasError: true };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        logTelemetry('error', {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
            info: 'REACT_ERROR_BOUNDARY_CAPTURE'
        });
    }

    public render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                    <div className="max-w-md w-full bg-white rounded-3xl p-8 shadow-xl border border-gray-100 text-center">
                        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-black text-gray-900 mb-2">Something went wrong</h2>
                        <p className="text-gray-600 mb-8 font-medium">
                            An unexpected error occurred. Our team has been notified.
                        </p>
                        <button 
                            onClick={() => window.location.reload()}
                            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200"
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
