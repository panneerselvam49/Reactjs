import db from '../config/db.ts';
import { DataTypes } from 'sequelize';

export interface ProductReviewAttributes {
	id: number;
	productId: number;
	userId: number;
	rating: number;
	comment?: string;
	createdAt: Date;
	updatedAt: Date;
}

const productReviewModel = db.define('ProductReview', {
	id: {
		type: DataTypes.INTEGER,
		autoIncrement: true,
		primaryKey: true,
	},

	productId: {
		type: DataTypes.INTEGER,
		allowNull: false,
	},

	userId: {
		type: DataTypes.INTEGER,
		allowNull: false,
	},

	rating: {
		type: DataTypes.INTEGER,
		allowNull: false,
		validate: {
			min: 1,
			max: 5,
			isInt: true,
		},
	},

	comment: {
		type: DataTypes.TEXT,
		allowNull: true,
	},
}, {
	timestamps: true,
	indexes: [
		{
			unique: true,
			fields: ['productId', 'userId'],
		},
	],
});

export function associateProductReview() {
	const Product = db.models.Product;
	const User = db.models.User;

	productReviewModel.belongsTo(Product, {
		foreignKey: 'productId',
		as: 'product',
	});

	productReviewModel.belongsTo(User, {
		foreignKey: 'userId',
		as: 'user',
	});

	Product.hasMany(productReviewModel, {
		foreignKey: 'productId',
		as: 'reviews',
	});

	User.hasMany(productReviewModel, {
		foreignKey: 'userId',
		as: 'reviews',
	});
}

export default productReviewModel;