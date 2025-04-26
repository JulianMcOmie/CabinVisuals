'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '../../../src/utils/supabase/server' // Updated path

export async function login(formData: FormData) {
  const supabase = await createClient()
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    console.error("Login Error:", error.message);
    // Redirect back to new login path with error
    return redirect('/auth/login?error=Could not authenticate user');
  }

  revalidatePath('/', 'layout')
  // Redirect to the alpha page after successful email/password login
  redirect('/alpha');
}

export async function handleSignInWithGoogle(idToken: string) {
  const supabase = await createClient()

  if (!idToken) {
    console.error("handleSignInWithGoogle called without an ID token!");
    // Redirect back to new login path with error
    return redirect('/auth/login?error=Google sign-in failed: No token received.');
  }

  console.log("Attempting signInWithIdToken...");
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });

  if (error) {
    console.error("signInWithIdToken error:", error);
    // Redirect back to new login path with error
    return redirect('/auth/login?error=Could not authenticate with Google.');
  }

  console.log("signInWithIdToken success!");
  revalidatePath('/', 'layout')
  // Redirect to the alpha page after successful Google Sign-In
  redirect('/alpha');
} 