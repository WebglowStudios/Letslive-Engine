import mongoose, { Document, Schema } from 'mongoose';

export interface IMediaImage extends Document {
  url: string;
  name: string; // Location or place name, e.g. "Betaab Valley, Pahalgam"
  publicId: string;
  folder: string;
  width?: number;
  height?: number;
  format?: string;
  size?: number;
  createdAt: Date;
  updatedAt: Date;
}

const MediaImageSchema = new Schema<IMediaImage>(
  {
    url: {
      type: String,
      required: [true, 'Please provide an image URL'],
      unique: true,
      index: true,
    },
    name: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    publicId: {
      type: String,
      required: [true, 'Please provide a Cloudinary publicId'],
      unique: true,
      index: true,
    },
    folder: {
      type: String,
      default: 'letslivetours',
      index: true,
    },
    width: { type: Number },
    height: { type: Number },
    format: { type: String },
    size: { type: Number },
  },
  {
    timestamps: true,
  }
);

export const MediaImage =
  mongoose.models.MediaImage || mongoose.model<IMediaImage>('MediaImage', MediaImageSchema);

export default MediaImage;
