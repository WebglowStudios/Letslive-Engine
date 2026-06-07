import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOperationTransport extends Document {
  operation: mongoose.Types.ObjectId;
  type: string; // flight, train, bus, ferry, car, taxi, buggy, cruise, etc.
  name: string; // airline name, train name, bus company, car model, etc.
  bookingRef: string; // PNR for flights/trains, booking ID for others
  route: string; // BOM → DXB, Station A → Station B, Pickup → Drop
  date?: Date;
  departureTime: string;
  arrivalTime: string;
  driverName: string; // for car/taxi/bus
  driverContact: string;
  vehicleNumber: string; // for car/bus
  duration: string; // "Full day", "4 hours", "Airport transfer only"
  tripDay: string; // "Day 1", "Day 3-4", "Arrival"
  vendorName: string;
  vendorCost: number;
  sellingPrice: number;
  paymentStatus: 'pending' | 'paid' | 'partial';
  paymentDueDate?: Date;
  isUrgent: boolean;
  remarks: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IOperationTransport>(
  {
    operation: { type: Schema.Types.ObjectId, ref: 'Operation', required: true, index: true },
    type: { type: String, default: 'flight' }, // no enum restriction — flexible
    name: { type: String, default: '' },
    bookingRef: { type: String, default: '' },
    route: { type: String, default: '' },
    date: { type: Date },
    departureTime: { type: String, default: '' },
    arrivalTime: { type: String, default: '' },
    driverName: { type: String, default: '' },
    driverContact: { type: String, default: '' },
    vehicleNumber: { type: String, default: '' },
    duration: { type: String, default: '' }, // e.g. "Full day", "4 hours", "Airport transfer only"
    tripDay: { type: String, default: '' }, // e.g. "Day 1", "Day 3-4", "Arrival"
    vendorName: { type: String, default: '' },
    vendorCost: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'partial'], default: 'pending' },
    paymentDueDate: { type: Date },
    isUrgent: { type: Boolean, default: false },
    remarks: { type: String, default: '' },
  },
  { timestamps: true }
);

// Auto-set urgent
schema.pre('save', function () {
  if (this.paymentDueDate && this.paymentStatus !== 'paid') {
    const hoursUntilDue = (new Date(this.paymentDueDate).getTime() - Date.now()) / (1000 * 60 * 60);
    this.isUrgent = hoursUntilDue <= 48;
  } else {
    this.isUrgent = false;
  }
});

const OperationTransport: Model<IOperationTransport> = mongoose.model<IOperationTransport>('OperationTransport', schema);
export default OperationTransport;
