import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOperationHotel extends Document {
  operation: mongoose.Types.ObjectId;
  hotelName: string;
  area: string;
  roomCategory: string;
  mealPlan: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  confirmationNumber: string;
  vendorName: string;
  vendorCost: number;
  sellingPrice: number;
  paymentStatus: 'pending' | 'paid' | 'partial';
  paymentDueDate?: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const operationHotelSchema = new Schema<IOperationHotel>(
  {
    operation: { type: Schema.Types.ObjectId, ref: 'Operation', required: true, index: true },
    hotelName: { type: String, default: '' },
    area: { type: String, default: '' },
    roomCategory: { type: String, default: '' },
    mealPlan: { type: String, default: 'CP' },
    checkIn: { type: Date },
    checkOut: { type: Date },
    nights: { type: Number, default: 1 },
    confirmationNumber: { type: String, default: '' },
    vendorName: { type: String, default: '' },
    vendorCost: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'partial'], default: 'pending' },
    paymentDueDate: { type: Date },
    remarks: { type: String },
  },
  { timestamps: true }
);

// Auto-calculate nights
operationHotelSchema.pre('save', function () {
  if (this.checkIn && this.checkOut) {
    const diff = new Date(this.checkOut).getTime() - new Date(this.checkIn).getTime();
    this.nights = Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
});

const OperationHotel: Model<IOperationHotel> = mongoose.model<IOperationHotel>('OperationHotel', operationHotelSchema);
export default OperationHotel;
