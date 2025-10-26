import { createBrowserClient } from '@supabase/ssr'

let clientCount = 0

export function createClient() {
  clientCount++
  const timestamp = Date.now()
  const callStack = new Error().stack
  const caller = callStack?.split('\n')[2]?.trim() || 'unknown'
  
  console.log(`🔵 [${timestamp}] Supabase client #${clientCount} CREATING`, {
    count: clientCount,
    caller: caller,
    timestamp: timestamp
  })
  
  // Check storage state before creating client
  const storageKeys = typeof window !== 'undefined' ? Object.keys(localStorage).filter(k => k.includes('supabase')) : []
  console.log(`🔵 [${timestamp}] Storage state before client #${clientCount}:`, {
    localStorageKeys: storageKeys.length,
    keys: storageKeys
  })
  
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  console.log(`🔵 [${timestamp}] Supabase client #${clientCount} CREATED`, {
    count: clientCount,
    hasAuth: !!client.auth
  })
  
  return client
}