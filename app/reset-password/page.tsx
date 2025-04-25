'use client';

import { requestPasswordReset } from './actions';
import { useState } from 'react';

export default function ResetPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (formData: FormData) => {
    setMessage(null);
    setError(null);
    const result = await requestPasswordReset(formData);
    if (result?.error) {
      setError(result.error);
    } else {
      setMessage('Password reset email sent. Please check your inbox (and spam folder).');
      // Optionally clear the form or disable it
      const form = document.getElementById('reset-password-form') as HTMLFormElement;
      form?.reset();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="w-full max-w-md rounded-lg bg-gray-900/50 p-8 shadow-md border border-gray-800">
        <h1 className="mb-6 text-center text-2xl font-bold text-white">
          Reset Your Password
        </h1>

        <form id="reset-password-form" action={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300"
            >
              Enter your email address:
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-full border border-gray-700 bg-black/50 px-4 py-3 text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              placeholder="you@example.com"
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
            >
              Send Reset Link
            </button>
          </div>
        </form>
         <div className="mt-6 text-center text-sm">
          <a href="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
} 