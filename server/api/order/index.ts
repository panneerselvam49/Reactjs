import express from 'express';
const router = express.Router();
import { placeOrder, getOrders, cancelOrder, updateOrderStatus, getAllOrderDetails } from './order.ts';

import userValidate from '../middleware/user.ts';
import adminSeller from '../middleware/specialUser.ts'

router.post('/placeOrder', userValidate, placeOrder);
router.get('/getOrders', userValidate, getOrders);
router.patch('/cancelOrder/:orderId', userValidate, cancelOrder);
router.patch('/updateStatus/:orderId', adminSeller, updateOrderStatus);
router.get('/getAllProducts', adminSeller, getAllOrderDetails)

export default router;
