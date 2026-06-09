import { Request } from 'express';
import ActivityLog, { IActivityLog } from '../models/ActivityLog.js';

type LogActivityParams = {
  req: Request;
  action: IActivityLog['action'];
  entity: IActivityLog['entity'];
  entityId?: string;
  entityName?: string;
  description: string;
  meta?: Record<string, unknown>;
};

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    if (!params.req.user) return;
    const user = params.req.user;
    await ActivityLog.create({
      user: user._id,
      userName: `${user.firstName} ${user.lastName}`,
      userRole: user.role,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      entityName: params.entityName,
      description: params.description,
      meta: params.meta,
    });
  } catch (err) {
    // Never let logging break the main request
    console.error('Activity log error:', err);
  }
}
