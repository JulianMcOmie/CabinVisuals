'use client';

import { completeSignup } from './actions';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';

function SetPasswordFormInternal() {
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const email = searchParams.get('email');
  const firstName = searchParams.get('firstName');
  const lastName = searchParams.get('lastName');

  useEffect(() => {
    const message = searchParams.get('message');
    if (message) setErrorMessage(message);
    if (!email || !firstName || !lastName) {
      console.error('Missing user details on password page, redirecting.');
      if (typeof window !== 'undefined') {
         window.location.href = '/signup?message=Something went wrong, please try again.';
      }
    }
  }, [searchParams, email, firstName, lastName]);

  const handleFormSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      setIsSubmitting(false);
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      setIsSubmitting(false);
      return;
    }
    formData.set('email', email || '');
    formData.set('firstName', firstName || '');
    formData.set('lastName', lastName || '');
    await completeSignup(formData);
    setIsSubmitting(false);
  };

  if (!email || !firstName || !lastName) {
      return (<div className="flex min-h-screen items-center justify-center bg-black text-white"><p>Loading...</p></div>);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="w-full max-w-md rounded-lg bg-gray-900/50 p-8 shadow-md border border-gray-800">
        <h1 className="mb-2 text-center text-2xl font-bold text-white">Sign Up</h1>
        <p className="mb-6 text-center text-sm text-gray-400">Setting password for: {email}</p>
        {errorMessage && ( <div className="mb-4 rounded border border-red-600 bg-red-900/30 p-3 text-center text-sm text-red-300">{errorMessage}</div> )}
        <form action={handleFormSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300">Create Password (min. 6 characters)</label>
            <input id="password" name="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full rounded-full border border-gray-700 bg-black/50 px-4 py-3 text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm placeholder-gray-500" placeholder="Create password" disabled={isSubmitting} />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">Confirm Password</label>
            <input id="confirmPassword" name="confirmPassword" type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 block w-full rounded-full border border-gray-700 bg-black/50 px-4 py-3 text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm placeholder-gray-500" placeholder="Confirm password" disabled={isSubmitting} />
          </div>
          <div className="pt-2">
            <button type="submit" className="w-full justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50" disabled={isSubmitting || !password || !confirmPassword || password !== confirmPassword || password.length < 6}>
              {isSubmitting ? 'Creating Account...' : 'Complete Sign Up'}
            </button>
          </div>
        </form>
        <div className="mt-6 text-center text-sm">
           <Link href="/signup" legacyBehavior>
             <a className="font-medium text-indigo-400 hover:text-indigo-300">&lt; Back</a>
           </Link>
        </div>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black text-white"><p>Loading...</p></div>}> 
            <SetPasswordFormInternal />
        </Suspense>
    );
} 