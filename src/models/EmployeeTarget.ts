import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEmployeeTarget extends Document {
  user: mongoose.Types.ObjectId;
  periodType: 'monthly' | 'quarterly' | 'yearly';
  year: number;
  month?: number; // 1 - 12
  quarter?: number; // 1 - 4
  
  salesTarget: number; // Target number of closed bookings/conversions
  revenueTarget: number; // Target revenue generated in ₹
  reviewTarget: number; // Target number of reviews entered into the system
  package?: mongoose.Types.ObjectId; // Optional target package for reviews
  packageName?: string; // Optional package name cache

  notes?: string;
  setBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const employeeTargetSchema = new Schema<IEmployeeTarget>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    periodType: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly'],
      required: true,
      default: 'monthly',
    },
    year: { type: Number, required: true },
    month: { type: Number, min: 1, max: 12 },
    quarter: { type: Number, min: 1, max: 4 },

    salesTarget: { type: Number, default: 0, min: 0 },
    revenueTarget: { type: Number, default: 0, min: 0 },
    reviewTarget: { type: Number, default: 0, min: 0 },
    package: { type: Schema.Types.ObjectId, ref: 'Package' },
    packageName: { type: String, trim: true },

    notes: { type: String, trim: true },
    setBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Ensure one target record per employee per timeframe
employeeTargetSchema.index(
  { user: 1, periodType: 1, year: 1, month: 1, quarter: 1 },
  { unique: true }
);

const EmployeeTarget: Model<IEmployeeTarget> = mongoose.model<IEmployeeTarget>(
  'EmployeeTarget',
  employeeTargetSchema
);

export default EmployeeTarget;
