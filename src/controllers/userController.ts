import { Request, Response } from 'express';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';
import Enquiry from '../models/Enquiry.js';
import Operation from '../models/Operation.js';
import Review from '../models/Review.js';
import EmployeeTarget from '../models/EmployeeTarget.js';
import '../models/Booking.js'; // Side-effect import to ensure Schema is registered for populate
import '../models/Package.js';
import mongoose from 'mongoose';
import { encryptPassword, decryptPassword } from '../utils/crypto.js';

// @desc    Get all users (admin)
// @route   GET /api/users
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    User.find().select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(),
  ]);

  res.status(200).json({
    status: 'success',
    results: users.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: users,
  });
});

// @desc    Get staff list (for reassign dropdowns — any auth user)
// @route   GET /api/users/staff
export const getStaffList = asyncHandler(async (req: Request, res: Response) => {
  let roles: any[] = ['admin', 'manager', 'sales-manager', 'sales-staff', 'ops-manager', 'ops-staff', 'staff'];
  
  if (req.query.department === 'sales') {
    roles = ['admin', 'manager', 'sales-manager', 'sales-staff', 'staff'];
  } else if (req.query.department === 'ops') {
    roles = ['admin', 'manager', 'ops-manager', 'ops-staff'];
  }

  const [staff, activeCounts, unassignedCount] = await Promise.all([
    User.find({
      role: { $in: roles },
      isActive: { $ne: false },
    })
      .select('_id firstName lastName email role')
      .sort({ firstName: 1 })
      .lean(),
    Enquiry.aggregate([
      { $match: { status: { $nin: ['closed', 'resolved'] }, assignedTo: { $ne: null } } },
      { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
    ]),
    Enquiry.countDocuments({
      status: { $nin: ['closed', 'resolved'] },
      $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }],
    }),
  ]);

  const countMap = new Map<string, number>();
  for (const c of activeCounts) {
    if (c._id) countMap.set(c._id.toString(), c.count);
  }

  const staffWithCounts = staff.map((s) => ({
    ...s,
    activeLeadsCount: countMap.get(s._id.toString()) || 0,
  }));

  res.status(200).json({
    status: 'success',
    data: staffWithCounts,
    meta: {
      unassignedActiveLeads: unassignedCount,
    },
  });
});


// @desc    Get user by ID (admin)
// @route   GET /api/users/:id
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id).select('-password');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: user,
  });
});

// @desc    Update profile (user)
// @route   PUT /api/users/profile
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, phone, avatar } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user!._id,
    { firstName, lastName, phone, avatar },
    { new: true, runValidators: true }
  ).select('-password');

  res.status(200).json({
    status: 'success',
    data: user,
  });
});

// @desc    Change password (user)
// @route   PUT /api/users/password
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError('Please provide current and new password', 400);
  }

  const user = await User.findById(req.user!._id).select('+password');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 401);
  }

  user.password = newPassword;
  user.viewablePassword = encryptPassword(newPassword);
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Password updated successfully',
  });
});

// @desc    Add to wishlist (user)
// @route   POST /api/users/wishlist/:packageId
export const addToWishlist = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findByIdAndUpdate(
    req.user!._id,
    { $addToSet: { wishlist: req.params.packageId } },
    { returnDocument: 'after' }
  ).select('-password');

  res.status(200).json({
    status: 'success',
    data: user?.wishlist,
  });
});

// @desc    Remove from wishlist (user)
// @route   DELETE /api/users/wishlist/:packageId
export const removeFromWishlist = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findByIdAndUpdate(
    req.user!._id,
    { $pull: { wishlist: req.params.packageId } },
    { new: true }
  ).select('-password');

  res.status(200).json({
    status: 'success',
    data: user?.wishlist,
  });
});

// @desc    Get wishlist (user)
// @route   GET /api/users/wishlist
export const getWishlist = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!._id)
    .populate('wishlist', 'name slug images price destination duration rating')
    .select('wishlist');

  res.status(200).json({
    status: 'success',
    results: user?.wishlist?.length || 0,
    data: user?.wishlist || [],
  });
});

// @desc    Delete user (admin)
// @route   DELETE /api/users/:id
export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

// @desc    Update user password (admin)
// @route   PUT /api/users/:id/password
export const updateUserPassword = asyncHandler(async (req: Request, res: Response) => {
  const { password } = req.body;

  if (!password || password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  user.password = password;
  user.viewablePassword = encryptPassword(password);
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'User password updated successfully',
  });
});

// @desc    Get user password for admin viewing
// @route   GET /api/users/:id/password-reveal
export const getUserPassword = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.params.id).select('+viewablePassword');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (!user.viewablePassword) {
    return res.status(200).json({
      status: 'success',
      data: {
        password: null,
        isPreExisting: true,
        message: 'Password was created before this feature was enabled (stored as one-way hash).',
      },
    });
  }

  const plainPassword = decryptPassword(user.viewablePassword);
  res.status(200).json({
    status: 'success',
    data: {
      password: plainPassword,
      isPreExisting: false,
    },
  });
});

// @desc    Search user by email (staff use: customer lookup for manual bookings)
// @route   GET /api/users/search?email=...
export const searchUserByEmail = asyncHandler(async (req: Request, res: Response) => {
  const email = (req.query.email as string || '').trim().toLowerCase();
  if (!email) throw new AppError('Email query parameter is required', 400);

  const user = await User.findOne({ email }).select('_id firstName lastName email phone role createdAt').lean();
  if (!user) throw new AppError('No account found with this email', 404);

  res.status(200).json({ status: 'success', data: user });
});

// @route   GET /api/users/:id/performance
export const getUserPerformance = asyncHandler(async (req: Request, res: Response) => {
  const targetId = req.params.id === 'me' ? req.user!._id : req.params.id;
  
  if (req.params.id !== 'me' && req.user!.role !== 'admin' && req.user!.role !== 'manager' && req.user!.role !== 'sales-manager') {
    throw new AppError('Not authorized to view other users performance', 403);
  }

  const userId = new mongoose.Types.ObjectId(String(targetId));
  const userProfile = await User.findById(userId).select('firstName lastName email role department').lean();

  // Timeframe parameters
  const period = ((req.query.period as string) || 'monthly').toLowerCase(); // 'monthly' | 'quarterly' | 'yearly' | 'all'
  const now = new Date();
  const year = req.query.year ? parseInt(req.query.year as string, 10) : now.getFullYear();
  const month = req.query.month ? parseInt(req.query.month as string, 10) : now.getMonth() + 1;
  const quarter = req.query.quarter ? parseInt(req.query.quarter as string, 10) : Math.floor(now.getMonth() / 3) + 1;

  let startDate: Date | null = null;
  let endDate: Date | null = null;

  if (period === 'monthly') {
    startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    endDate = new Date(year, month, 0, 23, 59, 59, 999);
  } else if (period === 'quarterly') {
    const startMonth = (quarter - 1) * 3;
    startDate = new Date(year, startMonth, 1, 0, 0, 0, 0);
    endDate = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  } else if (period === 'yearly') {
    startDate = new Date(year, 0, 1, 0, 0, 0, 0);
    endDate = new Date(year, 11, 31, 23, 59, 59, 999);
  }

  const dateFilter = startDate && endDate ? { $gte: startDate, $lte: endDate } : null;

  // 1. Inquiries Managed & Conversions within timeframe
  const enquiryMatch: Record<string, any> = { assignedTo: userId };
  if (dateFilter) enquiryMatch.createdAt = dateFilter;

  const enquiriesStats = await Enquiry.aggregate([
    { $match: enquiryMatch },
    {
      $group: {
        _id: null,
        totalManaged: { $sum: 1 },
        totalConverted: { $sum: { $cond: [{ $eq: ['$status', 'converted'] }, 1, 0] } },
      },
    },
  ]);

  const inquiriesManaged = enquiriesStats[0]?.totalManaged || 0;
  const conversions = enquiriesStats[0]?.totalConverted || 0;

  // 2a. Clients / Ops Handled — count operations WHERE THIS PERSON IS THE OPS HANDLER
  //     Uses `assignedTo` — this is purely about who is MANAGING the trip logistics
  const opsMatch: Record<string, any> = { assignedTo: userId };
  if (dateFilter) opsMatch.createdAt = dateFilter;

  const opsHandledStats = await Operation.aggregate([
    { $match: opsMatch },
    {
      $group: {
        _id: null,
        clientsHandled: { $sum: 1 },
      },
    },
  ]);

  const clientsHandled = opsHandledStats[0]?.clientsHandled || 0;

  // 2b. Revenue, Profit & Incentives — count operations WHERE THIS PERSON IS THE SALESPERSON
  //     Uses `salesperson` — this is purely about who CLOSED the sale / gets the credit
  //     Falls back to `assignedTo` only for legacy operations that predate the salesperson field
  const salesMatch: Record<string, any> = {
    $or: [
      { salesperson: userId },
      // Legacy fallback: if no salesperson is set, fall back to assignedTo
      // so pre-migration ops are still credited correctly
      { salesperson: { $exists: false }, assignedTo: userId },
      { salesperson: null, assignedTo: userId },
    ],
  };
  if (dateFilter) salesMatch.createdAt = dateFilter;

  const opsStats = await Operation.aggregate([
    { $match: salesMatch },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$sellingPrice' },
        totalProfit: { $sum: '$grossProfit' },
        totalIncentives: { $sum: { $ifNull: ['$incentiveAmount', 0] } },
        pendingIncentives: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'completed'] },
                  { $eq: [{ $ifNull: ['$incentiveAmount', 'MISSING'] }, 'MISSING'] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const revenueGenerated = opsStats[0]?.totalRevenue || 0;
  const grossProfit = opsStats[0]?.totalProfit || 0;
  const profitGenerated = grossProfit;
  const incentivesEarned = opsStats[0]?.totalIncentives || 0;
  const pendingIncentives = opsStats[0]?.pendingIncentives || 0;
  const netProfit = grossProfit - incentivesEarned;

  // 3. Approved reviews entered by this employee within timeframe
  const reviewMatch: Record<string, any> = {
    $or: [{ createdBy: userId }, { user: userId }],
    isApproved: true,
  };
  if (dateFilter) {
    reviewMatch.$and = [
      {
        $or: [
          { reviewDate: dateFilter },
          { createdAt: dateFilter },
        ],
      },
    ];
  }

  const [totalReviewsEntered, reviewsByPackage] = await Promise.all([
    Review.countDocuments(reviewMatch),
    Review.aggregate([
      { $match: reviewMatch },
      {
        $group: {
          _id: '$package',
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: 'packages',
          localField: '_id',
          foreignField: '_id',
          as: 'packageDoc',
        },
      },
      {
        $project: {
          packageId: '$_id',
          packageName: { $ifNull: [{ $arrayElemAt: ['$packageDoc.name', 0] }, 'Unassigned / Direct'] },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]),
  ]);

  // 4. Employee Target lookup for the specified timeframe
  let targetDoc = null;
  if (period !== 'all') {
    const targetQuery: Record<string, any> = {
      user: userId,
      periodType: period,
      year,
    };
    if (period === 'monthly') targetQuery.month = month;
    if (period === 'quarterly') targetQuery.quarter = quarter;
    targetDoc = await EmployeeTarget.findOne(targetQuery).lean();
  }

  // Calculate achievements against target
  let salesTarget = 0;
  let revenueTarget = 0;
  let reviewTarget = 0;
  let targetPackageId: string | null = null;
  let targetPackageName: string | null = null;
  let targetNotes: string | null = null;
  let reviewAchieved = totalReviewsEntered;

  if (targetDoc) {
    salesTarget = targetDoc.salesTarget || 0;
    revenueTarget = targetDoc.revenueTarget || 0;
    reviewTarget = targetDoc.reviewTarget || 0;
    targetPackageId = targetDoc.package ? String(targetDoc.package) : null;
    targetPackageName = targetDoc.packageName || null;
    targetNotes = targetDoc.notes || null;

    if (targetDoc.package) {
      // Review target is set specifically for a particular package
      const pkgReviewsCount = await Review.countDocuments({
        ...reviewMatch,
        package: targetDoc.package,
      });
      reviewAchieved = pkgReviewsCount;
    }
  }

  // Actual sales = number of operations WHERE THIS PERSON IS THE SALESPERSON (not ops handler)
  const salesClosedCount = opsStats[0] ? (await Operation.countDocuments(salesMatch)) : 0;
  const salesAchieved = salesClosedCount;
  const isSalesAchieved = salesTarget > 0 ? salesAchieved >= salesTarget : null;
  const grossProfitTarget = targetDoc?.grossProfitTarget || 0;
  const netProfitTarget = targetDoc?.netProfitTarget || 0;
  const isRevenueAchieved = revenueTarget > 0 ? revenueGenerated >= revenueTarget : null;
  const isReviewAchieved = reviewTarget > 0 ? reviewAchieved >= reviewTarget : null;
  const isGrossProfitAchieved = grossProfitTarget > 0 ? grossProfit >= grossProfitTarget : null;
  const isNetProfitAchieved = netProfitTarget > 0 ? netProfit >= netProfitTarget : null;

  // Determine overall status: 'achieved' | 'in-progress' | 'missed' | 'no-target'
  let overallStatus: 'achieved' | 'in-progress' | 'missed' | 'no-target' = 'no-target';
  const hasAnyTarget = salesTarget > 0 || revenueTarget > 0 || reviewTarget > 0 || grossProfitTarget > 0 || netProfitTarget > 0;

  if (hasAnyTarget) {
    const isSalesOk = salesTarget === 0 || salesAchieved >= salesTarget;
    const isRevenueOk = revenueTarget === 0 || revenueGenerated >= revenueTarget;
    const isReviewOk = reviewTarget === 0 || reviewAchieved >= reviewTarget;
    const isGrossProfitOk = grossProfitTarget === 0 || grossProfit >= grossProfitTarget;
    const isNetProfitOk = netProfitTarget === 0 || netProfit >= netProfitTarget;
    const allMet = isSalesOk && isRevenueOk && isReviewOk && isGrossProfitOk && isNetProfitOk;

    if (allMet) {
      overallStatus = 'achieved';
    } else {
      const isPeriodPast = endDate ? endDate.getTime() < Date.now() : false;
      overallStatus = isPeriodPast ? 'missed' : 'in-progress';
    }
  }

  const targetSummary = {
    exists: !!targetDoc,
    id: targetDoc?._id || null,
    periodType: period,
    year,
    month: period === 'monthly' ? month : undefined,
    quarter: period === 'quarterly' ? quarter : undefined,
    salesTarget,
    salesAchieved,
    isSalesAchieved,
    salesProgressPercent: salesTarget > 0 ? Math.min(Math.round((salesAchieved / salesTarget) * 100), 100) : 0,
    revenueTarget,
    revenueAchieved: revenueGenerated,
    isRevenueAchieved,
    revenueProgressPercent: revenueTarget > 0 ? Math.min(Math.round((revenueGenerated / revenueTarget) * 100), 100) : 0,
    grossProfitTarget,
    grossProfitAchieved: grossProfit,
    isGrossProfitAchieved,
    grossProfitProgressPercent: grossProfitTarget > 0 ? Math.min(Math.round((grossProfit / grossProfitTarget) * 100), 100) : 0,
    netProfitTarget,
    netProfitAchieved: netProfit,
    isNetProfitAchieved,
    netProfitProgressPercent: netProfitTarget > 0 ? Math.min(Math.round((netProfit / netProfitTarget) * 100), 100) : 0,
    reviewTarget,
    reviewAchieved,
    isReviewAchieved,
    reviewProgressPercent: reviewTarget > 0 ? Math.min(Math.round((reviewAchieved / reviewTarget) * 100), 100) : 0,
    targetPackageId,
    targetPackageName,
    notes: targetNotes,
    overallStatus,
  };

  // Recent Converted Operations — show operations WHERE THIS PERSON IS THE SALESPERSON
  // (same salesperson match with legacy fallback as the revenue/profit query above)
  const recentOpsMatch: Record<string, any> = {
    $or: [
      { salesperson: userId },
      { salesperson: { $exists: false }, assignedTo: userId },
      { salesperson: null, assignedTo: userId },
    ],
  };
  if (dateFilter) recentOpsMatch.createdAt = dateFilter;
  const recentOperations = await Operation.find(recentOpsMatch)
    .sort({ createdAt: -1 })
    .limit(8)
    .populate({
      path: 'booking',
      select: 'bookingId totalAmount primaryTraveller user travellersDetails',
      populate: { path: 'user', select: 'firstName lastName email phone' }
    })
    .populate({
      path: 'bookings',
      select: 'bookingId totalAmount primaryTraveller user travellersDetails',
      populate: { path: 'user', select: 'firstName lastName email phone' }
    });

  const normalizedRecentActivity = recentOperations.map(op => {
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

    return {
      ...op.toObject(),
      customer: {
        ...(op.customer || {}),
        name: derivedName || (op.customer?.name || ''),
        email: derivedEmail,
        phone: derivedPhone,
      }
    };
  });

  res.status(200).json({
    status: 'success',
    data: {
      user: userProfile,
      period,
      year,
      month: period === 'monthly' ? month : undefined,
      quarter: period === 'quarterly' ? quarter : undefined,
      inquiriesManaged,
      conversions,
      clientsHandled,
      revenueGenerated,
      profitGenerated,
      grossProfit,
      netProfit,
      incentivesEarned,
      pendingIncentives,
      totalReviewsEntered,
      reviewsByPackage,
      target: targetSummary,
      recentActivity: normalizedRecentActivity,
    },
  });
});
