import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IVendor extends Document {
  name: string;
  type: 'flight' | 'hotel' | 'vehicle' | 'activity' | 'mixed';
  contactPerson: string;
  phone: string;
  email: string;
  bankDetails: string;
  gstNumber: string;
  address: string;
  notes: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const vendorSchema = new Schema<IVendor>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['flight', 'hotel', 'vehicle', 'activity', 'mixed'], default: 'mixed' },
    contactPerson: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    bankDetails: { type: String, default: '' },
    gstNumber: { type: String, default: '' },
    address: { type: String, default: '' },
    notes: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const Vendor: Model<IVendor> = mongoose.model<IVendor>('Vendor', vendorSchema);
export default Vendor;
