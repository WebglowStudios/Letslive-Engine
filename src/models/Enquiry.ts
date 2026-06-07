import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INote {
  text: string;
  by: mongoose.Types.ObjectId;
  date: Date;
}

export interface IEnquiry extends Document {
  type: 'general' | 'booking' | 'support' | 'callback' | 'group-quote';
  firstName: string;
  lastName?: string;
  email: string;
  phone: string;
  destination?: string;
  travelDate?: Date;
  message?: string;
  packageName?: string;
  package?: mongoose.Types.ObjectId;
  status: 'new' | 'assigned' | 'in-progress' | 'follow-up' | 'converted' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: mongoose.Types.ObjectId;
  notes: INote[];
  source: 'website' | 'whatsapp' | 'phone';
  createdAt: Date;
  updatedAt: Date;
}

const enquirySchema = new Schema<IEnquiry>(
  {
    type: {
      type: String,
      enum: ['general', 'booking', 'support', 'callback', 'group-quote'],
      default: 'general',
    },
    firstName: { type: String, required: true },
    lastName: { type: String },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    destination: { type: String },
    travelDate: { type: Date },
    message: { type: String },
    packageName: { type: String },
    package: { type: Schema.Types.ObjectId, ref: 'Package' },
    status: {
      type: String,
      enum: ['new', 'assigned', 'in-progress', 'follow-up', 'converted', 'resolved', 'closed'],
      default: 'new',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: [
      {
        text: { type: String },
        by: { type: Schema.Types.ObjectId, ref: 'User' },
        date: { type: Date, default: Date.now },
      },
    ],
    source: {
      type: String,
      enum: ['website', 'whatsapp', 'phone'],
      default: 'website',
    },
  },
  { timestamps: true }
);

const Enquiry: Model<IEnquiry> = mongoose.model<IEnquiry>('Enquiry', enquirySchema);

export default Enquiry;
