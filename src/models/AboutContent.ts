import mongoose, { Document, Schema } from 'mongoose';

export interface IAboutContent extends Document {
  hero: {
    title: string;
    subtitle: string;
    bgImage: string;
  };
  story: {
    year: string;
    title: string;
    text: string;
    text2: string;
    text3: string;
    image: string;
  };
  vision: {
    title: string;
    text: string;
  };
  mission: {
    title: string;
    text: string;
  };
  stats: {
    years: number;
    destinations: number;
    travelers: number;
    partners: number;
  };
}

const AboutContentSchema: Schema = new Schema(
  {
    hero: {
      title: { type: String, default: "Every Trip, Planned As If We're the Travelers." },
      subtitle: { type: String, default: "Founded in 2021, LetsLive simplifies holiday planning by combining personalized service, technology-driven convenience, and a deep understanding of what makes travel truly memorable." },
      bgImage: { type: String, default: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1600&q=80" },
    },
    story: {
      year: { type: String, default: "2021" },
      title: { type: String, default: "Built Around a Simple Belief" },
      text: { type: String, default: "LetsLive was born from a simple belief — every trip should be planned as if we were the travelers ourselves. We guide travelers through every stage of their journey, from planning and research to booking and on-ground experiences." },
      text2: { type: String, default: "Our approach combines personalized service, technology-driven convenience, and a deep understanding of what makes travel truly memorable." },
      text3: { type: String, default: "Today, we operate as a comprehensive travel platform designed to bring travelers, travel experts, and trusted partners together under one roof." },
      image: { type: String, default: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80" },
    },
    vision: {
      title: { type: String, default: "Our Vision" },
      text: { type: String, default: "To become the most trusted travel ecosystem for modern travelers by making travel planning simple, transparent, accessible, and enjoyable." },
    },
    mission: {
      title: { type: String, default: "Our Mission" },
      text: { type: String, default: "Deliver exceptional travel experiences, offer transparent value-for-money services, and build a trusted community of travelers and partners." },
    },
    stats: {
      years: { type: Number, default: 3 },
      destinations: { type: Number, default: 45 },
      travelers: { type: Number, default: 1200 },
      partners: { type: Number, default: 150 },
    },
  },
  {
    timestamps: true,
  }
);

// We will only ever have one document in this collection
export default mongoose.models.AboutContent || mongoose.model<IAboutContent>('AboutContent', AboutContentSchema);
