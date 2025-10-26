import { createBrowserClient, type SupabaseClient } from '@supabase/ssr'

// Singleton instance to prevent "Multiple GoTrueClient instances" error
// when both LandingPage and ProjectsPage check auth simultaneously
let clientInstance: SupabaseClient | null = null

export function createClient() {
  // Return existing instance if it exists
  if (clientInstance) {
    return clientInstance
  }

  // Create new instance only if one doesn't exist
  clientInstance = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return clientInstance
}