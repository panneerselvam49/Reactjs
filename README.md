# E-commerce application

This repository contains a full-stack e-commerce application with a Next.js
frontend, a TypeScript/Express API, and a separate file-upload service.

## Features

- User registration, login, logout, token refresh, Google login, and password reset
- Product browsing, searching, reviews, and product management
- Shopping cart and checkout flow
- Customer order history and administrator order management
- PostgreSQL persistence through Sequelize
- Redis-backed caching and API rate limiting
- RabbitMQ order processing
- Separate image/file upload service with single and multiple upload support

## Repository layout

```text
Frontend/e-commerce-next/   Next.js frontend
server/                     Express API and database-backed application server
upload-server/              Express/Multer file-upload service
DEPLOYMENT.md               Deployment notes for Vercel and Render
test.js                     Standalone JavaScript practice file
```

## Prerequisites

Install the following before starting the application:

- Node.js 20 or newer and npm
- PostgreSQL
- Redis
- RabbitMQ
- Google OAuth credentials if Google login is required

Create a PostgreSQL database matching the database name in your connection
string. The API synchronizes its Sequelize models when it starts.

## Configuration

### API server

Copy `server/.env.example` to `server/.env` and replace placeholder values:

```env
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000
REFRESH_COOKIE_SAME_SITE=lax
DATABASE_URL=postgresql://postgres:password@localhost:5432/E-commerce
secret=replace-with-a-long-random-secret
GOOGLE_CLIENT_ID=your-google-client-id
RABBITMQ_URL=amqp://localhost
UPLOAD_SERVER_URL=http://localhost:5000
REDIS_URL=redis://localhost:6379
PRODUCT_CACHE_TTL_SECONDS=60
```

Use a long, unique value for `secret`. Do not commit `.env` files or real
credentials.

### Frontend

Copy `Frontend/e-commerce-next/.env.example` to
`Frontend/e-commerce-next/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_UPLOAD_SERVER_URL=http://localhost:5000
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

### Upload server

Create `upload-server/.env`:

```env
PORT=5000
CORS_ORIGIN=http://localhost:3000
```

The upload service stores files in its configured local upload directory.
Uploaded files are served from `/uploads`.

## Install dependencies

Run each command from the repository root:

```bash
cd server
npm install

cd ../upload-server
npm install

cd ../Frontend/e-commerce-next
npm install
```

## Run locally

Start the services in separate terminals. Start PostgreSQL, Redis, and
RabbitMQ first.

### 1. API server

```bash
cd server
npm run dev
```

The API is available at `http://localhost:4000`.

### 2. Upload server

```bash
cd upload-server
npm run dev
```

The upload service is available at `http://localhost:5000`. Verify it with:

```text
GET http://localhost:5000/health
```

### 3. Frontend

```bash
cd Frontend/e-commerce-next
npm run dev
```

Open `http://localhost:3000` in a browser.

## Available scripts

### Frontend

```bash
npm run dev       # Start the Next.js development server
npm run build     # Create a production build
npm run start     # Serve the production build
npm run lint      # Run ESLint
```

### API server

```bash
npm run dev       # Start with nodemon and tsx
npm run start     # Start the API server
npm run consumer  # Run the order consumer independently when needed
```

### Upload server

```bash
npm run dev       # Start with nodemon and tsx
npm run start     # Start the upload service
npm run build     # Type-check and compile with TypeScript
npm run test:upload
```

## Main API areas

The API is mounted under `http://localhost:4000/api`:

- `/user` - authentication and account operations
- `/product` - product listing, search, creation, and reviews
- `/cart` - cart operations
- `/order` - placing and retrieving orders

The upload service exposes:

- `GET /health`
- `POST /api/upload/single`
- `POST /api/upload/multiple`
- `GET /api/upload/list`
- `DELETE /api/upload/delete/:filename`

Upload and product-management operations require the appropriate authenticated
administrator or seller permissions.

## Production deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the recommended Vercel, Render,
PostgreSQL, RabbitMQ, and file-storage deployment arrangement. Set the
frontend root directory to `Frontend/e-commerce-next` when deploying the
frontend.

Before deploying:

1. Use production URLs for frontend, API, and upload-service environment variables.
2. Set `REFRESH_COOKIE_SAME_SITE=none` when frontend and API are on different sites.
3. Configure CORS and Google OAuth authorized origins for the production domain.
4. Use managed PostgreSQL, Redis, RabbitMQ, and durable object storage where appropriate.
5. Generate new secrets and never commit environment files.
