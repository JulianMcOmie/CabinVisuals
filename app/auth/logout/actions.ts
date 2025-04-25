'use server'

import { createClient } from '../../../src/utils/supabase/server' // Use relative path
import { redirect } from 'next/navigation'

export async function logout() {
  console.log("Executing logout server action...");
  const supabase = await createClient();
  
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error logging out:', error.message);
    // Optionally redirect with an error message, but usually just redirecting to login is fine
    // return redirect('/?error=Could not log out');
  } else {
    console.log("Successfully signed out.");
  }

  // Redirect to the login page after sign out, regardless of error (best practice)
  // Use the public-facing login route
  redirect('/login'); 
} 