import { Router } from 'express';
import { protect, requirePermission } from '../middleware/auth.js';
import {
  getOperations, getOperationById, createOperation, updateOperation, recalculateOperation, importFromItinerary,
  addTransport, updateTransport, deleteTransport,
  addAccommodation, updateAccommodation, deleteAccommodation,
  addActivity, updateActivity, deleteActivity,
  addVendorPayment, updateVendorPayment, deleteVendorPayment,
  addCustomerPayment, updateCustomerPayment, deleteCustomerPayment, notifyCustomerPayment, splitCustomerPayment,
  getFinanceOverview, getUrgentPayments, getSalespersonStats,
} from '../controllers/operationController.js';
import { getInstallmentDetails, createInstallmentOrder, verifyInstallmentPayment } from '../controllers/installmentPaymentController.js';

const router = Router();

// Public Customer Installment Endpoints (Must be before auth middleware)
router.get('/public-payments/:paymentId/details', getInstallmentDetails);
router.post('/public-payments/:paymentId/create-order', createInstallmentOrder);
router.post('/public-payments/:paymentId/verify', verifyInstallmentPayment);

router.use(protect, requirePermission('dashboard.view'));

// Finance (before /:id)
router.get('/finance/overview', requirePermission('dashboard.view'), getFinanceOverview);
router.get('/finance/urgent', getUrgentPayments);
router.get('/salesperson/stats', requirePermission('dashboard.view'), getSalespersonStats);

// Operations
router.get('/', getOperations);
router.post('/', createOperation);
router.get('/:id', getOperationById);
router.put('/:id', updateOperation);
router.put('/:id/recalculate', recalculateOperation);
router.post('/:id/import-itinerary', importFromItinerary);

// Transport
router.post('/:id/transports', addTransport);
router.put('/:id/transports/:itemId', updateTransport);
router.delete('/:id/transports/:itemId', deleteTransport);

// Accommodation
router.post('/:id/accommodations', addAccommodation);
router.put('/:id/accommodations/:itemId', updateAccommodation);
router.delete('/:id/accommodations/:itemId', deleteAccommodation);

// Activities
router.post('/:id/activities', addActivity);
router.put('/:id/activities/:itemId', updateActivity);
router.delete('/:id/activities/:itemId', deleteActivity);

// Vendor Payments
router.post('/:id/vendor-payments', addVendorPayment);
router.put('/:id/vendor-payments/:paymentId', updateVendorPayment);
router.delete('/:id/vendor-payments/:paymentId', deleteVendorPayment);

// Customer Payments
router.post('/:id/customer-payments', addCustomerPayment);
router.post('/:id/customer-payments/split', splitCustomerPayment);
router.put('/:id/customer-payments/:paymentId', updateCustomerPayment);
router.delete('/:id/customer-payments/:paymentId', deleteCustomerPayment);
router.post('/:id/customer-payments/:paymentId/notify', notifyCustomerPayment);

export default router;
