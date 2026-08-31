import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })

  // Check if they are administrator
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'Administrator') {
    return NextResponse.json({ error: 'Only administrators can view team profiles.' }, { status: 403 })
  }

  const adminUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!adminUrl || !adminKey) {
    return NextResponse.json({ error: 'Database service configuration is missing.' }, { status: 500 })
  }

  const adminClient = createClient(adminUrl, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Fetch all profiles
  const { data: profiles, error: profilesError } = await adminClient.from('profiles').select('full_name, role')
  if (profilesError) {
    return NextResponse.json({ error: 'Could not fetch profiles.' }, { status: 500 })
  }

  // Fetch invites
  const { data: invites, error: invitesError } = await adminClient.from('invites').select('email, role')
  if (invitesError) {
    return NextResponse.json({ error: 'Could not fetch invites.' }, { status: 500 })
  }

  return NextResponse.json({ profiles, invites })
}
