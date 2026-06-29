import mongoose, { Schema, Document, Model } from 'mongoose';
import slugify from 'slugify';

export interface IArticle extends Document {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  tags: string[];
  destination?: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  readTime: number;
  isPublished: boolean;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const articleSchema = new Schema<IArticle>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    excerpt: { type: String, required: true },
    content: { type: String, required: true },
    coverImage: { type: String },
    category: { type: String, default: 'travel' },
    tags: [{ type: String }],
    destination: { type: Schema.Types.ObjectId, ref: 'Destination', index: true },
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    readTime: { type: Number, default: 5 },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

// Auto-generate slug
articleSchema.pre('validate', function () {
  if (this.isModified('title') || !this.slug) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
});

// Auto-calculate read time (avg 200 words/min)
articleSchema.pre('save', function () {
  if (this.isModified('content')) {
    const wordCount = this.content.split(/\s+/).length;
    this.readTime = Math.max(1, Math.ceil(wordCount / 200));
  }
  // Set publishedAt when first published
  if (this.isPublished && !this.publishedAt) {
    this.publishedAt = new Date();
  }
});

const Article: Model<IArticle> = mongoose.model<IArticle>('Article', articleSchema);

export default Article;
