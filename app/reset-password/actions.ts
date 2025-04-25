'use server'

import { createClient } from '../../src/utils/supabase/server'
import { headers } from 'next/headers'

export async function requestPasswordReset(formData: FormData) {
  const email = formData.get('email') as string;
  const supabase = await createClient()
  const headersList = await headers(); // Await the headers
  const origin = headersList.get('origin'); // Get the origin URL (e.g., http://localhost:3000)

  // Validate email (basic)
  if (!email || typeof email !== 'string') {
    return { error: 'Invalid email address.' };
  }

  // Ensure origin is available for constructing the redirect URL
  if (!origin) {
    console.error('Could not determine origin URL for password reset redirect.');
    return { error: 'Server configuration error. Could not send reset link.' };
  }

  // Construct the redirect URL based on the current deployment origin
  const redirectUrl = `${origin}/update-password`;

  console.log(`Requesting password reset for ${email} with redirect to ${redirectUrl}`);

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectUrl,
  });

  if (error) {
    console.error('Supabase password reset error:', error.message);
    // Provide a generic error message to the user
    return { error: 'Failed to send password reset email. Please try again later.' };
  }

  console.log('Password reset email requested successfully.');
  // Return success indication (no error)
  return { error: null };
} 