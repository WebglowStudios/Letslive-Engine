import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IOperationVehicle extends Document {
  operation: mongoose.Types.ObjectId;
  vehicleType: string;
  vehicleNumber: string;
  driverName: string;
  driverContact: string;
  route: string;
  dates: { from: Date; to: Date };
  vendorName: string;
  vendorCost: number;
  sellingPrice: number;
  paymentStatus: 'pending' | 'paid' | 'partial';
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const operationVehicleSchema = new Schema<IOperationVehicle>(
  {
    operation: { type: Schema.Types.ObjectId, ref: 'Operation', required: true, index: true },
    vehicleType: { type: String, default: 'Sedan AC' },
    vehicleNumber: { type: String, default: '' },
    driverName: { type: String, default: '' },
    driverContact: { type: String, default: '' },
    route: { type: String, default: '' },
    dates: {
      from: { type: Date },
      to: { type: Date },
    },
    vendorName: { type: String, default: '' },
    vendorCost: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'partial'], default: 'pending' },
    remarks: { type: String },
  },
  { timestamps: true }
);

const OperationVehicle: Model<IOperationVehicle> = mongoose.model<IOperationVehicle>('OperationVehicle', operationVehicleSchema);
export default OperationVehicle;
