# Firebase & Firestore Setup Guide

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"**
3. Enter project name (e.g., "delivery-management")
4. Follow the setup wizard and create the project

## Step 2: Get Firebase Credentials

1. In Firebase Console, click the **⚙️ Settings** icon (top left)
2. Go to **Project Settings**
3. Under **Your apps**, click **Create app** (select Web)
4. Give it a nickname (e.g., "Delivery App")
5. Copy the Firebase config object - you'll need these values:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `storageBucket`
   - `messagingSenderId`
   - `appId`

## Step 3: Enable Firestore Database

1. In Firebase Console, go to **Build** → **Firestore Database**
2. Click **Create Database**
3. Choose **US (or your region)**
4. Select **Start in test mode** (for development)
5. Click **Create**

## Step 4: Set Environment Variables

1. **Copy the example file:**

   ```bash
   cp .env.local.example .env.local
   ```

2. **Edit `.env.local`** and paste your Firebase credentials:

   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

## Step 5: Create Firestore Collections

In Firestore Console, create these collections:

### Orders Collection

**Collection name:** `orders`

Example document structure:

```json
{
  "id": "order_001",
  "customerId": "cust_123",
  "origin": "123 Main St",
  "destination": "456 Oak Ave",
  "status": "pending",
  "priority": "standard",
  "weight": 2.5,
  "cost": 1200,
  "driverId": "",
  "createdAt": "2024-03-05T10:00:00Z",
  "updatedAt": "2024-03-05T10:00:00Z"
}
```

### Drivers Collection

**Collection name:** `drivers`

Example document structure:

```json
{
  "id": "driver_001",
  "name": "John Smith",
  "phone": "(555) 123-4567",
  "status": "available",
  "vehicle": "Honda Civic",
  "licensePlate": "ABC123",
  "rating": 4.8,
  "joinedDate": "2023-01-15T00:00:00Z"
}
```

## Step 6: Test the Connection

Run your app:

```bash
npm run dev
```

Your pages will now use Firestore instead of mock data. Initially, they'll show empty because you haven't added documents yet.

## Step 7: Add Sample Data (Optional)

In Firestore Console, manually add some documents to test, or use the Firebase Admin SDK to seed your database.

## Available Database Functions

See `lib/firestore.ts` for these functions:

- `fetchOrders()` - Get all orders
- `fetchDrivers()` - Get all drivers
- `fetchOrdersByStatus(status)` - Filter orders by status
- `fetchDriversByStatus(status)` - Filter drivers by status
- `createOrder(order)` - Add new order
- `updateOrder(orderId, updates)` - Update order
- `deleteOrder(orderId)` - Delete order
- `fetchOrder(orderId)` - Get single order

## Security Rules (Development)

Your test mode allows read/write access. For production, update Firestore rules:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Troubleshooting

- **Missing env variables?** Make sure `.env.local` exists and has all the Firebase credentials
- **Authentication errors?** Check Firestore security rules in test mode
- **No data showing?** Make sure collections and documents exist in Firestore Console
