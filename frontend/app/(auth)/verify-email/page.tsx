'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token');

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Verification token is missing');
        return;
      }

      try {
        const response = await api.auth.verifyEmail(token);

        if (response.data.success) {
          setStatus('success');
          setMessage('Your email has been verified successfully!');
          toast.success('Email verified! You can now login.');
        }
      } catch (err: any) {
        setStatus('error');
        const errorMessage = err.response?.data?.message || 'Email verification failed';
        setMessage(errorMessage);
        toast.error(errorMessage);
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-2">
          {status === 'loading' && (
            <div className="p-3 bg-blue-100 rounded-full">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
          )}
          {status === 'success' && (
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          )}
          {status === 'error' && (
            <div className="p-3 bg-red-100 rounded-full">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          )}
        </div>
        <CardTitle className="text-2xl text-center">
          {status === 'loading' && 'Verifying your email...'}
          {status === 'success' && 'Email verified!'}
          {status === 'error' && 'Verification failed'}
        </CardTitle>
        <CardDescription className="text-center">
          {message}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        {status === 'success' && (
          <Button onClick={() => router.push('/login')} className="w-full">
            Go to login
          </Button>
        )}
        {status === 'error' && (
          <Button onClick={() => router.push('/register')} className="w-full">
            Back to registration
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
