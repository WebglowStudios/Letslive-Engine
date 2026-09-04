import { Request, Response } from 'express';
import Operation from '../models/Operation.js';
import Booking from '../models/Booking.js';
import Package from '../models/Package.js';
import OperationTransport from '../models/OperationTransport.js';
import OperationAccommodation from '../models/OperationAccommodation.js';
import OperationActivity from '../models/OperationActivity.js';
import VendorPayment from '../models/VendorPayment.js';
import CustomerPayment from '../models/CustomerPayment.js';
import mongoose from 'mongoose';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import { sendPaymentReminder } from '../services/emailService.js';
import { logActivity } from '../utils/logActivity.js';

// ─── OPERATIONS CRUD ───

export const getOperations = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
  if (req.query.destination) filter.destination = new RegExp(req.query.destination as string, 'i');
  if (req.query.incentiveStatus === 'pending') {
    filter.status = 'completed';
    filter.$or = [{ incentiveAmount: { $exists: false } }, { incentiveAmount: null }];
  }
  if (req.user!.role === 'staff' || req.user!.role === 'ops-staff') {
    filter.assignedTo = req.user!._id;
  }

  if (req.query.hasPendingPayment === 'true') {
    const pendingCPs = await CustomerPayment.find({ status: { $in: ['partial', 'upcoming', 'overdue'] } }).select('operation');
    const opIds = pendingCPs.map(cp => cp.operation);
    filter._id = { $in: opIds };
  }

  const [operations, total] = await Promise.all([
    Operation.find(filter).populate('bookings', 'bookingId totalAmount').populate('assignedTo', 'firstName lastName').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Operation.countDocuments(filter),
  ]);

  // Attach live payment totals from actual CustomerPayments (not stale stored fields)
  const opsWithLiveData = await Promise.all(operations.map(async (op) => {
    const cps = await CustomerPayment.find({ operation: op._id });
    const totalBilled = cps.reduce((sum, cp) => sum + (cp.amount || 0), 0);
    const totalReceived = cps.reduce((sum, cp) => sum + (cp.paidAmount || 0), 0);
    const pendingAmount = Math.max(0, totalBilled - totalReceived);

    // Use stored sellingPrice if no CPs exist (new ops), otherwise use live CP total as billing
    const effectiveSelling = totalBilled > 0 ? totalBilled : (op.sellingPrice || 0);
    const vendorCost = op.totalVendorCost || 0;
    const grossProfit = effectiveSelling - vendorCost;
    const profitPercentage = effectiveSelling > 0 ? Math.round((grossProfit / effectiveSelling) * 100) : 0;

    return {
      ...op.toObject(),
      pendingPayment: pendingAmount,
      totalReceived,
      effectiveSelling,   // live total billed to customer
      grossProfit,
      profitPercentage,
    };
  }));

  res.status(200).json({ status: 'success', results: opsWithLiveData.length, total, page, pages: Math.ceil(total / limit), data: opsWithLiveData });
});

export const getOperationById = asyncHandler(async (req: Request, res: Response) => {
  const operation = await Operation.findById(req.params.id).populate({
    path: 'bookings',
    populate: [
      { path: 'package', select: 'name slug isCustom description itinerary' }
    ]
  }).populate('package', 'name slug description itinerary').populate('assignedTo', 'firstName lastName email');
  if (!operation) throw new AppError('Operation not found', 404);
  if ((req.user!.role === 'staff' || req.user!.role === 'ops-staff') && operation.assignedTo?.toString() !== req.user!._id.toString()) throw new AppError('Access denied', 403);

  const [transports, accommodations, activities, vendorPayments, customerPayments] = await Promise.all([
    OperationTransport.find({ operation: operation._id }).sort({ date: 1 }),
    OperationAccommodation.find({ operation: operation._id }).sort({ checkIn: 1 }),
    OperationActivity.find({ operation: operation._id }).sort({ date: 1 }),
    VendorPayment.find({ operation: operation._id }).sort({ dueDate: 1 }),
    CustomerPayment.find({ operation: operation._id }).sort({ dueDate: 1 }).populate('booking', 'bookingId primaryTraveller'),
  ]);

  // Calculate live financial totals from actual CustomerPayments (same as getOperations list does)
  const totalBilled = customerPayments.reduce((sum, cp) => sum + (cp.amount || 0), 0);
  const totalReceived = customerPayments.reduce((sum, cp) => sum + (cp.paidAmount || 0), 0);
  const pendingPayment = Math.max(0, totalBilled - totalReceived);
  const effectiveSelling = totalBilled > 0 ? totalBilled : (operation.sellingPrice || 0);
  const vendorCost = operation.totalVendorCost || 0;
  const grossProfit = effectiveSelling - vendorCost;
  const profitPercentage = effectiveSelling > 0 ? Math.round((grossProfit / effectiveSelling) * 100) : 0;

  const operationWithLiveData = {
    ...operation.toObject(),
    effectiveSelling,
    totalReceived,
    pendingPayment,
    grossProfit,
    profitPercentage,
  };

  res.status(200).json({ status: 'success', data: { operation: operationWithLiveData, transports, accommodations, activities, vendorPayments, customerPayments } });

});

export const createOperation = asyncHandler(async (req: Request, res: Response) => {
  const operation = await Operation.create(req.body);
  res.status(201).json({ status: 'success', data: operation });
});

export const updateOperation = asyncHandler(async (req: Request, res: Response) => {
  const operation = await Operation.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!operation) throw new AppError('Operation not found', 404);

  // Sync status to booking if it changed
  if (req.body.status && operation.bookings && operation.bookings.length > 0) {
    let bookingStatus = 'in-progress';
    if (req.body.status === 'completed') bookingStatus = 'completed';
    else if (req.body.status === 'cancelled') bookingStatus = 'cancelled';
    else if (req.body.status === 'planning') bookingStatus = 'confirmed';
    
    await Booking.updateMany(
      { _id: { $in: operation.bookings } },
      { bookingStatus }
    );
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

export const deleteOperation = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'admin') {
    throw new AppError('Only administrators can delete operations', 403);
  }
  
  const { reason } = req.body;
  if (!reason) {
    throw new AppError('Please provide a reason for deleting this operation.', 400);
  }

  const opId = req.params.id;
  const operation = await Operation.findById(opId);
  
  if (!operation) {
    throw new AppError('Operation not found', 404);
  }

  await logActivity({
    req,
    action: 'delete',
    entity: 'operation',
    entityId: String(opId),
    entityName: operation.operationId,
    description: `Deleted Post-Sales Operation ${operation.operationId}. Reason: ${reason}`
  });

  // Delete associated records
  await Promise.all([
    OperationTransport.deleteMany({ operation: opId }),
    OperationAccommodation.deleteMany({ operation: opId }),
    OperationActivity.deleteMany({ operation: opId }),
    VendorPayment.deleteMany({ operation: opId }),
    CustomerPayment.deleteMany({ operation: opId })
  ]);

  await Operation.findByIdAndDelete(opId);
  res.status(200).json({ status: 'success', message: 'Operation deleted successfully' });
});

// ─── GROUP / UNGROUP SERVICES ───
export const groupServices = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { type, itemIds } = req.body; 

  if (!Array.isArray(itemIds) || itemIds.length < 2) {
    throw new AppError('At least 2 items required for grouping', 400);
  }

  const groupId = new mongoose.Types.ObjectId().toString();

  let Model: any;
  if (type === 'transports') Model = OperationTransport;
  else if (type === 'accommodations') Model = OperationAccommodation;
  else if (type === 'activities') Model = OperationActivity;
  else throw new AppError('Invalid service type', 400);

  const masterId = itemIds[0];
  const others = itemIds.slice(1);

  await Model.updateOne({ _id: masterId, operation: id }, { $set: { groupId, isGroupMaster: true } });
  
  await Model.updateMany(
    { _id: { $in: others }, operation: id }, 
    { $set: { groupId, isGroupMaster: false, vendorCost: 0, sellingPrice: 0 } }
  );

  res.status(200).json({ status: 'success', message: 'Grouped successfully' });
});

export const ungroupServices = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { type, groupId } = req.body;

  let Model: any;
  if (type === 'transports') Model = OperationTransport;
  else if (type === 'accommodations') Model = OperationAccommodation;
  else if (type === 'activities') Model = OperationActivity;
  else throw new AppError('Invalid service type', 400);

  await Model.updateMany(
    { groupId, operation: id },
    { $unset: { groupId: 1, isGroupMaster: 1 } }
  );

  res.status(200).json({ status: 'success', message: 'Ungrouped successfully' });
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

  const mapTransferType = (type?: string): string => {
    if (!type) return 'road';
    const t = type.toLowerCase();
    if (t.includes('bus') || t.includes('coach')) return 'road';
    if (t.includes('ferry') || t.includes('boat')) return 'ferry';
    if (t.includes('cruise')) return 'cruise';
    if (t.includes('train')) return 'train';
    if (t.includes('flight')) return 'flight';
    return 'road';
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
        flight.notes || '',
      ].filter(Boolean).join(' · ');

      transportDocs.push({
        operation: opId,
        type: 'flight',
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
          pnr:         flight.pnr || '',
          departureTime: flight.departure || '',
          arrivalTime: flight.arrival || '',
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

      const tType = transfer.legs && transfer.legs.length > 0 ? (transfer.legs[0]?.transferType || transfer.transferType) : transfer.transferType;

      transportDocs.push({
        operation: opId,
        type:          mapTransferType(tType || transfer.vehicleType),
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

export const splitCustomerPayment = asyncHandler(async (req: Request, res: Response) => {
  const { amount, milestone } = req.body;
  const operationId = req.params.id as string;

  if (!amount || amount <= 0) {
    throw new AppError('Invalid split amount', 400);
  }

  // Find an installment that can absorb this split
  const payments = await CustomerPayment.find({ operation: operationId }).sort({ amount: -1 });
  let primaryPayment = null;

  for (const p of payments) {
    if ((p.amount - (p.paidAmount || 0)) >= amount) {
      primaryPayment = p;
      break;
    }
  }

  if (!primaryPayment) {
    throw new AppError('No single installment has enough pending balance to absorb this split amount.', 400);
  }

  // Deduct from primary
  primaryPayment.amount -= amount;
  if (primaryPayment.paidAmount > primaryPayment.amount) {
    primaryPayment.paidAmount = primaryPayment.amount; // cap it to prevent overpayment logic errors
  }
  await primaryPayment.save();

  // Create new split payment
  const newPayment = await CustomerPayment.create({
    operation: operationId,
    booking: primaryPayment.booking,
    milestone: milestone || `Split from ${primaryPayment.milestone}`,
    amount,
    paidAmount: 0,
    dueDate: primaryPayment.dueDate,
    status: 'upcoming',
  });

  res.status(201).json({ status: 'success', data: { newPayment, primaryPayment } });
});
export const updateCustomerPayment = asyncHandler(async (req: Request, res: Response) => {
  const payment = await CustomerPayment.findById(req.params.paymentId);
  if (!payment) throw new AppError('Payment not found', 404);

  const { financeDetails, paidAmount, ...rest } = req.body;

  // Apply direct updates (milestone, amount, dueDate, paymentMode, transactionId, paymentLink, etc.)
  Object.assign(payment, rest);

  // Only route through finance approval if explicitly requested (e.g., from a finance form)
  if (financeDetails && financeDetails.mode) {
    payment.financeStatus = 'pending_approval';
    payment.requestedBy = req.user!._id;
    payment.financeDetails = {
      paidAmount: paidAmount || financeDetails.paidAmount,
      mode: financeDetails.mode,
      transactionId: financeDetails.transactionId,
      remarks: financeDetails.remarks,
      requestedBy: req.user!._id,
    };
    // Don't update the actual paidAmount or status until approved by finance
  } else if (paidAmount !== undefined) {
    payment.paidAmount = paidAmount;
  }

  await payment.save(); // pre('save') hook recalculates status

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

// ─── POST-SALES ADVANCED PASSENGER MANAGEMENT ───

export const addOperationPassenger = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params; // operation ID
  const { mode, passengerData, bookingId, email, phone, firstName, lastName } = req.body;

  const operation = await Operation.findById(id).populate('package');
  if (!operation) throw new AppError('Operation not found', 404);

  const pkg = operation.package as any;
  const price = pkg?.price || 0;

  if (mode === 'existing') {
    if (!bookingId) throw new AppError('Booking ID is required for existing mode', 400);
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new AppError('Booking not found', 404);
    
    // 1. Add passenger to booking
    booking.travellersDetails = [...(booking.travellersDetails || []), passengerData];
    if (passengerData.type === 'child') {
      booking.travellers.children = (booking.travellers.children || 0) + 1;
    } else {
      booking.travellers.adults = (booking.travellers.adults || 1) + 1;
    }
    
    // 2. Financial Bookkeeping
    booking.totalAmount = (booking.totalAmount || 0) + price;
    await booking.save();

    operation.sellingPrice += price;
    
    // Update pax in operation customers array
    const custIndex = operation.bookings?.findIndex((b: any) => String(b) === String(bookingId));
    if (custIndex !== undefined && custIndex !== -1 && operation.customers[custIndex]) {
       operation.customers[custIndex].pax += 1;
       if (passengerData.type === 'child') operation.customers[custIndex].children = (operation.customers[custIndex].children || 0) + 1;
       else operation.customers[custIndex].adults = (operation.customers[custIndex].adults || 0) + 1;
       operation.markModified('customers');
    }

    await operation.save();

    await CustomerPayment.create({
      operation: operation._id,
      booking: booking._id,
      milestone: 'Extra Passenger Addition',
      amount: price,
      paidAmount: 0,
      status: 'upcoming',
      dueDate: new Date(),
    });

    // 3. Update Package Slots
    if (pkg && operation.departureId) {
      await mongoose.model('Package').updateOne(
        { _id: pkg._id, 'departures._id': operation.departureId },
        { $inc: { 'departures.$.bookedSlots': 1 } }
      );
    }

    res.status(200).json({ status: 'success', message: 'Passenger added to existing booking', data: operation });

  } else if (mode === 'new') {
    if (!email) throw new AppError('Email is required for new booking mode', 400);
    
    // 1. Resolve User
    let user = await mongoose.model('User').findOne({ email });
    if (!user) {
      user = await mongoose.model('User').create({
        firstName: firstName || passengerData.name.split(' ')[0] || 'Guest',
        lastName: lastName || passengerData.name.split(' ').slice(1).join(' ') || '',
        email,
        phone: phone || '',
        role: 'user',
        password: Math.random().toString(36).slice(-8), // random pass
      });
    }

    if (!pkg?._id) throw new AppError('Cannot create a new booking for an operation without a linked package', 400);

    // 2. Create Booking
    const newBooking = await Booking.create({
      user: user._id,
      package: pkg._id,
      departureId: operation.departureId,
      // destination on Operation is a string, Booking expects ObjectId, so we omit it here
      totalAmount: price,
      paidAmount: 0,
      paymentStatus: 'pending',
      bookingStatus: 'confirmed',
      travelDate: operation.travelDates?.start || new Date(),
      returnDate: operation.travelDates?.end,
      travellers: { adults: passengerData.type === 'adult' ? 1 : 0, children: passengerData.type === 'child' ? 1 : 0, infants: 0 },
      travellersDetails: [passengerData],
      primaryTraveller: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '',
        panCard: passengerData.panCard || ''
      },
      bookingId: `BK${Date.now().toString().slice(-6)}`
    });

    // 3. Add to Operation
    operation.bookings.push(newBooking._id);
    operation.customers.push({
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      phone: user.phone || '',
      pax: 1,
      adults: passengerData.type === 'adult' ? 1 : 0,
      children: passengerData.type === 'child' ? 1 : 0,
    });
    operation.sellingPrice += price;
    await operation.save();

    // 4. Create Payment
    await CustomerPayment.create({
      operation: operation._id,
      booking: newBooking._id,
      milestone: 'Full Payment',
      amount: price,
      paidAmount: 0,
      status: 'upcoming',
      dueDate: new Date(),
    });

    // 5. Update Package Slots
    if (pkg && operation.departureId) {
      await mongoose.model('Package').updateOne(
        { _id: pkg._id, 'departures._id': operation.departureId },
        { $inc: { 'departures.$.bookedSlots': 1 } }
      );
    }

    res.status(200).json({ status: 'success', message: 'New booking created and added to operation', data: operation });
  } else {
    throw new AppError('Invalid mode. Must be existing or new', 400);
  }
});
