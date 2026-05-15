import mongoose, { Schema, Document, Model } from 'mongoose';
import slugify from 'slugify';

export interface IItineraryDay {
  day: number;
  title: string;
  description: string;
  activities: string[];
  meals: string[];
  accommodation: string;
}

export interface IStay {
  name: string;
  rating: string;
  nights: number;
  roomType: string;
  amenities: string[];
}

export interface ITransfer {
  title: string;
  description: string;
  details: string[];
}

export interface IActivity {
  title: string;
  description: string;
  duration: string;
  details: string[];
}

export interface IPackage extends Document {
  name: string;
  slug: string;
  destination: mongoose.Types.ObjectId;
  description?: string;
  shortDescription?: string;
  images: string[];
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
  badge?: string;
  isActive: boolean;
  isFeatured: boolean;
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
      required: true,
      index: true,
    },
    description: { type: String },
    shortDescription: { type: String },
    images: [{ type: String }],
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
        details: [{ type: String }],
      },
    ],
    activities: [
      {
        title: { type: String },
        description: { type: String },
        duration: { type: String },
        details: [{ type: String }],
      },
    ],
    knowBeforeYouGo: [{ type: String }],
    thingsToCarry: [{ type: String }],
    badge: { type: String },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
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
