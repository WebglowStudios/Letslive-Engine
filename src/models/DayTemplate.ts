import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDayTemplate extends Document {
  name: string;
  folder: string;
  title: string;
  description: string;
  activities: string[];
  meals: string[];
  accommodation: string;
  images: string[];
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const dayTemplateSchema = new Schema<IDayTemplate>(
  {
    name: { type: String, required: true, trim: true },
    folder: { type: String, default: 'Uncategorized', trim: true },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    activities: [{ type: String }],
    meals: [{ type: String }],
    accommodation: { type: String, default: '' },
    images: [{ type: String }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Compound index for efficient folder-based lookups
dayTemplateSchema.index({ folder: 1, name: 1 });

const DayTemplate: Model<IDayTemplate> = mongoose.models.DayTemplate || mongoose.model<IDayTemplate>('DayTemplate', dayTemplateSchema);

export default DayTemplate;
