import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPackageTemplate extends Document {
  name: string;
  category: 'inclusions' | 'exclusions' | 'thingsToCarry' | 'keyPoints';
  items: string[];
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const packageTemplateSchema = new Schema<IPackageTemplate>(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['inclusions', 'exclusions', 'thingsToCarry', 'keyPoints', 'knowBeforeYouGo', 'highlights'],
      required: true,
    },
    items: [{ type: String }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Compound index for unique name per category
packageTemplateSchema.index({ name: 1, category: 1 }, { unique: true });

const PackageTemplate: Model<IPackageTemplate> = mongoose.model<IPackageTemplate>('PackageTemplate', packageTemplateSchema);

export default PackageTemplate;
