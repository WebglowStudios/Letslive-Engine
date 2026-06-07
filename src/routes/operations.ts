import { Router } from 'express';
import { protect, staffOnly, managerOnly } from '../middleware/auth.js';
import {
  getOperations, getOperationById, createOperation, updateOperation, recalculateOperation,
  addTransport, updateTransport, deleteTransport,
  addAccommodation, updateAccommodation, deleteAccommodation,
  addActivity, updateActivity, deleteActivity,
  addVendorPayment, updateVendorPayment, deleteVendorPayment,
  addCustomerPayment, updateCustomerPayment, deleteCustomerPayment,
  getFinanceOverview, getUrgentPayments, getSalespersonStats,
} from '../controllers/operationController.js';

const router = Router();
router.use(protect, staffOnly);

// Finance (before /:id)
router.get('/finance/overview', managerOnly, getFinanceOverview);
router.get('/finance/urgent', getUrgentPayments);
router.get('/salesperson/stats', managerOnly, getSalespersonStats);

// Operations
router.get('/', getOperations);
router.post('/', createOperation);
router.get('/:id', getOperationById);
router.put('/:id', updateOperation);
router.put('/:id/recalculate', recalculateOperation);

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
router.put('/:id/customer-payments/:paymentId', updateCustomerPayment);
router.delete('/:id/customer-payments/:paymentId', deleteCustomerPayment);

export default router;
