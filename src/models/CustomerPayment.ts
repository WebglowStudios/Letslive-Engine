import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICustomerPayment extends Document {
  operation: mongoose.Types.ObjectId;
  booking?: mongoose.Types.ObjectId;
  milestone: string;
  amount: number;
  dueDate?: Date;
  paidDate?: Date;
  paidAmount: number;
  paymentMode: string;
  transactionId: string;
  status: 'upcoming' | 'paid' | 'overdue' | 'partial';
  financeStatus: 'none' | 'pending_approval' | 'approved' | 'rejected';
  financeDetails?: { paidAmount: number; mode: string; transactionId: string; remarks: string; requestedBy?: mongoose.Types.ObjectId };
  requestedBy?: mongoose.Types.ObjectId;
  paymentLinkEnabled: boolean;
  paymentLink: string;
  remarks: string;
  createdAt: Date;
  updatedAt: Date;
}

const customerPaymentSchema = new Schema<ICustomerPayment>(
  {
    operation: { type: Schema.Types.ObjectId, ref: 'Operation', required: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', index: true },
    milestone: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    dueDate: { type: Date },
    paidDate: { type: Date },
    paidAmount: { type: Number, default: 0 },
    paymentMode: { type: String, default: '' },
    transactionId: { type: String, default: '' },
    status: {
      type: String,
      enum: ['upcoming', 'paid', 'overdue', 'partial'],
      default: 'upcoming',
    },
    financeStatus: {
      type: String,
      enum: ['none', 'pending_approval', 'approved', 'rejected'],
      default: 'none',
    },
    financeDetails: {
      paidAmount: { type: Number },
      mode: { type: String },
      transactionId: { type: String },
      remarks: { type: String },
      requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    paymentLinkEnabled: { type: Boolean, default: false },
    paymentLink: { type: String, default: '' },
    remarks: { type: String, default: '' },
  },
  { timestamps: true }
);

// Auto-detect status
customerPaymentSchema.pre('save', function () {
  if (this.amount > 0 && this.paidAmount >= this.amount) {
    this.status = 'paid';
  } else if (this.paidAmount > 0 && this.paidAmount < this.amount) {
    this.status = 'partial';
  } else if (this.amount === 0 && this.paidAmount === 0) {
    this.status = 'upcoming';
  } else if (this.dueDate && new Date(this.dueDate).getTime() < Date.now()) {
    this.status = 'overdue';
  } else {
    this.status = 'upcoming';
  }
});

const CustomerPayment: Model<ICustomerPayment> = mongoose.model<ICustomerPayment>('CustomerPayment', customerPaymentSchema);
export default CustomerPayment;
