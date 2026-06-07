import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOperation extends Document {
  operationId: string;
  booking: mongoose.Types.ObjectId;
  package?: mongoose.Types.ObjectId;
  customer: {
    name: string;
    email: string;
    phone?: string;
    pax: number;
  };
  destination: string;
  travelDates: {
    start: Date;
    end: Date;
  };
  assignedTo?: mongoose.Types.ObjectId;
  sellingPrice: number;
  totalVendorCost: number;
  grossProfit: number;
  profitPercentage: number;
  status: 'planning' | 'booked' | 'in-progress' | 'completed' | 'cancelled';
  voucherGenerated: boolean;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const operationSchema = new Schema<IOperation>(
  {
    operationId: { type: String, unique: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    package: { type: Schema.Types.ObjectId, ref: 'Package' },
    customer: {
      name: { type: String, required: true },
      email: { type: String },
      phone: { type: String },
      pax: { type: Number, default: 1 },
    },
    destination: { type: String, required: true },
    travelDates: {
      start: { type: Date },
      end: { type: Date },
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    sellingPrice: { type: Number, default: 0 },
    totalVendorCost: { type: Number, default: 0 },
    grossProfit: { type: Number, default: 0 },
    profitPercentage: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['planning', 'booked', 'in-progress', 'completed', 'cancelled'],
      default: 'planning',
    },
    voucherGenerated: { type: Boolean, default: false },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// Auto-generate operationId
operationSchema.pre('save', async function () {
  if (!this.isNew || this.operationId) return;
  const year = new Date().getFullYear();
  const last = await mongoose
    .model<IOperation>('Operation')
    .findOne({ operationId: { $regex: `^OPS-${year}-` } })
    .sort({ operationId: -1 })
    .lean();
  let counter = 1;
  if (last?.operationId) {
    const lastNum = parseInt(last.operationId.split('-')[2], 10);
    counter = lastNum + 1;
  }
  this.operationId = `OPS-${year}-${String(counter).padStart(4, '0')}`;
});

// Auto-calculate profit on save
operationSchema.pre('save', function () {
  this.grossProfit = this.sellingPrice - this.totalVendorCost;
  this.profitPercentage = this.sellingPrice > 0
    ? Math.round((this.grossProfit / this.sellingPrice) * 100)
    : 0;
});

const Operation: Model<IOperation> = mongoose.model<IOperation>('Operation', operationSchema);
export default Operation;
