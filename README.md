<div align="center">

<!-- Animated Banner -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=200&section=header&text=TIFFICA%20Backend%20API&fontSize=50&fontColor=fff&animation=twinkling&fontAlignY=35&desc=🍱%20Meal%20Delivery%20REST%20API%20•%20Node.js%20•%20Express%20•%20MongoDB&descAlignY=55&descSize=16" width="100%"/>

<!-- Badges -->
<p>
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white"/>
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white"/>
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white"/>
  <img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white"/>
  <img src="https://img.shields.io/badge/Cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white"/>
  <img src="https://img.shields.io/badge/Razorpay-02042B?style=for-the-badge&logo=razorpay&logoColor=white"/>
</p>

<p>
  <img src="https://img.shields.io/badge/status-production%20ready-brightgreen?style=flat-square"/>
  <img src="https://img.shields.io/badge/version-1.0.0-blue?style=flat-square"/>
  <img src="https://img.shields.io/badge/license-MIT-orange?style=flat-square"/>
</p>

</div>

---

## 🌟 What is TIFFICA?

> **TIFFICA** is a modern tiffin (home-style meal) delivery startup that connects cloud kitchens with customers. This is the **backend API** powering the entire platform — from user auth to payments to push notifications.

---

## ⚡ Tech Stack

| Layer | Technology |
|-------|-----------|
| 🖥️ Runtime | Node.js |
| 🚀 Framework | Express.js |
| 🗄️ Database | MongoDB (Atlas) via Mongoose |
| 🔐 Auth | JWT + bcryptjs |
| 💳 Payments | Razorpay |
| 📸 Media | Cloudinary + Multer |
| 📧 Email | Nodemailer |
| 🔔 Push Notifications | Web Push (VAPID) |
| 🌐 CORS | Enabled for all origins |

---

## 🗂️ Project Structure

```
tifica_web_backend-/
│
├── server.js                  # 🚀 Entry point — Express app, DB connect, routes
├── config.js                  # ⚙️  App configuration
│
├── 🔐 Auth & Users
│   ├── user.js                # User Mongoose model
│   ├── userauth.js            # /api/auth — register, login, JWT
│   ├── authmiddle.js          # JWT auth middleware
│   └── asynchandler.js        # Async error wrapper
│
├── 🍱 Menu
│   ├── menu.js                # /api/menu routes
│   └── menuitems.js           # MenuItem Mongoose model
│
├── 📦 Orders
│   ├── orders.js              # /api/orders routes
│   └── order.js               # Order Mongoose model
│
├── 📅 Subscriptions
│   ├── subscriptions.js       # /api/subscriptions routes
│   ├── subscription.js        # Subscription model
│   ├── subscriptionorders.js  # /api/subscription-orders routes
│   ├── subscriptionorder.js   # SubscriptionOrder model
│   ├── subscriptionplans.js   # Plans model
│   ├── subscriptioncards_routes.js  # /api/subscription-cards
│   ├── subscriptioncard.js    # SubscriptionCard model
│   ├── subscriptiontext.js    # SubscriptionText model
│   └── subscriptiontexts.js   # SubscriptionTexts routes
│
├── 🗓️ Schedule
│   ├── scheduleroutes.js      # /api/schedule routes
│   ├── scheduleconfig.js      # ScheduleConfig model
│   ├── scheduleconfigs.js     # /api/scheduleconfigs routes
│   ├── userschedule.js        # UserSchedule model
│   └── ScheduleCartContext.js # Schedule cart logic
│
├── 🏠 Home & Styles
│   ├── homeroutes.js          # Home routes
│   ├── homestyle.js           # HomeStyle model
│   ├── homestyles.js          # /api/homestyles routes
│   ├── pagestyles.js          # PageStyle model
│   └── pagestyles_routes.js   # /api/pagestyles routes
│
├── 🍳 Cloud Kitchens
│   ├── cloudkitchen.js        # CloudKitchen model
│   └── cloudkitchen_routes.js # /api/cloudkitchens routes
│
├── 💳 Payments
│   └── payments.js            # /api/payments — Razorpay integration
│
├── 🔔 Notifications
│   ├── notifications.js       # /api/notifications routes
│   ├── notification.js        # Notification model
│   └── pushsubscription.js    # Web Push subscription model
│
├── 📋 Complaints
│   ├── complaints.js          # /api/complaints routes
│   └── complaint.js           # Complaint model
│
├── 📄 Legal Pages
│   ├── legalpages.js          # /api/legalpages routes
│   └── legalpage.js           # LegalPage model
│
├── 🖼️ Upload
│   └── upload.js              # /api/upload — Cloudinary via Multer
│
├── 🛒 Contexts (shared logic)
│   ├── authcontext.js         # Auth context helpers
│   ├── cartcontext.js         # Cart context helpers
│   └── WalletContext.js       # Wallet context helpers
│
├── 👑 Admin
│   └── admin.js               # /api/admin routes
│
└── .env                       # 🔒 Environment variables (gitignored)
```

---

## 🔌 API Endpoints

```
GET    /                          → API info
GET    /health                    → Health check

POST   /api/auth/register         → Register user
POST   /api/auth/login            → Login + JWT

GET    /api/menu                  → List menu items
POST   /api/menu                  → Add menu item (admin)

GET    /api/orders                → User orders
POST   /api/orders                → Place order

POST   /api/payments              → Razorpay payment init
POST   /api/payments/verify       → Verify payment

GET    /api/subscriptions         → List plans
POST   /api/subscriptions         → Subscribe

GET    /api/schedule              → User schedule
POST   /api/schedule              → Set schedule

GET    /api/cloudkitchens         → List kitchens
GET    /api/notifications         → User notifications
POST   /api/upload                → Upload image (Cloudinary)
GET    /api/admin                 → Admin dashboard data
POST   /api/complaints            → Submit complaint
GET    /api/legalpages            → Legal content
```

---

## 🚀 Getting Started

### 1. Clone & Install

```bash
git clone <repo-url>
cd tifica_web_backend-
npm install
```

### 2. Setup Environment

Create a `.env` file in the root:

```env
PORT=5000
NODE_ENV=development

MONGODB_URI=<your_mongodb_atlas_uri>
JWT_SECRET=<your_jwt_secret>

EMAIL_USER=<your_gmail>
EMAIL_PASS=<your_app_password>

RAZORPAY_KEY_ID=<your_razorpay_key>
RAZORPAY_KEY_SECRET=<your_razorpay_secret>

CLOUDINARY_CLOUD_NAME=<your_cloud_name>
CLOUDINARY_API_KEY=<your_api_key>
CLOUDINARY_API_SECRET=<your_api_secret>

VAPID_PUBLIC_KEY=<your_vapid_public>
VAPID_PRIVATE_KEY=<your_vapid_private>
VAPID_EMAIL=mailto:<your_email>
```

### 3. Run

```bash
# Development
npm start

# Server starts on http://localhost:5000
```

---

## 🔐 Authentication Flow

```
Client → POST /api/auth/login
       ← JWT Token

Client → GET /api/orders
         Authorization: Bearer <token>
       ← Protected data
```

---

## 🏗️ How It Works

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT REQUEST                    │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              Express Middleware Stack                │
│  CORS → JSON Parser → Request Logger                │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│                  Route Handlers                      │
│  /api/auth  /api/menu  /api/orders  /api/payments   │
└──────────────────────┬──────────────────────────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
┌─────────────────┐   ┌──────────────────┐
│  JWT Middleware │   │  Mongoose Models  │
│  (protected     │   │  (MongoDB Atlas)  │
│   routes only)  │   └──────────────────┘
└─────────────────┘
```

---

## 🌍 Deployment

This backend is designed to run on any Node.js host:

- **Railway** / **Render** / **Heroku** — set env vars in dashboard
- **VPS** — use `pm2 start server.js`
- **Docker** — wrap with a simple Dockerfile

---

<div align="center">
<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer&animation=twinkling" width="100%"/>

**Built with ❤️ for TIFFICA — Startup Meal Delivery Platform**

</div>
