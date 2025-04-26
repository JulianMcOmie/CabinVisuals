'use server'

import { createClient } from '../../../src/utils/supabase/server' // Updated path
import { headers } from 'next/headers'
import { redirect } from 'next/navigation' // Import redirect

export async function requestPasswordReset(formData: FormData) {
  const email = formData.get('email') as string;
  const supabase = await createClient()
  const headersList = await headers();
  const origin = headersList.get('origin');

  if (!email || typeof email !== 'string') {
    // Don't redirect, return error object for client-side display
    return { error: 'Invalid email address.' };
  }

  if (!origin) {
    console.error('Could not determine origin URL for password reset redirect.');
    return { error: 'Server configuration error. Could not send reset link.' };
  }

  // Construct the redirect URL for the update password page (now nested under /auth)
  const redirectUrl = `${origin}/auth/update-password`;

  console.log(`Requesting password reset for ${email} with redirect to ${redirectUrl}`);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });

  if (error) {
    console.error('Supabase password reset error:', error.message);
    return { error: 'Failed to send password reset email. Please try again later.' };
  }

  console.log('Password reset email requested successfully.');
  return { error: null }; // Return success
} 