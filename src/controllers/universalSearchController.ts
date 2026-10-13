import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import Booking from '../models/Booking.js';
import Operation from '../models/Operation.js';
import Enquiry from '../models/Enquiry.js';
import CustomerPayment from '../models/CustomerPayment.js';
import mongoose from 'mongoose';

/**
 * Universal Search & 360° Customer/Trip Lifecycle Controller
 * Searches across Bookings, Operations, Enquiries, and Payments.
 * Returns fully linked lifecycle bundles grouped by Unified ID.
 */
export const searchUniversal = asyncHandler(async (req: Request, res: Response) => {
  const query = ((req.query.q || req.query.query || '') as string).trim();
  if (!query) {
    return res.status(200).json({ status: 'success', data: [] });
  }

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const searchRegex = new RegExp(escapedQuery, 'i');

  // Parallel search across all 4 key collections
  const [matchingBookings, matchingOps, matchingEnquiries, matchingPayments] = await Promise.all([
    // 1. Bookings by bookingId or primary traveler details
    Booking.find({
      $or: [
        { bookingId: searchRegex },
        { 'primaryTraveller.email': searchRegex },
        { 'primaryTraveller.phone': searchRegex },
        { 'primaryTraveller.firstName': searchRegex },
        { 'primaryTraveller.lastName': searchRegex },
      ],
    })
      .populate('package', 'name slug destination price isGroupTour duration images')
      .populate('destination', 'name')
      .populate('user', 'firstName lastName email phone')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),

    // 2. Operations by operationId or customer snapshot
    Operation.find({
      $or: [
        { operationId: searchRegex },
        { 'customers.email': searchRegex },
        { 'customers.phone': searchRegex },
        { 'customers.name': searchRegex },
        { destination: searchRegex },
      ],
    })
      .populate('package', 'name slug destination price duration')
      .populate('assignedTo', 'firstName lastName email phone')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),

    // 3. Enquiries by enquiryId, unifiedBookingId, contact info, destination, package
    Enquiry.find({
      $or: [
        { enquiryId: searchRegex },
        { unifiedBookingId: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
        { destination: searchRegex },
        { packageName: searchRegex },
      ],
    })
      .populate('package', 'name slug destination price')
      .populate('assignedTo', 'firstName lastName email phone')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),

    // 4. Customer payments by transactionId
    CustomerPayment.find({
      $or: [
        { transactionId: searchRegex },
        { 'financeDetails.transactionId': searchRegex },
      ],
    })
      .limit(6)
      .lean(),
  ]);

  // Aggregate trip identifiers to link all processes
  const bookingIdsToHydrate = new Set<string>();
  const enquiryIdsToHydrate = new Set<string>();
  const opIdsToHydrate = new Set<string>();

  // Add from bookings
  for (const b of matchingBookings) {
    bookingIdsToHydrate.add(String(b._id));
    if (b.enquiry) enquiryIdsToHydrate.add(String(b.enquiry));
  }

  // Add from operations
  for (const op of matchingOps) {
    opIdsToHydrate.add(String(op._id));
    if (op.booking) bookingIdsToHydrate.add(String(op.booking));
    if (op.bookings && Array.isArray(op.bookings)) {
      op.bookings.forEach((bid: any) => bookingIdsToHydrate.add(String(bid)));
    }
    if (op.enquiry) enquiryIdsToHydrate.add(String(op.enquiry));
  }

  // Add from enquiries
  for (const enq of matchingEnquiries) {
    enquiryIdsToHydrate.add(String(enq._id));
    if (enq.bookingRef) bookingIdsToHydrate.add(String(enq.bookingRef));
  }

  // Add from payments
  for (const p of matchingPayments) {
    if (p.booking) bookingIdsToHydrate.add(String(p.booking));
    if (p.operation) opIdsToHydrate.add(String(p.operation));
  }

  // Hydrate missing connected records in bulk
  const [hydratedBookings, hydratedOps, hydratedEnquiries] = await Promise.all([
    bookingIdsToHydrate.size > 0
      ? Booking.find({ _id: { $in: Array.from(bookingIdsToHydrate) } })
          .populate('package', 'name slug destination price isGroupTour duration images')
          .populate('destination', 'name')
          .populate('user', 'firstName lastName email phone')
          .lean()
      : [],
    opIdsToHydrate.size > 0 || bookingIdsToHydrate.size > 0
      ? Operation.find({
          $or: [
            { _id: { $in: Array.from(opIdsToHydrate) } },
            { booking: { $in: Array.from(bookingIdsToHydrate) } },
            { bookings: { $in: Array.from(bookingIdsToHydrate) } },
          ],
        })
          .populate('package', 'name slug destination price duration')
          .populate('assignedTo', 'firstName lastName email phone')
          .lean()
      : [],
    enquiryIdsToHydrate.size > 0 || bookingIdsToHydrate.size > 0
      ? Enquiry.find({
          $or: [
            { _id: { $in: Array.from(enquiryIdsToHydrate) } },
            { bookingRef: { $in: Array.from(bookingIdsToHydrate) } },
          ],
        })
          .populate('package', 'name slug destination price')
          .populate('assignedTo', 'firstName lastName email phone')
          .lean()
      : [],
  ]);

  // Combine into map for quick resolution
  const bookingMap = new Map<string, any>();
  const bookingByUnifiedIdMap = new Map<string, any>();
  for (const b of [...matchingBookings, ...hydratedBookings]) {
    const idStr = String(b._id);
    bookingMap.set(idStr, b);
    if (b.bookingId) bookingByUnifiedIdMap.set(b.bookingId, b);
  }

  const opMapByBookingId = new Map<string, any>();
  const opMapById = new Map<string, any>();
  for (const op of [...matchingOps, ...hydratedOps]) {
    opMapById.set(String(op._id), op);
    if (op.booking) opMapByBookingId.set(String(op.booking), op);
    if (op.bookings && Array.isArray(op.bookings)) {
      op.bookings.forEach((bid: any) => opMapByBookingId.set(String(bid), op));
    }
  }

  const enquiryMapByBookingId = new Map<string, any>();
  const enquiryMapById = new Map<string, any>();
  for (const enq of [...matchingEnquiries, ...hydratedEnquiries]) {
    enquiryMapById.set(String(enq._id), enq);
    if (enq.bookingRef) enquiryMapByBookingId.set(String(enq.bookingRef), enq);
    if (enq.unifiedBookingId) enquiryMapByBookingId.set(enq.unifiedBookingId, enq);
  }

  // Fetch all related customer payments
  const allBookingIds = Array.from(bookingMap.keys());
  const allOpIds = Array.from(opMapById.keys());
  const allPayments = await CustomerPayment.find({
    $or: [
      { booking: { $in: allBookingIds } },
      { operation: { $in: allOpIds } },
    ],
  })
    .sort({ dueDate: 1, createdAt: 1 })
    .lean();

  const paymentsMap = new Map<string, any[]>();
  for (const p of allPayments) {
    const bKey = p.booking ? String(p.booking) : null;
    const opKey = p.operation ? String(p.operation) : null;
    if (bKey) {
      if (!paymentsMap.has(bKey)) paymentsMap.set(bKey, []);
      paymentsMap.get(bKey)!.push(p);
    }
    if (opKey) {
      if (!paymentsMap.has(opKey)) paymentsMap.set(opKey, []);
      paymentsMap.get(opKey)!.push(p);
    }
  }

  // Build Unified Lifecycles
  const results: any[] = [];
  const processedKeys = new Set<string>();

  // 1. Group by Bookings first (since Booking ID is master unified ID)
  for (const [bIdStr, booking] of bookingMap.entries()) {
    const unifiedId = booking.bookingId || `BKG-${bIdStr.slice(-6).toUpperCase()}`;
    if (processedKeys.has(unifiedId)) continue;
    processedKeys.add(unifiedId);

    const operation = opMapByBookingId.get(bIdStr) || null;
    const enquiry =
      (booking.enquiry ? enquiryMapById.get(String(booking.enquiry)) : null) ||
      enquiryMapByBookingId.get(bIdStr) ||
      enquiryMapByBookingId.get(unifiedId) ||
      null;

    const payments = paymentsMap.get(bIdStr) || (operation ? paymentsMap.get(String(operation._id)) : []) || [];

    const totalAmount = booking.totalAmount || operation?.sellingPrice || 0;
    const paidAmount = booking.paidAmount || payments.reduce((acc: number, cur: any) => acc + (cur.paidAmount || 0), 0);
    const balance = Math.max(0, totalAmount - paidAmount);

    let stage = 'booking';
    if (booking.bookingStatus === 'cancelled' || operation?.status === 'cancelled') {
      stage = 'cancelled';
    } else if (operation?.status === 'completed') {
      stage = 'completed';
    } else if (operation?.status === 'in-progress' || operation?.status === 'vendor-confirmed') {
      stage = 'operations';
    }

    results.push({
      unifiedId,
      brand: booking.brand || 'letslivetours',
      customer: {
        name:
          `${booking.primaryTraveller?.firstName || ''} ${booking.primaryTraveller?.lastName || ''}`.trim() ||
          booking.user?.firstName ||
          operation?.customers?.[0]?.name ||
          enquiry?.firstName ||
          'Customer',
        email: booking.primaryTraveller?.email || booking.user?.email || operation?.customers?.[0]?.email || enquiry?.email || '',
        phone: booking.primaryTraveller?.phone || booking.user?.phone || operation?.customers?.[0]?.phone || enquiry?.phone || '',
        pax: (booking.travellers?.adults || 1) + (booking.travellers?.children || 0),
      },
      destination: (booking.destination as any)?.name || operation?.destination || enquiry?.destination || 'TBD',
      packageName: (booking.package as any)?.name || operation?.package?.name || enquiry?.packageName || 'Package Tour',
      travelDates: {
        start: booking.travelDate || operation?.travelDates?.start,
        end: booking.returnDate || operation?.travelDates?.end,
      },
      currentStage: stage,
      enquiry: enquiry
        ? {
            _id: String(enquiry._id),
            enquiryId: enquiry.enquiryId || `ENQ-${String(enquiry._id).slice(-6).toUpperCase()}`,
            unifiedBookingId: enquiry.unifiedBookingId || unifiedId,
            status: enquiry.status,
            source: enquiry.source,
            assignedTo: enquiry.assignedTo
              ? {
                  _id: String((enquiry.assignedTo as any)._id),
                  name: `${(enquiry.assignedTo as any).firstName || ''} ${(enquiry.assignedTo as any).lastName || ''}`.trim(),
                  email: (enquiry.assignedTo as any).email,
                }
              : null,
            message: enquiry.message,
            notesCount: enquiry.notes?.length || 0,
            callLogCount: enquiry.callLog?.length || 0,
            createdAt: enquiry.createdAt,
          }
        : null,
      booking: {
        _id: String(booking._id),
        bookingId: unifiedId,
        status: booking.status || 'confirmed',
        bookingStatus: booking.bookingStatus || 'confirmed',
        paymentStatus: booking.paymentStatus || 'unpaid',
        paymentFinanceStatus: booking.paymentFinanceStatus || 'approved',
        totalAmount,
        paidAmount,
        balanceAmount: balance,
        travellersCount: (booking.travellers?.adults || 1) + (booking.travellers?.children || 0),
        travellersDetails: booking.travellersDetails || [],
        createdAt: booking.createdAt,
      },
      operation: operation
        ? {
            _id: String(operation._id),
            operationId: operation.operationId || unifiedId,
            status: operation.status,
            voucherGenerated: !!operation.voucherGenerated,
            assignedTo: operation.assignedTo
              ? {
                  _id: String(operation.assignedTo._id),
                  name: `${operation.assignedTo.firstName} ${operation.assignedTo.lastName || ''}`.trim(),
                  email: operation.assignedTo.email,
                }
              : null,
            sellingPrice: operation.sellingPrice || totalAmount,
            totalVendorCost: operation.totalVendorCost || 0,
            grossProfit: operation.grossProfit || 0,
            notes: operation.notes || '',
            createdAt: operation.createdAt,
          }
        : null,
      payments: payments.map((p: any) => ({
        _id: String(p._id),
        milestone: p.milestone || 'Installment',
        amount: p.amount || 0,
        paidAmount: p.paidAmount || 0,
        status: p.status || 'upcoming',
        dueDate: p.dueDate,
        paidDate: p.paidDate,
        paymentMode: p.paymentMode || '',
        transactionId: p.transactionId || p.financeDetails?.transactionId || '',
        financeStatus: p.financeStatus || 'none',
      })),
      financeSummary: {
        totalAmount,
        paidAmount,
        balance,
        status: paidAmount >= totalAmount && totalAmount > 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'pending',
      },
    });
  }

  // 2. Add any standalone enquiries (leads that haven't converted to a booking yet)
  for (const enq of matchingEnquiries) {
    const enqIdStr = String(enq._id);
    const existing = results.find((r) => r.enquiry?._id === enqIdStr);
    if (existing) continue;

    const unifiedId = enq.enquiryId || `ENQ-${enqIdStr.slice(-6).toUpperCase()}`;
    if (processedKeys.has(unifiedId)) continue;
    processedKeys.add(unifiedId);

    results.push({
      unifiedId,
      brand: enq.brand || 'letslivetours',
      customer: {
        name: `${enq.firstName || ''} ${enq.lastName || ''}`.trim() || 'Lead',
        email: enq.email || '',
        phone: enq.phone || '',
        pax: enq.travellerCount || (enq.adultCount || 1) + (enq.childCount || 0),
      },
      destination: enq.destination || 'TBD',
      packageName: (enq.package as any)?.name || enq.packageName || 'General Tour Inquiry',
      travelDates: {
        start: enq.travelDate,
      },
      currentStage: 'enquiry',
      enquiry: {
        _id: enqIdStr,
        enquiryId: unifiedId,
        unifiedBookingId: enq.unifiedBookingId || null,
        status: enq.status,
        source: enq.source,
        assignedTo: enq.assignedTo
          ? {
              _id: String((enq.assignedTo as any)._id),
              name: `${(enq.assignedTo as any).firstName || ''} ${(enq.assignedTo as any).lastName || ''}`.trim(),
              email: (enq.assignedTo as any).email,
            }
          : null,
        message: enq.message,
        notesCount: enq.notes?.length || 0,
        callLogCount: enq.callLog?.length || 0,
        createdAt: enq.createdAt,
      },
      booking: null,
      operation: null,
      payments: [],
      financeSummary: {
        totalAmount: enq.conversionValue || enq.budget || 0,
        paidAmount: 0,
        balance: enq.conversionValue || enq.budget || 0,
        status: 'pending',
      },
    });
  }

  res.status(200).json({
    status: 'success',
    results: results.length,
    data: results,
  });
});
