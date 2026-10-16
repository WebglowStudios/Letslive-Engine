import { Router, Request, Response } from 'express';
import { protect, requirePermission } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import Vendor from '../models/Vendor.js';
import OperationAccommodation from '../models/OperationAccommodation.js';
import OperationTransport from '../models/OperationTransport.js';
import OperationActivity from '../models/OperationActivity.js';
import VendorPayment from '../models/VendorPayment.js';

const router = Router();
router.use(protect, requirePermission('dashboard.view'));

// Helper: Escape special characters for regex
function escapeRegex(s: string): string {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

// Helper: Build resilient regex matchers for a vendor name
function getVendorRegexes(name: string): RegExp[] {
  const trimmed = (name || '').trim();
  if (!trimmed) return [];
  const escaped = escapeRegex(trimmed);
  const exact = new RegExp('^' + escaped + '$', 'i');

  // Strip common company suffix words to match partial or alias forms
  const cleaned = trimmed
    .replace(/\s*(pvt\s*ltd|ltd|india|co\.|travels|holidays|tourism|vacation|dmc\s*north\s*india)\b/gi, '')
    .trim();

  if (cleaned.length >= 3 && cleaned.toLowerCase() !== trimmed.toLowerCase()) {
    const flex = new RegExp(escapeRegex(cleaned), 'i');
    return [exact, flex];
  }
  return [exact];
}

// Helper: Extract primary customer details from operation
function extractCustomer(op: any) {
  if (!op) return { name: 'Guest', pax: 1, email: '', phone: '' };
  const leadCust = (op.customer && op.customer.name && op.customer.name.trim())
    ? op.customer
    : (op.customers && op.customers.length > 0 && op.customers[0]?.name ? op.customers[0] : null);
  const name = leadCust?.name || op.customer?.name || 'Guest';
  const email = leadCust?.email || op.customer?.email || '';
  const phone = leadCust?.phone || op.customer?.phone || '';
  const pax = leadCust?.pax || op.customer?.pax || (op.customers?.length ? op.customers.reduce((s: number, c: any) => s + (c.pax || 1), 0) : 1);
  return { name, email, phone, pax };
}

// Helper: Calculate paid amount for a service item
function getPaidAmount(status: string | undefined, paidAmount: number | undefined, vendorCost: number | undefined): number {
  const cost = Number(vendorCost) || 0;
  if (status === 'paid') {
    return (paidAmount !== undefined && Number(paidAmount) > 0) ? Number(paidAmount) : cost;
  }
  if (status === 'partial') {
    return Number(paidAmount) || 0;
  }
  return Number(paidAmount) || 0;
}

// GET all vendors (with optional type/search filter AND live financial stats)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { isActive: true };
  if (req.query.type) filter.type = req.query.type;
  if (req.query.search) {
    filter.name = new RegExp(req.query.search as string, 'i');
  }

  const vendors = await Vendor.find(filter).sort({ name: 1 }).lean();

  // Load all assigned operations data in a single batch for ultra-fast aggregation
  const [allAccs, allTrs, allActs] = await Promise.all([
    OperationAccommodation.find(
      { vendorName: { $exists: true, $ne: '' } },
      'vendorName vendorCost paidAmount paymentStatus operation'
    ).lean(),
    OperationTransport.find(
      { vendorName: { $exists: true, $ne: '' } },
      'vendorName vendorCost paidAmount paymentStatus operation'
    ).lean(),
    OperationActivity.find(
      {
        $or: [
          { vendorName: { $exists: true, $ne: '' } },
          { 'transfers.vendorName': { $exists: true, $ne: '' } }
        ]
      },
      'vendorName vendorCost paidAmount paymentStatus operation transfers'
    ).lean(),
  ]);

  const vendorsWithStats = vendors.map((v) => {
    const regexes = getVendorRegexes(v.name);
    const matchesVendor = (name?: string) => {
      if (!name) return false;
      return regexes.some((r) => r.test(name.trim()));
    };

    const matchingAccs = allAccs.filter((a) => matchesVendor(a.vendorName));
    const matchingTrs = allTrs.filter((t) => matchesVendor(t.vendorName));
    const matchingActs: any[] = [];
    const matchingTransfers: any[] = [];

    allActs.forEach((act) => {
      if (matchesVendor(act.vendorName)) {
        matchingActs.push(act);
      }
      if (Array.isArray(act.transfers)) {
        act.transfers.forEach((tr: any) => {
          if (matchesVendor(tr.vendorName)) {
            matchingTransfers.push({ ...tr, operation: act.operation });
          }
        });
      }
    });

    const opIds = new Set<string>();
    matchingAccs.forEach((a) => { if (a.operation) opIds.add(a.operation.toString()); });
    matchingTrs.forEach((t) => { if (t.operation) opIds.add(t.operation.toString()); });
    matchingActs.forEach((act) => { if (act.operation) opIds.add(act.operation.toString()); });
    matchingTransfers.forEach((tr) => { if (tr.operation) opIds.add(tr.operation.toString()); });

    const accCost = matchingAccs.reduce((s, a) => s + (a.vendorCost || 0), 0);
    const trCost = matchingTrs.reduce((s, t) => s + (t.vendorCost || 0), 0);
    const actCost = matchingActs.reduce((s, act) => s + (act.vendorCost || 0), 0);
    const transferCost = matchingTransfers.reduce((s, tr) => s + (tr.vendorCost || 0), 0);
    const totalCost = accCost + trCost + actCost + transferCost;

    const accPaid = matchingAccs.reduce((s, a) => s + getPaidAmount(a.paymentStatus, a.paidAmount, a.vendorCost), 0);
    const trPaid = matchingTrs.reduce((s, t) => s + getPaidAmount(t.paymentStatus, t.paidAmount, t.vendorCost), 0);
    const actPaid = matchingActs.reduce((s, act) => s + getPaidAmount(act.paymentStatus, act.paidAmount, act.vendorCost), 0);
    const transferPaid = matchingTransfers.reduce((s, tr) => s + getPaidAmount(tr.paymentStatus, tr.paidAmount, tr.vendorCost), 0);
    const totalPaid = accPaid + trPaid + actPaid + transferPaid;

    const pendingBalance = Math.max(0, totalCost - totalPaid);
    const servicesCount = matchingAccs.length + matchingTrs.length + matchingActs.length + matchingTransfers.length;

    return {
      ...v,
      stats: {
        totalCost,
        totalPaid,
        pendingBalance,
        bookingsCount: opIds.size,
        servicesCount,
      },
    };
  });

  res.status(200).json({ status: 'success', data: vendorsWithStats });
}));

// GET detailed booking assignments and payments for a specific vendor
router.get('/:id/assignments', asyncHandler(async (req: Request, res: Response) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw new AppError('Vendor not found', 404);

  const regexes = getVendorRegexes(vendor.name);
  const vendorFilter = { $or: regexes.map((r) => ({ vendorName: r })) };
  const vpFilter = { $or: regexes.map((r) => ({ vendor: r })) };

  const [accommodations, transports, activities, vendorPayments] = await Promise.all([
    OperationAccommodation.find(vendorFilter)
      .populate('operation', 'operationId destination travelDates customer customers status')
      .lean(),
    OperationTransport.find(vendorFilter)
      .populate('operation', 'operationId destination travelDates customer customers status')
      .lean(),
    OperationActivity.find({
      $or: [
        ...regexes.map((r) => ({ vendorName: r })),
        ...regexes.map((r) => ({ 'transfers.vendorName': r })),
      ],
    })
      .populate('operation', 'operationId destination travelDates customer customers status')
      .lean(),
    VendorPayment.find(vpFilter)
      .populate('operation', 'operationId destination customer')
      .sort({ dueDate: 1, createdAt: -1 })
      .lean(),
  ]);

  const bookingMap = new Map<string, any>();

  const getOrCreateBooking = (op: any, fallbackId: string) => {
    const key = op?._id?.toString() || fallbackId || 'unlinked';
    if (!bookingMap.has(key)) {
      bookingMap.set(key, {
        operationId: op?.operationId || 'Unlinked',
        operationObjectId: op?._id?.toString() || null,
        destination: op?.destination || 'N/A',
        travelDates: op?.travelDates || null,
        customer: extractCustomer(op),
        status: op?.status || 'unknown',
        totals: { cost: 0, paid: 0, pending: 0 },
        parts: [],
      });
    }
    return bookingMap.get(key);
  };

  // 1. Process Accommodations
  accommodations.forEach((acc: any) => {
    const op = acc.operation;
    const bkg = getOrCreateBooking(op, acc.operation?.toString() || '');
    const cost = Number(acc.vendorCost) || 0;
    const paid = getPaidAmount(acc.paymentStatus, acc.paidAmount, acc.vendorCost);
    const pending = Math.max(0, cost - paid);

    bkg.totals.cost += cost;
    bkg.totals.paid += paid;
    bkg.totals.pending += pending;

    bkg.parts.push({
      _id: acc._id.toString(),
      category: 'accommodation',
      title: acc.name || 'Hotel Accommodation',
      subtitle: `${acc.roomCategory || 'Standard'} • ${acc.nights || 1} Night(s) • ${acc.mealPlan || 'Plan'}`,
      type: acc.type || 'hotel',
      vendorCost: cost,
      paidAmount: paid,
      paymentStatus: acc.paymentStatus || 'pending',
      paymentDueDate: acc.paymentDueDate,
      remarks: acc.remarks,
      details: {
        roomCategory: acc.roomCategory,
        nights: acc.nights,
        rooms: acc.rooms,
        mealPlan: acc.mealPlan,
        checkIn: acc.checkIn,
        checkOut: acc.checkOut,
        confirmationNumber: acc.confirmationNumber,
        tripDay: acc.tripDay,
        area: acc.area,
      },
    });
  });

  // 2. Process Transports
  transports.forEach((tr: any) => {
    const op = tr.operation;
    const bkg = getOrCreateBooking(op, tr.operation?.toString() || '');
    const cost = Number(tr.vendorCost) || 0;
    const paid = getPaidAmount(tr.paymentStatus, tr.paidAmount, tr.vendorCost);
    const pending = Math.max(0, cost - paid);

    bkg.totals.cost += cost;
    bkg.totals.paid += paid;
    bkg.totals.pending += pending;

    const legsSummary = (tr.legs && tr.legs.length > 0)
      ? tr.legs.map((l: any) => `${l.from || 'Origin'} → ${l.to || 'Destination'}${l.vehicleType ? ` (${l.vehicleType})` : ''}`).join(' • ')
      : (tr.type || 'Transport');

    bkg.parts.push({
      _id: tr._id.toString(),
      category: 'transport',
      title: tr.title || (tr.legs?.[0]?.from ? `${tr.legs[0].from} to ${tr.legs[0].to}` : 'Flight / Train / Transfer'),
      subtitle: legsSummary,
      type: tr.type || 'transport',
      vendorCost: cost,
      paidAmount: paid,
      paymentStatus: tr.paymentStatus || 'pending',
      paymentDueDate: tr.paymentDueDate,
      remarks: tr.remarks,
      details: {
        legs: tr.legs || [],
        vendorContact: tr.vendorContact,
        vendorEmail: tr.vendorEmail,
      },
    });
  });

  // 3. Process Activities & Transfers
  activities.forEach((act: any) => {
    const op = act.operation;
    const bkg = getOrCreateBooking(op, act.operation?.toString() || '');
    const matchesVendor = (name?: string) => {
      if (!name) return false;
      return regexes.some((r) => r.test(name.trim()));
    };

    if (matchesVendor(act.vendorName)) {
      const cost = Number(act.vendorCost) || 0;
      const paid = getPaidAmount(act.paymentStatus, act.paidAmount, act.vendorCost);
      const pending = Math.max(0, cost - paid);

      bkg.totals.cost += cost;
      bkg.totals.paid += paid;
      bkg.totals.pending += pending;

      bkg.parts.push({
        _id: act._id.toString(),
        category: 'activity',
        title: act.title || 'Tour / Activity',
        subtitle: act.tripDay ? `${act.tripDay}${act.duration ? ` • ${act.duration}` : ''}` : (act.duration || 'Activity'),
        type: 'activity',
        vendorCost: cost,
        paidAmount: paid,
        paymentStatus: act.paymentStatus || 'pending',
        paymentDueDate: act.paymentDueDate,
        remarks: act.remarks,
        details: {
          description: act.description,
          date: act.date,
          tripDay: act.tripDay,
          duration: act.duration,
        },
      });
    }

    if (Array.isArray(act.transfers)) {
      act.transfers.forEach((tr: any) => {
        if (matchesVendor(tr.vendorName)) {
          const cost = Number(tr.vendorCost) || 0;
          const paid = getPaidAmount(tr.paymentStatus, tr.paidAmount, tr.vendorCost);
          const pending = Math.max(0, cost - paid);

          bkg.totals.cost += cost;
          bkg.totals.paid += paid;
          bkg.totals.pending += pending;

          bkg.parts.push({
            _id: tr._id ? tr._id.toString() : `${act._id}-transfer-${tr.from}`,
            parentActivityId: act._id.toString(),
            category: 'transfer',
            title: `${act.title || 'Itinerary Transfer'}: ${tr.title || `${tr.from || 'Origin'} to ${tr.to || 'Destination'}`}`,
            subtitle: `${tr.vehicleType || 'Vehicle'}${tr.notes ? ` • ${tr.notes}` : ''}`,
            type: tr.vehicleType || 'vehicle',
            vendorCost: cost,
            paidAmount: paid,
            paymentStatus: tr.paymentStatus || 'pending',
            details: {
              from: tr.from,
              to: tr.to,
              vehicleType: tr.vehicleType,
              departureTime: tr.departureTime,
              arrivalTime: tr.arrivalTime,
              driverName: tr.driverName,
              driverContact: tr.driverContact,
              vehicleNumber: tr.vehicleNumber,
              notes: tr.notes,
            },
          });
        }
      });
    }
  });

  const bookings = Array.from(bookingMap.values()).sort((a, b) => {
    const da = a.travelDates?.start ? new Date(a.travelDates.start).getTime() : 0;
    const db = b.travelDates?.start ? new Date(b.travelDates.start).getTime() : 0;
    return db - da;
  });

  const totalCost = bookings.reduce((s, b) => s + b.totals.cost, 0);
  const totalPaid = bookings.reduce((s, b) => s + b.totals.paid, 0);
  const pendingBalance = Math.max(0, totalCost - totalPaid);
  const servicesCount = bookings.reduce((s, b) => s + b.parts.length, 0);

  res.status(200).json({
    status: 'success',
    data: {
      vendor,
      stats: {
        totalCost,
        totalPaid,
        pendingBalance,
        bookingsCount: bookings.length,
        servicesCount,
      },
      bookings,
      payments: vendorPayments.map((vp: any) => ({
        _id: vp._id.toString(),
        operationId: vp.operation?.operationId || '',
        operationObjectId: vp.operation?._id?.toString() || '',
        destination: vp.operation?.destination || '',
        customerName: vp.operation?.customer?.name || '',
        serviceType: vp.serviceType,
        description: vp.description,
        amount: vp.amount || 0,
        paidAmount: vp.paidAmount || 0,
        status: vp.status,
        dueDate: vp.dueDate,
        paidDate: vp.paidDate,
        paymentMode: vp.paymentMode,
        transactionId: vp.transactionId,
        remarks: vp.remarks,
      })),
    },
  });
}));

// Quick update payment for an assigned service part directly
router.put('/:id/assignments/:category/:serviceId/payment', asyncHandler(async (req: Request, res: Response) => {
  const { category, serviceId } = req.params;
  const { paymentStatus, paidAmount, paymentDueDate, remarks } = req.body;

  const updateFields: Record<string, any> = {};
  if (paymentStatus) updateFields.paymentStatus = paymentStatus;
  if (paidAmount !== undefined) updateFields.paidAmount = Number(paidAmount);
  if (paymentDueDate !== undefined) updateFields.paymentDueDate = paymentDueDate ? new Date(paymentDueDate) : null;
  if (remarks !== undefined) updateFields.remarks = remarks;

  let updatedDoc: any = null;

  if (category === 'accommodation') {
    if (paymentStatus === 'paid' && (paidAmount === undefined || Number(paidAmount) === 0)) {
      const existing = await OperationAccommodation.findById(serviceId);
      if (existing) updateFields.paidAmount = existing.vendorCost || 0;
    }
    updatedDoc = await OperationAccommodation.findByIdAndUpdate(serviceId, updateFields, { new: true });
  } else if (category === 'transport') {
    if (paymentStatus === 'paid' && (paidAmount === undefined || Number(paidAmount) === 0)) {
      const existing = await OperationTransport.findById(serviceId);
      if (existing) updateFields.paidAmount = existing.vendorCost || 0;
    }
    updatedDoc = await OperationTransport.findByIdAndUpdate(serviceId, updateFields, { new: true });
  } else if (category === 'activity') {
    if (paymentStatus === 'paid' && (paidAmount === undefined || Number(paidAmount) === 0)) {
      const existing = await OperationActivity.findById(serviceId);
      if (existing) updateFields.paidAmount = existing.vendorCost || 0;
    }
    updatedDoc = await OperationActivity.findByIdAndUpdate(serviceId, updateFields, { new: true });
  } else if (category === 'transfer') {
    const parent = await OperationActivity.findOne({ 'transfers._id': serviceId });
    if (parent) {
      const trIndex = parent.transfers.findIndex((t: any) => t._id.toString() === serviceId);
      if (trIndex > -1) {
        if (paymentStatus) parent.transfers[trIndex].paymentStatus = paymentStatus;
        if (paidAmount !== undefined) {
          parent.transfers[trIndex].paidAmount = Number(paidAmount);
        } else if (paymentStatus === 'paid') {
          parent.transfers[trIndex].paidAmount = parent.transfers[trIndex].vendorCost || 0;
        }
        await parent.save();
        updatedDoc = parent.transfers[trIndex];
      }
    }
  }

  if (!updatedDoc) throw new AppError('Service item not found', 404);

  res.status(200).json({ status: 'success', data: updatedDoc });
}));

// GET single vendor
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const vendor = await Vendor.findById(req.params.id);
  if (!vendor) throw new AppError('Vendor not found', 404);
  res.status(200).json({ status: 'success', data: vendor });
}));

// CREATE vendor
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const vendor = await Vendor.create(req.body);
  res.status(201).json({ status: 'success', data: vendor });
}));

// UPDATE vendor
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!vendor) throw new AppError('Vendor not found', 404);
  res.status(200).json({ status: 'success', data: vendor });
}));

// DELETE vendor (soft delete)
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  await Vendor.findByIdAndUpdate(req.params.id, { isActive: false });
  res.status(204).json({ status: 'success', data: null });
}));

export default router;
