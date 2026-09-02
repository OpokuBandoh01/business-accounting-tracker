import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function getAdminClient() {
  const adminUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!adminUrl || !adminKey) return null
  return createClient(adminUrl, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// GET: Returns the company's active business name
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

  const adminClient = getAdminClient()
  if (!adminClient) {
    return NextResponse.json({ error: 'Database service configuration missing.' }, { status: 500 })
  }

  // Find business name from Administrator profile
  const { data: adminProfile } = await adminClient
    .from('profiles')
    .select('business_name')
    .eq('role', 'Administrator')
    .maybeSingle()

  const businessName = adminProfile?.business_name || "R&B's Security Systems"
  return NextResponse.json({ business_name: businessName })
}

// POST: Updates the company business name across all profiles (Admin only)
export async function POST(request: Request) {
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

  const adminClient = getAdminClient()
  if (!adminClient) {
    return NextResponse.json({ error: 'Database service configuration missing.' }, { status: 500 })
  }

  // Check that the caller is an Administrator
  const { data: callerProfile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (callerProfile?.role !== 'Administrator') {
    return NextResponse.json({ error: 'Only administrators can update the business name.' }, { status: 403 })
  }

  const body = await request.json()
  const name = String(body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Business name is required.' }, { status: 400 })

  // Update business_name for all profiles in the organization
  const { error: updateError } = await adminClient
    .from('profiles')
    .update({ business_name: name })
    .neq('role', 'NonExistentRole')

  if (updateError) {
    return NextResponse.json({ error: 'Could not update business name.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, business_name: name })
}
