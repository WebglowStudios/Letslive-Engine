import mongoose, { Schema, Document, Model } from 'mongoose';
import slugify from 'slugify';

export interface IApplication {
  name: string;
  email: string;
  phone: string;
  resume: string;
  coverLetter?: string;
  status: 'new' | 'reviewing' | 'shortlisted' | 'rejected' | 'hired';
  appliedAt: Date;
}

export interface ICareer extends Document {
  title: string;
  slug: string;
  department: 'operations' | 'marketing' | 'technology' | 'hr' | 'finance';
  location?: string;
  type: 'full-time' | 'part-time' | 'contract' | 'internship';
  experience?: string;
  description?: string;
  requirements: string[];
  responsibilities: string[];
  benefits: string[];
  salary: { min?: number; max?: number; currency: string };
  isActive: boolean;
  applications: IApplication[];
  createdAt: Date;
  updatedAt: Date;
}

const careerSchema = new Schema<ICareer>(
  {
    title: { type: String, required: true },
    slug: { type: String, unique: true },
    department: {
      type: String,
      enum: ['operations', 'marketing', 'technology', 'hr', 'finance'],
      required: true,
    },
    location: { type: String },
    type: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'internship'],
      default: 'full-time',
    },
    experience: { type: String },
    description: { type: String },
    requirements: [{ type: String }],
    responsibilities: [{ type: String }],
    benefits: [{ type: String }],
    salary: {
      min: { type: Number },
      max: { type: Number },
      currency: { type: String, default: 'INR' },
    },
    isActive: { type: Boolean, default: true },
    applications: [
      {
        name: { type: String },
        email: { type: String },
        phone: { type: String },
        resume: { type: String },
        coverLetter: { type: String },
        status: {
          type: String,
          enum: ['new', 'reviewing', 'shortlisted', 'rejected', 'hired'],
          default: 'new',
        },
        appliedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

// Auto-generate slug from title
careerSchema.pre('validate', function () {
  if (this.isModified('title') || !this.slug) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
});

const Career: Model<ICareer> = mongoose.model<ICareer>('Career', careerSchema);

export default Career;
