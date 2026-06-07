import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVendorPayment extends Document {
  operation: mongoose.Types.ObjectId;
  vendor: string;
  serviceType: 'flight' | 'hotel' | 'vehicle' | 'activity' | 'other';
  serviceRef?: mongoose.Types.ObjectId;
  description: string;
  amount: number;
  dueDate?: Date;
  paidDate?: Date;
  paidAmount: number;
  paymentMode: string;
  transactionId: string;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  isUrgent: boolean;
  remarks: string;
  createdAt: Date;
  updatedAt: Date;
}

const vendorPaymentSchema = new Schema<IVendorPayment>(
  {
    operation: { type: Schema.Types.ObjectId, ref: 'Operation', required: true, index: true },
    vendor: { type: String, default: '' },
    serviceType: {
      type: String,
      enum: ['flight', 'hotel', 'vehicle', 'activity', 'other'],
      default: 'other',
    },
    serviceRef: { type: Schema.Types.ObjectId },
    description: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    dueDate: { type: Date },
    paidDate: { type: Date },
    paidAmount: { type: Number, default: 0 },
    paymentMode: { type: String, default: '' },
    transactionId: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'overdue'],
      default: 'pending',
    },
    isUrgent: { type: Boolean, default: false },
    remarks: { type: String, default: '' },
  },
  { timestamps: true }
);

// Auto-detect overdue and urgent status
vendorPaymentSchema.pre('save', function () {
  if (this.paidAmount >= this.amount) {
    this.status = 'paid';
    this.isUrgent = false;
  } else if (this.paidAmount > 0) {
    this.status = 'partial';
  }

  if (this.dueDate && this.status !== 'paid') {
    const now = Date.now();
    const due = new Date(this.dueDate).getTime();
    if (due < now) {
      this.status = 'overdue';
      this.isUrgent = true;
    } else if ((due - now) <= 48 * 60 * 60 * 1000) {
      this.isUrgent = true;
    }
  }
});

const VendorPayment: Model<IVendorPayment> = mongoose.model<IVendorPayment>('VendorPayment', vendorPaymentSchema);
export default VendorPayment;
