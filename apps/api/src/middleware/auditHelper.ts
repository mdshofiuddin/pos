import crypto from 'crypto';
import { getDb } from '../db/index.js';
import { TransactionContext } from '../db/contract/database.js';

export interface AuditLogOptions {
  actorId?: string;
  actorName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  correlationId?: string;
  ipAddress?: string;
  changeSummary: string;
  details?: any;
  tx?: TransactionContext;
}

export async function logAudit(options: AuditLogOptions): Promise<void> {
  const db = options.tx || getDb();
  const id = `aud-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const detailsJson = options.details ? JSON.stringify(options.details) : null;

  try {
    await db.execute(
      `INSERT INTO audit_logs (id, actor_id, actor_name, action, entity_type, entity_id, correlation_id, ip_address, change_summary, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        options.actorId || 'system',
        options.actorName || 'System',
        options.action,
        options.entityType,
        options.entityId || null,
        options.correlationId || crypto.randomUUID(),
        options.ipAddress || '127.0.0.1',
        options.changeSummary,
        detailsJson,
      ]
    );
  } catch (err) {
    console.error('[Audit Log Failure]:', err);
    // Audit failure should not crash main transaction unless critical
  }
}
