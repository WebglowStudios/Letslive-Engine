import mongoose, { Schema, Document, Model } from 'mongoose';
import slugify from 'slugify';

export interface ITravelTip {
  question: string;
  answer: string;
}

export interface IWhyVisit {
  icon: string;
  title: string;
  description: string;
}

export interface IDestination extends Document {
  name: string;
  slug: string;
  country?: string;
  region?: string;
  description?: string;
  shortDescription?: string;
  images: string[];
  heroImage?: string;
  category?: 'beach' | 'city' | 'mountain' | 'adventure' | 'cultural' | 'wildlife' | 'tropical';
  rating: number;
  reviewCount: number;
  packageCount: number;
  startingPrice?: number;
  bestSeason?: string;
  visaType?: 'free' | 'on-arrival' | 'required';
  visaInfo?: string;
  highlights: string[];
  travelTips: ITravelTip[];
  whyVisit: IWhyVisit[];
  partners: string[];
  groupDeal?: {
    title: string;
    description: string;
    image: string;
    discountText: string;
  };
  photoGallery: { image: string; label: string }[];
  isActive: boolean;
  isFeatured: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

const destinationSchema = new Schema<IDestination>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    country: { type: String },
    region: { type: String },
    description: { type: String },
    shortDescription: { type: String },
    images: [{ type: String }],
    heroImage: { type: String },
    category: {
      type: String,
      enum: ['beach', 'city', 'mountain', 'adventure', 'cultural', 'wildlife', 'tropical'],
    },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    packageCount: { type: Number, default: 0 },
    startingPrice: { type: Number },
    bestSeason: { type: String },
    visaType: { type: String, enum: ['free', 'on-arrival', 'required'] },
    visaInfo: { type: String },
    highlights: [{ type: String }],
    travelTips: [
      {
        question: { type: String },
        answer: { type: String },
      },
    ],
    whyVisit: [
      {
        icon: { type: String },
        title: { type: String },
        description: { type: String },
      },
    ],
    partners: [{ type: String }],
    groupDeal: {
      title: { type: String },
      description: { type: String },
      image: { type: String },
      discountText: { type: String },
    },
    photoGallery: [
      {
        image: { type: String },
        label: { type: String },
      },
    ],
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
);

// Auto-generate slug from name
destinationSchema.pre('validate', function () {
  if (this.isModified('name') || !this.slug) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
});

const Destination: Model<IDestination> = mongoose.model<IDestination>(
  'Destination',
  destinationSchema
);

export default Destination;
