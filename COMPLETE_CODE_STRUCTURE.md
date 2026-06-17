# HostelSet - Complete Project Structure & Code

## 📁 Complete Directory Structure

```
HostelSet/
├── pages/
│   ├── _app.js                              # Global App Wrapper
│   ├── _document.js                         # HTML Document Wrapper
│   ├── index.js                             # Homepage
│   ├── login.js                             # Login Page
│   ├── register.js                          # Owner Registration
│   ├── properties.js                        # Browse Properties
│   ├── reset-password.js                    # Password Reset
│   ├── admin/
│   │   └── dashboard.js                     # Admin Dashboard
│   ├── owner/
│   │   ├── dashboard.js                     # Owner Dashboard
│   │   ├── register-property.js             # Register Property
│   │   └── subscribe.js                     # Subscription Plans
│   ├── tenant/
│   │   ├── dashboard.js                     # Tenant Dashboard
│   │   └── waiting.js                       # Waiting for Room Assignment
│   ├── property/
│   │   └── [id].js                          # Property Details Page
│   └── api/
│       ├── admin/
│       │   ├── grant-membership.js          # Grant Membership
│       │   └── manage-membership.js         # Manage Membership
│       └── payment/
│           ├── create-membership-order.js   # Membership Payment
│           ├── create-rent-order.js         # Rent Payment
│           └── webhook.js                   # Payment Webhook
├── lib/
│   ├── supabase.js                          # Supabase Config & Auth
│   ├── utils.js                             # Utility Functions
│   └── dodo.js                              # Dodo Payments API
├── styles/
│   └── globals.css                          # Global Styles
├── package.json
├── tailwind.config.js
├── postcss.config.js
├── next.config.js
├── .gitignore
└── .env.local
```

---

## 📦 package.json

```json
{
  "name": "hostelset",
  "version": "2.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.8",
    "next": "14.2.35",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "recharts": "^2.12.7",
    "react-hot-toast": "^2.4.1",
    "framer-motion": "^10.16.16"
  },
  "devDependencies": {
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0"
  }
}
```

---

## ⚙️ Configuration Files

### next.config.js
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
}

module.exports = nextConfig
```

### postcss.config.js
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### tailwind.config.js
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FF6B35',
        secondary: '#1A4A6E',
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
```

### .gitignore
```
node_modules/
.next/
.env
.env.local
.DS_Store
*.log
.vercel
```

### .env.local (Template)
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DODO_API_KEY=your_dodo_api_key
DODO_WEBHOOK_SECRET=your_webhook_secret
NEXT_PUBLIC_APP_URL=https://hostelset.com
```

---

## 📚 Library Files

### lib/supabase.js
```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yzfggwnkawicwlniflnn.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6Zmdnd25rYXdpY3dsbmlmbG5uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMzQxNjYsImV4cCI6MjA5NTYxMDF2Nn0.FGm5Xo3...'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  }
})

// ========== IMAGE OPERATIONS ==========
export const uploadImage = async (file, folder = 'property-photos') => {
  try {
    if (!file) throw new Error('No file provided')
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Only JPEG, PNG, WEBP, and GIF images are allowed')
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image size must be less than 5MB')
    }
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`
    const filePath = `${folder}/${fileName}`
    const { data, error } = await supabase.storage
      .from('property-photos')
      .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type })
    if (error) throw error
    const { data: { publicUrl } } = supabase.storage.from('property-photos').getPublicUrl(filePath)
    return publicUrl
  } catch (error) {
    console.error('Upload error:', error)
    throw error
  }
}

export const deleteImage = async (imageUrl) => {
  try {
    const urlParts = imageUrl.split('/')
    const filePath = urlParts.slice(urlParts.indexOf('property-photos') + 1).join('/')
    const { error } = await supabase.storage.from('property-photos').remove([filePath])
    if (error) throw error
    return true
  } catch (error) {
    console.error('Delete image error:', error)
    return false
  }
}

// ========== AUTH FUNCTIONS ==========
export const signUpWithEmail = async (email, password, userData) => {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: userData.full_name, role: userData.role } }
    })
    if (authError) throw authError

    const { error: userError } = await supabase.from('users').insert({
      id: authData.user.id,
      email: email,
      full_name: userData.full_name,
      phone: userData.phone,
      role: userData.role,
      is_active: true
    })
    if (userError) throw userError

    return { success: true, user: authData.user }
  } catch (error) {
    console.error('Signup error:', error)
    return { success: false, error: error.message }
  }
}

export const signInWithEmail = async (email, password) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, id, full_name, phone')
      .eq('email', email)
      .single()
    if (userError) throw userError

    localStorage.setItem('userId', userData.id)
    localStorage.setItem('userRole', userData.role)
    localStorage.setItem('isLoggedIn', 'true')
    localStorage.setItem('userName', userData.full_name)
    localStorage.setItem('userEmail', email)

    return { success: true, user: data.user, role: userData.role, userData }
  } catch (error) {
    console.error('Signin error:', error)
    return { success: false, error: error.message }
  }
}

export const signOut = async () => {
  try {
    await supabase.auth.signOut()
    localStorage.clear()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const resetPassword = async (email) => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}
```

### lib/utils.js
```javascript
export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0)
}

export function formatDate(date) {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(date) {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function getDaysOverdue(dueDate) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  if (today <= due) return 0
  return Math.ceil((today - due) / (1000 * 60 * 60 * 24))
}

export function getSharingDetails(type) {
  const details = {
    single: { label: 'Single Sharing', icon: '👤', capacity: 1, description: 'Private room for 1 person' },
    double: { label: 'Double Sharing', icon: '👥', capacity: 2, description: 'Shared room for 2 persons' },
    triple: { label: 'Triple Sharing', icon: '👥👤', capacity: 3, description: 'Shared room for 3 persons' },
    four: { label: 'Four Sharing', icon: '👥👥', capacity: 4, description: 'Shared room for 4 persons' },
    five: { label: 'Five Sharing', icon: '👥👥👤', capacity: 5, description: 'Shared room for 5 persons' },
    six: { label: 'Six Sharing', icon: '👥👥👥', capacity: 6, description: 'Shared room for 6 persons' },
    dormitory: { label: 'Dormitory', icon: '🏘️', capacity: 8, description: 'Large shared room' },
  }
  return details[type] || details.double
}

export function getPropertyTypeLabel(type) {
  const types = {
    boys: '👨 Boys PG',
    girls: '👩 Girls PG',
    'co-ed': '👥 Co-ed PG',
    professionals: '💼 Working Professionals'
  }
  return types[type] || type
}

export function cleanPhoneNumber(phone) {
  if (!phone) return ''
  return phone.toString().replace(/^\+91/, '').replace(/\s/g, '').trim()
}
```

### lib/dodo.js
```javascript
// Dodo Payments API Helper (Live Mode – correct endpoint & fields)

const DODO_API_KEY = process.env.DODO_API_KEY;
const DODO_API_BASE = 'https://live.dodopayments.com';

// Your membership product ID from Dodo dashboard
const MEMBERSHIP_PRODUCT_ID = 'pdt_0NgsOeKIu8IFQi24BbANl';

export async function createDodoOrder({ amount, currency, customerName, customerEmail, purpose, metadata }) {
  try {
    const response = await fetch(`${DODO_API_BASE}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DODO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        billing: {
          country: 'IN',            // India (ISO alpha‑2)
        },
        customer: {
          email: customerEmail,
          name: customerName,
        },
        product_cart: [
          {
            product_id: MEMBERSHIP_PRODUCT_ID,
            quantity: 1,
            amount: amount * 100,   // amount in paise (₹499 = 49900)
          },
        ],
        return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://hostelset.com'}/payment/return`,
        payment_link: true,         // Required to generate a hosted payment page
        metadata: {
          purpose,
          ...metadata,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || JSON.stringify(data));
    }

    // Dodo returns { payment_id, payment_link, ... }
    return {
      success: true,
      orderId: data.payment_id,
      paymentLink: data.payment_link,
    };
  } catch (error) {
    console.error('Dodo order error:', error);
    return { success: false, error: error.message };
  }
}
```

---

## 🎨 Styles

### styles/globals.css
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Premium White & Slate Theme */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: #ffffff;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1e293b;
  min-height: 100vh;
}

/* Custom Scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 10px;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Buttons */
.btn-primary {
  background: #1e293b;
  color: white;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
}
.btn-primary:hover {
  background: #334155;
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-secondary {
  background: #f1f5f9;
  color: #1e293b;
  padding: 12px 24px;
  border-radius: 12px;
  font-weight: 600;
  transition: all 0.3s ease;
  border: 1px solid #e2e8f0;
  cursor: pointer;
}
.btn-secondary:hover {
  background: #e2e8f0;
  transform: translateY(-2px);
}

.btn-outline {
  background: transparent;
  border: 2px solid #1e293b;
  color: #1e293b;
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 600;
  transition: all 0.3s ease;
  cursor: pointer;
}
.btn-outline:hover {
  background: #1e293b;
  color: white;
  transform: translateY(-2px);
}

.btn-danger {
  background: #ef4444;
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 12px;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
}
.btn-danger:hover {
  background: #dc2626;
  transform: translateY(-1px);
}

.btn-success {
  background: #10b981;
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 12px;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
}
.btn-success:hover {
  background: #059669;
  transform: translateY(-1px);
}

/* Cards */
.card {
  background: white;
  border-radius: 20px;
  padding: 24px;
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 25px -12px rgba(0, 0, 0, 0.1);
}

/* Stats Cards */
.stat-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  text-align: center;
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);
}
.stat-number {
  font-size: 28px;
  font-weight: 800;
  color: #1e293b;
}
.stat-label {
  color: #64748b;
  font-size: 12px;
  margin-top: 4px;
}

/* Room Cards */
.room-card {
  background: white;
  border-radius: 16px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  transition: all 0.3s ease;
  cursor: pointer;
}
.room-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 20px 25px -12px rgba(0, 0, 0, 0.15);
  border-color: #cbd5e1;
}
.room-card-vacant {
  border-left: 4px solid #10b981;
}
.room-card-occupied {
  border-left: 4px solid #f59e0b;
}
.room-card-full {
  border-left: 4px solid #ef4444;
}

/* Inputs */
.input {
  width: 100%;
  padding: 12px 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  color: #1e293b;
  transition: all 0.3s ease;
}
.input:focus {
  outline: none;
  border-color: #1e293b;
  box-shadow: 0 0 0 3px rgba(30, 41, 59, 0.1);
}
.input::placeholder {
  color: #94a3b8;
}

/* File Input */
.file-input {
  width: 100%;
  padding: 12px 16px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  color: #1e293b;
  cursor: pointer;
  transition: all 0.3s ease;
}
.file-input:hover {
  border-color: #1e293b;
  background: #f1f5f9;
}

/* Badges */
.badge-success {
  background: #d1fae5;
  color: #065f46;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.badge-danger {
  background: #fee2e2;
  color: #991b1b;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.badge-warning {
  background: #fef3c7;
  color: #92400e;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.badge-info {
  background: #dbeafe;
  color: #1e40af;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* Tables */
.table-container {
  overflow-x: auto;
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
}
.table {
  width: 100%;
  border-collapse: collapse;
}
.table th {
  text-align: left;
  padding: 16px;
  color: #64748b;
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #e2e8f0;
}
.table td {
  padding: 16px;
  color: #1e293b;
  font-size: 14px;
  border-bottom: 1px solid #f1f5f9;
}
.table tr:hover {
  background: #f8fafc;
}

/* Modals */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 16px;
}
.modal-content {
  background: white;
  border-radius: 24px;
  padding: 24px;
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  animation: modalSlideIn 0.3s ease-out;
}
@keyframes modalSlideIn {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* Alerts */
.alert-success {
  background: #d1fae5;
  border: 1px solid #a7f3d0;
  color: #065f46;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.alert-danger {
  background: #fee2e2;
  border: 1px solid #fecaca;
  color: #991b1b;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.alert-warning {
  background: #fef3c7;
  border: 1px solid #fde68a;
  color: #92400e;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.alert-info {
  background: #dbeafe;
  border: 1px solid #bfdbfe;
  color: #1e40af;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
}

/* Progress Bar */
.progress-bar {
  width: 100%;
  background: #e2e8f0;
  border-radius: 9999px;
  height: 6px;
  overflow: hidden;
}
.progress-fill {
  background: #1e293b;
  height: 6px;
  border-radius: 9999px;
  transition: width 0.3s ease;
}

/* Image Gallery */
.image-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
  margin-top: 16px;
}
.image-preview {
  position: relative;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  background: #f1f5f9;
}
.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.image-preview .remove-image {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(239, 68, 68, 0.9);
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

/* Animations */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e2e8f0;
  border-top-color: #1e293b;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}
@keyframes float {
  0%, 100% {
    transform: translateY(0px);
  }
  50% {
    transform: translateY(-10px);
  }
}
.animate-float {
  animation: float 3s ease-in-out infinite;
}

/* Navbar */
.navbar {
  background: white;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 100;
}

/* Grids */
.room-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}
.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}
```

---

## 📄 Page Files

### pages/_document.js
```javascript
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
```

### pages/_app.js
```javascript
import '../styles/globals.css'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function App({ Component, pageProps }) {
  const router = useRouter()

  useEffect(() => {
    const checkSession = () => {
      const isLoggedIn = localStorage.getItem('isLoggedIn')
      const protectedRoutes = ['/owner', '/tenant']
      const isProtectedRoute = protectedRoutes.some(route => router.pathname.startsWith(route))
      
      if (isProtectedRoute && !isLoggedIn && router.pathname !== '/login') {
        router.push('/login')
      }
    }
    checkSession()
  }, [router.pathname])

  return (
    <>
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: { background: '#1e293b', color: '#fff', borderRadius: '12px' },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Component {...pageProps} />
    </>
  )
}
```

### pages/login.js
```javascript
import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase, signInWithEmail, resetPassword } from '../lib/supabase'
import { cleanPhoneNumber } from '../lib/utils'
import toast from 'react-hot-toast'

export default function Login() {
  const router = useRouter()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const isEmail = (input) => input.includes('@')
  const isPhone = (input) => /^\d{10}$/.test(input)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!identifier || !password) {
      toast.error('Please enter email/phone and password')
      return
    }
    setLoading(true)

    try {
      let emailToUse = identifier

      if (isPhone(identifier)) {
        const cleanPhone = cleanPhoneNumber(identifier)
        const { data, error } = await supabase
          .from('users')
          .select('email')
          .eq('phone', cleanPhone)
          .maybeSingle()
        if (error || !data || !data.email) {
          toast.error('No account found with this phone number. Please register.')
          setLoading(false)
          return
        }
        emailToUse = data.email
      } else if (!isEmail(identifier)) {
        toast.error('Enter a valid email or 10-digit mobile number')
        setLoading(false)
        return
      }

      const result = await signInWithEmail(emailToUse, password)
      if (result.success) {
        toast.success(`Welcome back, ${result.userData.full_name}!`)
        if (result.role === 'admin') {
          router.push('/admin/dashboard')
        } else if (result.role === 'owner') {
          const { data: property } = await supabase
            .from('properties')
            .select('id')
            .eq('owner_id', result.userData.id)
            .maybeSingle()
          if (property) {
            router.push('/owner/dashboard')
          } else {
            router.push('/owner/register-property')
          }
        } else {
          router.push('/tenant/dashboard')
        }
      } else {
        toast.error(result.error || 'Invalid email or password')
      }
    } catch (error) {
      console.error('Login error:', error)
      toast.error('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetEmail) {
      toast.error('Please enter your email')
      return
    }
    setLoading(true)
    const result = await resetPassword(resetEmail)
    if (result.success) {
      toast.success('Password reset email sent! Check your inbox (and spam).')
      setShowReset(false)
    } else {
      toast.error(result.error || 'Failed to send reset email')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-white">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border border-gray-100"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-slate-700 to-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <span className="text-3xl">🏠</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">HOSTELSET</h1>
          <p className="text-gray-500 mt-1">Login with email or mobile number</p>
        </div>

        {!showReset ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">Email or Mobile Number</label>
              <input
                type="text"
                placeholder="you@example.com or 9876543210"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800 transition"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
              <p className="text-xs text-gray-400 mt-1">Use the email you registered with (phone login only works if you stored your number).</p>
            </div>
            <div>
              <label className="block text-gray-700 font-semibold mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800 pr-12 transition"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-slate-800 transition"
                  tabIndex={-1}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login →'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowReset(true)}
                className="text-sm text-slate-600 hover:text-slate-800 transition"
              >
                Forgot password?
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div>
              <label className="block text-gray-700 font-semibold mb-2">Your Email Address</label>
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">We'll send a password reset link to this email</p>
            </div>
            <button
              onClick={handleResetPassword}
              disabled={loading}
              className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reset Email'}
            </button>
            <button
              onClick={() => setShowReset(false)}
              className="w-full text-slate-600 hover:text-slate-800 text-sm transition"
            >
              ← Back to login
            </button>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link href="/owner/register-property" className="text-slate-600 hover:text-slate-800 text-sm transition">
            📝 List Your Property →
          </Link>
        </div>
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            Don't have an account?{' '}
            <Link href="/register" className="text-slate-600 hover:text-slate-800 transition">
              Register as Owner
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
```

### pages/register.js
```javascript
import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase, signUpWithEmail } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function Register() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '', ownerName: '', phone: '', email: '', password: '', confirmPassword: '',
    address: '', city: '', propertyType: 'boys'
  })

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      setLoading(false)
      return
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      setLoading(false)
      return
    }
    const cleanPhone = formData.phone
    if (cleanPhone.length !== 10) {
      toast.error('Enter valid 10-digit phone number')
      setLoading(false)
      return
    }

    try {
      const signUpResult = await signUpWithEmail(formData.email, formData.password, {
        full_name: formData.ownerName,
        phone: cleanPhone,
        role: 'owner'
      })
      if (!signUpResult.success) throw new Error(signUpResult.error)

      const userId = signUpResult.user.id

      const { error: propertyError } = await supabase.from('properties').insert({
        owner_id: userId, name: formData.name, address: formData.address,
        city: formData.city, property_type: formData.propertyType, is_active: true
      })
      if (propertyError) throw propertyError

      toast.success('Registration successful! Please login.')
      router.push('/login')
    } catch (error) {
      console.error(error)
      toast.error(error.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen py-12 bg-gradient-to-br from-gray-50 to-white">
      <div className="container mx-auto max-w-2xl px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-8 py-6">
            <h1 className="text-2xl font-bold text-white">🏠 Register Your Property</h1>
            <p className="text-slate-300 text-sm mt-1">Join India's fastest-growing PG network</p>
          </div>
          <div className="p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Property Name *</label>
                  <input type="text" name="name" placeholder="e.g., Sunshine PG" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" value={formData.name} onChange={handleChange} required />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Owner Name *</label>
                  <input type="text" name="ownerName" placeholder="Full name" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" value={formData.ownerName} onChange={handleChange} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Phone Number *</label>
                  <input type="tel" name="phone" placeholder="10-digit number" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" value={formData.phone} onChange={handleChange} required />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Email Address *</label>
                  <input type="email" name="email" placeholder="owner@example.com" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" value={formData.email} onChange={handleChange} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Password *</label>
                  <input type="password" name="password" placeholder="••••••••" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" value={formData.password} onChange={handleChange} required />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Confirm Password *</label>
                  <input type="password" name="confirmPassword" placeholder="••••••••" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" value={formData.confirmPassword} onChange={handleChange} required />
                </div>
              </div>
              <div>
                <label className="block text-gray-700 font-semibold mb-2">Full Address *</label>
                <input type="text" name="address" placeholder="Street, area, landmark" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" value={formData.address} onChange={handleChange} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">City *</label>
                  <input type="text" name="city" placeholder="Bangalore" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" value={formData.city} onChange={handleChange} required />
                </div>
                <div>
                  <label className="block text-gray-700 font-semibold mb-2">Property Type</label>
                  <select name="propertyType" className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800" value={formData.propertyType} onChange={handleChange}>
                    <option value="boys">Boys PG</option>
                    <option value="girls">Girls PG</option>
                    <option value="co-ed">Co-ed PG</option>
                    <option value="professionals">Working Professionals</option>
                  </select>
                </div>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50 mt-4">
                {loading ? 'Registering...' : 'Register Property →'}
              </button>
            </form>
            <div className="mt-6 text-center">
              <Link href="/login" className="text-slate-600 hover:text-slate-800 text-sm">
                Already have an account? Login
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
```

### pages/properties.js
```javascript
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/utils'

export default function PropertiesPage() {
  const [properties, setProperties] = useState([])
  const [filteredProperties, setFilteredProperties] = useState([])
  const [cities, setCities] = useState([])
  const [selectedCity, setSelectedCity] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadProperties()
  }, [])

  useEffect(() => {
    let filtered = properties
    if (selectedCity) {
      filtered = filtered.filter(p => p.city === selectedCity)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          (p.city && p.city.toLowerCase().includes(q))
      )
    }
    setFilteredProperties(filtered)
  }, [selectedCity, searchQuery, properties])

  const loadProperties = async () => {
    setLoading(true)
    try {
      const { data: propertiesData, error: propError } = await supabase
        .from('properties')
        .select('*')
        .eq('is_active', true)

      if (propError) throw propError

      if (!propertiesData || propertiesData.length === 0) {
        setProperties([])
        setFilteredProperties([])
        setLoading(false)
        return
      }

      const propertyIds = propertiesData.map(p => p.id)
      const { data: roomsData, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .in('property_id', propertyIds)

      if (roomsError) throw roomsError

      const propertiesWithStats = propertiesData.map(property => {
        const rooms = roomsData?.filter(r => r.property_id === property.id) || []
        const totalRooms = rooms.length
        const occupiedRooms = rooms.filter(r => r.current_occupants >= r.capacity).length
        const lowestRent = rooms.length > 0 ? Math.min(...rooms.map(r => r.monthly_rent)) : null
        return {
          ...property,
          totalRooms,
          occupiedRooms,
          lowestRent,
          firstPhoto: property.photos && property.photos.length > 0 ? property.photos[0] : null,
        }
      })

      const uniqueCities = [...new Set(propertiesWithStats.map(p => p.city).filter(Boolean))]
      setCities(uniqueCities.sort())
      setProperties(propertiesWithStats)
      setFilteredProperties(propertiesWithStats)
    } catch (error) {
      console.error('Error loading properties:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-10">
        <div className="container mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold text-slate-800 mb-3"
          >
            🏠 Find Your Perfect PG
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-500 mb-8"
          >
            Browse properties, check rooms, and apply directly
          </motion.p>

          <div className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Search by property name or city..."
              className="flex-1 px-4 py-3 border border-gray-200 rounded-full focus:outline-none focus:border-slate-800 transition"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <select
              className="px-4 py-3 border border-gray-200 rounded-full focus:outline-none focus:border-slate-800 transition"
              value={selectedCity}
              onChange={e => setSelectedCity(e.target.value)}
            >
              <option value="">All Cities</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🏠</div>
            <p className="text-gray-500">No properties found. Try a different search or city.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProperties.map((property, index) => (
              <motion.div
                key={property.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -5 }}
                className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100"
              >
                <div className="h-48 bg-gray-100 relative">
                  {property.firstPhoto ? (
                    <img
                      src={property.firstPhoto}
                      alt={property.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-5xl text-gray-300">
                      🏢
                    </div>
                  )}
                  {property.lowestRent && (
                    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold text-slate-800">
                      From {formatCurrency(property.lowestRent)}/mo
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <h3 className="text-xl font-bold text-slate-800 mb-1">{property.name}</h3>
                  <p className="text-sm text-gray-500 mb-3">{property.city || 'Location not specified'}</p>
                  <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
                    <span>🏠 {property.totalRooms} rooms</span>
                    <span>🛏️ {property.occupiedRooms}/{property.totalRooms} occupied</span>
                  </div>
                  <Link
                    href={`/property/${property.id}`}
                    className="block w-full bg-slate-800 text-white text-center py-2.5 rounded-full font-semibold hover:bg-slate-700 transition"
                  >
                    View Details →
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

### pages/reset-password.js
```javascript
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function ResetPassword() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [accessToken, setAccessToken] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1))
      const token = params.get('access_token')
      if (token) {
        setAccessToken(token)
      } else {
        setError('Invalid reset link: missing token')
      }
    } else {
      const query = new URLSearchParams(window.location.search)
      const tokenFromQuery = query.get('access_token')
      if (tokenFromQuery) {
        setAccessToken(tokenFromQuery)
      } else {
        setError('No reset token found. Please request a new password reset link.')
      }
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser(
        { password },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (error) throw error
      toast.success('Password updated successfully! Please login.')
      router.push('/login')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => router.push('/login')} className="bg-slate-800 text-white px-6 py-2 rounded-xl">
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  if (!accessToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading reset token...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-white">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-6">Set New Password</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="New password"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Confirm password"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-slate-800"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-slate-800 text-white py-3 rounded-xl font-semibold hover:bg-slate-700 transition disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
```

---

## 🔗 Continue in next part for remaining files...

This document contains the core structure and files. Due to length limits, the large files (dashboards) are partially shown. The complete code is available in the GitHub repository.

**See the complete repository at**: https://github.com/CodingWithRAMKUMAR/HostelSet

