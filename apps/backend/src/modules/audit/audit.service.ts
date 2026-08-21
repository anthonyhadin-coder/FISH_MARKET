import { query } from '@fishmarket/database';
import { logger } from '../../utils/logger';

export type AuditSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

export interface AuditLogEntry {
    user_id?: number;
    action: string;
    entity_type?: string;
    entity_id?: number;
    ip_address?: string;
    user_agent?: string;
    metadata?: Record<string, unknown>;
    severity?: AuditSeverity;
}

/**
 * Write an audit log entry to the database.
 *
 * PHASE 17 FIX — Silent audit failure behaviour improved:
 * - The function still swallows DB errors so it never blocks the main request flow.
 * - However it now logs a structured ERROR with the full error details so that
 *   monitoring tools (Sentry, log aggregators) can alert on persistent failures.
 * - For CRITICAL severity events, the error is tagged as CRITICAL in the log to
 *   allow high-priority alerting rules to trigger.
 */
export async function logActivity(entry: AuditLogEntry): Promise<void> {
    try {
        await query(
            `INSERT INTO audit_logs
                (user_id, action, entity_type, entity_id, ip_address, user_agent, metadata, severity)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                entry.user_id ?? null,
                entry.action,
                entry.entity_type ?? null,
                entry.entity_id ?? null,
                entry.ip_address ?? null,
                entry.user_agent ?? null,
                entry.metadata ? JSON.stringify(entry.metadata) : null,
                entry.severity ?? 'INFO',
            ]
        );
    } catch (err: unknown) {
        // Never throw — audit failure must not break the main request flow.
        // Log at ERROR level so monitoring/Sentry can alert on persistent DB issues.
        const logLevel = entry.severity === 'CRITICAL' ? 'error' : 'error';
        logger[logLevel]({
            message: 'AuditService: failed to write audit log',
            action: entry.action,
            severity: entry.severity ?? 'INFO',
            entity_type: entry.entity_type,
            entity_id: entry.entity_id,
            // Do NOT log metadata — may contain sensitive information
            error: err instanceof Error ? { name: err.name, message: err.message } : String(err),
        });
    }
}
