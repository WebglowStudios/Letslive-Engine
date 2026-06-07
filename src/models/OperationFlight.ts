import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOperationFlight extends Document {
  operation: mongoose.Types.ObjectId;
  airline: string;
  pnr: string;
  route: string;
  departureDate: Date;
  departureTime: string;
  arrivalTime: string;
  vendorName: string;
  vendorCost: number;
  sellingPrice: number;
  paymentStatus: 'pending' | 'paid' | 'partial';
  paymentDueDate?: Date;
  isUrgent: boolean;
  ticketUrl?: string;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const operationFlightSchema = new Schema<IOperationFlight>(
  {
    operation: { type: Schema.Types.ObjectId, ref: 'Operation', required: true, index: true },
    airline: { type: String, default: '' },
    pnr: { type: String, default: '' },
    route: { type: String, default: '' },
    departureDate: { type: Date },
    departureTime: { type: String },
    arrivalTime: { type: String },
    vendorName: { type: String, default: '' },
    vendorCost: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'partial'], default: 'pending' },
    paymentDueDate: { type: Date },
    isUrgent: { type: Boolean, default: false },
    ticketUrl: { type: String },
    remarks: { type: String },
  },
  { timestamps: true }
);

// Auto-set urgent if payment due within 48 hours
operationFlightSchema.pre('save', function () {
  if (this.paymentDueDate && this.paymentStatus !== 'paid') {
    const hoursUntilDue = (new Date(this.paymentDueDate).getTime() - Date.now()) / (1000 * 60 * 60);
    this.isUrgent = hoursUntilDue <= 48;
  } else {
    this.isUrgent = false;
  }
});

const OperationFlight: Model<IOperationFlight> = mongoose.model<IOperationFlight>('OperationFlight', operationFlightSchema);
export default OperationFlight;
