# Profile Page Issues & Fixes

**Date**: 2025-10-15 20:05 UTC
**Status**: Investigating

## 🐛 Issues Reported

### Issue 1: Edit Profile Button - Fields Not Becoming Editable
**Problem**: When clicking "Edit Profile" button, the username and email fields remain grayed out (disabled).

**Investigation**:
Checked [frontend/app/(dashboard)/profile/page.tsx](frontend/app/(dashboard)/profile/page.tsx):
- Line 130: `disabled={!isEditingProfile || updateProfileMutation.isPending}`
- Line 146: `disabled={!isEditingProfile || updateProfileMutation.isPending}`

The logic is correct - fields should become enabled when `isEditingProfile` is `true`.

**Possible Causes**:
1. **CSS Override**: TailwindCSS or custom CSS might be overriding the `disabled` state styling
2. **Input Component Issue**: The shadcn/ui Input component might not properly handle disabled state
3. **State Not Updating**: The `isEditingProfile` state might not be updating correctly

### Issue 2: Change Password - Password Not Updating
**Problem**: After entering passwords and clicking submit, the password doesn't actually change.

**Investigation**:
Checked backend API [src/controllers/userController.js:123-164](src/controllers/userController.js#L123-L164):
- Backend expects `oldPassword` and `newPassword`
- Frontend API correctly maps `currentPassword` → `oldPassword` (line 73 in api.ts)
- Password is properly hashed with bcrypt (line 146)
- Password update calls `User.updatePassword()` (line 149)

**API Flow**:
```
Frontend → changePasswordMutation.mutate(data)
         → api.user.changePassword(currentPassword, newPassword)
         → PUT /api/users/password { oldPassword, newPassword }
         → Backend verifies old password
         → Hashes new password with bcrypt
         → Updates password in database
```

**Possible Causes**:
1. **Current Password Incorrect**: User entering wrong current password
2. **Backend Error**: Database update failing silently
3. **Success Message Misleading**: Shows success but update didn't happen
4. **Password Already Same**: Trying to change to same password

### Issue 3: Docker Socket Permission Errors (Secondary Issue)
**Problem**: Backend logs show Docker socket permission errors during auto-sync.

**Error**:
```
Error: connect EACCES /var/run/docker.sock
errno: -13
code: EACCES
syscall: connect
address: /var/run/docker.sock
```

**Analysis**: This is expected! The backend container doesn't need Docker socket access because:
- Profile downloads use the **profile proxy service** (running on host)
- Proxy service has Docker access and executes `sacli` commands
- Backend communicates with proxy via HTTP

**Impact**:
- ❌ Auto-sync scheduler fails (tries to sync users automatically)
- ✅ Profile downloads work fine (use proxy)
- ✅ Manual user sync works (via scripts)

---

## 🔍 Diagnosis Steps

### Step 1: Test Profile Edit Functionality

#### Open Browser DevTools (F12)
1. Navigate to http://localhost:3002/profile
2. Open Console and Network tabs
3. Click "Edit Profile" button
4. Check console for JavaScript errors
5. Inspect element to see if `disabled` attribute is removed

#### Expected Behavior:
- Button text changes from "Edit Profile" to "Save Changes" + "Cancel"
- Input fields should have `disabled` attribute removed
- Fields should become editable (not grayed out)

#### If Fields Still Disabled:
Check element inspector:
```html
<!-- Should be: -->
<input id="username" ... /> <!-- NO disabled attribute -->

<!-- If you see: -->
<input id="username" disabled ... /> <!-- Still has disabled -->
```

This indicates a React state issue.

### Step 2: Test Password Change

#### In Browser:
1. Click "Change Password" button
2. Fill in all three fields:
   - Current Password: `admin123`
   - New Password: `newpassword123`
   - Confirm New Password: `newpassword123`
3. Open Network tab (F12)
4. Click "Change Password" button
5. Watch for API request

#### Expected Network Request:
```
PUT /api/users/password
Status: 200 OK
Request Payload:
{
  "oldPassword": "admin123",
  "newPassword": "newpassword123"
}
Response:
{
  "success": true,
  "message": "Password changed successfully"
}
```

#### If Request Fails:
Check response:
- Status 401: Current password incorrect
- Status 400: Same password error or validation error
- Status 500: Server error

#### Test New Password:
1. Logout
2. Try logging in with new password
3. If login fails, password didn't change

---

## 🔧 Potential Fixes

### Fix 1: Profile Edit Button - CSS Override Issue

If fields stay grayed out despite disabled attribute being removed, add explicit styling:

**File**: `frontend/app/(dashboard)/profile/page.tsx`

```typescript
// Add this CSS class
const inputClassName = cn(
  "transition-all duration-200",
  isEditingProfile && !updateProfileMutation.isPending
    ? "bg-background cursor-text opacity-100"
    : "bg-muted cursor-not-allowed opacity-60"
);

// Then use it:
<Input
  id="username"
  {...profileForm.register('username')}
  disabled={!isEditingProfile || updateProfileMutation.isPending}
  className={inputClassName}
/>
```

### Fix 2: Force Re-render on State Change

Add a key to force component re-render:

```typescript
<Input
  key={`username-${isEditingProfile}`}
  id="username"
  {...profileForm.register('username')}
  disabled={!isEditingProfile || updateProfileMutation.isPending}
/>
```

### Fix 3: Password Change - Add Better Error Handling

**File**: `frontend/app/(dashboard)/profile/page.tsx`

```typescript
const changePasswordMutation = useMutation({
  mutationFn: async (data: PasswordFormData) => {
    console.log('Changing password...', { currentPassword: '***', newPassword: '***' });
    const response = await api.user.changePassword(data.currentPassword, data.newPassword);
    console.log('Password change response:', response.data);
    return response.data;
  },
  onSuccess: (data) => {
    console.log('Password changed successfully:', data);
    passwordForm.reset();
    setIsChangingPassword(false);
    toast.success('Password changed successfully. Please login again with your new password.');
  },
  onError: (error: any) => {
    console.error('Password change error:', error);
    const errorMessage = error.response?.data?.message || 'Failed to change password';
    toast.error(errorMessage);

    // Show specific error if current password is wrong
    if (error.response?.status === 401) {
      passwordForm.setError('currentPassword', {
        message: 'Current password is incorrect'
      });
    }
  },
});
```

### Fix 4: Backend - Add More Logging

**File**: `src/controllers/userController.js`

```javascript
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    logger.info(`Password change request for user ${req.user.id}`);

    // Verify old password
    const isValidPassword = await User.verifyPassword(req.user.id, oldPassword);

    if (!isValidPassword) {
      logger.warn(`Invalid current password for user ${req.user.id}`);
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Check if new password is same as old password
    if (oldPassword === newPassword) {
      logger.warn(`User ${req.user.id} attempted to use same password`);
      return res.status(400).json({
        success: false,
        message: 'New password must be different from current password',
      });
    }

    // Hash the new password
    logger.info(`Hashing new password for user ${req.user.id}`);
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    logger.info(`Updating password in database for user ${req.user.id}`);
    const result = await User.updatePassword(req.user.id, hashedPassword);
    logger.info(`Password update result:`, { userId: req.user.id, affected: result });

    logger.info(`Password changed successfully for user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
    });
  }
};
```

---

## 🧪 Testing Procedure

### Test 1: Edit Profile

```bash
# 1. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

# Save the token from response

# 2. Get current profile
TOKEN="your_token_here"
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/users/profile

# 3. Update profile
curl -X PUT http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"newusername","email":"admin@example.com"}'

# Expected: 200 OK with updated profile
```

### Test 2: Change Password

```bash
# 1. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'

TOKEN="your_token_here"

# 2. Change password
curl -X PUT http://localhost:3000/api/users/password \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"oldPassword":"admin123","newPassword":"newpassword123"}'

# Expected: 200 OK with success message

# 3. Test new password by logging in
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"newpassword123"}'

# Expected: 200 OK with new token
```

---

## 🎯 Quick Fixes Summary

### For Profile Edit Issue:
1. **Check browser console** for JavaScript errors
2. **Inspect element** to verify disabled attribute is removed
3. If still grayed, it's a **CSS issue** - needs styling override
4. **Add explicit CSS classes** to handle enabled/disabled states

### For Password Change Issue:
1. **Test with API directly** (curl) to verify backend works
2. **Check network tab** in browser to see actual request/response
3. **Verify current password** is correct
4. **Check backend logs** to see where it's failing
5. **Add console.log** statements to track mutation flow

### For Docker Socket Issue:
**No fix needed!** This is expected behavior:
- Auto-sync can't run in backend container
- Profile downloads work via proxy service
- Manual sync works fine
- This doesn't affect profile download functionality

---

## 📋 Recommended Actions

### Immediate:
1. ✅ Test profile edit in browser with DevTools open
2. ✅ Test password change with correct current password
3. ✅ Check backend logs during password change attempt
4. ✅ Verify API requests in Network tab

### If Issues Persist:
1. 🔄 Rebuild frontend with added logging
2. 🔄 Update backend with enhanced logging
3. 🔄 Add CSS overrides for input disabled states
4. 🔄 Test with curl to isolate frontend vs backend issues

### Not Urgent:
- ⏸️ Docker socket error (doesn't affect profile downloads)
- ⏸️ Auto-sync scheduler (can use manual sync instead)

---

## 🤔 User Testing Required

Please test and report back:

### Edit Profile:
1. Click "Edit Profile" button
2. **What happens?**
   - Do fields turn white (editable)?
   - Do they stay gray (disabled)?
   - Any console errors?

### Change Password:
1. Enter current password: `admin123`
2. Enter new password: `Test123!@#`
3. Confirm new password: `Test123!@#`
4. Click "Change Password"
5. **What happens?**
   - Success message?
   - Error message?
   - What's the exact error?
6. Try logging out and back in with new password
7. **Does new password work?**

---

**Generated**: 2025-10-15 20:05 UTC
**Status**: Awaiting User Testing
**Next Steps**: User testing required to determine exact nature of issues
