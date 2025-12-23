'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { User, Lock, Loader2, Mail, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';

const profileSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Password must be at least 6 characters'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { user: currentUser, setUser } = useAuthStore();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [formInitialized, setFormInitialized] = useState(false);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await api.user.getProfile();
      return response.data.data;
    },
  });

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    mode: 'onSubmit', // Only validate on submit, not on change/blur
    defaultValues: {
      username: '',
      email: '',
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  // Initialize form values ONLY ONCE when profile data first loads
  useEffect(() => {
    if (profileData && !formInitialized) {
      profileForm.reset({
        username: profileData.username || '',
        email: profileData.email || '',
      });
      setFormInitialized(true);
    }
  }, [profileData, formInitialized, profileForm]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await api.user.updateProfile(data);
      return response.data;
    },
    onSuccess: (data) => {
      // Update the form values without refetching
      if (data.data) {
        setUser(data.data);
        profileForm.reset({
          username: data.data.username || '',
          email: data.data.email || '',
        });
      }
      setIsEditingProfile(false);
      toast.success('Profile updated successfully');
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to update profile';
      toast.error(errorMessage);
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      const response = await api.user.changePassword(data.currentPassword, data.newPassword);
      return response.data;
    },
    onSuccess: () => {
      passwordForm.reset();
      setIsChangingPassword(false);
      toast.success('Password changed successfully');
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to change password';
      toast.error(errorMessage);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground">Manage your account information</p>
      </div>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Account Information</span>
          </CardTitle>
          <CardDescription>View and update your account details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                {...profileForm.register('username')}
                disabled={!isEditingProfile || updateProfileMutation.isPending}
                style={isEditingProfile && !updateProfileMutation.isPending ? {
                  backgroundColor: 'hsl(var(--background))',
                  opacity: 1,
                  cursor: 'text'
                } : undefined}
              />
              {profileForm.formState.errors.username && (
                <p className="text-sm text-destructive">
                  {profileForm.formState.errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="email"
                  type="email"
                  {...profileForm.register('email')}
                  disabled={!isEditingProfile || updateProfileMutation.isPending}
                  style={isEditingProfile && !updateProfileMutation.isPending ? {
                    backgroundColor: 'hsl(var(--background))',
                    opacity: 1,
                    cursor: 'text'
                  } : undefined}
                />
                {profileData?.email_verified && (
                  <Badge variant="default" className="shrink-0">Verified</Badge>
                )}
              </div>
              {profileForm.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {profileForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Label>Role</Label>
              <Badge variant={profileData?.role === 'admin' ? 'default' : 'secondary'}>
                {profileData?.role}
              </Badge>
            </div>

            <div className="flex space-x-2 pt-4">
              {isEditingProfile ? (
                <>
                  <Button
                    type="button"
                    onClick={() => {
                      profileForm.handleSubmit((data) => {
                        updateProfileMutation.mutate(data);
                      })();
                    }}
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsEditingProfile(false);
                      profileForm.reset();
                    }}
                    disabled={updateProfileMutation.isPending}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={() => setIsEditingProfile(true)}>
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lock className="h-5 w-5" />
            <span>Change Password</span>
          </CardTitle>
          <CardDescription>Update your password to keep your account secure</CardDescription>
        </CardHeader>
        <CardContent>
          {!isChangingPassword ? (
            <Button onClick={() => setIsChangingPassword(true)}>
              Change Password
            </Button>
          ) : (
            <form onSubmit={passwordForm.handleSubmit((data) => changePasswordMutation.mutate(data))} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  {...passwordForm.register('currentPassword')}
                  disabled={changePasswordMutation.isPending}
                />
                {passwordForm.formState.errors.currentPassword && (
                  <p className="text-sm text-destructive">
                    {passwordForm.formState.errors.currentPassword.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  {...passwordForm.register('newPassword')}
                  disabled={changePasswordMutation.isPending}
                />
                {passwordForm.formState.errors.newPassword && (
                  <p className="text-sm text-destructive">
                    {passwordForm.formState.errors.newPassword.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  {...passwordForm.register('confirmPassword')}
                  disabled={changePasswordMutation.isPending}
                />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">
                    {passwordForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <div className="flex space-x-2">
                <Button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                >
                  {changePasswordMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Changing...
                    </>
                  ) : (
                    'Change Password'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsChangingPassword(false);
                    passwordForm.reset();
                  }}
                  disabled={changePasswordMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

 
