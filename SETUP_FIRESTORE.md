# Firebase Project Setup Quick Start

Follow these steps to connect your delivery app to Firebase:

## 1. Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Create a project" or "Add project"
3. Enter your project name
4. Disable Google Analytics (optional)
5. Click **Create project** and wait for setup to complete

## 2. Get Your Firebase Credentials

1. In Firebase Console, click the **⚙️ (Settings)** icon at the top left
2. Go to **Project Settings**
3. Under "Your apps", click **Web** (</>) icon to create a new web app
4. Register the app with a name like "delivery-app"
5. Copy the Firebase config - you'll see something like:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123..."
};
```

## 3. Add Credentials to Your App

1. Create a file named `.env.local` in your project root:
   ```bash
   # Copy from your Firebase config above
   NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
   NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123...
   ```

2. **Keep `.env.local` secure** - never commit it to git

## 4. Create Firestore Collections

In Firebase Console:

1. Go to **Build** → **Firestore Database**
2. Click **Create Database**
3. Choose your location and click **Create**
4. Create two collections:

### Collection: `orders`
Click "Start collection", name it "orders"

Add sample documents with structure:
```json
{
  "orderNumber": "SG-2026-001",
  "customerName": "John Doe",
  "phone": "+234 801 234 5678",
  "address": "123 Main Street, Lagos",
  "amount": 45000,
  "status": "pending",
  "assignedDriver": null
}
```

### Collection: `drivers`
Click "Start collection", name it "drivers"

Add sample documents with structure:
```json
{
  "name": "Adebayo Ogunleye",
  "phone": "+234 801 234 5678",
  "vehicle": "Toyota Hilux - LG 234 AK",
  "status": "available",
  "rating": 4.8
}
```

## 5. Test Your Connection

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Open http://localhost:3000
3. Your dashboard should load data from Firestore
4. If you see an error, check:
   - Your `.env.local` file has all 6 environment variables
   - Firestore collections are created with correct names
   - At least one document exists in each collection

## 6. Available Database Functions

Import and use these in your components:

```typescript
import {
  fetchOrders,
  fetchDrivers,
  fetchOrdersByStatus,
  fetchDriversByStatus,
  createOrder,
  updateOrder,
  deleteOrder,
} from "@/lib/firestore"

// Fetch all orders
const orders = await fetchOrders()

// Update an order
await updateOrder("order_id", { status: "delivered" })

// Create new order
const orderId = await createOrder({
  orderNumber: "SG-2026-011",
  customerName: "Jane Doe",
  phone: "+234 801 234 5678",
  address: "456 Oak Avenue",
  amount: 35000,
  status: "pending",
  assignedDriver: null,
})
```

## Firestore Security Rules (Development)

Your test mode allows full read/write. For production, update in Firestore Console → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /orders/{document=**} {
      allow read, write: if request.auth != null;
    }
    match /drivers/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Missing env variables" | Check `.env.local` file exists with all 6 Firebase keys |
| "Permission denied" error | Firestore is in test mode - check Collections exist and have documents |
| Blank dashboard | No data in Firestore yet - add documents to "orders" and "drivers" collections |
| App won't load | Firebase config might be wrong - copy values again from Firebase Console |

## Next Steps

- Add more order/driver data to Firestore
- Update other pages (orders, reports, etc.) to use Firestore
- Set up Firebase Authentication for user login
- Configure production security rules
