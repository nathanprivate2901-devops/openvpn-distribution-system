'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, MailIcon, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');

  const forgotPasswordForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordFormData) => {
      const response = await api.auth.forgotPassword(data.email);
      return response.data;
    },
    onSuccess: (data, variables) => {
      setSentEmail(variables.email);
      setEmailSent(true);
      toast.success('Password reset email sent!');
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to send reset email';
      toast.error(errorMessage);
    },
  });

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle>Check Your Email</CardTitle>
            <CardDescription>
              We've sent password reset instructions to your email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <MailIcon className="h-4 w-4" />
              <AlertDescription>
                If an account exists for <strong>{sentEmail}</strong>, you will receive a password reset link shortly.
              </AlertDescription>
            </Alert>

            <div className="mt-6 space-y-4">
              <div className="text-sm text-muted-foreground text-center">
                <p className="mb-2">Didn't receive the email?</p>
                <ul className="list-disc text-left ml-6 space-y-1">
                  <li>Check your spam folder</li>
                  <li>Make sure you entered the correct email address</li>
                  <li>The link will expire in 1 hour</li>
                </ul>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setEmailSent(false);
                  forgotPasswordForm.reset();
                }}
              >
                Try Different Email
              </Button>

              <div className="text-center">
                <Link href="/login" className="text-sm text-primary hover:underline">
                  Back to Login
                </Link>
              </div>
            </div>
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
            <MailIcon className="h-12 w-12 text-primary" />
          </div>
          <CardTitle>Forgot Password?</CardTitle>
          <CardDescription>
            Enter your email address and we'll send you a link to reset your password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={forgotPasswordForm.handleSubmit((data) => forgotPasswordMutation.mutate(data))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                {...forgotPasswordForm.register('email')}
                disabled={forgotPasswordMutation.isPending}
                autoComplete="email"
                autoFocus
              />
              {forgotPasswordForm.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {forgotPasswordForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={forgotPasswordMutation.isPending}
            >
              {forgotPasswordMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending Reset Link...
                </>
              ) : (
                <>
                  <MailIcon className="mr-2 h-4 w-4" />
                  Send Reset Link
                </>
              )}
            </Button>

            <div className="space-y-2 text-center">
              <Link href="/login" className="text-sm text-primary hover:underline block">
                Back to Login
              </Link>
              <p className="text-sm text-muted-foreground">
                Don't have an account?{' '}
                <Link href="/register" className="text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
