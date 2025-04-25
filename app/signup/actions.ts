'use server'

import { redirect } from 'next/navigation'
// No Supabase client needed here

export async function initiateSignup(formData: FormData) {
  const email = formData.get('email') as string;
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;

  // Basic validation
  if (!email || !firstName || !lastName) {
    return redirect('/signup?message=Please fill in all fields.');
  }
  if (typeof email !== 'string' || !email.includes('@')) { // Basic email format check
      return redirect('/signup?message=Please enter a valid email address.');
  }
  if (typeof firstName !== 'string' || firstName.trim().length === 0 ||
      typeof lastName !== 'string' || lastName.trim().length === 0) {
       return redirect('/signup?message=First and last names cannot be empty.');
  }

  // Redirect to the password page, passing data via URL parameters
  const params = new URLSearchParams();
  params.set('email', email.trim());
  params.set('firstName', firstName.trim());
  params.set('lastName', lastName.trim());

  return redirect(`/signup/set-password?${params.toString()}`);
} 