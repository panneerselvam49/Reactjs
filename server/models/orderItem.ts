import db from '../config/db.ts';
import { DataTypes } from 'sequelize';

const orderItem = db.define('orderItem', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},

	orderId: {
		type: DataTypes.INTEGER,
		allowNull: false
	},

	productId: {
		type: DataTypes.INTEGER,
		allowNull: true
	},

	quantity: {
		type: DataTypes.INTEGER,
		allowNull: false,
	},

	unitPrice: {
		type: DataTypes.DECIMAL(10, 2),
		allowNull: false,
	},
}, {
	timestamps: true
});

export function associateOrderItem() {

	orderItem.belongsTo(db.models.Order, {
		foreignKey: 'orderId',
		as: 'order',
	});

	orderItem.belongsTo(db.models.Product, {
		foreignKey: 'productId',
		as: 'product',
	});
}

export default orderItem;
