'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
        <p className="mt-4 text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
