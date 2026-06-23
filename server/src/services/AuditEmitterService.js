import { EventEmitter } from 'events';
import { prisma } from '../db.js';
import geoip from 'geoip-lite';

class AuditEmitter extends EventEmitter {}

export const AuditEmitterService = new AuditEmitter();

// Listener for general audit logs
AuditEmitterService.on('AUDIT_LOG_CREATED', async (payload) => {
  try {
    const { userId, organizationId, action, entityType, entityId, details, previousValue, newValue, ipAddress, location } = payload;
    
    // Auto-resolve location if not provided
    let resolvedLocation = location;
    if (!resolvedLocation && ipAddress && ipAddress !== '127.0.0.1' && ipAddress !== '::1') {
      const geo = geoip.lookup(ipAddress);
      if (geo) {
        resolvedLocation = `${geo.city || geo.region || geo.country}, ${geo.country}`;
      }
    }

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action,
        entityType,
        entityId,
        ipAddress,
        location: resolvedLocation,
        details: details || undefined,
        previousValue: previousValue || undefined,
        newValue: newValue || undefined
      }
    });
  } catch (error) {
    console.error('AuditEmitterService [AUDIT_LOG_CREATED] Failed to write audit log to DB:', error);
  }
});

// Listener for approval record events
AuditEmitterService.on('APPROVAL_RECORD_CREATED', async (payload) => {
  try {
    await prisma.approvalRecord.create({
      data: payload
    });
  } catch (error) {
    console.error('AuditEmitterService [APPROVAL_RECORD_CREATED] Failed to write approval record to DB:', error);
  }
});
