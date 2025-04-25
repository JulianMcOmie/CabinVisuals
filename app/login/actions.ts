'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '../../src/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    console.error("Login Error:", error.message); // Log error
    // Redirect back to login with an error message
    return redirect('/login?error=Could not authenticate user');
  }

  revalidatePath('/', 'layout') // Or specific path like '/alpha'
  redirect('/'); // Redirect to main app page (e.g., '/' or '/alpha')
}

// export async function handleSignInWithGoogle(response: any) {
//   const supabase = await createClient()
//   const { data, error } = await supabase.auth.signInWithIdToken({
//     provider: 'google',
//     token: response.credential,
//   })
  
//   if (error) {
//     redirect('/error')
//   }

//   revalidatePath('/', 'layout')
//   redirect('/')
// }

// Use the correct version that accepts the ID token from GSI
export async function handleSignInWithGoogle(idToken: string) {
  const supabase = await createClient()

  if (!idToken) {
    console.error("handleSignInWithGoogle called without an ID token!");
    // Redirect back to login with an error message
    return redirect('/login?error=Google sign-in failed: No token received.');
  }

  console.log("Attempting signInWithIdToken...");
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
  });

  if (error) {
    console.error("signInWithIdToken error:", error);
    // Redirect back to login with an error message
    return redirect('/login?error=Could not authenticate with Google.');
  }

  console.log("signInWithIdToken success!");
  revalidatePath('/', 'layout') // Or specific path like '/alpha'
  redirect('/'); // Redirect to main app page (e.g., '/' or '/alpha')
}