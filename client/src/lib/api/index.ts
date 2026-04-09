// Re-exports the canonical API client from src/lib/api.ts.
// Both `@/lib/api` and `@/lib/api/index` resolve here — the directory
// takes priority over the file in Next.js, so this is the true entry point.
export { default } from '../api';
export * from '../api';
