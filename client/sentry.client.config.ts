import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 10% of transactions in production — 100% in dev for full visibility
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  // Capture full session replay only when an error occurs
  replaysOnErrorSampleRate: 1.0,
  debug: false,
  beforeSend(event) {
    if (event.request?.data && typeof event.request.data === 'object') {
      const data = event.request.data as Record<string, unknown>;
      if (data.phone) delete data.phone;
      if (data.password) delete data.password;
      if (data.newPassword) delete data.newPassword;
    }
    return event;
  },
});
