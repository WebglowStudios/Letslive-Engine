import { Request, Response } from 'express';
import Operation from '../models/Operation.js';
import OperationTransport from '../models/OperationTransport.js';
import OperationAccommodation from '../models/OperationAccommodation.js';
import OperationActivity from '../models/OperationActivity.js';
import VendorPayment from '../models/VendorPayment.js';
import CustomerPayment from '../models/CustomerPayment.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

// ─── OPERATIONS CRUD ───

export const getOperations = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
  if (req.query.destination) filter.destination = new RegExp(req.query.destination as string, 'i');
  if (req.user!.role === 'staff') filter.assignedTo = req.user!._id;

  const [operations, total] = await Promise.all([
    Operation.find(filter).populate('booking', 'bookingId totalAmount').populate('assignedTo', 'firstName lastName').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Operation.countDocuments(filter),
  ]);
  res.status(200).json({ status: 'success', results: operations.length, total, page, pages: Math.ceil(total / limit), data: operations });
});

export const getOperationById = asyncHandler(async (req: Request, res: Response) => {
  const operation = await Operation.findById(req.params.id).populate('booking').populate('package', 'name slug').populate('assignedTo', 'firstName lastName email');
  if (!operation) throw new AppError('Operation not found', 404);
  if (req.user!.role === 'staff' && operation.assignedTo?.toString() !== req.user!._id.toString()) throw new AppError('Access denied', 403);

  const [transports, accommodations, activities, vendorPayments, customerPayments] = await Promise.all([
    OperationTransport.find({ operation: operation._id }).sort({ date: 1 }),
    OperationAccommodation.find({ operation: operation._id }).sort({ checkIn: 1 }),
    OperationActivity.find({ operation: operation._id }).sort({ date: 1 }),
    VendorPayment.find({ operation: operation._id }).sort({ dueDate: 1 }),
    CustomerPayment.find({ operation: operation._id }).sort({ dueDate: 1 }),
  ]);

  res.status(200).json({ status: 'success', data: { operation, transports, accommodations, activities, vendorPayments, customerPayments } });
});

export const createOperation = asyncHandler(async (req: Request, res: Response) => {
  const operation = await Operation.create(req.body);
  res.status(201).json({ status: 'success', data: operation });
});

export const updateOperation = asyncHandler(async (req: Request, res: Response) => {
  const operation = await Operation.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!operation) throw new AppError('Operation not found', 404);
  res.status(200).json({ status: 'success', data: operation });
});

export const recalculateOperation = asyncHandler(async (req: Request, res: Response) => {
  const opId = req.params.id;
  const [transports, accommodations, activities] = await Promise.all([
    OperationTransport.find({ operation: opId }),
    OperationAccommodation.find({ operation: opId }),
    OperationActivity.find({ operation: opId }),
  ]);
  const totalVendorCost =
    transports.reduce((s, t) => s + (t.vendorCost || 0), 0) +
    accommodations.reduce((s, a) => s + (a.vendorCost || 0), 0) +
    activities.reduce((s, a) => s + (a.vendorCost || 0), 0);

  const operation = await Operation.findById(opId);
  if (!operation) throw new AppError('Operation not found', 404);
  operation.totalVendorCost = totalVendorCost;
  await operation.save();
  res.status(200).json({ status: 'success', data: operation });
});

// ─── TRANSPORT CRUD ───

export const addTransport = asyncHandler(async (req: Request, res: Response) => {
  const item = await OperationTransport.create({ ...req.body, operation: req.params.id });
  res.status(201).json({ status: 'success', data: item });
});
export const updateTransport = asyncHandler(async (req: Request, res: Response) => {
  const item = await OperationTransport.findByIdAndUpdate(req.params.itemId, req.body, { new: true });
  if (!item) throw new AppError('Transport not found', 404);
  res.status(200).json({ status: 'success', data: item });
});
export const deleteTransport = asyncHandler(async (req: Request, res: Response) => {
  await OperationTransport.findByIdAndDelete(req.params.itemId);
  res.status(204).json({ status: 'success', data: null });
});

// ─── ACCOMMODATION CRUD ───

export const addAccommodation = asyncHandler(async (req: Request, res: Response) => {
  const item = await OperationAccommodation.create({ ...req.body, operation: req.params.id });
  res.status(201).json({ status: 'success', data: item });
});
export const updateAccommodation = asyncHandler(async (req: Request, res: Response) => {
  const item = await OperationAccommodation.findByIdAndUpdate(req.params.itemId, req.body, { new: true });
  if (!item) throw new AppError('Accommodation not found', 404);
  res.status(200).json({ status: 'success', data: item });
});
export const deleteAccommodation = asyncHandler(async (req: Request, res: Response) => {
  await OperationAccommodation.findByIdAndDelete(req.params.itemId);
  res.status(204).json({ status: 'success', data: null });
});

// ─── ACTIVITIES CRUD ───

export const addActivity = asyncHandler(async (req: Request, res: Response) => {
  const item = await OperationActivity.create({ ...req.body, operation: req.params.id });
  res.status(201).json({ status: 'success', data: item });
});
export const updateActivity = asyncHandler(async (req: Request, res: Response) => {
  const item = await OperationActivity.findByIdAndUpdate(req.params.itemId, req.body, { new: true });
  if (!item) throw new AppError('Activity not found', 404);
  res.status(200).json({ status: 'success', data: item });
});
export const deleteActivity = asyncHandler(async (req: Request, res: Response) => {
  await OperationActivity.findByIdAndDelete(req.params.itemId);
  res.status(204).json({ status: 'success', data: null });
});

// ─── VENDOR PAYMENTS ───

export const addVendorPayment = asyncHandler(async (req: Request, res: Response) => {
  const payment = await VendorPayment.create({ ...req.body, operation: req.params.id });
  res.status(201).json({ status: 'success', data: payment });
});
export const updateVendorPayment = asyncHandler(async (req: Request, res: Response) => {
  const payment = await VendorPayment.findByIdAndUpdate(req.params.paymentId, req.body, { new: true });
  if (!payment) throw new AppError('Payment not found', 404);
  res.status(200).json({ status: 'success', data: payment });
});
export const deleteVendorPayment = asyncHandler(async (req: Request, res: Response) => {
  await VendorPayment.findByIdAndDelete(req.params.paymentId);
  res.status(204).json({ status: 'success', data: null });
});

// ─── CUSTOMER PAYMENTS ───

export const addCustomerPayment = asyncHandler(async (req: Request, res: Response) => {
  const payment = await CustomerPayment.create({ ...req.body, operation: req.params.id });
  res.status(201).json({ status: 'success', data: payment });
});
export const updateCustomerPayment = asyncHandler(async (req: Request, res: Response) => {
  const payment = await CustomerPayment.findByIdAndUpdate(req.params.paymentId, req.body, { new: true });
  if (!payment) throw new AppError('Payment not found', 404);
  res.status(200).json({ status: 'success', data: payment });
});
export const deleteCustomerPayment = asyncHandler(async (req: Request, res: Response) => {
  await CustomerPayment.findByIdAndDelete(req.params.paymentId);
  res.status(204).json({ status: 'success', data: null });
});

// ─── FINANCE ───

export const getFinanceOverview = asyncHandler(async (_req: Request, res: Response) => {
  const [vendorAgg, customerAgg, urgentCount] = await Promise.all([
    VendorPayment.aggregate([{ $group: { _id: null, totalPayable: { $sum: '$amount' }, totalPaid: { $sum: '$paidAmount' }, pending: { $sum: { $subtract: ['$amount', '$paidAmount'] } } } }]),
    CustomerPayment.aggregate([{ $group: { _id: null, totalReceivable: { $sum: '$amount' }, totalReceived: { $sum: '$paidAmount' }, pending: { $sum: { $subtract: ['$amount', '$paidAmount'] } } } }]),
    VendorPayment.countDocuments({ isUrgent: true, status: { $ne: 'paid' } }),
  ]);
  const vendor = vendorAgg[0] || { totalPayable: 0, totalPaid: 0, pending: 0 };
  const customer = customerAgg[0] || { totalReceivable: 0, totalReceived: 0, pending: 0 };
  res.status(200).json({ status: 'success', data: { vendorPayables: vendor.totalPayable, vendorPaid: vendor.totalPaid, vendorPending: vendor.pending, customerReceivables: customer.totalReceivable, customerReceived: customer.totalReceived, customerPending: customer.pending, netPosition: customer.totalReceived - vendor.totalPaid, urgentPaymentsCount: urgentCount } });
});

export const getUrgentPayments = asyncHandler(async (_req: Request, res: Response) => {
  const payments = await VendorPayment.find({ isUrgent: true, status: { $ne: 'paid' } }).populate('operation', 'operationId customer destination').sort({ dueDate: 1 }).limit(50);
  res.status(200).json({ status: 'success', data: payments });
});

// ─── SALESPERSON ───

export const getSalespersonStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await Operation.aggregate([
    { $match: { assignedTo: { $exists: true, $ne: null } } },
    { $group: { _id: '$assignedTo', totalBookings: { $sum: 1 }, totalRevenue: { $sum: '$sellingPrice' }, totalCost: { $sum: '$totalVendorCost' }, totalProfit: { $sum: '$grossProfit' }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: '$user' },
    { $project: { _id: 1, name: { $concat: ['$user.firstName', ' ', '$user.lastName'] }, email: '$user.email', role: '$user.role', totalBookings: 1, totalRevenue: 1, totalCost: 1, totalProfit: 1, completed: 1, avgMargin: { $cond: [{ $gt: ['$totalRevenue', 0] }, { $multiply: [{ $divide: ['$totalProfit', '$totalRevenue'] }, 100] }, 0] } } },
    { $sort: { totalProfit: -1 } },
  ]);
  res.status(200).json({ status: 'success', data: stats });
});
