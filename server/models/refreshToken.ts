import db from '../config/db.ts';
import { DataTypes } from 'sequelize';

const RefreshToken = db.define('RefreshToken', {
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	},
	userId: {
		type: DataTypes.INTEGER,
		allowNull: false,
	},
	tokenHash: {
		type: DataTypes.STRING(64),
		allowNull: false,
		unique: true,
	},
	expiresAt: {
		type: DataTypes.DATE,
		allowNull: false,
	},
}, {
	timestamps: true,
	indexes: [
		{ fields: ['userId'] },
		{ fields: ['expiresAt'] },
	],
});

export default RefreshToken;
