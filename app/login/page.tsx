'use client'; // Required for useEffect and client-side Google Sign-In callback

import { useEffect } from 'react';
import Script from 'next/script';
import { handleSignInWithGoogle, login } from './actions'; // Removed signup import
import Link from 'next/link'; // Import Link
import { useSearchParams } from 'next/navigation'; // Import useSearchParams
import { useState } from 'react'; // Import useState

export default function LoginPage() {

  // --- Handle Messages --- 
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const msg = searchParams.get('message');
    const errMsg = searchParams.get('error'); // Check for error param too
    if (msg) setMessage(msg);
    if (errMsg) setError(errMsg);
    // Optional: Clear params from URL
    // window.history.replaceState({}, document.title, window.location.pathname);
  }, [searchParams]);

  // Client-side callback function for Google Sign-In
  async function handleGoogleSignInCallback(response: any) {
    console.log("Google Sign-In CredentialResponse:", response);
    if (response.credential) {
      try {
        await handleSignInWithGoogle(response.credential);
        // Redirect happens in server action
      } catch (error) {
        console.error("Error calling handleSignInWithGoogle server action:", error);
        setError('Could not authenticate with Google.');
      }
    } else {
      console.error("Google Sign-In failed: No credential received.");
      setError('Google Sign-In failed. Please try again.');
    }
  }

  useEffect(() => {
    // Attach the callback function to the window object
    (window as any).handleGoogleSignInCallback = handleGoogleSignInCallback;
    return () => {
      delete (window as any).handleGoogleSignInCallback;
    };
  }, []); // Separate useEffect for Google callback setup

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-white">
      <div className="w-full max-w-md rounded-lg bg-gray-900/50 p-8 shadow-md border border-gray-800">
        <h1 className="mb-6 text-center text-2xl font-bold text-white">
          Sign In
        </h1>

        {/* Display Success/Error Messages */} 
        {message && (
          <div className="mb-4 rounded border border-green-600 bg-green-900/30 p-3 text-center text-sm text-green-300">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded border border-red-600 bg-red-900/30 p-3 text-center text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Email/Password Form */}
        <form action={login} className="space-y-4">
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
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-300"
            >
              Password:
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 block w-full rounded-full border border-gray-700 bg-black/50 px-4 py-3 text-white shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              placeholder="••••••••"
            />
          </div>

          {/* Forgot Password Link */} 
          <div className="text-center text-sm py-2">
            <Link href="/reset-password" legacyBehavior>
               <a className="font-medium text-indigo-400 hover:text-indigo-300">
                 Forgot password?
               </a>
            </Link>
          </div>

          {/* Login Button Only */}
          <div className="pt-2">
            <button
              type="submit" // Use type=submit as action is on the form
              className="w-full justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Log in
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center">
          <div className="flex-grow border-t border-gray-700"></div>
          <span className="mx-4 flex-shrink text-sm text-gray-500">Or</span>
          <div className="flex-grow border-t border-gray-700"></div>
        </div>

        {/* Google Sign-In Button */}
        <div className="flex flex-col items-center space-y-3">
           <div
             id="g_id_onload"
             data-client_id={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID}
             data-context="signin"
             data-ux_mode="popup"
             data-callback="handleGoogleSignInCallback"
             data-nonce=""
             data-itp_support="true"
             data-use_fedcm_for_prompt="false"
             style={{ display: 'none' }}
           ></div>
           <div
             className="g_id_signin"
             data-type="standard"
             data-shape="rectangular"
             data-theme="outline"
             data-text="signin_with"
             data-size="large"
             data-logo_alignment="left"
           ></div>
        </div>

        {/* Link to Sign Up Page */}
        <div className="mt-6 text-center text-sm">
          <p className="text-gray-400">
            Don't have an account?
            <Link href="/signup" legacyBehavior>
               <a className="ml-1 font-medium text-indigo-400 hover:text-indigo-300">
                 Sign up
               </a>
             </Link>
          </p>
        </div>

      </div>
       <Script src="https://accounts.google.com/gsi/client" async defer strategy="afterInteractive"></Script>
    </div>
  );
}