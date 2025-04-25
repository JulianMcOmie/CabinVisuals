'use client';

import { completeSignup } from './actions';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';

function SetPasswordForm() {
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Read user details from URL - ensure they exist
  const email = searchParams.get('email');
  const firstName = searchParams.get('firstName');
  const lastName = searchParams.get('lastName');

  useEffect(() => {
    // Check for error messages passed back to this page
    const message = searchParams.get('message');
    if (message) {
      setErrorMessage(message);
      // Optional: Clear message from URL
      // const currentParams = new URLSearchParams(window.location.search);
      // currentParams.delete('message');
      // window.history.replaceState({}, '', `${window.location.pathname}?${currentParams.toString()}`);
    }

    // If essential data is missing, redirect back to start
    if (!email || !firstName || !lastName) {
      console.error('Missing user details on password page, redirecting.');
      // Use window.location for client-side redirect if needed before hydration
      if (typeof window !== 'undefined') {
         window.location.href = '/signup?message=Something went wrong, please try again.';
      }
    }

  }, [searchParams, email, firstName, lastName]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
     event.preventDefault();
     if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    setErrorMessage(null);

    // Manually create FormData and append hidden fields + password
    const formData = new FormData(event.currentTarget);
    formData.set('password', password); // Set explicitly from state
    // Append details read from URL params
    if (email) formData.set('email', email);
    if (firstName) formData.set('firstName', firstName);
    if (lastName) formData.set('lastName', lastName);

    // Call the server action with the constructed FormData
    completeSignup(formData);
  };

  // If essential data is missing, render minimally or null until redirect happens
  if (!email || !firstName || !lastName) {
      return (
         <div className="flex min-h-screen items-center justify-center bg-black text-white">
            <p>Loading...</p>
         </div>
      );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="w-full max-w-md rounded-lg bg-gray-900/50 p-8 shadow-md border border-gray-800">
        <h1 className="mb-2 text-center text-2xl font-bold text-white">
          Create Account - Step 2 of 2
        </h1>
        <p className="mb-6 text-center text-sm text-gray-400">Setting password for: {email}</p>

        {errorMessage && (
          <div className="mb-4 rounded border border-red-600 bg-red-900/30 p-3 text-center text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Hidden inputs might not be strictly necessary if passed in FormData construction */}
          {/* <input type="hidden" name="email" value={email || ''} />
          <input type="hidden" name="firstName" value={firstName || ''} />
          <input type="hidden" name="lastName" value={lastName || ''} /> */}
          
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-300"
            >
              Password (min. 6 characters):
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-full border border-gray-700 bg-black/50 px-4 py-3 text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              placeholder="••••••••"
            />
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-300"
            >
              Confirm Password:
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-full border border-gray-700 bg-black/50 px-4 py-3 text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              placeholder="••••••••"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
              disabled={!password || !confirmPassword || password !== confirmPassword || password.length < 6}
            >
              Complete Sign Up
            </button>
          </div>
        </form>

         {/* Optional: Link back to start? */}
         <div className="mt-6 text-center text-sm">
           <Link href="/signup" legacyBehavior>
             <a className="font-medium text-indigo-400 hover:text-indigo-300">
               Back to Step 1
             </a>
           </Link>
         </div>

      </div>
    </div>
  );
}

// Wrap the component in Suspense because useSearchParams() needs it
export default function SetPasswordPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}> 
            <SetPasswordForm />
        </Suspense>
    );
} 