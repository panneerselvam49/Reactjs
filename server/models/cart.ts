import db from '../config/db.ts';
import { DataTypes } from 'sequelize';

const cart = db.define('Cart', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    productId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    timestamps: true,
});

export function associateCart() {
    const user = db.models.User;
    const product = db.models.Product;

    cart.belongsTo(user, {
        foreignKey: 'userId',
        as: 'user',
    });
    cart.belongsTo(product, {
        foreignKey: 'productId',
        as: 'product',
    });
}

export default cart;