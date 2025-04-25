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
    redirect('/error')
  }

  revalidatePath('/', 'layout')
  redirect('/')
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
export async function handleSignInWithGoogle(idToken: string) { // Accept idToken: string
  const supabase = await createClient()

  if (!idToken) { // Add check for token
    console.error("handleSignInWithGoogle called without an ID token!");
    redirect('/login?message=Google sign-in failed: No token received.');
  }

  console.log("Attempting signInWithIdToken..."); // Add logging
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken, // Use the idToken parameter
  });

  if (error) {
    console.error("signInWithIdToken error:", error); // Add logging
    redirect('/login?message=Could not authenticate with Google.'); // Redirect on error
  }

  console.log("signInWithIdToken success!"); // Add logging
  revalidatePath('/', 'layout')
  redirect('/') // Redirect on success
}