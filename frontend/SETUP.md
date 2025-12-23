# Quick Start Guide - OpenVPN Frontend

This guide will help you get the OpenVPN Distribution System frontend up and running quickly.

## Prerequisites

Before you begin, ensure you have:

- Node.js 18+ installed
- npm or yarn package manager
- Backend API running on http://localhost:3000
- Terminal/Command Prompt access

## Installation Steps

### 1. Navigate to Frontend Directory

```bash
cd /mnt/e/MYCOMPANY/TNam/frontend
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui components
- TanStack Query
- Zustand
- React Hook Form + Zod
- Axios
- And all other dependencies

### 3. Configure Environment

The `.env.local` file is already configured with default values:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
NEXT_PUBLIC_APP_NAME=OpenVPN Distribution System
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

If your backend runs on a different port, update the values accordingly.

### 4. Start Development Server

```bash
npm run dev
```

The application will start on http://localhost:3000 (or next available port if 3000 is occupied by the backend).

### 5. Access the Application

Open your browser and navigate to:
- **Development:** http://localhost:3000 (or the port shown in terminal)

### 6. Login with Default Credentials

For testing, use the default admin account:
- **Email:** admin@example.com
- **Password:** admin123

**IMPORTANT:** Change this password immediately after first login!

## Available Scripts

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run TypeScript type checking
npm run type-check

# Run ESLint
npm run lint
```

## Project Structure Overview

```
frontend/
├── app/                     # Next.js App Router
│   ├── (auth)/             # Authentication pages
│   ├── (dashboard)/        # User dashboard
│   ├── (admin)/            # Admin panel
│   └── layout.tsx          # Root layout
├── components/
│   ├── ui/                 # shadcn/ui components
│   └── layout/             # Layout components
├── lib/
│   ├── api.ts              # API client
│   ├── auth.ts             # Auth utilities
│   └── utils.ts            # Helper functions
├── store/
│   └── authStore.ts        # Zustand store
└── types/
    └── index.ts            # TypeScript types
```

## Features Available

### User Features
- User registration with email verification
- Login/Logout
- Dashboard with statistics
- VPN config generation
- VPN config download
- Config revocation
- Profile management
- Password change

### Admin Features (Admin role only)
- System statistics dashboard
- User management (CRUD operations)
- QoS policy management
- Docker container management
- View/Start/Stop/Restart containers

## API Integration

The frontend communicates with the backend API at:
- Base URL: `http://localhost:3000/api`

All API endpoints are configured in `/lib/api.ts` with:
- Automatic JWT token injection
- Error handling
- Request/response interceptors
- Type-safe responses

## Authentication Flow

1. User logs in → Receives JWT token
2. Token stored in localStorage
3. Token included in all API requests via interceptor
4. 401 responses automatically redirect to login
5. Protected routes check authentication status

## Troubleshooting

### Port Conflict

If port 3000 is already in use:

```bash
# Run on different port
PORT=3001 npm run dev
```

### Backend Connection Issues

1. Verify backend is running: http://localhost:3000/health
2. Check CORS settings in backend
3. Verify `.env.local` has correct API URL

### Build Errors

```bash
# Clean install
rm -rf node_modules .next
npm install
npm run build
```

### TypeScript Errors

```bash
# Run type checking
npm run type-check
```

## Development Tips

### Hot Reload

The development server supports hot module replacement (HMR). Changes to files will automatically refresh in the browser.

### Adding New Pages

1. Create new folder in appropriate route group
2. Add `page.tsx` file
3. Use existing layouts or create custom layout
4. Protected routes automatically inherit authentication

### Adding New API Endpoints

1. Add method to `/lib/api.ts`
2. Use TanStack Query for data fetching
3. Handle loading and error states

### Styling

- Use Tailwind CSS utility classes
- Use shadcn/ui components for consistency
- Follow mobile-first responsive design
- Use design tokens from theme

## Production Deployment

### Build for Production

```bash
npm run build
```

This creates an optimized production build in `.next` folder.

### Start Production Server

```bash
npm start
```

### Environment Variables

For production, update `.env.local` with:
- Production API URL
- Production app URL
- Any other environment-specific values

### Deployment Platforms

The Next.js app can be deployed to:
- Vercel (recommended)
- Netlify
- AWS Amplify
- Docker container
- Any Node.js hosting

## Security Considerations

1. **JWT Tokens:** Stored in localStorage, cleared on logout
2. **Protected Routes:** Automatic authentication checks
3. **Role-Based Access:** Admin routes restricted to admin users
4. **XSS Protection:** React's built-in XSS protection
5. **HTTPS:** Use HTTPS in production
6. **Environment Variables:** Never commit sensitive data

## Performance Optimization

The app includes:
- Code splitting by route
- Lazy loading of components
- Optimized images
- React Query caching
- Production builds minified
- Tree shaking enabled

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Getting Help

If you encounter issues:

1. Check backend is running and accessible
2. Verify environment variables
3. Check browser console for errors
4. Review API responses in Network tab
5. Check backend logs for API errors

## Next Steps

After successful setup:

1. Change default admin password
2. Create new users
3. Generate VPN configurations
4. Configure QoS policies
5. Set up Docker containers (if needed)
6. Customize branding (optional)

## Additional Resources

- Next.js Documentation: https://nextjs.org/docs
- React Documentation: https://react.dev
- Tailwind CSS: https://tailwindcss.com
- shadcn/ui: https://ui.shadcn.com
- TanStack Query: https://tanstack.com/query

Enjoy using the OpenVPN Distribution System!
