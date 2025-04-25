'use client'; // Required for useEffect and client-side Google Sign-In callback

import { useEffect } from 'react';
import Script from 'next/script';
import { handleSignInWithGoogle, login, signup } from './actions';

export default function LoginPage() {

  // Client-side callback function for Google Sign-In
  async function handleGoogleSignInCallback(response: any) {
    console.log("Google Sign-In CredentialResponse:", response);
    if (response.credential) {
      try {
        // Call the server action to handle the token
        await handleSignInWithGoogle(response.credential);
        // Server action might handle redirect internally (e.g., using next/navigation redirect)
        // Or you can handle redirect client-side if needed:
        // window.location.href = '/dashboard';
      } catch (error) {
        console.error("Error calling handleSignInWithGoogle server action:", error);
        // TODO: Display error message to the user
      }
    } else {
      console.error("Google Sign-In failed: No credential received.");
      // TODO: Display error message to the user
    }
  }

  useEffect(() => {
    // Attach the callback function to the window object
    // so Google's library can find it.
    (window as any).handleGoogleSignInCallback = handleGoogleSignInCallback;

    // Cleanup function to remove it from window when the component unmounts
    return () => {
      delete (window as any).handleGoogleSignInCallback;
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-800">
          Sign In
        </h1>

        {/* Email/Password Form */}
        <form className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Email:
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password:
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              placeholder="••••••••"
            />
          </div>
          {/* TODO: Add area to display login/signup errors */}
          <div className="flex items-center justify-between space-x-2 pt-2">
            <button
              formAction={login}
              className="flex-1 justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              Log in
            </button>
            <button
              formAction={signup}
              className="flex-1 justify-center rounded-md bg-gray-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-600"
            >
              Sign up
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="mx-4 flex-shrink text-sm text-gray-500">Or</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        {/* Google Sign-In */}
        <div className="flex flex-col items-center space-y-3">
           {/* Google Sign-In Configuration Div - hidden but needed */}
           <div
             id="g_id_onload"
             data-client_id={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID} // Use env var
             data-context="signin"
             data-ux_mode="popup"
             data-callback="handleGoogleSignInCallback" // Matches the function defined above
             data-nonce="" // Optional
             // data-auto_select="true" // Can enable for auto sign-in attempt
             data-itp_support="true"
             data-use_fedcm_for_prompt="true" // Important
             style={{ display: 'none' }} // Hide this config div
           ></div>

           {/* Google Sign-In Button Rendering Div */}
           <div
             className="g_id_signin"
             data-type="standard"
             data-shape="rectangular"
             data-theme="outline"
             data-text="signin_with"
             data-size="large"
             data-logo_alignment="left"
             // suppressHydrationWarning={true} // May still be needed if timing issues occur
           ></div>
        </div>

      </div>

       {/* Load Google Client Library using next/script */}
       <Script src="https://accounts.google.com/gsi/client" async defer strategy="afterInteractive"></Script>
    </div>
  );
}