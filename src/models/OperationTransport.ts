import mongoose, { Schema, Document, Model } from 'mongoose';

// ─── Leg sub-schema ───────────────────────────────────────────────────────────
export interface ITransferLeg {
  from: string;
  to: string;
  date?: Date;
  tripDay: string;       // e.g. "Day 1", "Arrival", "Day 3-4"
  vehicleType: string;   // free text: Car, SUV, Bus, Flight, Train, Ferry, etc.
  notes: string;         // leg-specific notes
  pnr?: string;
  departureTime?: string;
  arrivalTime?: string;
  driverName?: string;
  driverContact?: string;
  vehicleNumber?: string;
  duration?: string;
}

// ─── Parent document interface ────────────────────────────────────────────────
export interface IOperationTransport extends Document {
  operation: mongoose.Types.ObjectId;
  type: string;
  title: string;           // e.g. "Airport Transfer - Day 1" (auto-filled from itinerary)
  vendorName: string;      // e.g. "Ravi Travels" (filled manually by ops team)
  vendorContact: string;
  vendorEmail: string;
  vendorCost: number;
  sellingPrice: number;
  paymentStatus: 'pending' | 'paid' | 'partial';
  paymentDueDate?: Date;
  isUrgent: boolean;
  remarks: string;
  groupId?: mongoose.Types.ObjectId;
  isGroupMaster?: boolean;
  linkedBooking?: mongoose.Types.ObjectId;
  legs: ITransferLeg[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Leg sub-schema definition ────────────────────────────────────────────────
const legSchema = new Schema<ITransferLeg>(
  {
    from:        { type: String, default: '' },
    to:          { type: String, default: '' },
    date:        { type: Date },
    tripDay:     { type: String, default: '' },
    vehicleType: { type: String, default: '' },
    notes:       { type: String, default: '' },
    pnr:         { type: String, default: '' },
    departureTime:{ type: String, default: '' },
    arrivalTime: { type: String, default: '' },
    driverName:  { type: String, default: '' },
    driverContact:{ type: String, default: '' },
    vehicleNumber:{ type: String, default: '' },
    duration:    { type: String, default: '' },
  },
  { _id: true }
);

// ─── Parent schema definition ─────────────────────────────────────────────────
const schema = new Schema<IOperationTransport>(
  {
    operation:     { type: Schema.Types.ObjectId, ref: 'Operation', required: true, index: true },
    type:          { type: String, default: 'other' },
    title:         { type: String, default: '' },
    vendorName:    { type: String, default: '' },
    vendorContact: { type: String, default: '' },
    vendorEmail:   { type: String, default: '' },
    vendorCost:    { type: Number, default: 0 },
    sellingPrice:  { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'partial'], default: 'pending' },
    paymentDueDate: { type: Date },
    isUrgent:      { type: Boolean, default: false },
    remarks:       { type: String, default: '' },
    groupId:       { type: mongoose.Schema.Types.ObjectId, ref: 'OperationTransport' },
    isGroupMaster: { type: Boolean, default: false },
    linkedBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    // Use direct array notation for sub-document arrays in Mongoose TS
    legs:          { type: [legSchema], default: [] },
  },
  { timestamps: true }
);

// ─── Auto-set urgent flag ─────────────────────────────────────────────────────
// Explicitly type `this` so TS resolves the document fields correctly
schema.pre<IOperationTransport>('save', function () {
  if (this.paymentDueDate && this.paymentStatus !== 'paid') {
    const hoursUntilDue = (new Date(this.paymentDueDate).getTime() - Date.now()) / (1000 * 60 * 60);
    this.isUrgent = hoursUntilDue <= 48;
  } else {
    this.isUrgent = false;
  }
});

const OperationTransport: Model<IOperationTransport> = mongoose.model<IOperationTransport>('OperationTransport', schema);
export default OperationTransport;
