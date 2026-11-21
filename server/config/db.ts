import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const envCandidates = [
	join(process.cwd(), 'server', '.env'),
	join(process.cwd(), '..', 'server', '.env'),
	join(process.cwd(), '.env'),
];
const envPath = envCandidates.find((candidate) => existsSync(candidate));
dotenv.config({ path: envPath });

const dbUsername = process.env.dbUsername;
const dbPassword = process.env.dbPassword;
const dbName = process.env.database;


const db = new Sequelize(dbName!, dbUsername!, dbPassword!, {
	dialect: 'postgres',
	pool: {
		max: 10,
		min: 3,
		acquire: 30000,
		idle: 10000
	},
	logging: console.log
});

console.log(`Database connection established to ${dbName} as ${dbUsername}`);

export default db;