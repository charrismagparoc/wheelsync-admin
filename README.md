# WheelSync Admin Console

The web console of the **Administrator / Owner** of Pardz Car Rental. From here the admin:
- reviews customers and their requirements;
- accepts or rejects bookings and assigns staff;
- manages the fleet, destinations, blacklist and staff;
- verifies inspections and follows cleaning;
- records transactions and exports reports;
- sees the **Customer Churn Prediction**.

It talks only to the WheelSync API ([`../wheelsync-fastapi_postgres-main`](../wheelsync-fastapi_postgres-main/README.md)).
System overview and the full flow: [`../README.md`](../README.md).

## Run it

```bat
npm install          :: first time only
npm run dev          :: http://localhost:5173
```

The backend must be running (default `http://localhost:8000`). Other commands:

| Command | Does |
|---|---|
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serves the built `dist/` locally |
| `npm run lint` | Lints with oxlint |

**Settings (`.env`):** `VITE_API_URL=http://localhost:8000` is the backend address, with no trailing slash. Copy `.env.example` to `.env`.

**Signing in:** use the admin's email and password. If no admin exists yet, **Create the admin account** on the sign-in page
makes the first one; it works only while there is no admin.

## Pages

| Page | Route | What the admin does there |
|---|---|---|
| Dashboard | `/` | Today at a glance: bookings, revenue, monthly rentals chart, rentals due back soon (with the customer's number), recent bookings |
| Bookings | `/bookings` | Accept requests and assign staff, reject with a reason, edit a booking, change the assigned staff, resend the approval email, download the **rental agreement** as PDF or Word (Pardz's paper layout). Customers matching the blacklist are flagged |
| Transactions | `/transactions` | Record walk-in rentals, edit them, add extra payments (e.g. extensions) |
| Inspections | `/inspections` | Verify the staff's pre/post-rental inspections (checklist, damage marks, photos, fee), assign cleaning, follow each returned car until it is back on the fleet |
| Vehicles | `/vehicles` | Add / edit / remove cars: brand, model (optional), plate, rates, status, photo (any image type) |
| Destinations | `/locations` | The price-sheet destinations customers can pick, with per-vehicle-type fees |
| Customers | `/customers` | Customer list with ID verification, **churn prediction**, standing (Good standing / On blacklist record / Blacklisted). Review requirements, print documents, blacklist or delete a customer. The **ⓘ** button explains how churn is computed and can retrain the model |
| Blacklist | `/blacklist` | Pardz's blacklist records (name, area, source, reason): search, filter, add, edit, remove. Also the blocked customer accounts |
| Staff | `/staff` | Create staff accounts (phone required, email optional), edit them, reset their password |
| Notifications | `/notifications` | All notifications by type; mark as read, clear; turn the notification **sound** on/off |
| Reports | `/reports` | Filter rental records and export them as PDF, Word or CSV |
| Audit log | `/audit-log` | Every change by the admin and staff: who, what, when (cannot be edited) |
| Settings | `/settings` | Administrator account, appearance (light/dark), notification preferences |
| Sign in / Sign up / Forgot password | `/login`, `/signup`, `/forgot-password` | Account access (password reset by emailed 6-digit code) |

Live updates: the console listens to the API's WebSocket, so new bookings and notifications appear without refreshing.
A short chime plays for new notifications, and return reminders pop up 2 hours and 30 minutes before a rental is due back.

## Customer Churn Prediction on the Customers page

The predictions come from the backend's Random Forest model (`GET /admin/churn/predictions`).

| Label | Meaning |
|---|---|
| **At Risk of Churn** | Churn risk at or above the model's threshold (currently 40%) |
| **Likely to Return** | Below the threshold |
| **Valuable – At Risk** | At risk and in the top 25% by completed rentals: a frequent suki to contact first |
| **New Customer – Not Yet Rated** | Fewer than 2 completed rentals |

Hover over a prediction to see the customer's 6 numbers. The **ⓘ** panel explains:
- the 6 features, with a worked example customer;
- the 180-day rule used for training;
- how the 200 trees' answers become a percentage;
- the model's scores, and how often each label is right;
- which features matter most.

It also has a **Retrain model** button.

## Folder structure

```
wheelsync-admin-main/
├── index.html               page shell
├── public/                  favicon, icons, Pardz banner (pardz-banner.png)
├── src/
│   ├── main.jsx             app entry
│   ├── App.jsx              routes (table above)
│   ├── index.css            Tailwind + theme colours (dark / light), badges, cards, modal styles
│   ├── pages/               one file per page (see Pages)
│   ├── components/
│   │   ├── Layout.jsx           sidebar, top bar (date/time, refresh, notifications bell, theme, account menu)
│   │   ├── PageParts.jsx        PageHeader, FilterBar, Tabs, Notice: shared page layout
│   │   ├── Modal.jsx            centred, scrollable pop-up with sticky header and footer
│   │   ├── ChurnExplainer.jsx   "How churn is computed" panel
│   │   ├── EditBookingModal.jsx edit a booking and the customer's details
│   │   ├── ReturnsDueCard.jsx   dashboard card: rentals due back soon
│   │   ├── ReturnReminderPopups.jsx  2-hour / 30-minute return pop-ups
│   │   ├── MonthlyRentalsChart.jsx   rentals-per-month chart
│   │   ├── StatCard.jsx, Badge.jsx, SearchBar.jsx, PasswordInput.jsx (show/hide), ThemeToggle.jsx
│   │   ├── ProtectedRoute.jsx   sends signed-out users to the sign-in page
│   │   └── ErrorBoundary.jsx    friendly message instead of a blank page on errors
│   ├── context/
│   │   ├── AuthContext.jsx      signed-in admin, sign in / out
│   │   ├── ThemeContext.jsx     dark / light mode
│   │   └── RefreshContext.jsx   the top bar's Refresh button
│   └── lib/
│       ├── api.js               calls to the backend (adds the sign-in token)
│       ├── realtime.js          WebSocket live updates
│       ├── agreementContent.js, agreementPdf.js, agreementDocx.js   rental agreement (PDF / Word, 8.5 × 13 in)
│       ├── reportExport.js      branded report as PDF / Word
│       ├── print.js             printable customer documents and inspection pack
│       ├── download.js          saves generated files
│       ├── notificationKinds.js, notificationHistory.js   notification types and cleared items
│       ├── search.js            search-box matching
│       └── sound.js             notification chime
├── .env.example             VITE_API_URL
├── vercel.json              hosting config (all routes → index.html)
├── vite.config.js           dev server on port 5173
├── .oxlintrc.json           lint rules
└── package.json
```

## Built with

React 19 · Vite · Tailwind CSS 4 · React Router · lucide-react icons · jsPDF + jspdf-autotable (PDFs) · docx (Word files).

## Deploying

`npm run build`, then host the `dist/` folder; `vercel.json` is set up for Vercel.
Set `VITE_API_URL` to the public HTTPS address of the API before building, and add this console's address to the API's `CORS_ORIGINS`.
