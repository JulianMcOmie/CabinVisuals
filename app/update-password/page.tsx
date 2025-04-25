'use client'

import { useState, useEffect } from 'react'
import { updatePassword } from './actions'
import { createClient } from '../../src/utils/supabase/client' // Corrected path
import type { AuthChangeEvent, Session } from '@supabase/supabase-js' // Import types

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPage, setShowPage] = useState(false)

  useEffect(() => {
    // Supabase PKCE flow stores the session in the URL hash fragment
    // Check if the session is available after the client initializes
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (event: AuthChangeEvent, session: Session | null) => { // Add types
      if (event === 'PASSWORD_RECOVERY') {
        // This event confirms the user arrived via the password recovery link
        setShowPage(true)
      } else if (session) {
        // If there's already a normal session, maybe they don't need to be here?
        // Or maybe the recovery happened implicitly.
        // For now, let's allow the page if there's any session after potential recovery.
        setShowPage(true)
      }
      // If no session and not PASSWORD_RECOVERY, maybe show an error or redirect?
      // For simplicity, we'll just rely on the initial state (showPage=false)
      // Consider adding a timeout or explicit check if session *never* appears.
    })

    // Initial check in case the event fires before the listener is attached
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => { // Add type
      if (session) {
          // Check if we are in the middle of a password recovery flow
          const hashParams = new URLSearchParams(window.location.hash.substring(1)); // Remove #
          if (hashParams.has('access_token') && hashParams.get('type') === 'recovery') {
              console.log('Detected password recovery flow from URL hash.');
              setShowPage(true);
          } else {
              // User has a session but didn't come from recovery link? Maybe redirect?
              // console.log('User has session but not from recovery link.');
              // For now, allow access if they have any session.
              setShowPage(true);
          }
      } else {
           // Maybe show message 'Checking authentication...'? For now, just wait.
      }
    });

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!password) {
        setError('Password cannot be empty.');
        return;
    }
    // Add more complex password validation if needed

    setIsSubmitting(true)
    setMessage(null)
    setError(null)

    const result = await updatePassword(password);

    if (result?.error) {
      setError(result.error)
    } else {
      setMessage('Password updated successfully! You can now log in with your new password.')
      // Consider redirecting after a delay
      setTimeout(() => {
         window.location.href = '/login';
      }, 3000);
    }
    setIsSubmitting(false)
  }

  if (!showPage) {
     // Show loading state or a message indicating verification is happening
     return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <p>Verifying access...</p>
          {/* Optional: Add a spinner here */}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="w-full max-w-md rounded-lg bg-gray-900/50 p-8 shadow-md border border-gray-800">
        <h1 className="mb-6 text-center text-2xl font-bold text-white">
          Update Your Password
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-300"
            >
              New Password:
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-full border border-gray-700 bg-black/50 px-4 py-3 text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              placeholder="••••••••"
              disabled={isSubmitting || !!message}
            />
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-300"
            >
              Confirm New Password:
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-full border border-gray-700 bg-black/50 px-4 py-3 text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              placeholder="••••••••"
              disabled={isSubmitting || !!message}
            />
          </div>

          {message && (
            <p className="text-sm text-green-500">{message}</p>
          )}
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="pt-2">
            <button
              type="submit"
              className="w-full justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
              disabled={isSubmitting || !password || password !== confirmPassword || !!message}
            >
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 