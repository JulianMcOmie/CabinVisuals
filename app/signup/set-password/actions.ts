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

  // Prepare params for potential redirect back with error
  const params = new URLSearchParams();
  if (email) params.set('email', email);
  if (firstName) params.set('firstName', firstName);
  if (lastName) params.set('lastName', lastName);

  // Re-validate essential data
  if (!email || !password || !firstName || !lastName) {
    console.error('CompleteSignup: Missing form data');
    return redirect('/signup?message=Something went wrong, please start over.');
  }

  // Validate password length
  if (password.length < 6) {
    params.set('message', 'Password must be at least 6 characters long');
    return redirect(`/signup/set-password?${params.toString()}`);
  }

  // Call Supabase signup with user metadata
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
      },
    },
  });

  if (error) {
    console.error('CompleteSignup Error:', error.message);
    let errorMessage = 'Could not create account. Please try again.';
    if (error.message.includes('User already registered')) {
        errorMessage = 'An account with this email already exists. Please log in instead.';
        // Optionally redirect straight to login
        // return redirect(`/login?error=${encodeURIComponent(errorMessage)}`);
    } else if (error.message.includes('weak password')) {
        errorMessage = 'Password is too weak. Please choose a stronger one.';
    }
    params.set('message', errorMessage);
    return redirect(`/signup/set-password?${params.toString()}`);
  }

  // Signup successful
  revalidatePath('/', 'layout')
  // Redirect to login page with success message
  return redirect('/login?message=Account created! Please check your email to confirm your account.');
} 