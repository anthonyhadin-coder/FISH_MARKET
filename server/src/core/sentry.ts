import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

export const initSentry = () => {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
        console.log("Sentry DSN not found, skipping initialization.");
        return;
    }

    Sentry.init({
        dsn: dsn,
        integrations: [
            nodeProfilingIntegration(),
        ],
        // Performance Monitoring
        tracesSampleRate: 1.0, //  Capture 100% of the transactions
        // Set sampling rate for profiling - this is relative to tracesSampleRate
        profilesSampleRate: 1.0,
    });
    
    console.log("Sentry initialized for Server.");
};
