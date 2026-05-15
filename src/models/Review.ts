import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReview extends Document {
  user: mongoose.Types.ObjectId;
  package: mongoose.Types.ObjectId;
  destination?: mongoose.Types.ObjectId;
  booking?: mongoose.Types.ObjectId;
  rating: number;
  title?: string;
  text: string;
  tripType?: 'honeymoon' | 'family' | 'solo' | 'group' | 'business';
  travelDate?: Date;
  images: string[];
  isVerified: boolean;
  isApproved: boolean;
  helpfulCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    package: { type: Schema.Types.ObjectId, ref: 'Package', required: true, index: true },
    destination: { type: Schema.Types.ObjectId, ref: 'Destination', index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String },
    text: { type: String, required: true },
    tripType: {
      type: String,
      enum: ['honeymoon', 'family', 'solo', 'group', 'business'],
    },
    travelDate: { type: Date },
    images: [{ type: String }],
    isVerified: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: false },
    helpfulCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One review per user per package
reviewSchema.index({ package: 1, user: 1 }, { unique: true });

const Review: Model<IReview> = mongoose.model<IReview>('Review', reviewSchema);

export default Review;
