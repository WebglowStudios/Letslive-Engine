import mongoose, { Schema, Document, Model } from 'mongoose';

export interface INote {
  text: string;
  by: mongoose.Types.ObjectId;
  date: Date;
}

export interface ICallLog {
  attemptedAt: Date;
  outcome: 'answered' | 'dnp' | 'busy' | 'whatsapp-sent' | 'email-sent' | 'callback-scheduled';
  notes?: string;
  by: mongoose.Types.ObjectId;
  duration?: number; // call duration in seconds
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
  user?: mongoose.Types.ObjectId;          // Linked customer account (if created)
  status: 'new' | 'assigned' | 'in-progress' | 'follow-up' | 'converted' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: mongoose.Types.ObjectId;
  notes: INote[];
  source: 'website' | 'whatsapp' | 'phone' | 'walk-in' | 'instagram' | 'google' | 'referral' | 'other';
  // ─── CRM fields ───────────────────────────────────────────────────────────
  dnpCount: number;                            // 0–6+, incremented each unanswered call attempt
  followUpDate?: Date;                         // Scheduled next contact date
  followUpNotes?: string;                      // Quick note for the follow-up
  lostReason?: string;                         // Why the lead was closed
  conversionValue?: number;                    // ₹ value when status → converted
  bookingRef?: mongoose.Types.ObjectId;        // Linked booking once converted
  travellerCount?: number;                     // Pax count
  budget?: number;                             // Customer's stated budget
  tags: string[];                              // Free-form: 'honeymoon', 'family', etc.
  channel?: string;                            // Lead acquisition channel
  callLog: ICallLog[];                         // Per-call attempt records
  lastContactedAt?: Date;                      // Last time customer actually picked up/replied
  // ──────────────────────────────────────────────────────────────────────────
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
    user: { type: Schema.Types.ObjectId, ref: 'User' },   // linked customer account
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
      enum: ['website', 'whatsapp', 'phone', 'walk-in', 'instagram', 'google', 'referral', 'other'],
      default: 'website',
    },

    // ─── CRM fields ─────────────────────────────────────────────────────────
    dnpCount: { type: Number, default: 0, min: 0 },
    followUpDate: { type: Date },
    followUpNotes: { type: String },
    lostReason: {
      type: String,
      enum: ['no-budget', 'went-elsewhere', 'not-responding', 'not-interested', 'timing', 'other'],
    },
    conversionValue: { type: Number },
    bookingRef: { type: Schema.Types.ObjectId, ref: 'Booking' },
    travellerCount: { type: Number },
    budget: { type: Number },
    tags: [{ type: String }],
    channel: {
      type: String,
      enum: ['instagram', 'google', 'referral', 'repeat', 'walk-in', 'website', 'whatsapp', 'phone', 'other'],
    },
    callLog: [
      {
        attemptedAt: { type: Date, default: Date.now },
        outcome: {
          type: String,
          enum: ['answered', 'dnp', 'busy', 'whatsapp-sent', 'email-sent', 'callback-scheduled'],
          required: true,
        },
        notes: { type: String },
        by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        duration: { type: Number }, // seconds
      },
    ],
    lastContactedAt: { type: Date },
    // ────────────────────────────────────────────────────────────────────────
  },
  { timestamps: true }
);

// CRM-specific indexes for fast queries
enquirySchema.index({ followUpDate: 1, status: 1 });
enquirySchema.index({ assignedTo: 1, status: 1 });
enquirySchema.index({ dnpCount: 1 });
enquirySchema.index({ channel: 1 });
enquirySchema.index({ createdAt: -1 });

const Enquiry: Model<IEnquiry> = mongoose.model<IEnquiry>('Enquiry', enquirySchema);

export default Enquiry;
