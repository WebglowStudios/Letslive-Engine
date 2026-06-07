import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOperationActivity extends Document {
  operation: mongoose.Types.ObjectId;
  title: string;
  description: string;
  date?: Date;
  duration: string;
  tripDay: string;
  vendorName: string;
  vendorCost: number;
  sellingPrice: number;
  paymentStatus: 'pending' | 'paid' | 'partial';
  paymentDueDate?: Date;
  remarks: string;
  createdAt: Date;
  updatedAt: Date;
}

const operationActivitySchema = new Schema<IOperationActivity>(
  {
    operation: { type: Schema.Types.ObjectId, ref: 'Operation', required: true, index: true },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    date: { type: Date },
    duration: { type: String, default: '' },
    tripDay: { type: String, default: '' }, // e.g. "Day 2", "Day 5"
    vendorName: { type: String, default: '' },
    vendorCost: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'partial'], default: 'pending' },
    paymentDueDate: { type: Date },
    remarks: { type: String, default: '' },
  },
  { timestamps: true }
);

const OperationActivity: Model<IOperationActivity> = mongoose.model<IOperationActivity>('OperationActivity', operationActivitySchema);
export default OperationActivity;
