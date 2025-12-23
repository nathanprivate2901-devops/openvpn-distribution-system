# OpenVPN Distribution System - Frontend

A modern Next.js 14+ frontend application for managing OpenVPN configurations with user authentication, QoS policies, and Docker container management.

## Tech Stack

- **Framework:** Next.js 14+ with App Router
- **Language:** TypeScript (Strict Mode)
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui (Radix UI primitives)
- **State Management:** Zustand
- **Data Fetching:** TanStack Query (React Query)
- **Forms:** React Hook Form + Zod validation
- **HTTP Client:** Axios
- **Icons:** Lucide React
- **Notifications:** Sonner

## Features

- User authentication (Login, Register, Email Verification)
- Protected routes with role-based access control
- User dashboard with statistics
- VPN configuration generation and management
- Download VPN config files
- Revoke VPN configurations
- User profile management
- Password change functionality
- Admin dashboard with system statistics
- User management (Admin only)
- QoS policy management (Admin only)
- Docker container management (Admin only)
- Responsive design (mobile-friendly)
- Toast notifications
- Loading states and error handling

## Prerequisites

- Node.js 18+
- npm or yarn
- Backend API running on http://localhost:3000

## Installation

1. Install dependencies:

```bash
npm install
```

2. Install missing peer dependency:

```bash
npm install tailwindcss-animate
```

3. Copy environment variables:

```bash
cp .env.example .env.local
```

4. Update `.env.local` with your configuration:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_NAME=OpenVPN Distribution System
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Build

Build for production:

```bash
npm run build
```

## Start Production Server

```bash
npm start
```

## Project Structure

```
frontend/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Authentication routes (layout group)
│   │   ├── login/
│   │   ├── register/
│   │   └── verify-email/
│   ├── (dashboard)/         # User dashboard routes (layout group)
│   │   ├── dashboard/
│   │   ├── vpn-configs/
│   │   └── profile/
│   ├── (admin)/             # Admin routes (layout group)
│   │   └── admin/
│   │       ├── users/
│   │       ├── qos/
│   │       └── docker/
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Home page (redirects)
│   ├── providers.tsx        # React Query provider
│   └── globals.css          # Global styles
├── components/
│   ├── ui/                  # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── table.tsx
│   │   ├── dialog.tsx
│   │   ├── badge.tsx
│   │   ├── alert.tsx
│   │   └── select.tsx
│   └── layout/              # Layout components
│       └── DashboardNav.tsx
├── lib/
│   ├── api.ts               # API client and endpoints
│   ├── auth.ts              # Auth utilities and storage
│   └── utils.ts             # Utility functions
├── store/
│   └── authStore.ts         # Zustand auth store
├── types/
│   └── index.ts             # TypeScript types
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── next.config.js
└── README.md
```

## API Integration

The frontend integrates with the backend API at `http://localhost:3000/api`. All API calls are configured in `/lib/api.ts` with the following features:

- Automatic JWT token injection
- Request/response interceptors
- Error handling
- 401 redirect to login
- Typed responses

## Authentication Flow

1. User registers with username, email, and password
2. Verification email is sent
3. User clicks verification link
4. User logs in and receives JWT token
5. Token is stored in localStorage
6. Token is included in all API requests
7. Protected routes check authentication status

## Role-Based Access

- **User Role:**
  - View dashboard
  - Manage VPN configs
  - Update profile
  - Change password

- **Admin Role:**
  - All user permissions
  - View system statistics
  - Manage users
  - Manage QoS policies
  - Manage Docker containers

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:3000` |
| `NEXT_PUBLIC_API_BASE_URL` | API base path | `http://localhost:3000/api` |
| `NEXT_PUBLIC_APP_NAME` | Application name | `OpenVPN Distribution System` |
| `NEXT_PUBLIC_APP_URL` | Frontend URL | `http://localhost:3001` |

## Default Credentials

For testing purposes, the backend comes with a default admin account:

- **Email:** admin@example.com
- **Password:** admin123

**Important:** Change this password immediately in production!

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Key Dependencies

```json
{
  "next": "^14.2.0",
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "@tanstack/react-query": "^5.28.0",
  "axios": "^1.6.8",
  "zustand": "^4.5.2",
  "react-hook-form": "^7.51.0",
  "zod": "^3.22.4",
  "tailwindcss": "^3.4.1",
  "lucide-react": "^0.356.0",
  "sonner": "^1.4.3"
}
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance

- Lighthouse score target: >90
- Initial bundle size: <200KB gzipped
- Core Web Vitals optimized
- Lazy loading for routes
- Image optimization

## Security Features

- JWT token authentication
- Automatic token refresh on 401
- Protected routes
- Role-based access control
- XSS protection
- CSRF protection
- Secure password requirements
- Rate limiting on backend

## Troubleshooting

### Port Already in Use

If port 3000 is already in use by the backend:

```bash
# Run frontend on a different port
PORT=3001 npm run dev
```

### API Connection Issues

1. Ensure backend is running on http://localhost:3000
2. Check CORS configuration in backend
3. Verify `.env.local` has correct API URL

### Build Errors

```bash
# Clean and reinstall
rm -rf node_modules .next
npm install
npm run build
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run type checking: `npm run type-check`
4. Run linting: `npm run lint`
5. Build to verify: `npm run build`
6. Submit a pull request

## License

This project is part of the OpenVPN Distribution System.

## Support

For issues and questions, please refer to the main project documentation.
