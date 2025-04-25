'use client';

import { initiateSignup } from './actions';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation'; // To read URL query parameters
import { useEffect, useState } from 'react';

export default function SignupPage() {
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check for error messages passed in the URL
    const message = searchParams.get('message');
    if (message) {
      setErrorMessage(message);
      // Optional: Clear the message from the URL without reloading
      // window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="w-full max-w-md rounded-lg bg-gray-900/50 p-8 shadow-md border border-gray-800">
        <h1 className="mb-6 text-center text-2xl font-bold text-white">
          Create Account - Step 1 of 2
        </h1>

        {/* Display Error Message */} 
        {errorMessage && (
          <div className="mb-4 rounded border border-red-600 bg-red-900/30 p-3 text-center text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {/* Email/Password Form */}
        <form action={initiateSignup} className="space-y-4">
          {/* First Name and Last Name on the same line */}
          <div className="flex space-x-4"> 
            <div className="flex-1"> {/* Take up half the space */}
              <label
                htmlFor="firstName"
                className="block text-sm font-medium text-gray-300"
              >
                First Name:
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                className="mt-1 block w-full rounded-full border border-gray-700 bg-black/50 px-4 py-3 text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="Ada"
              />
            </div>
            <div className="flex-1"> {/* Take up half the space */}
              <label
                htmlFor="lastName"
                className="block text-sm font-medium text-gray-300"
              >
                Last Name:
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                className="mt-1 block w-full rounded-full border border-gray-700 bg-black/50 px-4 py-3 text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
                placeholder="Lovelace"
              />
            </div>
          </div>

          {/* Email field moved below names */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-300"
            >
              Email:
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

          <div className="pt-2">
            <button
              type="submit" // Changed formAction to type=submit to use form's action
              className="w-full justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Continue
            </button>
          </div>
        </form>

        {/* Divider */} 
        <div className="my-6 flex items-center">
          <div className="flex-grow border-t border-gray-700"></div>
          <span className="mx-4 flex-shrink text-sm text-gray-500">Or</span>
          <div className="flex-grow border-t border-gray-700"></div>
        </div>

        {/* Link to Login Page */} 
        <div className="text-center text-sm">
          <p className="text-gray-400">
            Already have an account?
            <Link href="/login" legacyBehavior>
              <a className="ml-1 font-medium text-indigo-400 hover:text-indigo-300">
                Log in
              </a>
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
} 