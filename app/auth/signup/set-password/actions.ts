'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../src/utils/supabase/server' // Updated path

export async function completeSignup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;

  const params = new URLSearchParams();
  if (email) params.set('email', email);
  if (firstName) params.set('firstName', firstName);
  if (lastName) params.set('lastName', lastName);

  if (!email || !password || !firstName || !lastName) {
    console.error('CompleteSignup: Missing form data');
    return redirect('/auth/signup?message=Something went wrong, please start over.'); // Updated path
  }

  if (password.length < 6) {
    params.set('message', 'Password must be at least 6 characters long');
    // Redirect back to new set-password path
    return redirect(`/auth/signup/set-password?${params.toString()}`);
  }

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
    } else if (error.message.includes('weak password')) {
        errorMessage = 'Password is too weak. Please choose a stronger one.';
    }
    params.set('message', errorMessage);
    // Redirect back to new set-password path
    return redirect(`/auth/signup/set-password?${params.toString()}`);
  }

  revalidatePath('/', 'layout')
  // Redirect to the projects page after successful account creation
  // We might want to add a success message query param later
  redirect('/projects');
} 