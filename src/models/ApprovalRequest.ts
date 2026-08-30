import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IApprovalRequest extends Document {
  entityType: 'Package' | 'Destination';
  entityId?: mongoose.Types.ObjectId;
  action: 'create' | 'update' | 'delete';
  payload: any;
  requestedBy: mongoose.Types.ObjectId;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: mongoose.Types.ObjectId;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const approvalRequestSchema = new Schema<IApprovalRequest>(
  {
    entityType: { type: String, enum: ['Package', 'Destination'], required: true },
    entityId: { type: Schema.Types.ObjectId, refPath: 'entityType' },
    action: { type: String, enum: ['create', 'update', 'delete'], required: true },
    payload: { type: Schema.Types.Mixed },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewNotes: { type: String },
  },
  { timestamps: true }
);

const ApprovalRequest: Model<IApprovalRequest> = mongoose.model<IApprovalRequest>('ApprovalRequest', approvalRequestSchema);
export default ApprovalRequest;
