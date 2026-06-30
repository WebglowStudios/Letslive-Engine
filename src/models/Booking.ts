import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPaymentRecord {
  amount: number;
  method: string;
  transactionId: string;
  date: Date;
  status: string;
}

export interface IBooking extends Document {
  bookingId: string;
  user: mongoose.Types.ObjectId;
  package: mongoose.Types.ObjectId;
  destination?: mongoose.Types.ObjectId;
  travelDate: Date;
  returnDate?: Date;
  travellers: { adults: number; children: number; infants: number };
  travellersDetails: { name: string; age?: number; phone?: string; type: 'adult' | 'child' | 'infant' }[];
  primaryTraveller: { firstName: string; lastName: string; email: string; phone?: string };
  totalAmount: number;
  paidAmount: number;
  paymentStatus: 'pending' | 'partial' | 'paid' | 'refunded';
  bookingStatus: 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';
  specialRequests?: string;
  contactPhone?: string;
  contactEmail?: string;
  paymentHistory: IPaymentRecord[];
  cancellationReason?: string;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<IBooking>(
  {
    bookingId: { type: String, unique: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    package: { type: Schema.Types.ObjectId, ref: 'Package', required: true, index: true },
    destination: { type: Schema.Types.ObjectId, ref: 'Destination' },
    enquiry: { type: Schema.Types.ObjectId, ref: 'Enquiry' },
    travelDate: { type: Date, required: true },
    returnDate: { type: Date },
    travellers: {
      adults: { type: Number, default: 1 },
      children: { type: Number, default: 0 },
      infants: { type: Number, default: 0 },
    },
    travellersDetails: [
      {
        name: { type: String },
        age: { type: Number },
        phone: { type: String },
        type: { type: String, enum: ['adult', 'child', 'infant'], default: 'adult' },
      },
    ],
    primaryTraveller: {
      firstName: { type: String },
      lastName: { type: String },
      email: { type: String },
      phone: { type: String },
    },
    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'refunded'],
      default: 'pending',
    },
    bookingStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    specialRequests: { type: String },
    contactPhone: { type: String },
    contactEmail: { type: String },
    paymentHistory: [
      {
        amount: { type: Number },
        method: { type: String },
        transactionId: { type: String },
        date: { type: Date },
        status: { type: String },
      },
    ],
    cancellationReason: { type: String },
    cancelledAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        // Expose bookingStatus as 'status' for frontend compatibility
        (ret as Record<string, unknown>).status = ret.bookingStatus;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform(_doc, ret) {
        (ret as Record<string, unknown>).status = ret.bookingStatus;
        return ret;
      },
    },
  }
);

// Auto-generate bookingId like "LLT-2026-00001"
bookingSchema.pre('save', async function () {
  if (!this.isNew || this.bookingId) return;

  const year = new Date().getFullYear();
  const lastBooking = await mongoose
    .model<IBooking>('Booking')
    .findOne({ bookingId: { $regex: `^LLT-${year}-` } })
    .sort({ bookingId: -1 })
    .lean();

  let counter = 1;
  if (lastBooking?.bookingId) {
    const lastCounter = parseInt(lastBooking.bookingId.split('-')[2], 10);
    counter = lastCounter + 1;
  }

  this.bookingId = `LLT-${year}-${String(counter).padStart(5, '0')}`;
});

const Booking: Model<IBooking> = mongoose.model<IBooking>('Booking', bookingSchema);

export default Booking;
