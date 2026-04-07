export const logger = {
    info: (message: string, meta?: any) => {
        console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'INFO', message, ...meta }));
    },
    error: (message: string, error?: any) => {
        console.error(JSON.stringify({ 
            timestamp: new Date().toISOString(), 
            level: 'ERROR', 
            message, 
            error: error instanceof Error ? { message: error.message, stack: error.stack } : error 
        }));
    },
    warn: (message: string, meta?: any) => {
        console.warn(JSON.stringify({ timestamp: new Date().toISOString(), level: 'WARN', message, ...meta }));
    }
};
