import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | undefined

export function createClient(): ReturnType<typeof createBrowserClient> {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  if (!url || !key) {
    console.warn(
      'Supabase environment variables are missing. Using local mock Supabase client fallback.'
    )
    
    const mockSupabase = {
      auth: {
        getUser: async () => {
          if (typeof window !== 'undefined') {
            const storedUser = localStorage.getItem('kolo_ledger_v2_user')
            let mockUser = null
            if (storedUser) {
              try { mockUser = JSON.parse(storedUser) } catch (e) {}
            }
            if (!mockUser) {
              mockUser = {
                id: 'mock-admin-id',
                email: 'admin@mabushi.com',
                user_metadata: { full_name: 'Opoku Bandoh' }
              }
              if (typeof window !== 'undefined') {
                localStorage.setItem('kolo_ledger_v2_user', JSON.stringify(mockUser))
              }
            }
            return { data: { user: mockUser }, error: null }
          }
        },
        signUp: async (options: any) => {
          return { data: { user: {} }, error: null }
        },
        signInWithPassword: async (options: any) => {
          const isEmployee = options.email.includes('employee')
          const mockUser = {
            id: isEmployee ? 'mock-employee-id' : 'mock-admin-id',
            email: options.email,
            user_metadata: { full_name: isEmployee ? 'Mr. P' : 'Opoku Bandoh' }
          }
          if (typeof window !== 'undefined') {
            localStorage.setItem('kolo_ledger_v2_user', JSON.stringify(mockUser))
          }
          return { data: { user: mockUser }, error: null }
        },
        signOut: async () => {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('kolo_ledger_v2_user')
          }
          return { error: null }
        },
        getSession: async () => {
          if (typeof window !== 'undefined') {
            const mockUserStr = localStorage.getItem('kolo_ledger_v2_user')
            if (mockUserStr) {
              const mockUser = JSON.parse(mockUserStr)
              const profilesStr = localStorage.getItem('kolo_ledger_v2_profiles') || '[]'
              const profiles = JSON.parse(profilesStr)
              if (!profiles.some((p: any) => p.full_name === mockUser.user_metadata?.full_name)) {
                profiles.push({
                  full_name: mockUser.user_metadata?.full_name || mockUser.email?.split('@')[0] || 'New Member',
                  role: mockUser.user_metadata?.full_name === 'Mr. P' ? 'Employee' : 'Administrator'
                })
                localStorage.setItem('kolo_ledger_v2_profiles', JSON.stringify(profiles))
              }
            }
          }
          return { data: { user: {} }, error: null }
        }
      },
      from: (table: string) => {
        return {
          select: (fields: string) => {
            const thenable = {
              then: (resolve: any) => {
                if (table === 'profiles') {
                  let profiles = []
                  if (typeof window !== 'undefined') {
                    const stored = localStorage.getItem('kolo_ledger_v2_profiles')
                    if (stored) {
                      try {
                        profiles = JSON.parse(stored)
                      } catch (e) {}
                    }
                  }
                  if (!profiles.length) {
                    profiles = [
                      { full_name: 'Opoku Bandoh', role: 'Administrator' },
                      { full_name: 'Mr. P', role: 'Employee' }
                    ]
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('kolo_ledger_v2_profiles', JSON.stringify(profiles))
                    }
                  }
                  return Promise.resolve(resolve({ data: profiles, error: null }))
                }
                if (table === 'invites') {
                  let invites = []
                  if (typeof window !== 'undefined') {
                    const stored = localStorage.getItem('kolo_ledger_v2_invites')
                    if (stored) {
                      try {
                        invites = JSON.parse(stored)
                      } catch (e) {}
                    }
                  }
                  return Promise.resolve(resolve({ data: invites, error: null }))
                }
                if (table === 'products') {
                  let productsList: any[] = []
                  if (typeof window !== 'undefined') {
                    const stored = localStorage.getItem('kolo_ledger_v2_products')
                    if (stored) {
                      try {
                        productsList = JSON.parse(stored)
                      } catch (e) {}
                    }
                  }
                  if (!productsList.length) {
                    productsList = []
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('kolo_ledger_v2_products', JSON.stringify(productsList))
                    }
                  }
                  return Promise.resolve(resolve({ data: productsList, error: null }))
                }
                return Promise.resolve(resolve({ data: [], error: null }))
              },
              eq: (field: string, value: any) => {
                return {
                  maybeSingle: async () => {
                    if (table === 'profiles') {
                      const isEmployee = value === 'mock-employee-id'
                      return {
                        data: {
                          id: value,
                          full_name: isEmployee ? 'Mr. P' : 'Opoku Bandoh',
                          role: isEmployee ? 'Employee' : 'Administrator',
                          business_name: 'Mabushi Security Systems'
                        },
                        error: null
                      }
                    }
                    return { data: null, error: null }
                  }
                }
              },
              order: (field: string, options: any) => {
                return {
                  limit: async (lim: number) => {
                    let entries: any[] = []
                    if (typeof window !== 'undefined') {
                      const stored = localStorage.getItem('kolo_ledger_v2_entries')
                      if (stored) {
                        try {
                          entries = JSON.parse(stored)
                        } catch (e) {}
                      }
                    }
                    if (!entries.length) {
                      entries = []
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('kolo_ledger_v2_entries', JSON.stringify(entries))
                      }
                    }
                    return { data: entries, error: null }
                  }
                }
              }
            }
            return thenable
          },
          insert: (values: any) => {
            return {
              select: () => {
                return {
                  single: async () => {
                    if (table === 'products') {
                      let productsList = []
                      if (typeof window !== 'undefined') {
                        const stored = localStorage.getItem('kolo_ledger_v2_products')
                        if (stored) {
                          try {
                            productsList = JSON.parse(stored)
                          } catch (e) {}
                        }
                      }
                      const newProd = { id: Date.now().toString(), ...values }
                      productsList.push(newProd)
                      if (typeof window !== 'undefined') {
                        localStorage.setItem('kolo_ledger_v2_products', JSON.stringify(productsList))
                      }
                      return { data: newProd, error: null }
                    }
                    let entries = []
                    if (typeof window !== 'undefined') {
                      const stored = localStorage.getItem('kolo_ledger_v2_entries')
                      if (stored) {
                        try {
                          entries = JSON.parse(stored)
                        } catch (e) {}
                      }
                    }
                    const newEntry = {
                      id: Date.now(),
                      ...values,
                      status: values.status || 'Recorded',
                      entry_date: values.entry_date || new Date().toISOString().slice(0, 10)
                    }
                    entries.unshift(newEntry)
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('kolo_ledger_v2_entries', JSON.stringify(entries))
                    }
                    return { data: newEntry, error: null }
                  }
                }
              }
            }
          },
          update: (values: any) => {
            return {
              eq: (field: string, value: any) => {
                return Promise.resolve({ error: null })
              }
            }
          },
          delete: () => {
            return {
              eq: (field: string, value: any) => {
                return Promise.resolve({ error: null })
              }
            }
          }
        }
      }
    }
    
    return mockSupabase as unknown as ReturnType<typeof createBrowserClient>
  }
  
  client = createBrowserClient(url, key)
  return client
}

