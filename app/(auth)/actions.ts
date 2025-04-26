'use server'

import { createClient } from '../../src/utils/supabase/server' // Use relative path
import { redirect } from 'next/navigation'

/**
 * Signs the user out and redirects them to the login page.
 */
export async function logout() {
  console.log("Executing logout server action from app/(auth)/actions.ts...");
  const supabase = await createClient();
  
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error logging out:', error.message);
    // Optionally redirect with an error message, but usually just redirecting to login is fine
    // return redirect('/login?error=Could not log out'); 
  } else {
    console.log("Successfully signed out.");
  }

  // Redirect to the login page after sign out, regardless of error (best practice)
  redirect('/login'); 
}

// You can add other shared auth actions here later if needed
// (e.g., an action to update user metadata, etc.) 