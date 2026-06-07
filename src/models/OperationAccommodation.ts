import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOperationAccommodation extends Document {
  operation: mongoose.Types.ObjectId;
  type: string; // hotel, motel, hostel, inn, resort, villa, apartment, homestay, etc.
  name: string; // property name
  area: string;
  roomCategory: string;
  mealPlan: string;
  checkIn?: Date;
  checkOut?: Date;
  nights: number;
  confirmationNumber: string;
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

const schema = new Schema<IOperationAccommodation>(
  {
    operation: { type: Schema.Types.ObjectId, ref: 'Operation', required: true, index: true },
    type: { type: String, default: 'hotel' }, // flexible — no enum
    name: { type: String, default: '' },
    area: { type: String, default: '' },
    roomCategory: { type: String, default: '' },
    mealPlan: { type: String, default: 'CP' },
    checkIn: { type: Date },
    checkOut: { type: Date },
    nights: { type: Number, default: 1 },
    confirmationNumber: { type: String, default: '' },
    tripDay: { type: String, default: '' }, // e.g. "Day 1-3", "Day 4-7"
    vendorName: { type: String, default: '' },
    vendorCost: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'partial'], default: 'pending' },
    paymentDueDate: { type: Date },
    remarks: { type: String, default: '' },
  },
  { timestamps: true }
);

// Auto-calculate nights
schema.pre('save', function () {
  if (this.checkIn && this.checkOut) {
    const diff = new Date(this.checkOut).getTime() - new Date(this.checkIn).getTime();
    this.nights = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
});

const OperationAccommodation: Model<IOperationAccommodation> = mongoose.model<IOperationAccommodation>('OperationAccommodation', schema);
export default OperationAccommodation;
