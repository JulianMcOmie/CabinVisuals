'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../src/utils/supabase/server'

// Renamed function
export async function initiateSignup(formData: FormData) {
  // No Supabase client needed here yet

  const email = formData.get('email') as string;
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;

  // Basic validation
  if (!email || !firstName || !lastName) {
    return redirect('/signup?message=Please fill in all fields.');
  }

  // More specific validation (example)
  if (typeof email !== 'string' || typeof firstName !== 'string' || typeof lastName !== 'string') {
      return redirect('/signup?message=Invalid form data.');
  }
  if (firstName.trim().length === 0 || lastName.trim().length === 0) {
       return redirect('/signup?message=First and last names cannot be empty.');
  }

  // --- Redirect to the password page --- 
  // Pass data via URL parameters
  const params = new URLSearchParams();
  params.set('email', email);
  params.set('firstName', firstName);
  params.set('lastName', lastName);

  // Redirect to the next step
  return redirect(`/signup/set-password?${params.toString()}`);
}
