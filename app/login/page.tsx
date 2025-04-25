'use client'; // Required for useEffect and client-side Google Sign-In callback

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { handleSignInWithGoogle, login } from './actions'; // Removed signup import
import Link from 'next/link'; // Import Link
import { useSearchParams, usePathname } from 'next/navigation'; // Import useSearchParams and usePathname

// Define type for Google Identity Services library (optional but good practice)
declare global {
  interface Window {
    google?: typeof import('google-one-tap');
    handleGoogleSignInCallback?: (response: any) => void;
  }
}

export default function LoginPage() {

  // --- Handle Messages & Pathname --- 
  const searchParams = useSearchParams();
  const pathname = usePathname(); // Get current path
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
    window.handleGoogleSignInCallback = handleGoogleSignInCallback;

    // --- Manual Button Rendering --- 
    if (window.google?.accounts?.id) {
        const buttonContainer = document.getElementById('google-signin-button-container');
        if (buttonContainer) {
             // Check if button isn't already rendered (simple check: look for iframe)
             if (buttonContainer.childElementCount === 0) { 
                console.log('Rendering Google Sign-In button (Login Page)');
                window.google.accounts.id.renderButton(
                    buttonContainer,
                    { 
                        theme: "outline", 
                        size: "large",
                        type: "standard",
                        text: "signin_with",
                        shape: "rectangular",
                        logo_alignment: "left"
                        // Add other customizations as needed
                    }
                );
            }
        } else {
             console.error('Google Sign-In button container not found');
        }
        // Optionally, prompt one-tap UI if needed, but renderButton is key here
        // window.google.accounts.id.prompt(); 
    }

    // Cleanup function
    return () => {
      delete window.handleGoogleSignInCallback;
       // It might be good practice to also hide any prompts if used
       // window.google?.accounts?.id?.cancel(); 
    };
    // Re-run this effect if the pathname changes
  }, [pathname, searchParams]); 

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

        {/* Google Sign-In Button Container */}
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
             id="google-signin-button-container"
             className="g_id_signin"
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
       <Script 
         src="https://accounts.google.com/gsi/client" 
         async 
         defer 
         strategy="afterInteractive"
         onLoad={() => console.log('Google GSI script loaded.')}
        ></Script>
    </div>
  );
}