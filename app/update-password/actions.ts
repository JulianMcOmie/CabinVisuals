'use server'

import { createClient } from '../../src/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function updatePassword(newPassword: string) {
  const supabase = await createClient()

  // Validate password (basic)
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      // Supabase might have its own length check, but adding one here is good practice.
      return { error: 'Password must be at least 6 characters long.' };
  }

  // The user should be authenticated at this point via the link
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    console.error('Supabase password update error:', error.message);
    // Check for specific errors if needed, e.g., weak password
    if (error.message.includes('weak password')) {
        return { error: 'Password is too weak. Please choose a stronger password.' };
    }
    return { error: 'Failed to update password. The reset link may have expired or been used already.' };
  }

  console.log('Password updated successfully via reset flow.');
  // Don't redirect here from the action, let the client-side handle it after showing a message.
  return { error: null };
}
