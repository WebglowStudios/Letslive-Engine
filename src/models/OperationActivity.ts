import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IActivityTransfer {
  _id?: mongoose.Types.ObjectId;
  title?: string;
  from: string;
  to: string;
  vehicleType?: string;
  duration?: string;
  departureTime?: string;
  arrivalTime?: string;
  driverName?: string;
  driverContact?: string;
  vehicleNumber?: string;
  notes?: string;
  hasPricing?: boolean;
  vendorName?: string;
  vendorContact?: string;
  vendorCost?: number;
  sellingPrice?: number;
  paymentStatus?: 'pending' | 'paid' | 'partial';
}

export interface IOperationActivity extends Document {
  operation: mongoose.Types.ObjectId;
  title: string;
  description: string;
  date?: Date;
  duration: string;
  tripDay: string;
  vendorName: string;
  vendorContact?: string;
  vendorEmail?: string;
  vendorCost: number;
  sellingPrice: number;
  paymentStatus: 'pending' | 'paid' | 'partial';
  paymentDueDate?: Date;
  remarks: string;
  groupId?: mongoose.Types.ObjectId;
  isGroupMaster?: boolean;
  linkedBooking?: mongoose.Types.ObjectId;
  transfers: IActivityTransfer[];
  createdAt: Date;
  updatedAt: Date;
}

const activityTransferSchema = new Schema<IActivityTransfer>(
  {
    title: { type: String, default: '' },
    from: { type: String, default: '' },
    to: { type: String, default: '' },
    vehicleType: { type: String, default: '' },
    duration: { type: String, default: '' },
    departureTime: { type: String, default: '' },
    arrivalTime: { type: String, default: '' },
    driverName: { type: String, default: '' },
    driverContact: { type: String, default: '' },
    vehicleNumber: { type: String, default: '' },
    notes: { type: String, default: '' },
    hasPricing: { type: Boolean, default: false },
    vendorName: { type: String, default: '' },
    vendorContact: { type: String, default: '' },
    vendorCost: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'partial'], default: 'pending' },
  },
  { _id: true }
);

const operationActivitySchema = new Schema<IOperationActivity>(
  {
    operation: { type: Schema.Types.ObjectId, ref: 'Operation', required: true, index: true },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    date: { type: Date },
    duration: { type: String, default: '' },
    tripDay: { type: String, default: '' }, // e.g. "Day 2", "Day 5"
    vendorName: { type: String, default: '' },
    vendorContact: { type: String, default: '' },
    vendorEmail: { type: String, default: '' },
    vendorCost: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'partial'], default: 'pending' },
    paymentDueDate: { type: Date },
    remarks: { type: String, default: '' },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'OperationActivity' },
    isGroupMaster: { type: Boolean, default: false },
    linkedBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    transfers: { type: [activityTransferSchema], default: [] },
  },
  { timestamps: true }
);

const OperationActivity: Model<IOperationActivity> = mongoose.model<IOperationActivity>('OperationActivity', operationActivitySchema);
export default OperationActivity;
