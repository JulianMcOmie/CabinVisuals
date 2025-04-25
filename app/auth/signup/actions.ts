'use server'

import { redirect } from 'next/navigation'

export async function initiateSignup(formData: FormData) {
  const email = formData.get('email') as string;
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;

  if (!email || !firstName || !lastName) {
    return redirect('/auth/signup?message=Please fill in all fields.'); // Updated path
  }
  if (typeof email !== 'string' || !email.includes('@')) {
      return redirect('/auth/signup?message=Please enter a valid email address.'); // Updated path
  }
  if (typeof firstName !== 'string' || firstName.trim().length === 0 ||
      typeof lastName !== 'string' || lastName.trim().length === 0) {
       return redirect('/auth/signup?message=First and last names cannot be empty.'); // Updated path
  }

  const params = new URLSearchParams();
  params.set('email', email.trim());
  params.set('firstName', firstName.trim());
  params.set('lastName', lastName.trim());

  // Redirect to the new password page path
  return redirect(`/auth/signup/set-password?${params.toString()}`);
} 