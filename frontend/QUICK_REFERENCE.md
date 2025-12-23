# Quick Reference Guide

This guide provides quick answers to common tasks and questions.

## Installation & Setup

```bash
# 1. Navigate to frontend directory
cd /mnt/e/MYCOMPANY/TNam/frontend

# 2. Install all dependencies
npm install

# 3. Start development server
npm run dev

# 4. Open browser to http://localhost:3000
```

## Default Login Credentials

```
Email: admin@example.com
Password: admin123
```

**IMPORTANT:** Change this immediately in production!

## File Locations

### Need to modify...

**API endpoints?**
→ `/lib/api.ts`

**Authentication logic?**
→ `/lib/auth.ts` and `/store/authStore.ts`

**TypeScript types?**
→ `/types/index.ts`

**Global styles?**
→ `/app/globals.css`

**Environment variables?**
→ `.env.local`

**Navigation menu?**
→ `/components/layout/DashboardNav.tsx`

**Login page?**
→ `/app/(auth)/login/page.tsx`

**Dashboard?**
→ `/app/(dashboard)/dashboard/page.tsx`

**Admin panel?**
→ `/app/(admin)/admin/page.tsx`

## Common Tasks

### Add a New Page

1. Create folder in appropriate route group:
   - Auth: `/app/(auth)/new-page/`
   - Dashboard: `/app/(dashboard)/new-page/`
   - Admin: `/app/(admin)/admin/new-page/`

2. Add `page.tsx`:
```tsx
export default function NewPage() {
  return <div>New Page</div>;
}
```

3. Update navigation in `/components/layout/DashboardNav.tsx`

### Add a New API Endpoint

1. Open `/lib/api.ts`

2. Add to appropriate section:
```typescript
export const api = {
  // ... existing code

  newEndpoint: () =>
    apiClient.get('/new-endpoint'),
};
```

3. Use in component with React Query:
```typescript
const { data } = useQuery({
  queryKey: ['new-endpoint'],
  queryFn: async () => {
    const response = await api.newEndpoint();
    return response.data;
  },
});
```

### Add a New TypeScript Type

1. Open `/types/index.ts`

2. Add interface:
```typescript
export interface NewType {
  id: number;
  name: string;
  // ... other fields
}
```

### Create a New UI Component

1. Create file in `/components/ui/new-component.tsx`

2. Follow shadcn/ui pattern:
```tsx
import { cn } from "@/lib/utils";

export function NewComponent({ className, ...props }) {
  return (
    <div className={cn("base-classes", className)} {...props}>
      {/* content */}
    </div>
  );
}
```

### Add Authentication to a Page

Already done! All pages in `(dashboard)` and `(admin)` groups are protected.

For manual protection:
```tsx
'use client';
import { useAuthStore } from '@/store/authStore';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function ProtectedPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // ... rest of component
}
```

## Styling

### Using Tailwind Classes

```tsx
<div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg">
  <span className="text-lg font-semibold">Title</span>
  <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
    Click me
  </button>
</div>
```

### Using shadcn/ui Components

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    <Button>Click me</Button>
  </CardContent>
</Card>
```

### Custom Colors

Defined in `/app/globals.css`:
- `bg-primary` / `text-primary`
- `bg-secondary` / `text-secondary`
- `bg-destructive` / `text-destructive`
- `bg-muted` / `text-muted-foreground`

## Data Fetching

### Simple GET Request

```tsx
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const { data, isLoading, error } = useQuery({
  queryKey: ['key'],
  queryFn: async () => {
    const response = await api.endpoint();
    return response.data.data;
  },
});

if (isLoading) return <div>Loading...</div>;
if (error) return <div>Error!</div>;
return <div>{data}</div>;
```

### POST/PUT/DELETE with Mutation

```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const queryClient = useQueryClient();

const mutation = useMutation({
  mutationFn: async (data) => {
    const response = await api.endpoint(data);
    return response.data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['key'] });
    toast.success('Success!');
  },
  onError: (error) => {
    toast.error('Failed!');
  },
});

// Use it
<button onClick={() => mutation.mutate({ data })}>
  Submit
</button>
```

## Forms

### Simple Form with Validation

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const schema = z.object({
  name: z.string().min(3, 'Name too short'),
  email: z.string().email('Invalid email'),
});

type FormData = z.infer<typeof schema>;

const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
  resolver: zodResolver(schema),
});

const onSubmit = (data: FormData) => {
  console.log(data);
};

<form onSubmit={handleSubmit(onSubmit)}>
  <input {...register('name')} />
  {errors.name && <span>{errors.name.message}</span>}

  <input {...register('email')} />
  {errors.email && <span>{errors.email.message}</span>}

  <button type="submit">Submit</button>
</form>
```

## Dialogs/Modals

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const [open, setOpen] = useState(false);

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>Dialog description</DialogDescription>
    </DialogHeader>
    <div>Dialog content here</div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
      <Button onClick={() => setOpen(false)}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Notifications

```tsx
import { toast } from 'sonner';

// Success
toast.success('Operation successful!');

// Error
toast.error('Something went wrong!');

// Info
toast.info('Information message');

// Warning
toast.warning('Warning message');

// Loading
const loadingToast = toast.loading('Processing...');
// Later dismiss it
toast.dismiss(loadingToast);
```

## Environment Variables

### Access in Code

```typescript
// Client-side only (must start with NEXT_PUBLIC_)
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
```

### Add New Variable

1. Add to `.env.local`:
```
NEXT_PUBLIC_NEW_VAR=value
```

2. Restart dev server:
```bash
npm run dev
```

## Troubleshooting

### "Port 3000 already in use"

```bash
# Run on different port
PORT=3001 npm run dev
```

### "Cannot connect to API"

1. Check backend is running: `curl http://localhost:3000/health`
2. Check `.env.local` has correct API URL
3. Check CORS settings in backend

### "Module not found"

```bash
# Reinstall dependencies
rm -rf node_modules .next
npm install
```

### "TypeScript errors"

```bash
# Check types
npm run type-check
```

### "Build fails"

```bash
# Try clean build
rm -rf .next
npm run build
```

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm start                # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run type-check       # TypeScript check

# Maintenance
rm -rf node_modules      # Remove dependencies
npm install              # Install dependencies
rm -rf .next             # Clear build cache
```

## Common Patterns

### Protected Admin Route

Already handled by layout! Just create page in `/app/(admin)/admin/`

### Pagination

```tsx
const [page, setPage] = useState(1);

const { data } = useQuery({
  queryKey: ['items', page],
  queryFn: async () => {
    const response = await api.getItems(page, 10);
    return response.data.data;
  },
});

<button onClick={() => setPage(page - 1)} disabled={page === 1}>
  Previous
</button>
<button onClick={() => setPage(page + 1)}>
  Next
</button>
```

### Search with Debounce

```tsx
import { useState, useEffect } from 'react';

const [search, setSearch] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');

useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(search);
  }, 500);
  return () => clearTimeout(timer);
}, [search]);

const { data } = useQuery({
  queryKey: ['items', debouncedSearch],
  queryFn: async () => {
    const response = await api.search(debouncedSearch);
    return response.data.data;
  },
});
```

### File Download

```tsx
const handleDownload = async (id, filename) => {
  try {
    const response = await api.download(id);
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success('Downloaded successfully');
  } catch (error) {
    toast.error('Download failed');
  }
};
```

## Keyboard Shortcuts

In development:
- **Ctrl + C** - Stop dev server
- **Ctrl + Shift + R** - Hard refresh browser
- **F12** - Open browser DevTools

## Useful URLs

- **App:** http://localhost:3000
- **Backend API:** http://localhost:3000/api
- **Backend Health:** http://localhost:3000/health

## Getting Help

1. Check browser console for errors (F12)
2. Check terminal for build errors
3. Check Network tab for API calls
4. Review backend logs
5. Check this documentation
6. Check README.md for detailed info

## Quick Checklist

Before committing:
- [ ] No console errors
- [ ] TypeScript compiles (`npm run type-check`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Features work as expected
- [ ] Responsive on mobile
- [ ] Error states handled

Before deploying:
- [ ] Environment variables set
- [ ] Backend URL correct
- [ ] Build succeeds
- [ ] Test all features
- [ ] Check performance
- [ ] Verify security
- [ ] Test on different browsers

---

**Need more help?** Check README.md or SETUP.md for detailed documentation.
