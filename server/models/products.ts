import db from '../config/db.ts';
import { DataTypes } from 'sequelize';

const products = db.define('Product', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},

	name: {
		type: DataTypes.STRING,
		allowNull: false,
		unique: true
	},

	price: {
		type: DataTypes.DECIMAL(10, 2),
		allowNull: false,
	},

	description: {
		type: DataTypes.TEXT,
		allowNull: true
	},

	isAvailableToBuy: {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: true
	},

	stock: {
		type: DataTypes.INTEGER,
		allowNull: false
	},

	images: {
		type: DataTypes.JSONB,
		allowNull: true,
		defaultValue: []
	},

	createdBy: {
		type: DataTypes.STRING,
		allowNull: false
	},

	category: {
		type: DataTypes.STRING,
		allowNull: false,
	}
}, {
	timestamps: true,
}
);

export function associateProducts() {
	const orderItem = db.models.orderItem;

	products.hasMany(orderItem, {
		foreignKey: 'productId',
		as: 'orderItems',
	});
}

export default products;