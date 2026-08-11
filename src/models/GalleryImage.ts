import mongoose, { Document, Schema } from 'mongoose';

export interface IGalleryImage extends Document {
  url: string;
  caption?: string;
  isActive: boolean;
  sortOrder: number;
}

const GalleryImageSchema: Schema = new Schema(
  {
    url: {
      type: String,
      required: [true, 'Please provide an image URL'],
    },
    caption: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.GalleryImage || mongoose.model<IGalleryImage>('GalleryImage', GalleryImageSchema);
