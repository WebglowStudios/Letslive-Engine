import mongoose, { Schema, Document, Model } from 'mongoose';
import slugify from 'slugify';

export interface IDayActivity {
  title: string;
  description?: string;
  image?: string;
  images?: string[];
}

export interface IItineraryDay {
  day: number;
  title: string;
  description: string;
  activities: (string | IDayActivity)[];
  meals: string[];
  accommodation: string;
  images: string[];
}

export interface IStay {
  name: string;
  rating: string;
  nights: number;
  roomType: string;
  rooms?: number;
  checkIn?: string;
  checkOut?: string;
  address?: string;
  confirmationNo?: string;
}

export interface ITransferLeg {
  from: string;
  to: string;
  stops: string[];
  transferType?: string;
  vehicleType?: string;
}

export interface ITransfer {
  title: string;
  description: string;
  transferType: string;
  vehicleType: string;
  from: string;
  to: string;
  stops: string[];
  legs: ITransferLeg[];
  day: number;
  details: string[];
  images: string[];
}

export interface IActivity {
  title: string;
  description: string;
  duration: string;
  details: string[];
  images: string[];
}

export interface IFlight {
  day: number;
  airline: string;
  flightNumber: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  pnr?: string;
  class?: string;
  notes?: string;
}

export interface IPackage extends Document {
  name: string;
  slug: string;
  destination?: mongoose.Types.ObjectId;
  customDestinationText?: string;
  description?: string;
  shortDescription?: string;
  images: string[];
  destinationImages: string[];
  stayImages: string[];
  activityImages: string[];
  heroImage?: string;
  duration: { nights: number; days: number };
  travelDates?: { startDate?: Date; endDate?: Date };
  hotelRating?: string;
  category?: string;
  originalPrice?: number;
  price: number;
  priceUnit: 'person' | 'couple' | 'family' | 'group';
  discount?: number;
  discountType?: 'percent' | 'amount';
  rating: number;
  reviewCount: number;
  highlights: string[];
  itinerary: IItineraryDay[];
  inclusions: string[];
  exclusions: string[];
  paymentPolicy: string[];
  cancellationPolicy: string[];
  flightCancellationPolicy: string[];
  stays: IStay[];
  transfers: ITransfer[];
  activities: IActivity[];
  flights: IFlight[];
  knowBeforeYouGo: string[];
  thingsToCarry: string[];
  keyPoints: string[];
  badge?: string;
  isActive: boolean;
  isFeatured: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  flightsIncluded: boolean;
  travellerCount?: string;
  adultCount?: number;
  childCount?: number;
  extraPersonPrice?: number;
  // Custom itinerary fields
  isCustom: boolean;
  showOnDestination: boolean;
  isInternational: boolean;
  visaIncluded: boolean;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  enquiryId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  // Group Tour fields
  isGroupTour: boolean;
  departures: {
    _id?: mongoose.Types.ObjectId;
    startDate: Date;
    endDate: Date;
    price: number;
    discount?: number;
    totalSlots: number;
    bookedSlots: number;
    status: 'available' | 'sold-out' | 'cancelled';
  }[];
  // Transfer summary (shown when no day-wise transfers exist)
  transferSummary?: string;
  // Payment configuration
  paymentConfig: {
    mode: 'full' | 'partial';           // full = pay full amount; partial = pay deposit now, rest later
    depositType: 'percent' | 'fixed';   // how the deposit is expressed
    depositValue: number;               // e.g. 30 (percent) or 10000 (fixed ₹)
    depositLabel?: string;              // custom label shown to user e.g. "Book with ₹5000"
    balanceDueDays?: number;            // days before travel by which balance must be paid
  };
  imageMap?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

const packageSchema = new Schema<IPackage>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    destination: {
      type: Schema.Types.ObjectId,
      ref: 'Destination',
      index: true,
    },
    customDestinationText: { type: String, trim: true },
    description: { type: String },
    shortDescription: { type: String },
    images: [{ type: String }],
    destinationImages: [{ type: String }],
    stayImages: [{ type: String }],
    activityImages: [{ type: String }],
    heroImage: { type: String },
    duration: {
      nights: { type: Number },
      days: { type: Number },
    },
    travelDates: {
      startDate: { type: Date },
      endDate: { type: Date },
    },
    hotelRating: { type: String },
    category: {
      type: String,
    },
    originalPrice: { type: Number },
    price: { type: Number, required: true },
    priceUnit: {
      type: String,
      enum: ['person', 'couple', 'family', 'group'],
      default: 'person',
    },
    discount: { type: Number },
    discountType: { type: String, enum: ['percent', 'amount'], default: 'percent' },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    highlights: [{ type: String }],
    itinerary: [
      {
        day: { type: Number },
        title: { type: String },
        description: { type: String },
        activities: [{ type: Schema.Types.Mixed }],
        meals: [{ type: String }],
        accommodation: { type: String },
        images: [{ type: String }],
      },
    ],
    inclusions: [{ type: String }],
    exclusions: [{ type: String }],
    paymentPolicy: [{ type: String }],
    cancellationPolicy: [{ type: String }],
    flightCancellationPolicy: [{ type: String }],
    stays: [
      {
        name: { type: String },
        rating: { type: String },
        nights: { type: Number },
        roomType: { type: String },
        rooms: { type: Number },
        checkIn: { type: String },
        checkOut: { type: String },
        address: { type: String },
        confirmationNo: { type: String },
      },
    ],
    transfers: [
      {
        title: { type: String },
        description: { type: String },
        transferType: { type: String },
        vehicleType: { type: String },
        from: { type: String },
        to: { type: String },
        stops: [{ type: String }],
        legs: [
          {
            from: { type: String },
            to: { type: String },
            stops: [{ type: String }],
            transferType: { type: String },
            vehicleType: { type: String },
          },
        ],
        day: { type: Number },
        details: [{ type: String }],
        images: [{ type: String }],
      },
    ],
    activities: [
      {
        title: { type: String },
        description: { type: String },
        duration: { type: String },
        details: [{ type: String }],
        images: [{ type: String }],
      },
    ],
    knowBeforeYouGo: [{ type: String }],
    thingsToCarry: [{ type: String }],
    keyPoints: [{ type: String }],
    flights: [
      {
        day: { type: Number },
        airline: { type: String },
        flightNumber: { type: String },
        from: { type: String },
        to: { type: String },
        departure: { type: String },
        arrival: { type: String },
        pnr: { type: String },
        class: { type: String },
        notes: { type: String },
      },
    ],
    badge: { type: String },
    flightsIncluded: { type: Boolean, default: false },
    travellerCount: { type: String },
    adultCount: { type: Number },
    childCount: { type: Number },
    extraPersonPrice: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    // Custom itinerary fields
    isCustom: { type: Boolean, default: false },
    showOnDestination: { type: Boolean, default: true },
    isInternational: { type: Boolean, default: false },
    visaIncluded: { type: Boolean, default: false },
    clientName: { type: String },
    clientEmail: { type: String },
    clientPhone: { type: String },
    enquiryId: { type: Schema.Types.ObjectId, ref: 'Enquiry' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    // Group Tour fields
    isGroupTour: { type: Boolean, default: false },
    departures: [
      {
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
        price: { type: Number, required: true },
        discount: { type: Number },
        totalSlots: { type: Number, default: 0 },
        bookedSlots: { type: Number, default: 0 },
        status: { type: String, enum: ['available', 'sold-out', 'cancelled'], default: 'available' },
      }
    ],
    // Transfer summary (shown when no day-wise transfers exist)
    transferSummary: { type: String },
    // Payment configuration per package
    paymentConfig: {
      mode: { type: String, enum: ['full', 'partial'], default: 'full' },
      depositType: { type: String, enum: ['percent', 'fixed'], default: 'percent' },
      depositValue: { type: Number, default: 30 },
      depositLabel: { type: String },
      balanceDueDays: { type: Number, default: 30 },
    },
  },
  { timestamps: true }
);

// Auto-generate slug from name only when slug isn't already explicitly provided
packageSchema.pre('validate', function () {
  if (!this.slug) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
});

const Package: Model<IPackage> = mongoose.model<IPackage>('Package', packageSchema);

export default Package;
