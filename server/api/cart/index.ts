import express from 'express';
const router = express.Router();
import { addToCart, getCartItems, removeFromCart } from './cart.ts';
import userValidate from '../middleware/user.ts';

router.post('/addToCart', userValidate, addToCart);
router.get('/getCartItems', userValidate, getCartItems);
router.put("/removeFromCart", userValidate, removeFromCart);

export default router;