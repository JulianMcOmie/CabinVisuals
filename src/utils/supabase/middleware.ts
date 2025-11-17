import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: DO NOT REMOVE auth.getUser()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname;

  // Define public paths that don't require authentication
  const publicPaths = [
    '/', 
    '/editor',
    '/login',
    '/signup',
    '/reset-password',
    '/update-password',
    // Add any other public paths like /about, /pricing, etc.
  ];

  // Define auth-related paths that logged-in users should be redirected away from
  const authRoutes = [
    '/login',
    '/signup',
    '/reset-password',
    // Don't usually redirect away from update-password as user needs to be there after clicking link
  ];

  // Check if the current path starts with any of the public paths
  const isPublicPath = publicPaths.some(path => pathname.startsWith(path));
  
  // Check if the current path starts with any of the auth routes
  const isAuthRoute = authRoutes.some(path => pathname.startsWith(path));

  // Redirect unauthenticated users from *protected* pages to login
  if (!user && !isPublicPath) {
    console.log(`Middleware: Unauthenticated user accessing protected path ${pathname}. Redirecting to login.`);
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users from auth pages (login, signup, reset) to the projects page
  if (user && isAuthRoute) {
      console.log(`Middleware: Authenticated user accessing auth route ${pathname}. Redirecting to projects.`);
      const url = request.nextUrl.clone();
      url.pathname = '/projects';
      return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}