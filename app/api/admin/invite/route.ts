import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: (cookiesToSet) => { try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role, business_name').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'Administrator') return NextResponse.json({ error: 'Only administrators can send invitations.' }, { status: 403 })
  const body = await request.json()
  const email = String(body.email ?? '').trim().toLowerCase()
  const role = body.role === 'Administrator' ? 'Administrator' : 'Employee'
  const fullName = String(body.fullName ?? '').trim()
  if (!email || !email.includes('@')) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  const adminUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!adminUrl || !adminKey) {
    return NextResponse.json({ error: 'Database service configuration is missing.' }, { status: 500 })
  }
  const admin = createClient(adminUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: invite, error: inviteError } = await admin.from('invites').insert({ email, role, business_name: profile.business_name ?? "R&B's Security Systems", invited_by: user.id, token_hash: crypto.randomUUID() }).select('id').single()
  if (inviteError) return NextResponse.json({ error: inviteError.code === '23505' ? 'An invitation already exists for this email.' : 'Could not create invitation.' }, { status: 400 })
  const { error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName, invited_role: role, invite_id: invite.id } })
  if (error) { await admin.from('invites').delete().eq('id', invite.id); return NextResponse.json({ error: 'The invitation email could not be sent. Check the email provider configuration.' }, { status: 502 }) }
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => cookieStore.getAll(), setAll: (cookiesToSet) => { try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {} } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'You must be signed in.' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'Administrator') return NextResponse.json({ error: 'Only administrators can revoke invitations.' }, { status: 403 })
  
  const body = await request.json()
  const email = String(body.email ?? '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 })

  const adminUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!adminUrl || !adminKey) {
    return NextResponse.json({ error: 'Database service configuration is missing.' }, { status: 500 })
  }
  const admin = createClient(adminUrl, adminKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: deleteError } = await admin.from('invites').delete().eq('email', email)
  if (deleteError) return NextResponse.json({ error: 'Could not revoke invitation.' }, { status: 400 })

  return NextResponse.json({ ok: true })
}
