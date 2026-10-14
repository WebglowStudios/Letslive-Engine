import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOperation extends Document {
  operationId: string;
  booking?: mongoose.Types.ObjectId;  // legacy single-booking ref
  bookings: mongoose.Types.ObjectId[];
  departureId?: mongoose.Types.ObjectId;
  package?: mongoose.Types.ObjectId;
  enquiry?: mongoose.Types.ObjectId;  // trace back to originating lead
  customer?: {            // legacy single-customer snapshot
    name: string;
    email: string;
    phone?: string;
    pax: number;
    adults?: number;
    children?: number;
  };
  customers: {
    name: string;
    email: string;
    phone?: string;
    pax: number;
    adults?: number;
    children?: number;
  }[];
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
  incentiveAmount?: number;
  status: 'planning' | 'booked' | 'vendor-confirmed' | 'in-progress' | 'completed' | 'cancelled';
  voucherGenerated: boolean;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

  const operationSchema = new Schema<IOperation>(
  {
    operationId: { type: String, unique: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', index: true },  // legacy single-booking
    bookings: [{ type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true }],
    departureId: { type: Schema.Types.ObjectId, index: true },
    package: { type: Schema.Types.ObjectId, ref: 'Package' },
    enquiry: { type: Schema.Types.ObjectId, ref: 'Enquiry' },
    customer: {            // legacy single-customer snapshot
      name: { type: String },
      email: { type: String },
      phone: { type: String },
      pax: { type: Number, default: 1 },
      adults: { type: Number },
      children: { type: Number },
    },
    customers: [{
      name: { type: String, required: true },
      email: { type: String },
      phone: { type: String },
      pax: { type: Number, default: 1 },
      adults: { type: Number },
      children: { type: Number },
    }],
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
    incentiveAmount: { type: Number },
    status: {
      type: String,
      enum: ['planning', 'booked', 'vendor-confirmed', 'in-progress', 'completed', 'cancelled'],
      default: 'planning',
    },
    voucherGenerated: { type: Boolean, default: false },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

// Auto-generate operationId (unified with Booking ID if linked)
operationSchema.pre('save', async function () {
  if (!this.isNew || this.operationId) return;

  // 1. If linked to a Booking, adopt the Booking's bookingId as the unified master ID
  const linkedBookingId = this.booking || (this.bookings && this.bookings.length > 0 ? this.bookings[0] : null);
  if (linkedBookingId) {
    const linkedBooking = await mongoose
      .model('Booking')
      .findById(linkedBookingId)
      .select('bookingId')
      .lean();
    if (linkedBooking && (linkedBooking as any).bookingId) {
      this.operationId = (linkedBooking as any).bookingId;
      return;
    }
  }

  // 2. Fallback for standalone operations without booking
  const year = new Date().getFullYear();
  const last = await mongoose
    .model<IOperation>('Operation')
    .findOne({ operationId: { $regex: `^OPS-${year}-\\d{4}$` } })
    .sort({ operationId: -1 })
    .lean();
  let counter = 1;
  if (last?.operationId) {
    const parts = last.operationId.split('-');
    if (parts.length >= 3) {
      const lastNum = parseInt(parts[2], 10);
      if (!isNaN(lastNum)) counter = lastNum + 1;
    }
  }
  let candidateId = `OPS-${year}-${String(counter).padStart(4, '0')}`;
  while (await mongoose.model('Operation').exists({ operationId: candidateId })) {
    counter++;
    candidateId = `OPS-${year}-${String(counter).padStart(4, '0')}`;
  }
  this.operationId = candidateId;
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
