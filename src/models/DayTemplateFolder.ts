import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDayTemplateFolder extends Document {
  name: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const dayTemplateFolderSchema = new Schema<IDayTemplateFolder>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const DayTemplateFolder: Model<IDayTemplateFolder> =
  mongoose.models.DayTemplateFolder || mongoose.model<IDayTemplateFolder>('DayTemplateFolder', dayTemplateFolderSchema);

export default DayTemplateFolder;
