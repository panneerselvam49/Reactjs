import db from '../config/db.ts';
import { DataTypes } from 'sequelize';

const User = db.define('User', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true
	},

	name: {
		type: DataTypes.STRING,
		unique: true,
		allowNull: false
	},

	email: {
		type: DataTypes.STRING,
		allowNull: false,
		unique: true,
		validate: {
			isEmail: true
		}
	},

	role: {
		type: DataTypes.ENUM('admin', 'user', 'seller'),
		allowNull: false,
		defaultValue: 'user'
	},

	password: {
		type: DataTypes.STRING,
		allowNull: false
	},

	otherDetails: {
		type: DataTypes.JSONB,
		allowNull: true
	},

	mobileNumber: {
		type: DataTypes.STRING,
		allowNull: false,
		unique: true
	}
}, {
	timestamps: true,
}
);

export function associcateUser() {
	const cart = db.models.Cart;

	User.hasMany(cart, {
		foreignKey: 'userId',
		as: 'carts',
	});
}

export default User;