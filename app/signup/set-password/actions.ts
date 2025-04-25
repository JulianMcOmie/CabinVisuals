'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../../src/utils/supabase/server' // Adjusted path

export async function completeSignup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;

  // Re-validate essential data (belt and suspenders)
  if (!email || !password || !firstName || !lastName) {
    console.error('CompleteSignup: Missing form data');
    // Redirect back to start ideally, or show generic error
    return redirect('/signup?message=Something went wrong, please start over.');
  }

  // Validate password length
  if (password.length < 6) {
    // Redirect back to set-password page with error and existing data
    const params = new URLSearchParams();
    params.set('email', email);
    params.set('firstName', firstName);
    params.set('lastName', lastName);
    params.set('message', 'Password must be at least 6 characters long');
    return redirect(`/signup/set-password?${params.toString()}`);
  }

  // Call Supabase signup with user metadata
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName, // Supabase convention often uses snake_case for metadata
        last_name: lastName,
        // Add other metadata if needed
      },
    },
  });

  if (error) {
    console.error('CompleteSignup Error:', error.message);
    // Redirect back to set-password page with error and data
    const params = new URLSearchParams();
    params.set('email', email);
    params.set('firstName', firstName);
    params.set('lastName', lastName);
    // Provide a more specific error message if possible, otherwise generic
    let errorMessage = 'Could not create account. Please try again.';
    if (error.message.includes('User already registered')) {
        errorMessage = 'An account with this email already exists. Please log in.';
        // Maybe redirect to login instead?
        // return redirect(`/login?message=${encodeURIComponent(errorMessage)}`);
    }
    params.set('message', errorMessage);
    return redirect(`/signup/set-password?${params.toString()}`);
  }

  // Signup successful
  revalidatePath('/', 'layout') // Revalidate if needed
  // Redirect to login page with success message
  return redirect('/login?message=Account created! Please check your email to confirm your account.');
} 