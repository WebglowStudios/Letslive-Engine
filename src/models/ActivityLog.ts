import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IActivityLog extends Document {
  user: mongoose.Types.ObjectId;
  userName: string;
  userRole: string;
  action: 'create' | 'update' | 'delete' | 'approve' | 'status_change' | 'login' | 'other';
  entity: 'package' | 'destination' | 'booking' | 'career' | 'article' | 'review' | 'enquiry' | 'staff' | 'operation' | 'vendor' | 'other';
  entityId?: string;
  entityName?: string;
  description: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    userRole: { type: String, required: true },
    action: {
      type: String,
      enum: ['create', 'update', 'delete', 'approve', 'status_change', 'login', 'other'],
      required: true,
    },
    entity: {
      type: String,
      enum: ['package', 'destination', 'booking', 'career', 'article', 'review', 'enquiry', 'staff', 'operation', 'vendor', 'other'],
      required: true,
    },
    entityId: { type: String },
    entityName: { type: String },
    description: { type: String, required: true },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Index for fast queries — most recent first, filter by entity/action
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ entity: 1, createdAt: -1 });

const ActivityLog: Model<IActivityLog> = mongoose.model<IActivityLog>('ActivityLog', activityLogSchema);

export default ActivityLog;
