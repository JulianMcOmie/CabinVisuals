'use client'

import { useState, useEffect, Suspense } from 'react'
import { updatePassword } from './actions'
import { createClient } from '../../../src/utils/supabase/client'
import Link from 'next/link';

function UpdatePasswordFormInternal() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPage, setShowPage] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowPage(true)
      } else if (session) {
        setShowPage(true)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          if (hashParams.has('access_token') && hashParams.get('type') === 'recovery') {
              setShowPage(true);
          } else {
             // User has session but didn't come from recovery link? Allow for now.
             setShowPage(true);
          }
      }
    });

    return () => { subscription.unsubscribe() }
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (password !== confirmPassword) {
      setError('Passwords do not match.'); return;
    }
    if (password.length < 6) {
        setError('Password must be at least 6 characters long.'); return;
    }
    setIsSubmitting(true); setMessage(null); setError(null);

    const result = await updatePassword(password);

    if (result?.error) {
      setError(result.error)
    } else {
      setMessage('Password updated successfully! You will be redirected to login shortly.')
      setTimeout(() => {
         // Redirect to new login path
         window.location.href = '/login';
      }, 3000);
    }
    setIsSubmitting(false)
  }

  if (!showPage) {
     return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white"><p>Verifying access...</p></div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="w-full max-w-md rounded-lg bg-gray-900/50 p-8 shadow-md border border-gray-800">
        <h1 className="mb-6 text-center text-2xl font-bold text-white">Update Your Password</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">New Password (min. 6 characters)</label>
            <input id="password" name="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full rounded-full border border-gray-700 bg-black/50 px-4 py-3 text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm placeholder-gray-500" placeholder="Enter new password" disabled={isSubmitting || !!message} />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">Confirm New Password</label>
            <input id="confirmPassword" name="confirmPassword" type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 block w-full rounded-full border border-gray-700 bg-black/50 px-4 py-3 text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm placeholder-gray-500" placeholder="Confirm new password" disabled={isSubmitting || !!message} />
          </div>

          {message && ( <p className="text-sm text-green-500">{message}</p> )}
          {error && ( <p className="text-sm text-red-500">{error}</p> )}

          <div className="pt-2">
            <button type="submit" className="w-full justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50" disabled={isSubmitting || !password || password !== confirmPassword || password.length < 6 || !!message}>
              {isSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
        {!message && (
            <div className="mt-6 text-center text-sm">
                <Link href="/login" legacyBehavior>
                    <a className="font-medium text-indigo-400 hover:text-indigo-300">Cancel and go to Login</a>
                </Link>
            </div>
        )}
      </div>
    </div>
  );
}

export default function UpdatePasswordPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black text-white"><p>Loading...</p></div>}> 
            <UpdatePasswordFormInternal />
        </Suspense>
    );
} 