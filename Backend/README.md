# Backup System Backend

Node.js backend API with Prisma and PostgreSQL.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file (copy from `.env.example`):
```env
BASE_URL=http://localhost
PORT=3000
DATABASE_URL="postgresql://username:password@localhost:5432/backupsystem?schema=public"
```

3. Initialize Prisma:
```bash
npx prisma generate
npx prisma migrate dev --name init
```

4. Start the server:
```bash
npm start
# or for development with auto-reload
npm run dev
```

## API Endpoints

### Settings

- `GET /api/settings` - Get all settings
  - Query params: `?date=YYYY-MM-DD` (single date)
  - Query params: `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` (date range)
  - Query params: none (get all)

- `GET /api/settings/:id` - Get setting by ID

- `POST /api/settings` - Create single setting
  ```json
  {
    "backendname": "string",
    "DBurl": "string",
    "bucketurl": "string",
    "attributes": {}
  }
  ```

- `POST /api/settings/bulk` - Create multiple settings
  ```json
  {
    "data": [
      {
        "backendname": "string",
        "DBurl": "string",
        "bucketurl": "string",
        "attributes": {}
      }
    ]
  }
  ```

- `PUT /api/settings/:id` - Update setting by ID
- `PATCH /api/settings/:id` - Update setting by ID
- `DELETE /api/settings/:id` - Delete setting by ID

## Database Schema

### Setting Model
- `id` (Int, auto-increment)
- `backendname` (String)
- `DBurl` (String)
- `bucketurl` (String)
- `attributes` (JSON)
- `createdAt` (DateTime)
- `updatedAt` (DateTime)
