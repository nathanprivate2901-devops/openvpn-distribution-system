'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, Key } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain uppercase, lowercase, and number'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [tokenStatus, setTokenStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');

  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Verify token on mount
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setTokenStatus('invalid');
        return;
      }

      try {
        await api.auth.verifyResetToken(token);
        setTokenStatus('valid');
      } catch (error) {
        setTokenStatus('invalid');
      }
    };

    verifyToken();
  }, [token]);

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordFormData) => {
      if (!token) throw new Error('No reset token');
      const response = await api.auth.resetPassword(token, data.newPassword);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Password reset successfully! Redirecting to login...');
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to reset password';
      toast.error(errorMessage);
    },
  });

  if (tokenStatus === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Verifying reset token...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tokenStatus === 'invalid') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <XCircle className="h-12 w-12 text-destructive" />
            </div>
            <CardTitle>Invalid or Expired Link</CardTitle>
            <CardDescription>
              This password reset link is invalid or has expired
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>
                Password reset links expire after 1 hour. Please request a new reset link.
              </AlertDescription>
            </Alert>
            <div className="mt-6 space-y-2">
              <Link href="/forgot-password" className="block">
                <Button className="w-full" variant="default">
                  Request New Reset Link
                </Button>
              </Link>
              <Link href="/login" className="block">
                <Button className="w-full" variant="outline">
                  Back to Login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (resetPasswordMutation.isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle>Password Reset Successful!</CardTitle>
            <CardDescription>
              Your password has been reset successfully
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                You can now log in with your new password. Redirecting to login page...
              </AlertDescription>
            </Alert>
            <Link href="/login" className="block mt-4">
              <Button className="w-full">
                Go to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Key className="h-12 w-12 text-primary" />
          </div>
          <CardTitle>Reset Your Password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={resetPasswordForm.handleSubmit((data) => resetPasswordMutation.mutate(data))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password"
                {...resetPasswordForm.register('newPassword')}
                disabled={resetPasswordMutation.isPending}
              />
              {resetPasswordForm.formState.errors.newPassword && (
                <p className="text-sm text-destructive">
                  {resetPasswordForm.formState.errors.newPassword.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Password must be at least 8 characters and contain uppercase, lowercase, and numbers
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                {...resetPasswordForm.register('confirmPassword')}
                disabled={resetPasswordMutation.isPending}
              />
              {resetPasswordForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {resetPasswordForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={resetPasswordMutation.isPending}
            >
              {resetPasswordMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resetting Password...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>

            <div className="text-center mt-4">
              <Link href="/login" className="text-sm text-primary hover:underline">
                Back to Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
