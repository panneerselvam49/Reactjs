import db from '../config/db.ts';
import { DataTypes } from 'sequelize';

const order = db.define('Order', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},

	totalAmount: {
		type: DataTypes.DECIMAL(10, 2),
		allowNull: false,
	},

	status: {
		type: DataTypes.ENUM('ordered', 'shipped', 'delivered', 'cancelled'),
		allowNull: false,
		defaultValue: 'ordered',
	},

	orderedAt: {
		type: DataTypes.DATE,
		allowNull: false,
		defaultValue: DataTypes.NOW,
	},

	address: {
		type: DataTypes.STRING,
		allowNull: false,
	},

	shippedAt: {
		type: DataTypes.DATE,
		allowNull: true,
	},

	deliveredAt: {
		type: DataTypes.DATE,
		allowNull: true,
	},

	cancelledAt: {
		type: DataTypes.DATE,
		allowNull: true,
	}
}, {
	timestamps: true,
});

export function associateOrder() {
	const User = db.models.User;
	const OrderItem = db.models.orderItem;

	order.belongsTo(User, {
		foreignKey: 'userId',
		as: 'user',
	});

	order.hasMany(OrderItem, {
		foreignKey: 'orderId',
		as: 'items',
	});
}

export default order;