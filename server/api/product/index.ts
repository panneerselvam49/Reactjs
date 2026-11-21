import express from 'express';
import { getProducts, createProduct, getProductById, searchProducts, getAllProducts, deleteProduct, upateProduct, getProductReviews, reviewProduct } from './product.ts';
import adminSellerAccess from '../middleware/specialUser.ts';
import optionalUser from '../middleware/optionalUser.ts';
import userValidate from "../middleware/user.ts";

const router = express.Router();

router.get('/getProducts', optionalUser, getProducts);
router.get('/getProductById/:id', getProductById);
router.post('/createProduct', adminSellerAccess, createProduct);
router.get('/searchProducts', optionalUser, searchProducts);
router.get("/getAllProducts", adminSellerAccess, getAllProducts);
router.delete("/deleteProduct/:id", adminSellerAccess, deleteProduct);
router.put("/updateProduct/:id", adminSellerAccess, upateProduct);
router.get("/getProductReviews/:id", getProductReviews);
router.post("/reviewProduct/:id", userValidate, reviewProduct);

export default router;