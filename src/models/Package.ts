import mongoose, { Schema, Document, Model } from 'mongoose';
import slugify from 'slugify';

export interface IItineraryDay {
  day: number;
  title: string;
  description: string;
  activities: string[];
  meals: string[];
  accommodation: string;
  images: string[];
}

export interface IStay {
  name: string;
  rating: string;
  nights: number;
  roomType: string;
  amenities: string[];
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

export interface IPackage extends Document {
  name: string;
  slug: string;
  destination?: mongoose.Types.ObjectId;
  description?: string;
  shortDescription?: string;
  images: string[];
  destinationImages: string[];
  stayImages: string[];
  activityImages: string[];
  heroImage?: string;
  duration: { nights: number; days: number };
  hotelRating?: string;
  category?: 'luxury' | 'honeymoon' | 'family' | 'adventure' | 'group' | 'budget';
  originalPrice?: number;
  price: number;
  priceUnit: 'person' | 'couple' | 'family';
  discount?: number;
  rating: number;
  reviewCount: number;
  highlights: string[];
  itinerary: IItineraryDay[];
  inclusions: string[];
  exclusions: string[];
  stays: IStay[];
  transfers: ITransfer[];
  activities: IActivity[];
  knowBeforeYouGo: string[];
  thingsToCarry: string[];
  keyPoints: string[];
  badge?: string;
  isActive: boolean;
  isFeatured: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  flightsIncluded: boolean;
  travellerCount?: string;
  isCustom: boolean;
  showOnDestination: boolean;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  enquiryId?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
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
    hotelRating: { type: String },
    category: {
      type: String,
      enum: ['luxury', 'honeymoon', 'family', 'adventure', 'group', 'budget'],
    },
    originalPrice: { type: Number },
    price: { type: Number, required: true },
    priceUnit: {
      type: String,
      enum: ['person', 'couple', 'family'],
      default: 'person',
    },
    discount: { type: Number },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    highlights: [{ type: String }],
    itinerary: [
      {
        day: { type: Number },
        title: { type: String },
        description: { type: String },
        activities: [{ type: String }],
        meals: [{ type: String }],
        accommodation: { type: String },
        images: [{ type: String }],
      },
    ],
    inclusions: [{ type: String }],
    exclusions: [{ type: String }],
    stays: [
      {
        name: { type: String },
        rating: { type: String },
        nights: { type: Number },
        roomType: { type: String },
        amenities: [{ type: String }],
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
    badge: { type: String },
    flightsIncluded: { type: Boolean, default: false },
    travellerCount: { type: String },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    // Custom itinerary fields
    isCustom: { type: Boolean, default: false },
  showOnDestination: { type: Boolean, default: false },
    clientName: { type: String },
    clientEmail: { type: String },
    clientPhone: { type: String },
    enquiryId: { type: Schema.Types.ObjectId, ref: 'Enquiry' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Auto-generate slug from name
packageSchema.pre('validate', function () {
  if (this.isModified('name') || !this.slug) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
});

const Package: Model<IPackage> = mongoose.model<IPackage>('Package', packageSchema);

export default Package;
