import { Request, Response } from 'express';
import Operation from '../models/Operation.js';
import Booking from '../models/Booking.js';
import Package from '../models/Package.js';
import OperationTransport from '../models/OperationTransport.js';
import OperationAccommodation from '../models/OperationAccommodation.js';
import OperationActivity from '../models/OperationActivity.js';
import VendorPayment from '../models/VendorPayment.js';
import CustomerPayment from '../models/CustomerPayment.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendPaymentReminder } from '../services/emailService.js';

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
  const operation = await Operation.findById(req.params.id).populate({
    path: 'booking',
    populate: [
      { path: 'package', select: 'name slug isCustom description itinerary' }
    ]
  }).populate('package', 'name slug description itinerary').populate('assignedTo', 'firstName lastName email');
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

  // Sync status to booking if it changed
  if (req.body.status && operation.booking) {
    let bookingStatus = 'in-progress';
    if (req.body.status === 'completed') bookingStatus = 'completed';
    else if (req.body.status === 'cancelled') bookingStatus = 'cancelled';
    else if (req.body.status === 'planning') bookingStatus = 'confirmed';
    
    await Booking.findByIdAndUpdate(operation.booking, { bookingStatus });
  }

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

// ─── IMPORT FROM ITINERARY ───

export const importFromItinerary = asyncHandler(async (req: Request, res: Response) => {
  const opId = req.params.id;

  const operation = await Operation.findById(opId);
  if (!operation) throw new AppError('Operation not found', 404);
  if (!operation.package) throw new AppError('This operation has no linked package/itinerary', 400);

  // Fetch full package data
  const pkg = await Package.findById(operation.package).lean() as any;
  if (!pkg) throw new AppError('Linked package not found', 404);

  // Check what already exists to avoid duplicates
  const [existingTransports, existingAccommodations, existingActivities] = await Promise.all([
    OperationTransport.countDocuments({ operation: opId }),
    OperationAccommodation.countDocuments({ operation: opId }),
    OperationActivity.countDocuments({ operation: opId }),
  ]);

  const skipped: string[] = [];
  const created = { transports: 0, accommodations: 0, activities: 0 };

  // Date math helper based on operation's start date
  const startDate = operation.travelDates?.start ? new Date(operation.travelDates.start) : null;
  const computeDate = (dayNumber: number): Date | undefined => {
    if (!startDate || !dayNumber) return undefined;
    const d = new Date(startDate);
    d.setDate(d.getDate() + (dayNumber - 1));
    return d;
  };



  // ── TRANSPORTS: flights + transfers → new vendor-group + legs[] format ──
  if (existingTransports > 0) {
    skipped.push('transport');
  } else {
    const transportDocs: object[] = [];

    // From pkg.flights[] — each flight becomes its own vendor group with one leg
    for (const flight of (pkg.flights || [])) {
      const legNotes = [
        flight.flightNumber ? `Flight: ${flight.flightNumber}` : '',
        flight.class ? `Class: ${flight.class}` : '',
        flight.pnr ? `PNR: ${flight.pnr}` : '',
        flight.departure ? `Dep: ${flight.departure}` : '',
        flight.arrival ? `Arr: ${flight.arrival}` : '',
        flight.notes || '',
      ].filter(Boolean).join(' · ');

      transportDocs.push({
        operation: opId,
        vendorName: flight.airline || '',
        vendorContact: '',
        vendorEmail: '',
        vendorCost: 0,
        sellingPrice: 0,
        paymentStatus: 'pending',
        remarks: '',
        legs: [{
          from:        flight.from || '',
          to:          flight.to || '',
          date:        computeDate(flight.day),
          tripDay:     flight.day ? `Day ${flight.day}` : '',
          vehicleType: 'Flight',
          notes:       legNotes,
        }],
      });
    }

    // From pkg.transfers[] — multi-leg transfers map directly to legs[]
    for (const transfer of (pkg.transfers || [])) {
      let legs: object[];

      if (transfer.legs && transfer.legs.length > 0) {
        // Itinerary already has leg breakdown — map each leg individually
        legs = transfer.legs.map((leg: any, legIdx: number) => ({
          from:        leg.from || '',
          to:          leg.to || '',
          date:        computeDate(transfer.day),
          tripDay:     transfer.day ? `Day ${transfer.day}` : '',
          vehicleType: leg.vehicleType || leg.transferType || '',
          notes:       leg.stops && leg.stops.length > 0 ? `Stops: ${leg.stops.join(', ')}` : '',
        }));
      } else {
        // Simple single-point transfer
        legs = [{
          from:        transfer.from || '',
          to:          transfer.to || '',
          date:        computeDate(transfer.day),
          tripDay:     transfer.day ? `Day ${transfer.day}` : '',
          vehicleType: transfer.vehicleType || transfer.transferType || '',
          notes:       [transfer.description || '', ...(transfer.details || []), transfer.stops?.length ? `Stops: ${transfer.stops.join(', ')}` : ''].filter(Boolean).join(' · '),
        }];
      }

      transportDocs.push({
        operation: opId,
        vendorName:    transfer.title || '',
        vendorContact: '',
        vendorEmail:   '',
        vendorCost:    0,
        sellingPrice:  0,
        paymentStatus: 'pending',
        remarks:       transfer.description || '',
        legs,
      });
    }

    if (transportDocs.length > 0) {
      await OperationTransport.insertMany(transportDocs);
      created.transports = transportDocs.length;
    }
  }

  // ── ACCOMMODATIONS: stays[] ──
  if (existingAccommodations > 0) {
    skipped.push('accommodation');
  } else {
    const accDocs: object[] = [];
    let currentStayDay = 1;

    for (const stay of (pkg.stays || [])) {
      const nights = stay.nights || 1;
      const checkInDate = computeDate(currentStayDay);
      const checkOutDate = computeDate(currentStayDay + nights);
      
      accDocs.push({
        operation: opId,
        type: 'hotel',
        name: stay.name || '',
        area: stay.address || '',
        roomCategory: stay.roomType || '',
        checkIn: checkInDate,
        checkOut: checkOutDate,
        nights: nights,
        rooms: stay.rooms || 1,
        confirmationNumber: stay.confirmationNo || '',
        tripDay: `Day ${currentStayDay}-${currentStayDay + nights}`,
        remarks: [
          stay.rating ? `${stay.rating} property` : '',
          stay.address || '',
          stay.checkIn ? `Time In: ${stay.checkIn}` : '',
          stay.checkOut ? `Time Out: ${stay.checkOut}` : ''
        ].filter(Boolean).join(' | '),
        paymentStatus: 'pending',
      });
      currentStayDay += nights;
    }

    if (accDocs.length > 0) {
      await OperationAccommodation.insertMany(accDocs);
      created.accommodations = accDocs.length;
    }
  }

  // ── ACTIVITIES: itinerary[] (day-wise entries for expenses) ──
  if (existingActivities > 0) {
    skipped.push('activities');
  } else {
    const actDocs: object[] = [];

    for (const day of (pkg.itinerary || [])) {
      actDocs.push({
        operation: opId,
        title: day.title || `Day ${day.day}`,
        description: day.activities && day.activities.length > 0 ? day.activities.join(' | ') : day.description || '',
        date: computeDate(day.day),
        tripDay: `Day ${day.day}`,
        paymentStatus: 'pending',
      });
    }

    if (actDocs.length > 0) {
      await OperationActivity.insertMany(actDocs);
      created.activities = actDocs.length;
    }
  }

  res.status(200).json({
    status: 'success',
    message: `Import complete. Created: ${created.transports} transport(s), ${created.accommodations} stay(s), ${created.activities} itinerary day(s).${skipped.length > 0 ? ` Skipped (already had data): ${skipped.join(', ')}.` : ''}`,
    data: { created, skipped },
  });
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
  const { financeDetails, status, paidAmount, ...rest } = req.body;
  let updateData: any = { status, paidAmount, ...rest };

  if (financeDetails && (status === 'paid' || status === 'partial' || paidAmount > 0)) {
    updateData.financeStatus = 'pending_approval';
    updateData.requestedBy = req.user!._id;
    updateData.financeDetails = {
      paidAmount: paidAmount || financeDetails.paidAmount,
      mode: financeDetails.mode,
      transactionId: financeDetails.transactionId,
      remarks: financeDetails.remarks,
      requestedBy: req.user!._id,
    };
    // Don't update the actual paidAmount or status until approved
    delete updateData.paidAmount;
    delete updateData.status;
  }

  const payment = await CustomerPayment.findByIdAndUpdate(req.params.paymentId, updateData, { new: true });
  if (!payment) throw new AppError('Payment not found', 404);
  res.status(200).json({ status: 'success', data: payment });
});
export const deleteCustomerPayment = asyncHandler(async (req: Request, res: Response) => {
  await CustomerPayment.findByIdAndDelete(req.params.paymentId);
  res.status(204).json({ status: 'success', data: null });
});

export const notifyCustomerPayment = asyncHandler(async (req: Request, res: Response) => {
  const payment = await CustomerPayment.findById(req.params.paymentId).populate('operation');
  if (!payment) throw new AppError('Payment not found', 404);

  const operation = payment.operation as unknown as { 
    customer: { email: string; name: string };
  };

  if (!operation.customer.email) {
    throw new AppError('No email address on file for this customer', 400);
  }

  const balance = payment.amount - payment.paidAmount;
  if (balance <= 0) {
    throw new AppError('This installment is already fully paid', 400);
  }

  await sendPaymentReminder(
    operation.customer.email,
    operation.customer.name,
    payment.milestone || 'Installment',
    balance,
    payment.dueDate
  );

  res.status(200).json({ status: 'success', message: 'Payment reminder sent successfully' });
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
