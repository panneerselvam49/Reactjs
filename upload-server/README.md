# File Upload Server (Microservice)

A dedicated, high-performance file uploading microservice built with **Express**, **TypeScript**, and **Multer**.

---

## 🚀 Features

- **Isolated Microservice**: Runs independently from the main API and Frontend servers.
- **Multer Integration**: Secure disk storage with unique filename generation and sanitized filenames.
- **File Validation**:
  - Configurable allowed extensions (`jpg`, `jpeg`, `png`, `webp`, `gif`, `pdf`, `doc`, `zip`, etc.)
  - File size limits (default: 10MB, configurable via `.env`).
- **Static File Serving**: Uploaded files are immediately accessible via `http://localhost:5000/uploads/<filename>`.
- **Single & Multiple Uploads**: Supports single file and multi-file batch uploads.
- **File Management**: List existing uploaded files and delete files by filename.
- **Comprehensive Error Handling**: Clear JSON responses for `LIMIT_FILE_SIZE`, invalid extensions, unexpected field names, etc.
- **CORS Configured**: Ready for access from Next.js (port 3000) or any other client.

---

## 📁 Project Structure

```
upload-server/
├── .env                       # Environment configuration
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── uploads/                   # Stored files directory (auto-created)
└── src/
    ├── config/
    │   └── multer.ts          # Multer storage, limits & file filtering
    ├── controllers/
    │   └── uploadController.ts # Upload, list & delete handlers
    ├── middlewares/
    │   └── errorHandler.ts    # Multer error formatting
    ├── routes/
    │   └── uploadRoutes.ts    # REST endpoints
    ├── types/
    │   └── index.ts           # Type definitions
    └── server.ts              # Express application bootstrap
```

---

## 🛠️ API Endpoints

| Method | Endpoint | Description | Content-Type | Payload / Parameters |
|---|---|---|---|---|
| `GET` | `/health` | Health check | `N/A` | `None` |
| `POST` | `/api/upload/single` | Upload a single file | `multipart/form-data` | `file`: `<binary>` |
| `POST` | `/api/upload` | Single upload alias | `multipart/form-data` | `file`: `<binary>` |
| `POST` | `/api/upload/multiple` | Upload multiple files (up to 10) | `multipart/form-data` | `files`: `<binaries>` |
| `GET` | `/api/upload/list` | List all uploaded files | `N/A` | `None` |
| `DELETE` | `/api/upload/:filename`| Delete a file | `N/A` | URL Param: `filename` |
| `GET` | `/uploads/:filename` | Access / download file directly | `N/A` | URL Param: `filename` |

---

## 📦 How to Run

1. **Install dependencies**:
   ```bash
   cd upload-server
   npm install
   ```

2. **Start in development mode (hot-reloading)**:
   ```bash
   npm run dev
   ```

3. **Start in production mode**:
   ```bash
   npm start
   ```

---

## 💻 Example Usage

### 1. Using cURL

```bash
# Upload single file
curl -X POST http://localhost:5000/api/upload/single \
  -F "file=@/path/to/image.png"

# Upload multiple files
curl -X POST http://localhost:5000/api/upload/multiple \
  -F "files=@/path/to/image1.png" \
  -F "files=@/path/to/image2.png"
```

### 2. Using React / Next.js / Axios

```typescript
import axios from 'axios';

export const uploadFile = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await axios.post('http://localhost:5000/api/upload/single', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  // res.data.data.url contains the direct URL to the uploaded file
  return res.data.data;
};
```
