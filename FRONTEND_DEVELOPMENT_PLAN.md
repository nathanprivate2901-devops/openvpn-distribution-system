# Frontend Development Plan: OpenVPN Distribution System

## Overview

This document outlines the complete frontend development plan for the OpenVPN Distribution System, including technology stack, architecture, component structure, and implementation roadmap.

---

## Technology Stack

### Core Framework
**Next.js 14** (React 18+)
- **Why:** Server-side rendering, API routes, optimized performance, excellent DX
- **Features Used:** App Router, Server Components, API routes, Middleware
- **Version:** ^14.0.0

### UI & Styling
**TailwindCSS v3** + **shadcn/ui**
- **Why:** Utility-first CSS, component library with accessibility built-in
- **Alternative:** Material-UI (MUI) if enterprise look preferred
- **Icons:** Lucide React (tree-shakeable, modern)

### State Management
**Zustand** (lightweight) or **React Context API**
- **Why:** Simple, performant, minimal boilerplate
- **Usage:** User authentication state, global UI state

### Form Handling
**React Hook Form** + **Zod**
- **Why:** Performance, type-safe validation, excellent DX
- **Features:** Schema validation, error handling, custom validators

### HTTP Client
**Axios** with interceptors
- **Why:** Request/response interception, automatic token injection
- **Features:** Error handling, retry logic, request cancellation

### Additional Libraries
- **date-fns**: Date formatting and manipulation
- **recharts**: Dashboard charts and statistics
- **react-toastify**: Toast notifications
- **framer-motion**: Smooth animations and transitions

---

## Project Structure

```
frontend/
├── public/
│   ├── logo.svg
│   ├── favicon.ico
│   └── assets/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── (auth)/              # Auth group (login, register)
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   └── verify-email/
│   │   │       └── page.tsx
│   │   ├── (dashboard)/         # Protected routes group
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── configs/
│   │   │   │   └── page.tsx
│   │   │   └── profile/
│   │   │       └── page.tsx
│   │   ├── (admin)/             # Admin routes group
│   │   │   ├── admin/
│   │   │   │   ├── users/
│   │   │   │   ├── stats/
│   │   │   │   └── docker/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # Landing page
│   │   └── not-found.tsx
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── Navbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Footer.tsx
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── dashboard/
│   │   │   ├── StatsCard.tsx
│   │   │   ├── ConfigList.tsx
│   │   │   └── QuickActions.tsx
│   │   └── admin/
│   │       ├── UserTable.tsx
│   │       └── DockerContainerList.tsx
│   ├── lib/
│   │   ├── api/
│   │   │   ├── axios.ts        # Axios instance config
│   │   │   ├── auth.ts         # Auth API calls
│   │   │   ├── configs.ts      # VPN config API calls
│   │   │   └── admin.ts        # Admin API calls
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useConfigs.ts
│   │   │   └── useToast.ts
│   │   ├── store/
│   │   │   └── authStore.ts    # Zustand store
│   │   ├── utils/
│   │   │   ├── validators.ts
│   │   │   ├── formatters.ts
│   │   │   └── constants.ts
│   │   └── types/
│   │       └── index.ts        # TypeScript types
│   ├── styles/
│   │   └── globals.css
│   └── middleware.ts            # Next.js middleware for auth
├── .env.local
├── .env.example
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## Core Features & Pages

### 1. Landing Page (`/`)
**Purpose:** Marketing/info page for unauthenticated users

**Sections:**
- Hero section with value proposition
- Features overview (security, ease of use, QoS)
- How it works (3-step process)
- CTA buttons (Login, Get Started)
- Footer with links

**Components:**
```tsx
<LandingPage>
  <Navbar />
  <HeroSection />
  <FeaturesSection />
  <HowItWorksSection />
  <CTASection />
  <Footer />
</LandingPage>
```

---

### 2. Login Page (`/login`)
**Purpose:** User authentication

**Features:**
- Email + password form
- "Remember me" checkbox
- "Forgot password" link
- Email verification status handling
- Error messages for invalid credentials
- Rate limiting feedback
- Link to registration

**Form Validation:**
```typescript
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  rememberMe: z.boolean().optional()
});
```

**API Integration:**
```typescript
POST /api/auth/login
Body: { email, password }
Response: { success, message, data: { token, user } }
```

---

### 3. Registration Page (`/register`)
**Purpose:** New user account creation

**Features:**
- Username, email, password fields
- Password strength indicator
- Confirm password field
- Terms & conditions checkbox
- Real-time email availability check (debounced)
- Success state with verification email reminder
- Link to login

**Form Validation:**
```typescript
const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username too long'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase letter')
    .regex(/[a-z]/, 'Must contain lowercase letter')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  confirmPassword: z.string(),
  terms: z.boolean().refine(val => val === true, 'You must accept terms')
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});
```

**API Integration:**
```typescript
POST /api/auth/register
Body: { username, email, password }
Response: { success, message, data: { id, email, name, role } }
```

---

### 4. Email Verification Page (`/verify-email`)
**Purpose:** Verify user email with token from URL

**Features:**
- Token extraction from query params
- Automatic verification on page load
- Success/error states
- Redirect to login after success
- Resend verification link option

**Flow:**
```typescript
// URL: /verify-email?token=abc123...
1. Extract token from URL
2. Call verification API
3. Show success/error message
4. Redirect to login (if successful)
5. Offer resend option (if failed)
```

**API Integration:**
```typescript
POST /api/auth/verify-email
Body: { token }
Response: { success, message }
```

---

### 5. Dashboard Page (`/dashboard`)
**Purpose:** Main user hub after login

**Layout:**
```
+----------------------------------+
| Navbar (Logo, Profile, Logout)  |
+----------------------------------+
| Welcome, [Username]!             |
|                                  |
| +--------+ +--------+ +--------+ |
| | Total  | | Active | | Down-  | |
| | Config | | Config | | loads  | |
| +--------+ +--------+ +--------+ |
|                                  |
| Quick Actions:                   |
| [Generate New Config]            |
|                                  |
| Recent Configurations:           |
| +--------------------------+     |
| | Config Name | Date | DL  |     |
| +--------------------------+     |
|                                  |
| QoS Policy Info (if assigned)    |
+----------------------------------+
```

**Components:**
- **StatsCards:** Display total, active, revoked configs
- **QuickActions:** Button to generate new config
- **RecentConfigsList:** Table/list of user's configs
- **QoSPolicyCard:** Current policy information

**API Integration:**
```typescript
GET /api/users/dashboard
Response: {
  user: { id, username, email, role, email_verified, member_since },
  stats: { total_configs, active_configs, total_downloads },
  qos_policy: { id, policy_name, max_download_speed, max_upload_speed, priority }
}
```

---

### 6. VPN Configs Page (`/configs`)
**Purpose:** Manage VPN configurations

**Features:**
- List all user configs (paginated)
- Generate new config button
- Download config file
- Revoke config
- Filter (active/revoked)
- Search by filename
- Sort by date

**Table Columns:**
- Filename
- QoS Policy
- Created Date
- Downloaded (Yes/No + timestamp)
- Status (Active/Revoked)
- Actions (Download, Revoke)

**API Integration:**
```typescript
// List configs
GET /api/vpn/configs
Response: { success, data: { total, configs: [...] } }

// Generate new config
POST /api/vpn/generate-config
Response: { success, data: { id, filename, qos_policy, created_at } }

// Download config
GET /api/vpn/config/:id
Response: File download (.ovpn)

// Revoke config
DELETE /api/vpn/config/:id
Response: { success, message }
```

---

### 7. Profile Settings Page (`/profile`)
**Purpose:** User profile management

**Sections:**

**A. Profile Information**
- Username (editable)
- Email (editable, requires re-verification if changed)
- Account created date
- Email verified status

**B. Change Password**
- Current password
- New password
- Confirm new password
- Password strength indicator

**C. Danger Zone**
- Delete account button
- Confirmation modal

**API Integration:**
```typescript
// Get profile
GET /api/users/profile
Response: { success, data: { id, email, name, role, email_verified, created_at } }

// Update profile
PUT /api/users/profile
Body: { username?, email? }
Response: { success, message, data: { ...updatedUser } }

// Change password
PUT /api/users/password
Body: { oldPassword, newPassword }
Response: { success, message }

// Delete account
DELETE /api/users/account
Response: { success, message }
```

---

### 8. Admin Panel (`/admin`)
**Purpose:** Administrative functions (admin role only)

**Sub-pages:**

#### A. Dashboard (`/admin`)
- Total users count
- Active configs count
- System statistics
- Recent activity

#### B. User Management (`/admin/users`)
- User list (paginated)
- Search/filter users
- View user details
- Edit user roles
- Delete users
- View user's configs

**Table Columns:**
- ID
- Username
- Email
- Role
- Email Verified
- Created Date
- Actions (View, Edit, Delete)

#### C. System Stats (`/admin/stats`)
- Charts and graphs
- User growth over time
- Config generation trends
- QoS policy distribution

#### D. Docker Management (`/admin/docker`)
- List Docker containers
- Container status
- Start/stop/restart containers
- View logs
- Create new containers

**API Integration:**
```typescript
// Admin dashboard stats
GET /api/admin/stats
Response: {
  users: { total, active, admin },
  configs: { total, active, revoked },
  system: { uptime, memory, cpu }
}

// List users
GET /api/admin/users?page=1&limit=10
Response: { success, data: { users: [...], pagination: {...} } }

// Docker containers
GET /api/docker/containers
Response: { success, data: { containers: [...] } }

// Container operations
POST /api/docker/containers/:id/start
POST /api/docker/containers/:id/stop
POST /api/docker/containers/:id/restart
GET /api/docker/containers/:id/logs
```

---

## Authentication Flow

### Token Management
```typescript
// Store JWT in localStorage or httpOnly cookie
const setAuthToken = (token: string) => {
  localStorage.setItem('authToken', token);
  // Set axios default header
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

const removeAuthToken = () => {
  localStorage.removeItem('authToken');
  delete api.defaults.headers.common['Authorization'];
};
```

### Protected Routes (Next.js Middleware)
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const token = request.cookies.get('authToken')?.value;

  // Redirect to login if no token
  if (!token && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify JWT (optional: validate with backend)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check admin routes
    if (request.nextUrl.pathname.startsWith('/admin') && decoded.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
  } catch (error) {
    // Invalid token
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/profile/:path*']
};
```

### Auth Store (Zustand)
```typescript
// lib/store/authStore.ts
import create from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  email: string;
  username: string;
  role: 'user' | 'admin';
  email_verified: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (token, user) => {
        setAuthToken(token);
        set({ token, user, isAuthenticated: true });
      },
      logout: () => {
        removeAuthToken();
        set({ token: null, user: null, isAuthenticated: false });
      },
      updateUser: (user) => set({ user })
    }),
    {
      name: 'auth-storage'
    }
  )
);
```

---

## API Client Setup

### Axios Instance
```typescript
// lib/api/axios.ts
import axios, { AxiosError } from 'axios';
import { useAuthStore } from '@/lib/store/authStore';
import { toast } from 'react-toastify';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor: Add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<any>) => {
    // Handle 401 Unauthorized
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      toast.error('Session expired. Please login again.');
      window.location.href = '/login';
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      toast.error('Access denied. Insufficient permissions.');
    }

    // Handle 429 Rate Limit
    if (error.response?.status === 429) {
      toast.error('Too many requests. Please try again later.');
    }

    // Handle 500 Server Error
    if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.');
    }

    return Promise.reject(error);
  }
);

export default api;
```

### API Functions
```typescript
// lib/api/auth.ts
import api from './axios';

export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/api/auth/login', { email, password });
    return response.data;
  },

  register: async (username: string, email: string, password: string) => {
    const response = await api.post('/api/auth/register', { username, email, password });
    return response.data;
  },

  verifyEmail: async (token: string) => {
    const response = await api.post('/api/auth/verify-email', { token });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },

  resendVerification: async (email: string) => {
    const response = await api.post('/api/auth/resend-verification', { email });
    return response.data;
  }
};
```

---

## Custom Hooks

### useAuth
```typescript
// lib/hooks/useAuth.ts
import { useAuthStore } from '@/lib/store/authStore';
import { authAPI } from '@/lib/api/auth';
import { toast } from 'react-toastify';

export const useAuth = () => {
  const { user, token, isAuthenticated, login, logout } = useAuthStore();

  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);
      if (response.success) {
        login(response.data.token, response.data.user);
        toast.success('Login successful!');
        return true;
      }
      return false;
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Login failed');
      return false;
    }
  };

  const handleLogout = () => {
    logout();
    toast.info('Logged out successfully');
  };

  const isAdmin = user?.role === 'admin';

  return {
    user,
    token,
    isAuthenticated,
    isAdmin,
    handleLogin,
    handleLogout
  };
};
```

---

## UI Components (shadcn/ui)

### Installation
```bash
npx shadcn-ui@latest init
```

### Required Components
```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add input
npx shadcn-ui@latest add card
npx shadcn-ui@latest add table
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add form
npx shadcn-ui@latest add label
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add avatar
npx shadcn-ui@latest add skeleton
```

---

## Responsive Design Breakpoints

```typescript
// Tailwind breakpoints
sm: '640px'   // Mobile landscape
md: '768px'   // Tablet
lg: '1024px'  // Desktop
xl: '1280px'  // Large desktop
2xl: '1536px' // Extra large
```

### Layout Strategy
- **Mobile First:** Design for mobile, then enhance for larger screens
- **Sidebar:** Collapsible on mobile, fixed on desktop
- **Tables:** Horizontal scroll on mobile, full view on desktop
- **Cards:** Stack on mobile, grid on desktop

---

## Implementation Roadmap

### Week 1: Foundation & Authentication
**Days 1-2: Project Setup**
- Initialize Next.js project with TypeScript
- Configure TailwindCSS and shadcn/ui
- Setup project structure
- Configure environment variables
- Setup axios and API client

**Days 3-5: Authentication Pages**
- Build Login page with form validation
- Build Registration page with password strength
- Implement Email Verification page
- Create auth store with Zustand
- Setup protected route middleware
- Add toast notifications

**Days 6-7: Layout Components**
- Build Navbar component
- Build Sidebar component
- Build Footer component
- Implement responsive layout

**Deliverable:** Working authentication flow with protected routes

---

### Week 2: User Dashboard & VPN Management
**Days 1-3: Dashboard Page**
- Build stats cards component
- Create quick actions section
- Implement recent configs list
- Add QoS policy display
- Integrate dashboard API

**Days 4-7: VPN Configs Management**
- Build configs list page with table
- Implement pagination
- Add generate config functionality
- Implement download config
- Add revoke config with confirmation
- Add filters and search

**Deliverable:** Complete user dashboard with VPN config management

---

### Week 3: Profile & Admin Panel
**Days 1-3: Profile Page**
- Build profile information section
- Implement profile edit form
- Create change password form
- Add account deletion with confirmation
- Integrate profile APIs

**Days 4-7: Admin Panel (Part 1)**
- Build admin dashboard with stats
- Create user management page
- Implement user table with pagination
- Add user edit/delete functionality
- Build admin navigation

**Deliverable:** User profile management and basic admin panel

---

### Week 4: Admin Features & Polish
**Days 1-3: Admin Panel (Part 2)**
- Build system stats page with charts
- Implement Docker management page
- Add container operations (start/stop/restart)
- Create container logs viewer

**Days 4-5: Testing & Bug Fixes**
- End-to-end testing all flows
- Fix bugs and edge cases
- Optimize performance
- Cross-browser testing

**Days 6-7: Polish & Documentation**
- Improve UI/UX based on testing
- Add loading states and skeletons
- Improve error handling
- Write frontend documentation
- Prepare for deployment

**Deliverable:** Production-ready frontend application

---

## Environment Variables

### `.env.local` (Development)
```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000

# JWT Secret (for middleware verification)
JWT_SECRET=your-jwt-secret-matching-backend

# Application
NEXT_PUBLIC_APP_NAME=OpenVPN Distribution System
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

### `.env.production`
```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
JWT_SECRET=your-production-jwt-secret
NEXT_PUBLIC_APP_NAME=OpenVPN Distribution System
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## Package.json Scripts
```json
{
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "format": "prettier --write \"**/*.{js,jsx,ts,tsx,json,md}\""
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "axios": "^1.6.0",
    "zustand": "^4.4.0",
    "react-hook-form": "^7.49.0",
    "zod": "^3.22.0",
    "@hookform/resolvers": "^3.3.0",
    "tailwindcss": "^3.4.0",
    "@radix-ui/react-*": "latest",
    "lucide-react": "^0.300.0",
    "react-toastify": "^9.1.0",
    "date-fns": "^3.0.0",
    "recharts": "^2.10.0",
    "framer-motion": "^10.16.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "typescript": "^5.3.0",
    "eslint": "^8.55.0",
    "eslint-config-next": "^14.0.0",
    "prettier": "^3.1.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

---

## Next Steps

1. **Create Frontend Repository** (or subdirectory)
2. **Initialize Next.js Project**
   ```bash
   npx create-next-app@latest frontend --typescript --tailwind --app --src-dir
   cd frontend
   ```
3. **Install Dependencies**
   ```bash
   npm install axios zustand react-hook-form zod @hookform/resolvers
   npx shadcn-ui@latest init
   ```
4. **Follow Week 1 Roadmap** - Start with authentication pages
5. **Test API Integration** - Ensure backend endpoints are accessible
6. **Iterative Development** - Build, test, refine

---

## Success Criteria

- ✅ All authentication flows working (login, register, verify, logout)
- ✅ Protected routes implemented with role-based access
- ✅ User dashboard displays correct data
- ✅ VPN config generation, download, and revocation functional
- ✅ Profile management working (edit, change password, delete)
- ✅ Admin panel accessible only to admin users
- ✅ Responsive design works on mobile, tablet, desktop
- ✅ Error handling provides clear user feedback
- ✅ Loading states prevent confusion
- ✅ No console errors in production build
- ✅ Type safety maintained (no TypeScript errors)

---

**Document Version:** 1.0.0
**Last Updated:** 2025-10-14
**Status:** Ready for Implementation
