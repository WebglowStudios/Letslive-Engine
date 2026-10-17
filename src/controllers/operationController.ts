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
    Operation.find(filter)
      .populate({
        path: 'bookings',
        select: 'bookingId totalAmount primaryTraveller user travellersDetails',
        populate: { path: 'user', select: 'firstName lastName email phone' }
      })
      .populate({
        path: 'booking',
        select: 'bookingId totalAmount primaryTraveller user travellersDetails',
        populate: { path: 'user', select: 'firstName lastName email phone' }
      })
      .populate('assignedTo', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Operation.countDocuments(filter),
  ]);

  // Attach live payment totals from actual CustomerPayments (not stale stored fields)
  const opsWithLiveData = await Promise.all(operations.map(async (op) => {
    const cps = await CustomerPayment.find({ operation: op._id });
    const totalBilled = cps.reduce((sum, cp) => sum + (cp.amount || 0), 0);
    const totalReceived = cps.reduce((sum, cp) => sum + (cp.paidAmount || 0), 0);
    const pendingAmount = Math.max(0, totalBilled - totalReceived);

    // Multi-source lead customer derivation (ensures customer snapshot is never blank)
    const leadCust = (op.customer && op.customer.name && op.customer.name.trim())
      ? op.customer
      : (op.customers && op.customers.length > 0 && op.customers[0]?.name && op.customers[0].name.trim() ? op.customers[0] : null);

    const linkedBooking = (op.booking as any) || (op.bookings && (op.bookings as any)[0]) || null;
    const primaryTraveller = linkedBooking?.primaryTraveller;
    const usr = linkedBooking?.user;
    const bkgDetails = linkedBooking?.travellersDetails || [];

    const derivedName = (leadCust?.name && leadCust.name.trim())
      || (primaryTraveller?.firstName ? `${primaryTraveller.firstName} ${primaryTraveller.lastName || ''}`.trim() : '')
      || (usr?.firstName ? `${usr.firstName} ${usr.lastName || ''}`.trim() : '')
      || (bkgDetails[0]?.name ? bkgDetails[0].name.trim() : '')
      || '';

    const derivedEmail = leadCust?.email || primaryTraveller?.email || usr?.email || '';
    const derivedPhone = leadCust?.phone || primaryTraveller?.phone || usr?.phone || '';

    const normalizedCustomer = {
      ...(op.customer || {}),
      name: derivedName || (op.customer?.name || ''),
      email: derivedEmail,
      phone: derivedPhone,
    };

    // If op.customers is empty or first entry lacks name, backfill it
    const normalizedCustomers = (op.customers && op.customers.length > 0)
      ? op.customers.map((c, i) => i === 0 && (!c.name || !c.name.trim()) && derivedName ? { ...c, name: derivedName, email: derivedEmail, phone: derivedPhone } : c)
      : (derivedName ? [normalizedCustomer] : []);

    // Use stored sellingPrice if no CPs exist (new ops), otherwise use live CP total as billing
    const effectiveSelling = totalBilled > 0 ? totalBilled : (op.sellingPrice || 0);
    const vendorCost = op.totalVendorCost || 0;
    const grossProfit = effectiveSelling - vendorCost;
    const profitPercentage = effectiveSelling > 0 ? Math.round((grossProfit / effectiveSelling) * 100) : 0;

    return {
      ...op.toObject(),
      customer: normalizedCustomer,
      customers: normalizedCustomers,
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
    select: 'bookingId brand totalAmount paidAmount paymentStatus travellersDetails primaryTraveller travellers dateChangeHistory package',
    populate: [
      { path: 'package', select: 'name slug isCustom description itinerary adultCount childCount isInternational visaIncluded flightsIncluded trainsIncluded hideTrainInfo flightPrice landCost hotelPrice activityPrice transferPrice activityAndTransportPrice extraMealsIncluded extraMealsCount extraMealsPrice visaPrice trainPrice cruiseIncluded cruisePrice flights' }
    ]
  }).populate({
    path: 'booking',
    select: 'bookingId brand totalAmount paidAmount paymentStatus travellersDetails primaryTraveller travellers dateChangeHistory package',
    populate: [
      { path: 'package', select: 'name slug isCustom description itinerary adultCount childCount isInternational visaIncluded flightsIncluded trainsIncluded hideTrainInfo flightPrice landCost hotelPrice activityPrice transferPrice activityAndTransportPrice extraMealsIncluded extraMealsCount extraMealsPrice visaPrice trainPrice cruiseIncluded cruisePrice flights' }
    ]
  }).populate('package', 'name slug isCustom description itinerary isInternational visaIncluded flightsIncluded trainsIncluded hideTrainInfo flightPrice landCost hotelPrice activityPrice transferPrice activityAndTransportPrice extraMealsIncluded extraMealsCount extraMealsPrice visaPrice trainPrice cruiseIncluded cruisePrice flights').populate('assignedTo', 'firstName lastName email');
  if (!operation) throw new AppError('Operation not found', 404);
  if ((req.user!.role === 'staff' || req.user!.role === 'ops-staff') && operation.assignedTo?.toString() !== req.user!._id.toString()) throw new AppError('Access denied', 403);

  const [transports, accommodations, activities, vendorPayments, customerPayments] = await Promise.all([
    OperationTransport.find({ operation: operation._id }).sort({ date: 1 }),
    OperationAccommodation.find({ operation: operation._id }).sort({ checkIn: 1 }),
    OperationActivity.find({ operation: operation._id }).sort({ date: 1, createdAt: 1 }),
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

  // Multi-source lead customer derivation (ensures customer snapshot is never blank)
  const leadCust = (operation.customer && operation.customer.name && operation.customer.name.trim())
    ? operation.customer
    : (operation.customers && operation.customers.length > 0 && operation.customers[0]?.name ? operation.customers[0] : null);

  const linkedBooking = (operation.booking as any) || (operation.bookings && (operation.bookings as any)[0]) || null;
  const primaryTraveller = linkedBooking?.primaryTraveller;
  const bookingTravellers = linkedBooking?.travellers;
  const bkgDetails = linkedBooking?.travellersDetails || [];

  const derivedName = leadCust?.name
    || (primaryTraveller?.firstName ? `${primaryTraveller.firstName} ${primaryTraveller.lastName || ''}`.trim() : '')
    || (bkgDetails[0]?.name)
    || '';

  const derivedAdults = leadCust?.adults
    ?? bookingTravellers?.adults
    ?? (bkgDetails.filter((t: any) => t.type === 'adult').length || undefined)
    ?? (operation.package as any)?.adultCount
    ?? (linkedBooking?.package as any)?.adultCount;

  const derivedChildren = leadCust?.children
    ?? bookingTravellers?.children
    ?? (bkgDetails.filter((t: any) => t.type === 'child').length || undefined)
    ?? (operation.package as any)?.childCount
    ?? (linkedBooking?.package as any)?.childCount;

  const derivedPax = leadCust?.pax
    ?? ((derivedAdults !== undefined || derivedChildren !== undefined) ? ((derivedAdults || 0) + (derivedChildren || 0)) : undefined)
    ?? (bookingTravellers ? (bookingTravellers.adults || 0) + (bookingTravellers.children || 0) : undefined)
    ?? (bkgDetails.length > 0 ? bkgDetails.length : undefined)
    ?? 1;

  const normalizedCustomer = {
    ...(operation.customer || {}),
    name: (operation.customer && operation.customer.name) ? operation.customer.name : derivedName,
    email: (operation.customer && operation.customer.email) ? operation.customer.email : (leadCust?.email || primaryTraveller?.email || ''),
    phone: (operation.customer && operation.customer.phone) ? operation.customer.phone : (leadCust?.phone || primaryTraveller?.phone || ''),
    pax: (operation.customer && operation.customer.pax && operation.customer.name) ? operation.customer.pax : derivedPax,
    adults: (operation.customer && operation.customer.adults !== undefined) ? operation.customer.adults : derivedAdults,
    children: (operation.customer && operation.customer.children !== undefined) ? operation.customer.children : derivedChildren,
  };

  const operationWithLiveData = {
    ...operation.toObject(),
    customer: normalizedCustomer,
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

  const bookingIds = [...(operation.bookings || [])];
  if ((operation as any).booking && !bookingIds.includes((operation as any).booking)) {
    bookingIds.push((operation as any).booking);
  }

  // Sync status to booking if it changed
  if (req.body.status && bookingIds.length > 0) {
    let bookingStatus = 'in-progress';
    if (req.body.status === 'completed') bookingStatus = 'completed';
    else if (req.body.status === 'cancelled') bookingStatus = 'cancelled';
    else if (req.body.status === 'planning') bookingStatus = 'confirmed';
    else if (req.body.status === 'vendor-confirmed') bookingStatus = 'vendor-confirmed';
    else if (req.body.status === 'booked') bookingStatus = 'confirmed';
    
    await Booking.updateMany(
      { _id: { $in: bookingIds } },
      { bookingStatus }
    );
  }

  res.status(200).json({ status: 'success', data: operation });
});

export const recalculateOperation = asyncHandler(async (req: Request, res: Response) => {
  const opId = req.params.id;
  const [transports, accommodations, activities, customerPayments] = await Promise.all([
    OperationTransport.find({ operation: opId }),
    OperationAccommodation.find({ operation: opId }),
    OperationActivity.find({ operation: opId }),
    CustomerPayment.find({ operation: opId }),
  ]);

  // 1. Calculate Total Vendor Cost across all services
  const totalVendorCost =
    transports.reduce((s, t) => s + (t.vendorCost || 0), 0) +
    accommodations.reduce((s, a) => s + (a.vendorCost || 0), 0) +
    activities.reduce((s, a) => {
      const actBase = a.vendorCost || 0;
      const transferCost = (a.transfers || []).reduce((ts: number, tr: any) => ts + (tr.hasPricing ? (tr.vendorCost || 0) : 0), 0);
      return s + actBase + transferCost;
    }, 0);

  // 2. Calculate Line-Item Selling Price (if configured in service tabs)
  const totalLineItemSelling =
    transports.reduce((s, t) => s + (t.sellingPrice || 0), 0) +
    accommodations.reduce((s, a) => s + (a.sellingPrice || 0), 0) +
    activities.reduce((s, a) => {
      const actBase = a.sellingPrice || 0;
      const transferSelling = (a.transfers || []).reduce((ts: number, tr: any) => ts + (tr.hasPricing ? (tr.sellingPrice || 0) : 0), 0);
      return s + actBase + transferSelling;
    }, 0);

  // 3. Recalculate and normalize CustomerPayment statuses and totals
  let totalCustomerBilled = 0;
  let totalCustomerReceived = 0;

  for (const cp of customerPayments) {
    totalCustomerBilled += (cp.amount || 0);
    totalCustomerReceived += (cp.paidAmount || 0);

    // Ensure status is strictly consistent with paidAmount vs amount
    let expectedStatus = cp.status;
    if (cp.amount > 0 && cp.paidAmount >= cp.amount) {
      expectedStatus = 'paid';
    } else if (cp.paidAmount > 0 && cp.paidAmount < cp.amount) {
      expectedStatus = 'partial';
    } else if (cp.dueDate && new Date(cp.dueDate).getTime() < Date.now() && (cp.paidAmount || 0) < cp.amount) {
      expectedStatus = 'overdue';
    } else {
      expectedStatus = 'upcoming';
    }

    if (cp.status !== expectedStatus) {
      cp.status = expectedStatus;
      await cp.save();
    }
  }

  const operation = await Operation.findById(opId);
  if (!operation) throw new AppError('Operation not found', 404);

  // 4. Resolve Selling Price
  // - Priority 1: Customer Payments (actual installment schedule agreed with client)
  // - Priority 2: Sum of individual line item selling prices (if set by ops team)
  // - Priority 3: Current stored selling price
  // - Priority 4: Booking total amount
  let newSellingPrice = operation.sellingPrice || 0;
  if (totalCustomerBilled > 0) {
    newSellingPrice = totalCustomerBilled;
  } else if (totalLineItemSelling > 0) {
    newSellingPrice = totalLineItemSelling;
  } else if (newSellingPrice === 0 && operation.bookings?.length) {
    const linkedBookings = await Booking.find({ _id: { $in: operation.bookings } });
    const bSum = linkedBookings.reduce((s, b) => s + (b.totalAmount || 0), 0);
    if (bSum > 0) newSellingPrice = bSum;
  }

  // 5. Update and save Operation
  operation.totalVendorCost = totalVendorCost;
  operation.sellingPrice = newSellingPrice;
  operation.grossProfit = newSellingPrice - totalVendorCost;
  operation.profitPercentage = newSellingPrice > 0
    ? Math.round(((newSellingPrice - totalVendorCost) / newSellingPrice) * 100)
    : 0;

  await operation.save();

  // 6. Synchronize Linked Bookings
  const allBookingIds = [...(operation.bookings || [])];
  if ((operation as any).booking && !allBookingIds.some(id => String(id) === String((operation as any).booking))) {
    allBookingIds.push((operation as any).booking);
  }

  if (allBookingIds.length > 0) {
    for (const bId of allBookingIds) {
      const bPayments = customerPayments.filter(cp => cp.booking && String(cp.booking) === String(bId));
      let bTotal = 0;
      let bPaid = 0;

      if (bPayments.length > 0) {
        bTotal = bPayments.reduce((s, cp) => s + (cp.amount || 0), 0);
        bPaid = bPayments.reduce((s, cp) => s + (cp.paidAmount || 0), 0);
      } else if (allBookingIds.length === 1) {
        bTotal = totalCustomerBilled > 0 ? totalCustomerBilled : newSellingPrice;
        bPaid = totalCustomerReceived;
      }

      let bStatus: 'pending' | 'partial' | 'paid' = 'pending';
      if (bTotal > 0 && bPaid >= bTotal) {
        bStatus = 'paid';
      } else if (bPaid > 0) {
        bStatus = 'partial';
      }

      const updateFields: any = { paymentStatus: bStatus };
      if (bTotal > 0) updateFields.totalAmount = bTotal;
      if (bPaid >= 0) updateFields.paidAmount = bPaid;

      await Booking.findByIdAndUpdate(bId, { $set: updateFields });
    }
  }

  // 7. Return with live data fields attached
  const pendingPayment = Math.max(0, newSellingPrice - totalCustomerReceived);
  const operationWithLiveData = {
    ...operation.toObject(),
    effectiveSelling: newSellingPrice,
    totalReceived: totalCustomerReceived,
    pendingPayment,
    grossProfit: operation.grossProfit,
    profitPercentage: operation.profitPercentage,
  };

  res.status(200).json({ status: 'success', message: 'Pricing and payments recalculated successfully', data: operationWithLiveData });
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

  // Preserve and sum existing vendorCost and sellingPrice so grouping aggregates existing costs
  const items = await Model.find({ _id: { $in: itemIds }, operation: id });
  const sumCost = items.reduce((sum: number, it: any) => sum + (it.vendorCost || 0), 0);
  const sumSelling = items.reduce((sum: number, it: any) => sum + (it.sellingPrice || 0), 0);

  await Model.updateOne(
    { _id: masterId, operation: id }, 
    { $set: { groupId, isGroupMaster: true, vendorCost: sumCost, sellingPrice: sumSelling } }
  );
  
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

  // Resolve linked package: check operation.package, bookings, or single booking
  let packageId: any = operation.package;
  if (!packageId && operation.bookings && operation.bookings.length > 0) {
    const Booking = mongoose.model('Booking');
    const b: any = await Booking.findById(operation.bookings[0]);
    if (b?.package) packageId = b.package;
  }
  if (!packageId && (operation as any).booking) {
    const Booking = mongoose.model('Booking');
    const b: any = await Booking.findById((operation as any).booking);
    if (b?.package) packageId = b.package;
  }
  if (!packageId) throw new AppError('This operation has no linked package/itinerary', 400);

  // Fetch full package data
  const pkg = await Package.findById(packageId).lean() as any;
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

  // ── TRANSPORTS: ONLY FLIGHTS & TRAINS ──
  // Road / local transfers now move directly under itinerary days (activities)
  const roadTransfersByDay: Record<number, any[]> = {};

  if (existingTransports > 0) {
    skipped.push('transport');
  } else {
    const transportDocs: object[] = [];

    // From pkg.flights[] (Custom Itinerary Flights tab & Package Flights)
    const validFlights = (pkg.flights || []).filter((f: any) => f && (f.airline || f.from || f.to || f.flightNumber));
    for (const flight of validFlights) {
      const legNotes = [
        flight.flightNumber ? `Flight: ${flight.flightNumber}` : '',
        flight.class ? `Class: ${flight.class}` : '',
        flight.notes || '',
      ].filter(Boolean).join(' · ');

      const isTrain = (flight.airline || '').toLowerCase().includes('train') ||
                      (flight.airline || '').toLowerCase().includes('rail') ||
                      (flight.airline || '').toLowerCase().includes('express') ||
                      (flight.notes || '').toLowerCase().includes('train') ||
                      (flight.notes || '').toLowerCase().includes('rail') ||
                      (flight.flightNumber || '').toLowerCase().includes('train');

      const mappedType = isTrain ? 'train' : 'flight';
      const defaultTitle = isTrain 
        ? (flight.airline ? (flight.airline.toLowerCase().includes('train') || flight.airline.toLowerCase().includes('express') ? flight.airline : `${flight.airline} Train`) : 'Train Journey')
        : (flight.airline ? `${flight.airline} Flight` : (flight.flightNumber ? `Flight ${flight.flightNumber}` : 'Flight'));

      transportDocs.push({
        operation: opId,
        type: mappedType,
        title: defaultTitle,
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
          vehicleType: isTrain ? 'Train' : 'Flight',
          notes:       legNotes,
          pnr:         flight.pnr || '',
          departureTime: flight.departure || '',
          arrivalTime: flight.arrival || '',
        }],
      });
    }

    // From pkg.transfers[] — ONLY trains and flights go to transports; all road transfers go to itinerary days
    for (const transfer of (pkg.transfers || [])) {
      const tType = transfer.legs && transfer.legs.length > 0 ? (transfer.legs[0]?.transferType || transfer.transferType) : transfer.transferType;
      const mappedType = mapTransferType(tType || transfer.vehicleType);

      if (mappedType === 'flight' || mappedType === 'train') {
        let legs: object[];
        if (transfer.legs && transfer.legs.length > 0) {
          legs = transfer.legs.map((leg: any) => ({
            from:        leg.from || '',
            to:          leg.to || '',
            date:        computeDate(transfer.day),
            tripDay:     transfer.day ? `Day ${transfer.day}` : '',
            vehicleType: leg.vehicleType || leg.transferType || (mappedType === 'train' ? 'Train' : 'Flight'),
            notes:       leg.stops && leg.stops.length > 0 ? `Stops: ${leg.stops.join(', ')}` : '',
          }));
        } else {
          legs = [{
            from:        transfer.from || '',
            to:          transfer.to || '',
            date:        computeDate(transfer.day),
            tripDay:     transfer.day ? `Day ${transfer.day}` : '',
            vehicleType: transfer.vehicleType || transfer.transferType || (mappedType === 'train' ? 'Train' : 'Flight'),
            notes:       [transfer.description || '', ...(transfer.details || []), transfer.stops?.length ? `Stops: ${transfer.stops.join(', ')}` : ''].filter(Boolean).join(' · '),
          }];
        }

        transportDocs.push({
          operation: opId,
          type:          mappedType,
          title:         transfer.title || (mappedType === 'train' ? 'Train Journey' : 'Flight'),
          vendorName:    '',
          vendorContact: '',
          vendorEmail:   '',
          vendorCost:    0,
          sellingPrice:  0,
          paymentStatus: 'pending',
          remarks:       transfer.description || '',
          legs,
        });
      } else {
        // Road transfers (car, bus, coach, taxi, etc.) — map to day itinerary
        const dayNum = Number(transfer.day) || 1;
        if (!roadTransfersByDay[dayNum]) roadTransfersByDay[dayNum] = [];

        if (transfer.legs && transfer.legs.length > 0) {
          for (const leg of transfer.legs) {
            roadTransfersByDay[dayNum].push({
              title:       transfer.title || '',
              from:        leg.from || '',
              to:          leg.to || '',
              vehicleType: leg.vehicleType || leg.transferType || transfer.vehicleType || 'Car',
              notes:       leg.stops && leg.stops.length > 0 ? `Stops: ${leg.stops.join(', ')}` : (transfer.description || ''),
              hasPricing:  false,
              vendorCost:  0,
              sellingPrice: 0,
            });
          }
        } else {
          roadTransfersByDay[dayNum].push({
            title:       transfer.title || '',
            from:        transfer.from || '',
            to:          transfer.to || '',
            vehicleType: transfer.vehicleType || transfer.transferType || 'Car',
            notes:       [transfer.description || '', ...(transfer.details || []), transfer.stops?.length ? `Stops: ${transfer.stops.join(', ')}` : ''].filter(Boolean).join(' · '),
            hasPricing:  false,
            vendorCost:  0,
            sellingPrice: 0,
          });
        }
      }
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
      
      const stayLocation = stay.address || (stay as any).location || (stay as any).city || '';
      accDocs.push({
        operation: opId,
        type: 'hotel',
        name: stay.name || '',
        area: stayLocation,
        roomCategory: stay.roomType || '',
        checkIn: checkInDate,
        checkOut: checkOutDate,
        nights: nights,
        rooms: stay.rooms || 1,
        confirmationNumber: stay.confirmationNo || '',
        tripDay: `Day ${currentStayDay}-${currentStayDay + nights}`,
        remarks: [
          stay.remark || '',
          stay.rating ? `${stay.rating} property` : '',
          stayLocation,
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

  // ── ACTIVITIES: itinerary[] + Road Transfers ──
  if (existingActivities > 0) {
    skipped.push('activities');
  } else {
    const actDocs: object[] = [];

    for (const day of (pkg.itinerary || [])) {
      const dayTransfers = roadTransfersByDay[day.day] || [];
      actDocs.push({
        operation: opId,
        title: day.title || `Day ${day.day}`,
        description: day.activities && day.activities.length > 0
          ? day.activities.map((a: any) => typeof a === 'string' ? a : (a.title || a.name || '')).filter(Boolean).join(' | ')
          : day.description || '',
        date: computeDate(day.day),
        tripDay: `Day ${day.day}`,
        paymentStatus: 'pending',
        transfers: dayTransfers,
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
  const payment = await CustomerPayment.findById(req.params.paymentId);
  if (!payment) throw new AppError('Payment not found', 404);

  const opId = payment.operation;
  const bookingId = payment.booking;
  const paymentAmount = payment.amount || 0;
  const milestoneLower = (payment.milestone || '').toLowerCase();
  const isExtraCharge = milestoneLower.includes('extra passenger') || milestoneLower.includes('extra charge');

  await CustomerPayment.findByIdAndDelete(req.params.paymentId);

  // If this payment was an extra passenger or extra charge milestone, deduct it from booking.totalAmount
  if (bookingId && isExtraCharge && paymentAmount > 0) {
    const booking = await Booking.findById(bookingId);
    if (booking && booking.totalAmount) {
      booking.totalAmount = Math.max(0, booking.totalAmount - paymentAmount);
      await booking.save();
    }
  }

  // Recalculate operation financials
  if (opId) {
    const [transports, accommodations, activities, remainingPayments] = await Promise.all([
      OperationTransport.find({ operation: opId }),
      OperationAccommodation.find({ operation: opId }),
      OperationActivity.find({ operation: opId }),
      CustomerPayment.find({ operation: opId }),
    ]);

    const totalVendorCost =
      transports.reduce((s, t) => s + (t.vendorCost || 0), 0) +
      accommodations.reduce((s, a) => s + (a.vendorCost || 0), 0) +
      activities.reduce((s, a) => {
        const actBase = a.vendorCost || 0;
        const transferCost = (a.transfers || []).reduce((ts: number, tr: any) => ts + (tr.hasPricing ? (tr.vendorCost || 0) : 0), 0);
        return s + actBase + transferCost;
      }, 0);

    const totalCustomerBilled = remainingPayments.reduce((s, cp) => s + (cp.amount || 0), 0);

    const operation = await Operation.findById(opId);
    if (operation) {
      operation.totalVendorCost = totalVendorCost;
      if (totalCustomerBilled > 0) {
        operation.sellingPrice = totalCustomerBilled;
      }
      operation.grossProfit = (operation.sellingPrice || 0) - totalVendorCost;
      operation.profitPercentage = operation.sellingPrice > 0
        ? Math.round(((operation.sellingPrice - totalVendorCost) / operation.sellingPrice) * 100)
        : 0;
      await operation.save();

      // Also sync linked bookings if needed
      if (bookingId) {
        const bPayments = remainingPayments.filter(cp => cp.booking && String(cp.booking) === String(bookingId));
        if (bPayments.length > 0) {
          const bTotal = bPayments.reduce((s, cp) => s + (cp.amount || 0), 0);
          const bPaid = bPayments.reduce((s, cp) => s + (cp.paidAmount || 0), 0);
          let bStatus: 'pending' | 'partial' | 'paid' = 'pending';
          if (bTotal > 0 && bPaid >= bTotal) bStatus = 'paid';
          else if (bPaid > 0) bStatus = 'partial';
          await Booking.findByIdAndUpdate(bookingId, { $set: { totalAmount: bTotal, paidAmount: bPaid, paymentStatus: bStatus } });
        }
      }
    }
  }

  res.status(200).json({ status: 'success', message: 'Payment deleted and operation recalculated' });
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
  const { mode, passengerData, bookingId, email, phone, firstName, lastName, billExtra, extraAmount } = req.body;

  const operation = await Operation.findById(id).populate('package');
  if (!operation) throw new AppError('Operation not found', 404);

  const pkg = operation.package as any;
  const basePrice = pkg?.price || 0;

  const rawAge = (passengerData?.age !== '' && passengerData?.age !== undefined && passengerData?.age !== null)
    ? Number(passengerData.age)
    : undefined;
  const sanitizedPassenger: any = {
    ...passengerData,
    age: (rawAge !== undefined && !isNaN(rawAge)) ? rawAge : undefined,
    dob: passengerData?.dob ? new Date(passengerData.dob) : undefined,
    gender: passengerData?.gender ? String(passengerData.gender).trim().toLowerCase() : undefined,
  };
  if (sanitizedPassenger.age === undefined && sanitizedPassenger.dob && !isNaN(sanitizedPassenger.dob.getTime())) {
    const today = new Date();
    let calculatedAge = today.getFullYear() - sanitizedPassenger.dob.getFullYear();
    const m = today.getMonth() - sanitizedPassenger.dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < sanitizedPassenger.dob.getDate())) {
      calculatedAge--;
    }
    if (calculatedAge >= 0) sanitizedPassenger.age = calculatedAge;
  }

  // Determine if extra billing is requested
  const shouldBillExtra = Boolean(billExtra);
  const extraPrice = shouldBillExtra
    ? (extraAmount !== undefined && extraAmount !== '' && !isNaN(Number(extraAmount)) ? Number(extraAmount) : basePrice)
    : 0;

  if (mode === 'existing') {
    if (!bookingId) throw new AppError('Booking ID is required for existing mode', 400);
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new AppError('Booking not found', 404);
    
    // 1. Add passenger to booking travellersDetails
    booking.travellersDetails = [...(booking.travellersDetails || []), sanitizedPassenger];
    
    // Calculate actual passenger counts from details vs existing booked counts
    const allDetails = booking.travellersDetails || [];
    const adultDetailsCount = allDetails.filter((p: any) => p.type !== 'child' && p.type !== 'infant').length;
    const childDetailsCount = allDetails.filter((p: any) => p.type === 'child').length;
    const infantDetailsCount = allDetails.filter((p: any) => p.type === 'infant').length;

    booking.travellers = booking.travellers || { adults: 1, children: 0, infants: 0 };
    const prevPax = (booking.travellers.adults || 0) + (booking.travellers.children || 0);

    // Use Math.max to prevent inflating counts for group bookings where pax was already booked
    booking.travellers.adults = Math.max(booking.travellers.adults || 0, adultDetailsCount);
    booking.travellers.children = Math.max(booking.travellers.children || 0, childDetailsCount);
    booking.travellers.infants = Math.max(booking.travellers.infants || 0, infantDetailsCount);

    const newPax = (booking.travellers.adults || 0) + (booking.travellers.children || 0);
    const totalWithInfants = newPax + (booking.travellers.infants || 0);

    // 2. Financial Bookkeeping: ONLY bill if explicitly requested
    if (shouldBillExtra && extraPrice > 0) {
      booking.totalAmount = (booking.totalAmount || 0) + extraPrice;
      operation.sellingPrice = (operation.sellingPrice || 0) + extraPrice;

      await CustomerPayment.create({
        operation: operation._id,
        booking: booking._id,
        milestone: `Extra Passenger: ${sanitizedPassenger.name || 'Additional'}`,
        amount: extraPrice,
        paidAmount: 0,
        status: 'upcoming',
        dueDate: new Date(),
      });
    }

    await booking.save();
    
    // Update pax in operation customers array
    const custIndex = operation.bookings?.findIndex((b: any) => String(b) === String(bookingId));
    if (custIndex !== undefined && custIndex !== -1 && operation.customers[custIndex]) {
       operation.customers[custIndex].pax = Math.max(operation.customers[custIndex].pax || 0, totalWithInfants);
       operation.customers[custIndex].adults = Math.max(operation.customers[custIndex].adults || 0, booking.travellers.adults || 0);
       operation.customers[custIndex].children = Math.max(operation.customers[custIndex].children || 0, booking.travellers.children || 0);
       operation.markModified('customers');
    } else if ((operation as any).customer) {
       (operation as any).customer.pax = Math.max((operation as any).customer.pax || 0, totalWithInfants);
       (operation as any).customer.adults = Math.max((operation as any).customer.adults || 0, booking.travellers.adults || 0);
       (operation as any).customer.children = Math.max((operation as any).customer.children || 0, booking.travellers.children || 0);
       operation.markModified('customer');
    }

    await operation.save();

    // 3. Update Package Slots ONLY if passenger increases booked slots beyond original booking
    const addedSlots = newPax - prevPax;
    if (addedSlots > 0 && pkg && operation.departureId) {
      await mongoose.model('Package').updateOne(
        { _id: pkg._id, 'departures._id': operation.departureId },
        { $inc: { 'departures.$.bookedSlots': addedSlots } }
      );
    }

    res.status(200).json({ status: 'success', message: 'Passenger added to existing booking', data: operation });

  } else if (mode === 'new') {
    if (!email) throw new AppError('Email is required for new booking mode', 400);
    
    // Allow custom price if specified in extraAmount, otherwise fallback to pkg.price
    const newBookingPrice = (extraAmount !== undefined && extraAmount !== '' && !isNaN(Number(extraAmount)))
      ? Number(extraAmount)
      : basePrice;

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
      totalAmount: newBookingPrice,
      paidAmount: 0,
      paymentStatus: 'pending',
      bookingStatus: 'confirmed',
      travelDate: operation.travelDates?.start || new Date(),
      returnDate: operation.travelDates?.end,
      travellers: { adults: sanitizedPassenger.type === 'adult' ? 1 : 0, children: sanitizedPassenger.type === 'child' ? 1 : 0, infants: sanitizedPassenger.type === 'infant' ? 1 : 0 },
      travellersDetails: [sanitizedPassenger],
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
    operation.sellingPrice = (operation.sellingPrice || 0) + newBookingPrice;
    await operation.save();

    // 4. Create Payment
    await CustomerPayment.create({
      operation: operation._id,
      booking: newBooking._id,
      milestone: 'Full Payment',
      amount: newBookingPrice,
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
