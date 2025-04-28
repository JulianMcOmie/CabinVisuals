'use server'

import { createClient } from '../../../src/utils/supabase/server' // Use relative path
import { redirect } from 'next/navigation'

/**
 * Signs the user out and redirects them.
 * @param redirectTo - The path to redirect to after logout. Defaults to '/'.
 */
export async function logout(redirectTo: string = '/') { // Accept redirectTo argument
  console.log(`Executing logout server action. Redirecting to: ${redirectTo}`);
  const supabase = await createClient();
  
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error logging out:', error.message);
    // Still redirect even on error, but maybe log it or add a query param
  } else {
    console.log("Successfully signed out.");
  }

  // Redirect to the login page after sign out, regardless of error (best practice)
  // Use the public-facing login route
  redirect('/projects'); 
} 