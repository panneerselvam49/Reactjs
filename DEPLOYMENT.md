# Free deployment

## Recommended services

- Deploy `Frontend/e-commerce-next` to Vercel.
- Deploy `server` to Render as a Node web service.
- Use Neon or Supabase for PostgreSQL.
- Use a hosted RabbitMQ provider, or disable order-queue features until one is configured.
- Use Cloudinary or another hosted object-storage service for uploads.

## Vercel environment variables

```text
NEXT_PUBLIC_API_URL=https://your-server.onrender.com
NEXT_PUBLIC_UPLOAD_SERVER_URL=https://your-upload-service.example.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

Set the Vercel root directory to `Frontend/e-commerce-next`.

## Render environment variables

```text
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://your-app.vercel.app
REFRESH_COOKIE_SAME_SITE=none
DATABASE_URL=your-postgresql-connection-string
secret=generate-a-new-long-random-secret
GOOGLE_CLIENT_ID=your-google-client-id
RABBITMQ_URL=your-rabbitmq-connection-string
```

Use `npm install` as the build command and `npm run dev` as the start command, or add a production start script that runs the compiled server with your chosen TypeScript runtime.

Add the Vercel domain to Google Cloud's authorized JavaScript origins. The current Google ID-token flow does not use a redirect URI.

Never commit `.env` files. Rotate any credentials that have previously been shared.
