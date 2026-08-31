'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, BarChart3, Bell, CalendarDays, Check, ChevronDown, CircleDollarSign, ClipboardList, Eye, EyeOff, FileText, LayoutDashboard, LogOut, Menu, MoreHorizontal, Package, Plus, Receipt, Search, Settings2, ShieldCheck, Tag, TrendingUp, UserPlus, Users, WalletCards, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Type = 'Sale' | 'Expense'
type Entry = { id: string | number; type: Type; label: string; category: string; amount: number; quantity?: number; unitPrice?: number; date: string; person: string; status: 'Recorded' | 'Pending' }
const money = (n: number) => `GHS ${n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const seed: Entry[] = []
const seedProducts: any[] = []
const nav = [{ label: 'Overview', icon: LayoutDashboard }, { label: 'Sales recording', icon: Receipt }, { label: 'Expense recording', icon: ClipboardList }, { label: 'Reports', icon: BarChart3 }, { label: 'All entries', icon: FileText }, { label: 'Products', icon: Tag }, { label: 'Team access', icon: Users }, { label: 'Record safety', icon: ShieldCheck }]

export default function LedgerDashboard() {
  const [role, setRole] = useState<'Administrator' | 'Employee'>('Employee')
  const [displayName, setDisplayName] = useState('Team member')
  const [active, setActive] = useState('Overview')
  const [currentDate, setCurrentDate] = useState('')
  const [businessName, setBusinessName] = useState('Mabushi Security Systems')
  const [entries, setEntries] = useState(seed)
  const [mobile, setMobile] = useState(false)
  const [notice, setNotice] = useState(false)
  const [profile, setProfile] = useState(false)
  const [logout, setLogout] = useState(false)
  const [modal, setModal] = useState<'entry' | 'invite' | 'product' | null>(null)
  const [editingProduct, setEditingProduct] = useState<any | null>(null)
  const [productList, setProductList] = useState<any[]>(seedProducts)
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isSettingPassword, setIsSettingPassword] = useState(false)
  const [teamProfiles, setTeamProfiles] = useState<{ full_name: string; role: string }[]>([])
  const [pendingInvites, setPendingInvites] = useState<{ email: string; role: string }[]>([])
  const totals = useMemo(() => { const sales = entries.filter(e => e.type === 'Sale').reduce((a, e) => a + e.amount, 0); const expenses = entries.filter(e => e.type === 'Expense').reduce((a, e) => a + e.amount, 0); return { sales, expenses, profit: sales - expenses } }, [entries])
  const supabase = createClient()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash
      const search = window.location.search
      const params = new URLSearchParams(hash.replace('#', '?'))
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      
      if (accessToken && refreshToken) {
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        }).then(() => {
          setIsSettingPassword(true)
        })
      } else if (
        hash.includes('type=invite') ||
        hash.includes('type=recovery') ||
        hash.includes('type=signup') ||
        search.includes('code=')
      ) {
        setIsSettingPassword(true)
      }
    }
  }, [supabase])

  const loadProducts = useCallback(async () => {
    const { data, error } = await supabase.from('products').select('*').order('name')
    if (!error && data) {
      setProductList(data)
    } else {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('kolo_ledger_v2_live_products')
        if (stored) {
          try {
            setProductList(JSON.parse(stored))
          } catch (e) {}
        } else {
          setProductList(seedProducts)
        }
      }
    }
  }, [supabase])

  const loadTeamData = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/team')
      if (res.ok) {
        const data = await res.json()
        if (data.profiles) setTeamProfiles(data.profiles)
        if (data.invites) setPendingInvites(data.invites)
      } else {
        const { data: profiles } = await supabase.from('profiles').select('full_name, role')
        if (profiles) setTeamProfiles(profiles)
        const { data: invites } = await supabase.from('invites').select('email, role')
        if (invites) setPendingInvites(invites)
      }
    } catch {
      const { data: profiles } = await supabase.from('profiles').select('full_name, role')
      if (profiles) setTeamProfiles(profiles)
      const { data: invites } = await supabase.from('invites').select('email, role')
      if (invites) setPendingInvites(invites)
    }
  }, [supabase])

  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
    let mounted = true
    if (!user) {
      setAuthLoading(true)
      supabase.auth.getUser().then(({ data }: any) => {
        if (!mounted) return
        if (data.user) {
          setUser({ id: data.user.id, email: data.user.email })
        } else {
          setAuthLoading(false)
        }
      })
      return
    }

    setAuthLoading(true)
    const loadProfileAndData = async () => {
      try {
        const { data: profileRow } = await supabase.from('profiles').select('full_name, role, business_name').eq('id', user.id).maybeSingle()
        if (!mounted) return
        const nextRole = profileRow?.role === 'Administrator' ? 'Administrator' : 'Employee'
        setRole(nextRole)
        setDisplayName(profileRow?.full_name?.trim() || user.email?.split('@')[0] || 'Team member')
        if (profileRow?.business_name) {
          setBusinessName(profileRow.business_name)
        }
        await loadProducts()
        if (window.location.pathname.startsWith('/admin') && nextRole !== 'Administrator') {
          window.location.replace('/')
          return
        }

        if (nextRole === 'Administrator') {
          await loadTeamData()
        }

        const { data: rows } = await supabase.from('entries').select('*').order('entry_date', { ascending: false }).limit(200)
        if (!mounted) return
        if (rows?.length) {
          setEntries(rows.map((r: any) => ({
            id: r.id,
            type: r.type,
            label: r.label,
            category: r.category,
            amount: Number(r.amount),
            quantity: r.quantity ? Number(r.quantity) : undefined,
            unitPrice: r.unit_price ? Number(r.unit_price) : undefined,
            date: r.entry_date,
            person: user.email ?? 'Team member',
            status: r.status === 'Pending' ? 'Pending' : 'Recorded'
          })))
        }
      } catch (err) {
        console.error(err)
      } finally {
        if (mounted) {
          setAuthLoading(false)
        }
      }
    }
    loadProfileAndData()

    return () => { mounted = false }
  }, [user, supabase, loadTeamData, loadProducts])
  const go = (v: string) => { setActive(v); setMobile(false) }
  const add = async (e: Entry) => {
    if (!user) return
    const { data: row } = await supabase.from('entries').insert({ user_id: user.id, type: e.type, label: e.label, category: e.category, amount: e.amount, quantity: e.quantity, unit_price: e.unitPrice, entry_date: e.date }).select().single()
    setEntries(x => [{ ...e, id: row?.id ?? e.id, person: user.email ?? e.person }, ...x])
  }
  const handleSaveBusinessName = async (name: string) => {
    if (!user) return
    const { error } = await supabase.from('profiles').update({ business_name: name }).eq('id', user.id)
    if (!error) {
      setBusinessName(name)
    }
  }
  const handleAddProduct = async (product: { name: string; category: string; stock: number; revenue: number; units: number }) => {
    const newProduct = {
      name: product.name,
      category: product.category,
      stock: Number(product.stock),
      revenue: Number(product.revenue ?? 0),
      units: Number(product.units ?? 0)
    }
    const { data, error } = await supabase.from('products').insert(newProduct).select().single()
    if (!error && data) {
      await loadProducts()
    } else {
      const updated = [...productList, { id: Date.now(), ...newProduct }]
      setProductList(updated)
      if (typeof window !== 'undefined') {
        localStorage.setItem('kolo_ledger_v2_live_products', JSON.stringify(updated))
      }
    }
  }
  const handleEditProduct = async (id: any, product: { name: string; category: string; price: number; stock: number; revenue: number; units: number }) => {
    const updatedProduct = {
      name: product.name,
      category: product.category,
      price: Number(product.price ?? 0),
      stock: Number(product.stock),
      revenue: Number(product.revenue ?? 0),
      units: Number(product.units ?? 0)
    }
    const isMock = typeof id === 'number' || (typeof id === 'string' && !id.includes('-'))
    if (!isMock) {
      const { error } = await supabase.from('products').update(updatedProduct).eq('id', id)
      if (!error) {
        await loadProducts()
        return
      }
    }
    const updated = productList.map(p => (p.id === id || p.name === product.name) ? { ...p, ...updatedProduct } : p)
    setProductList(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem('kolo_ledger_v2_live_products', JSON.stringify(updated))
    }
  }
  const handleDeleteProduct = async (id: any, name: string) => {
    const isMock = typeof id === 'number' || (typeof id === 'string' && !id.includes('-'))
    if (!isMock) {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (!error) {
        await loadProducts()
        return
      }
    }
    const updated = productList.filter(p => p.id !== id && p.name !== name)
    setProductList(updated)
    if (typeof window !== 'undefined') {
      localStorage.setItem('kolo_ledger_v2_live_products', JSON.stringify(updated))
    }
  }
  const handleRevokeInvite = async (email: string) => {
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      if (res.ok) {
        loadTeamData()
      } else {
        const { error } = await supabase.from('invites').delete().eq('email', email)
        if (error) {
          console.error("Failed to revoke invite:", error.message)
        } else {
          loadTeamData()
        }
      }
    } catch {
      const { error } = await supabase.from('invites').delete().eq('email', email)
      if (error) {
        console.error("Failed to revoke invite:", error.message)
      } else {
        loadTeamData()
      }
    }
  }
  if (authLoading && !isSettingPassword) return <main className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">Loading your ledger...</main>
  if (isSettingPassword) {
    return (
      <SetPasswordScreen
        onPasswordSet={async () => {
          const { data } = await supabase.auth.getUser()
          if (data.user) {
            setUser({ id: data.user.id, email: data.user.email })
          }
          setIsSettingPassword(false)
        }}
      />
    )
  }
  if (!user) return <AuthScreen onAuthenticated={(next) => setUser(next)} />
  const visibleNav = role === 'Employee' ? nav.filter(x => ['Overview', 'Sales recording', 'Expense recording', 'Reports'].includes(x.label)) : nav
  return <main className="min-h-screen bg-background text-foreground"><div className="flex min-h-screen">
    {mobile && <div className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm md:hidden" onClick={() => setMobile(false)} />}
    <aside className={`${mobile ? 'flex' : 'hidden'} fixed inset-0 z-40 w-72 flex-col border-r border-border bg-sidebar p-5 md:static md:flex md:w-64`}><div className="flex items-center justify-between gap-3 px-2"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground"><WalletCards className="size-5" /></div><div><p className="font-semibold">Kolo Ledger</p><p className="text-xs text-muted-foreground">{businessName}</p></div></div><button className="md:hidden" onClick={() => setMobile(false)} aria-label="Close navigation"><X className="size-5" /></button></div><div className="mt-8 rounded-xl border border-sidebar-border bg-sidebar-accent p-3"><p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your access</p><div className="mt-2 flex items-center justify-between"><span className="text-sm font-semibold">{role}</span><ShieldCheck className="size-4 text-accent" /></div><p className="mt-1 text-xs text-muted-foreground">Managed by your administrator</p></div><div className="mt-7 space-y-1"><p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Workspace</p>{visibleNav.map(({ label, icon: Icon }) => <button key={label} onClick={() => go(label)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${active === label ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-sidebar-accent'}`}><Icon className="size-[18px]" />{label}</button>)}</div><div className="mt-auto"><button onClick={() => go('Settings')} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-sidebar-accent"><Settings2 className="size-[18px]" />Settings</button><div className="mt-3 flex items-center gap-3 border-t border-sidebar-border px-3 pt-4"><div className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-bold">{displayName.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{displayName}</p><p className="text-xs text-muted-foreground">{role}</p></div><button onClick={() => setProfile(!profile)} aria-label="Open administrator menu"><MoreHorizontal className="size-4" /></button></div></div></aside>
    <section className="min-w-0 flex-1"><header className="flex h-20 items-center justify-between border-b border-border px-5 md:px-10"><div className="flex items-center gap-3"><button className="rounded-lg border border-border p-2 md:hidden" onClick={() => setMobile(true)} aria-label="Open navigation"><Menu className="size-5" /></button><div><p className="text-xs text-muted-foreground">{currentDate}</p><h1 className="mt-1 text-xl font-semibold md:text-2xl">Good morning, {displayName.split(' ')[0]}</h1></div></div><div className="relative flex items-center gap-3"><button onClick={() => setNotice(!notice)} className="relative rounded-xl border border-border p-2.5 text-muted-foreground" aria-label="Notifications"><Bell className="size-[18px]" /></button><button onClick={() => setProfile(!profile)} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium"><span className="flex size-6 items-center justify-center rounded-full bg-accent text-[10px] font-bold">{displayName.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()}</span><span className="hidden sm:inline">{role}</span><ChevronDown className="size-4" /></button>{notice && <Popover title="Notifications"><p className="text-muted-foreground text-xs">No new notifications.</p></Popover>}{profile && <Popover title="Account"><button onClick={() => setLogout(true)} className="flex w-full items-center gap-2 text-left text-sm text-expense"><LogOut className="size-4" />Log out</button></Popover>}</div></header>
      <div className="mx-auto max-w-[1440px] p-5 md:p-10"><div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays className="size-4" />Financial workspace · {role}</div><h2 className="text-3xl font-semibold tracking-tight md:text-4xl">{active === 'Overview' ? 'Your business at a glance' : active}</h2><p className="mt-2 text-sm text-muted-foreground">{active === 'Overview' ? 'Track what comes in, what goes out, and what stays.' : 'Manage business records with clarity and confidence.'}</p></div>{active !== 'Products' && <button onClick={() => setModal('entry')} className="flex h-10 items-center gap-2 self-start rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"><Plus className="size-4" />Quick entry</button>}</div>
        {active === 'Overview' && <Overview totals={totals} entries={entries} go={go} />}{active === 'Sales recording' && <Recording type="Sale" onSave={add} displayName={displayName} products={productList} />}{active === 'Expense recording' && <Recording type="Expense" onSave={add} displayName={displayName} products={productList} />}{active === 'Reports' && <Reports totals={totals} entries={entries} />}{active === 'All entries' && <Entries entries={entries} />}{active === 'Products' && <Products products={productList} role={role} onAdd={() => setModal('product')} onEdit={setEditingProduct} />}{active === 'Team access' && <Team profiles={teamProfiles} invites={pendingInvites} onInvite={() => setModal('invite')} onRevoke={handleRevokeInvite} />}{active === 'Record safety' && <Safety entries={entries} />}{active === 'Settings' && <Settings businessName={businessName} onSave={handleSaveBusinessName} />}
      </div></section>
  </div>{modal === 'entry' && <QuickEntry close={() => setModal(null)} onSave={add} displayName={displayName} products={productList} />}{modal === 'invite' && <Invite close={() => setModal(null)} onInviteSent={loadTeamData} />}{modal === 'product' && <AddProduct close={() => setModal(null)} onAdd={handleAddProduct} />}{editingProduct && <EditProduct close={() => setEditingProduct(null)} product={editingProduct} onSave={handleEditProduct} onDelete={handleDeleteProduct} />}{logout && <ConfirmLogout close={() => setLogout(false)} />}</main>
}

function Popover({ title, children }: { title: string; children: React.ReactNode }) { return <div className="absolute right-0 top-12 z-30 w-64 rounded-2xl border border-border bg-card p-4 text-sm shadow-xl"><p className="mb-3 font-semibold">{title}</p>{children}</div> }
function Metric({ label, value, icon, tone = 'normal' }: { label: string; value: string; icon: React.ReactNode; tone?: string }) { return <div className="rounded-2xl border border-border bg-card p-5"><span className={`flex size-9 items-center justify-center rounded-xl ${tone === 'expense' ? 'bg-expense/10 text-expense' : 'bg-muted text-muted-foreground'}`}>{icon}</span><p className="mt-5 text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p></div> }
function Overview({ totals, entries, go }: { totals: { sales: number; expenses: number; profit: number }; entries: Entry[]; go: (v: string) => void }) { return <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Total revenue" value={money(totals.sales)} icon={<CircleDollarSign />} /><Metric label="Total expenses" value={money(totals.expenses)} icon={<ArrowDownRight />} tone="expense" /><Metric label="Net profit" value={money(totals.profit)} icon={<TrendingUp />} /><Metric label="Entries recorded" value={String(entries.length).padStart(2, '0')} icon={<BarChart3 />} /></div><div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]"><div className="rounded-2xl border border-border bg-card p-5 md:p-6"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Cash flow</h3><p className="mt-1 text-sm text-muted-foreground">Revenue versus expenses</p></div><span className="text-sm font-semibold text-primary">{money(totals.profit)} retained</span></div><div className="mt-8 flex h-52 items-end gap-3 border-b border-border px-2">{[48,62,54,74,61,82,70,92,77,88,80,96].map((h,i) => <div key={i} className="flex flex-1 items-end justify-center gap-1"><div className="w-full max-w-5 rounded-t bg-primary/85" style={{height:`${h}%`}} /><div className="w-full max-w-5 rounded-t bg-expense/70" style={{height:`${Math.max(14,h*.38)}%`}} /></div>)}</div><div className="mt-3 flex justify-between text-[11px] text-muted-foreground"><span>Aug 01</span><span>Aug 08</span><span>Aug 15</span><span>Aug 21</span></div></div><div className="rounded-2xl border border-border bg-card p-5 md:p-6"><div className="flex items-center justify-between"><div><h3 className="font-semibold">Recent entries</h3><p className="mt-1 text-sm text-muted-foreground">Latest business activity</p></div><button onClick={() => go('All entries')} className="text-sm font-semibold text-primary">View all</button></div><div className="mt-5 space-y-4">{entries.slice(0,4).map(e => <div key={e.id} className="flex items-center gap-3"><div className={`flex size-9 items-center justify-center rounded-xl ${e.type === 'Sale' ? 'bg-primary/10 text-primary' : 'bg-expense/10 text-expense'}`}>{e.type === 'Sale' ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{e.label}</p><p className="text-xs text-muted-foreground">{e.person} · {e.date}</p></div><p className={`text-sm font-semibold ${e.type === 'Sale' ? 'text-primary' : 'text-expense'}`}>{e.type === 'Sale' ? '+' : '-'}{money(e.amount)}</p></div>)}</div></div></div></> }

function Recording({ type, onSave, displayName, products }: { type: Type; onSave: (e: Entry) => void; displayName: string; products: any[] }) {
  const [rows, setRows] = useState([{ label: '', category: type === 'Sale' ? 'GPS Tracking' : 'Equipment', quantity: 1, unitPrice: 0, amount: 0, date: '2026-08-21' }])
  const [customRows, setCustomRows] = useState<Record<number, boolean>>({})
  const update = (i: number, key: string, value: string) => {
    setRows(r => r.map((x, j) => j === i ? {
      ...x,
      [key]: key === 'quantity' || key === 'unitPrice' ? Number(value) : value,
      amount: key === 'quantity' || key === 'unitPrice'
        ? (key === 'quantity' ? Number(value) : x.quantity) * (key === 'unitPrice' ? Number(value) : x.unitPrice)
        : x.amount
    } : x))
  }
  const save = () => {
    rows.filter(r => r.label && r.amount > 0).forEach((r, i) => onSave({
      id: Date.now() + i,
      type,
      label: r.label,
      category: r.category,
      amount: r.amount,
      quantity: r.quantity,
      unitPrice: r.unitPrice,
      date: r.date,
      person: displayName,
      status: 'Recorded'
    }))
    setRows([{ label: '', category: type === 'Sale' ? 'GPS Tracking' : 'Equipment', quantity: 1, unitPrice: 0, amount: 0, date: '2026-08-21' }])
    setCustomRows({})
  }
  const total = rows.reduce((a, r) => a + r.amount, 0)
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="border-b border-border p-5 md:p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h3 className="font-semibold">{type === 'Sale' ? 'Sales recording' : 'Expense recording'}</h3>
            <p className="mt-1 text-sm text-muted-foreground">Enter multiple rows like a spreadsheet. Totals calculate automatically in GHS.</p>
          </div>
          <button onClick={() => setRows([...rows, { label: '', category: type === 'Sale' ? 'GPS Tracking' : 'Equipment', quantity: 1, unitPrice: 0, amount: 0, date: '2026-08-21' }])} className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold">
            <Plus className="size-4" />Add row
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-muted/45 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-5 py-3">{type === 'Sale' ? 'Product' : 'Description'}</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Qty</th>
              <th className="px-5 py-3">Unit price</th>
              <th className="px-5 py-3">Total</th>
              <th className="px-5 py-3">Date</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => {
              const showSelect = type === 'Sale' && !customRows[i]
              return (
                <tr key={i}>
                  <td className="px-5 py-3">
                    {showSelect ? (
                      <select
                        value={r.label}
                        onChange={e => {
                          if (e.target.value === '__custom__') {
                            setCustomRows(prev => ({ ...prev, [i]: true }))
                            update(i, 'label', '')
                          } else {
                            const prod = products.find(p => p.name === e.target.value)
                            if (prod) {
                              setRows(prev => prev.map((x, j) => j === i ? {
                                ...x,
                                label: prod.name,
                                category: prod.category,
                                unitPrice: prod.price ?? 350,
                                amount: (prod.price ?? 350) * x.quantity
                              } : x))
                            }
                          }
                        }}
                        className="h-10 w-full rounded-lg border border-input bg-background px-3"
                      >
                        <option value="">Select product...</option>
                        {products.map(p => (
                          <option key={p.name} value={p.name}>{p.name} (GHS {p.price ?? 0})</option>
                        ))}
                        <option value="__custom__">+ Custom (Write-in)...</option>
                      </select>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <input value={r.label} onChange={e => update(i, 'label', e.target.value)} placeholder="Enter item description" className="h-10 w-full rounded-lg border border-input bg-background px-3" />
                        {type === 'Sale' && (
                          <button onClick={() => {
                            setCustomRows(prev => ({ ...prev, [i]: false }))
                            update(i, 'label', '')
                          }} className="text-xs text-primary hover:underline">List</button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <input value={r.category} onChange={e => update(i, 'category', e.target.value)} className="h-10 w-32 rounded-lg border border-input bg-background px-3" />
                  </td>
                  <td className="px-5 py-3">
                    <input type="number" min="1" value={r.quantity} onChange={e => {
                      const qty = Number(e.target.value)
                      setRows(prev => prev.map((x, j) => j === i ? {
                        ...x,
                        quantity: qty,
                        amount: qty * x.unitPrice
                      } : x))
                    }} className="h-10 w-20 rounded-lg border border-input bg-background px-3" />
                  </td>
                  <td className="px-5 py-3">
                    <input type="number" min="0" value={r.unitPrice} onChange={e => update(i, 'unitPrice', e.target.value)} className="h-10 w-28 rounded-lg border border-input bg-background px-3" />
                  </td>
                  <td className="px-5 py-3 font-semibold text-primary">{money(r.amount)}</td>
                  <td className="px-5 py-3">
                    <input type="date" value={r.date} onChange={e => update(i, 'date', e.target.value)} className="h-10 rounded-lg border border-input bg-background px-3" />
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label="Remove row">
                      <X className="size-4 text-muted-foreground" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col items-end gap-3 border-t border-border p-5 sm:flex-row sm:justify-end sm:items-center">
        <p className="text-sm text-muted-foreground font-medium">Batch total <strong className="ml-2 text-lg text-foreground font-semibold">{money(total)}</strong></p>
        <button onClick={save} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Save all {type.toLowerCase()}s</button>
      </div>
    </div>
  )
}
function Reports({ totals, entries }: { totals: { sales:number; expenses:number; profit:number }; entries:Entry[] }) { const cats = [...new Set(entries.map(e=>e.category))]; return <div className="space-y-6"><div className="grid gap-4 md:grid-cols-3"><Metric label="Today" value={money(totals.profit)} icon={<CalendarDays />} /><Metric label="This week" value={money(totals.sales)} icon={<TrendingUp />} /><Metric label="This month" value={money(totals.expenses)} icon={<ArrowDownRight />} tone="expense" /></div><div className="rounded-2xl border border-border bg-card p-5 md:p-6"><h3 className="font-semibold">Automatic calculations</h3><p className="mt-1 text-sm text-muted-foreground">All totals update from recorded sales and expenses.</p><div className="mt-6 space-y-4">{cats.map(c => { const value=entries.filter(e=>e.category===c).reduce((a,e)=>a+(e.type==='Sale'?e.amount:-e.amount),0); return <div key={c}><div className="mb-2 flex justify-between text-sm"><span>{c}</span><strong>{money(value)}</strong></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{width:`${Math.min(100,Math.abs(value)/Math.max(1,totals.sales)*100)}%`}} /></div></div>})}</div></div></div> }
function Entries({ entries }: { entries:Entry[] }) { const [q,setQ]=useState(''); const filtered=entries.filter(e=>`${e.label} ${e.category} ${e.person}`.toLowerCase().includes(q.toLowerCase())); return <div className="rounded-2xl border border-border bg-card"><div className="flex items-center justify-between border-b border-border p-5"><div><h3 className="font-semibold">All entries</h3><p className="mt-1 text-sm text-muted-foreground">Searchable record of every transaction.</p></div><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search entries" className="h-10 rounded-xl border border-input bg-background pl-9 pr-3 text-sm" /></div></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-muted/45 text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3">Entry</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Recorded by</th><th className="px-5 py-3">Status</th></tr></thead><tbody className="divide-y divide-border">{filtered.map(e=><tr key={e.id}><td className="px-5 py-4"><p className="font-medium">{e.label}</p><p className="text-xs text-muted-foreground">{e.category} · {e.date}</p></td><td className="px-5 py-4">{e.type}</td><td className={`px-5 py-4 font-semibold ${e.type==='Sale'?'text-primary':'text-expense'}`}>{money(e.amount)}</td><td className="px-5 py-4">{e.person}</td><td className="px-5 py-4"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{e.status}</span></td></tr>)}</tbody></table></div></div> }
function Products({ products, role, onAdd, onEdit }: { products: any[]; role: 'Administrator' | 'Employee'; onAdd: () => void; onEdit: (product: any) => void }) {
  const activeProducts = products.length
  const totalUnitsSold = products.reduce((acc, p) => acc + p.units, 0)
  const totalProductRevenue = products.reduce((acc, p) => acc + p.revenue, 0)
  return <div className="space-y-6">{role === 'Administrator' && (
        <div className="flex justify-end">
          <button onClick={onAdd} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
            <Plus className="size-4" />Add Product
          </button>
        </div>
      )}<div className="grid gap-4 sm:grid-cols-3"><Metric label="Active products" value={String(activeProducts)} icon={<Package />} /><Metric label="Units sold" value={String(totalUnitsSold)} icon={<BarChart3 />} /><Metric label="Product revenue" value={money(totalProductRevenue)} icon={<TrendingUp />} /></div><div className="rounded-2xl border border-border bg-card p-5"><h3 className="font-semibold">Product performance</h3><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="text-xs uppercase text-muted-foreground"><tr><th className="py-3">Product</th><th>Units sold</th><th>Revenue</th><th>Stock</th>{role === 'Administrator' && <th className="py-3">Actions</th>}</tr></thead><tbody className="divide-y divide-border">{products.map(p=><tr key={p.name}><td className="py-4"><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.category}</p></td><td>{p.units}</td><td className="font-semibold text-primary">{money(p.revenue)}</td><td>{p.stock} units</td>{role === 'Administrator' && <td className="py-4"><button onClick={() => onEdit(p)} className="text-xs font-semibold text-primary hover:underline">Edit</button></td>}</tr>)}</tbody></table></div></div></div>
}
function Team({ profiles, invites, onInvite, onRevoke }: { profiles: { full_name: string; role: string }[]; invites: { email: string; role: string }[]; onInvite: () => void; onRevoke?: (email: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold">User access</h3>
            <p className="mt-1 text-sm text-muted-foreground">Employees record entries; admins manage reports and permissions.</p>
          </div>
          <button onClick={onInvite} className="flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
            <UserPlus className="size-4" />Invite member
          </button>
        </div>
        
        <div className="mt-5 divide-y divide-border">
          {/* Active Profiles */}
          {profiles.map(p => (
            <div key={p.full_name} className="flex items-center gap-3 py-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground text-xs font-bold">
                {p.full_name.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{p.full_name}</p>
                <p className="text-sm text-muted-foreground">{p.role}</p>
              </div>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">Active</span>
            </div>
          ))}

          {/* Pending Invites */}
          {invites.map(i => (
            <div key={i.email} className="flex items-center gap-3 py-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold">
                {i.email.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{i.email}</p>
                <p className="text-sm text-muted-foreground">{i.role}</p>
              </div>
              <span className="mr-3 rounded-full bg-expense/10 px-2.5 py-1 text-xs font-semibold text-expense">Pending</span>
              {onRevoke && (
                <button
                  onClick={() => onRevoke(i.email)}
                  className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-expense transition-colors"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}

          {profiles.length === 0 && invites.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No users found.</p>
          )}
        </div>
      </div>
    </div>
  )
}
function Safety({ entries }: { entries:Entry[] }) { return <div className="space-y-6"><div className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center gap-3"><ShieldCheck className="size-6 text-primary" /><div><h3 className="font-semibold">Record safety and audit trail</h3><p className="mt-1 text-sm text-muted-foreground">Every record keeps who entered it, when it was entered, and its review status.</p></div></div><div className="mt-6 divide-y divide-border">{entries.slice(0,5).map(e=><div key={e.id} className="flex items-center gap-3 py-4"><Check className="size-4 text-primary" /><div className="flex-1"><p className="text-sm font-medium">{e.person} recorded {e.label}</p><p className="text-xs text-muted-foreground">{e.date} · {e.status}</p></div><span className="text-sm font-semibold">{money(e.amount)}</span></div>)}</div></div></div> }
function Settings({ businessName, onSave }: { businessName: string; onSave: (name: string) => void }) {
  const [name, setName] = useState(businessName)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    await onSave(name)
    setBusy(false)
  }
  return <div className="max-w-2xl rounded-2xl border border-border bg-card p-5"><h3 className="font-semibold">Business settings</h3><p className="mt-1 text-sm text-muted-foreground">Your default currency is Ghana cedis (GHS).</p><label className="mt-6 block text-sm font-medium">Business name<input value={name} onChange={e=>setName(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3" /></label><label className="mt-4 block text-sm font-medium">Currency<input value="GHS — Ghana cedi" readOnly className="mt-2 h-11 w-full rounded-xl border border-input bg-muted px-3" /></label><button onClick={submit} disabled={busy} className="mt-6 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{busy?'Saving…':'Save settings'}</button></div>
}
function QuickEntry({ close, onSave, displayName, products }: { close: () => void; onSave: (e: Entry) => void; displayName: string; products: any[] }) {
  const [type, setType] = useState<Type>('Sale')
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [isCustom, setIsCustom] = useState(false)
  const handleProductChange = (prodName: string) => {
    if (prodName === '__custom__') {
      setIsCustom(true)
      setLabel('')
      setAmount('')
    } else {
      const prod = products.find(p => p.name === prodName)
      if (prod) {
        setLabel(prod.name)
        setAmount(String(prod.price ?? 350))
      }
    }
  }
  const submit = () => {
    if (label && Number(amount)) {
      const prod = products.find(p => p.name === label)
      onSave({
        id: Date.now(),
        type,
        label,
        category: type === 'Sale' ? (prod ? prod.category : 'GPS Tracking') : 'Operations',
        amount: Number(amount),
        date: 'Just now',
        person: displayName,
        status: 'Recorded'
      })
      close()
    }
  }
  return (
    <Modal title="Quick entry" close={close}>
      <select value={type} onChange={e => { setType(e.target.value as Type); setIsCustom(false); setLabel(''); setAmount('') }} className="h-11 w-full rounded-xl border border-input bg-background px-3">
        <option>Sale</option>
        <option>Expense</option>
      </select>
      {type === 'Sale' && !isCustom ? (
        <select value={label} onChange={e => handleProductChange(e.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3">
          <option value="">Select product...</option>
          {products.map(p => (
            <option key={p.name} value={p.name}>{p.name} (GHS {p.price ?? 0})</option>
          ))}
          <option value="__custom__">+ Custom (Write-in)...</option>
        </select>
      ) : (
        <div className="flex gap-2 items-center">
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Item or description" className="h-11 w-full rounded-xl border border-input bg-background px-3" />
          {type === 'Sale' && (
            <button onClick={() => { setIsCustom(false); setLabel(''); setAmount('') }} className="text-xs text-primary hover:underline">List</button>
          )}
        </div>
      )}
      <input value={amount} onChange={e => setAmount(e.target.value)} type="number" placeholder="Amount in GHS" className="h-11 w-full rounded-xl border border-input bg-background px-3" />
      <button onClick={submit} className="h-11 rounded-xl bg-primary font-semibold text-primary-foreground">Save entry</button>
    </Modal>
  )
}
function Invite({ close, onInviteSent }: { close:()=>void; onInviteSent?: () => void }) { const [fullName,setFullName]=useState(''); const [email,setEmail]=useState(''); const [role,setRole]=useState<'Employee'|'Administrator'>('Employee'); const [busy,setBusy]=useState(false); const [message,setMessage]=useState(''); const submit=async()=>{ if(!email||!email.includes('@')){setMessage('Enter a valid email address.');return} setBusy(true);setMessage(''); const response=await fetch('/api/admin/invite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fullName,email,role})}); const result=await response.json(); setBusy(false); if(!response.ok){setMessage(result.error??'Could not send invitation.');return} setMessage('Invitation sent. Ask the invitee to check their inbox.'); if (onInviteSent) onInviteSent(); setTimeout(close,1200) }; return <Modal title="Invite team member" close={close}><input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Full name" className="h-11 rounded-xl border border-input bg-background px-3" /><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" type="email" className="h-11 rounded-xl border border-input bg-background px-3" /><select value={role} onChange={e=>setRole(e.target.value as 'Employee'|'Administrator')} className="h-11 rounded-xl border border-input bg-background px-3"><option>Employee</option><option>Administrator</option></select>{message&&<p className="text-sm text-muted-foreground">{message}</p>}<button onClick={submit} disabled={busy} className="h-11 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60">{busy?'Sending…':'Send invitation'}</button></Modal> }
function ConfirmLogout({ close }: { close:()=>void }) { const supabase = createClient(); return <Modal title="Log out?" close={close}><p className="text-sm text-muted-foreground">You will need to sign in again to access Kolo Ledger.</p><button onClick={close} className="h-11 rounded-xl bg-primary font-semibold text-primary-foreground">Stay signed in</button><button onClick={async () => { await supabase.auth.signOut(); window.location.reload() }} className="h-11 rounded-xl border border-border font-semibold">Log out</button></Modal> }
function AddProduct({ close, onAdd }: { close: () => void; onAdd: (product: { name: string; category: string; price: number; stock: number; revenue: number; units: number }) => void }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('GPS Tracking')
  const [isCustomCategory, setIsCustomCategory] = useState(false)
  const [customCategoryText, setCustomCategoryText] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('')
  const [units, setUnits] = useState('0')
  const [revenue, setRevenue] = useState('0')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async () => {
    const finalCategory = isCustomCategory ? customCategoryText.trim() : category
    if (!name.trim()) { setError('Product name is required.'); return }
    if (!finalCategory) { setError('Product category is required.'); return }
    if (!price || Number(price) <= 0) { setError('Enter a valid price.'); return }
    if (!stock || Number(stock) < 0) { setError('Enter a valid stock number.'); return }
    setBusy(true)
    await onAdd({ name: name.trim(), category: finalCategory, price: Number(price), stock: Number(stock), units: Number(units || 0), revenue: Number(revenue || 0) })
    setBusy(false)
    close()
  }
  return <Modal title="Add product" close={close}><input value={name} onChange={e=>setName(e.target.value)} placeholder="Product name" className="h-11 rounded-xl border border-input bg-background px-3" />{isCustomCategory ? (
        <div className="flex gap-2 items-center">
          <input value={customCategoryText} onChange={e => setCustomCategoryText(e.target.value)} placeholder="Enter custom category" className="h-11 w-full rounded-xl border border-input bg-background px-3" />
          <button onClick={() => { setIsCustomCategory(false); setCustomCategoryText('') }} className="text-xs text-primary hover:underline">List</button>
        </div>
      ) : (
        <select value={category} onChange={e => {
          if (e.target.value === '__custom__') {
            setIsCustomCategory(true)
            setCustomCategoryText('')
          } else {
            setCategory(e.target.value)
          }
        }} className="h-11 rounded-xl border border-input bg-background px-3">
          <option>GPS Tracking</option>
          <option>CCTV Systems</option>
          <option>Gate Control</option>
          <option>Electric Fencing</option>
          <option>Equipment</option>
          <option value="__custom__">+ Custom Category...</option>
        </select>
      )}<div className="grid grid-cols-2 sm:grid-cols-4 gap-3"><label className="block text-[10px] font-semibold text-muted-foreground uppercase">Price (GHS)<input type="number" min="1" value={price} onChange={e=>setPrice(e.target.value)} placeholder="0.00" className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground font-normal normal-case" /></label><label className="block text-[10px] font-semibold text-muted-foreground uppercase">Stock<input type="number" min="0" value={stock} onChange={e=>setStock(e.target.value)} placeholder="0" className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground font-normal normal-case" /></label><label className="block text-[10px] font-semibold text-muted-foreground uppercase">Units sold<input type="number" min="0" value={units} onChange={e=>setUnits(e.target.value)} placeholder="0" className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground font-normal normal-case" /></label><label className="block text-[10px] font-semibold text-muted-foreground uppercase">Initial rev.<input type="number" min="0" value={revenue} onChange={e=>setRevenue(e.target.value)} placeholder="0.00" className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground font-normal normal-case" /></label></div>{error&&<p className="text-sm text-expense">{error}</p>}<button onClick={submit} disabled={busy} className="h-11 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60">{busy?'Saving…':'Add product'}</button></Modal>
}
function EditProduct({ close, product, onSave, onDelete }: { close: () => void; product: any; onSave: (id: any, product: { name: string; category: string; price: number; stock: number; revenue: number; units: number }) => void; onDelete: (id: any, name: string) => void }) {
  const [name, setName] = useState(product.name || '')
  const [category, setCategory] = useState(product.category || 'GPS Tracking')
  const [isCustomCategory, setIsCustomCategory] = useState(false)
  const [customCategoryText, setCustomCategoryText] = useState('')
  const [price, setPrice] = useState(String(product.price || ''))
  const [stock, setStock] = useState(String(product.stock || '0'))
  const [units, setUnits] = useState(String(product.units || '0'))
  const [revenue, setRevenue] = useState(String(product.revenue || '0'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const submit = async () => {
    const finalCategory = isCustomCategory ? customCategoryText.trim() : category
    if (!name.trim()) { setError('Product name is required.'); return }
    if (!finalCategory) { setError('Product category is required.'); return }
    if (!price || Number(price) <= 0) { setError('Enter a valid price.'); return }
    if (!stock || Number(stock) < 0) { setError('Enter a valid stock number.'); return }
    setBusy(true)
    await onSave(product.id || product.name, { name: name.trim(), category: finalCategory, price: Number(price), stock: Number(stock), units: Number(units || 0), revenue: Number(revenue || 0) })
    setBusy(false)
    close()
  }

  const handleDelete = async () => {
    setBusy(true)
    await onDelete(product.id || product.name, product.name)
    setBusy(false)
    close()
  }

  return (
    <Modal title="Edit product" close={close}>
      {confirmDelete ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong className="text-foreground">{product.name}</strong>? This action cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={handleDelete} className="h-11 flex-1 rounded-xl bg-expense font-semibold text-white">Yes, delete</button>
            <button onClick={() => setConfirmDelete(false)} className="h-11 flex-1 rounded-xl border border-border font-semibold">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="Product name" className="h-11 rounded-xl border border-input bg-background px-3" />
          {isCustomCategory ? (
            <div className="flex gap-2 items-center">
              <input value={customCategoryText} onChange={e => setCustomCategoryText(e.target.value)} placeholder="Enter custom category" className="h-11 w-full rounded-xl border border-input bg-background px-3" />
              <button onClick={() => { setIsCustomCategory(false); setCustomCategoryText('') }} className="text-xs text-primary hover:underline">List</button>
            </div>
          ) : (
            <select value={category} onChange={e => {
              if (e.target.value === '__custom__') {
                setIsCustomCategory(true)
                setCustomCategoryText('')
              } else {
                setCategory(e.target.value)
              }
            }} className="h-11 rounded-xl border border-input bg-background px-3">
              <option>GPS Tracking</option>
              <option>CCTV Systems</option>
              <option>Gate Control</option>
              <option>Electric Fencing</option>
              <option>Equipment</option>
              <option value="__custom__">+ Custom Category...</option>
            </select>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase">Price (GHS)<input type="number" min="1" value={price} onChange={e=>setPrice(e.target.value)} placeholder="0.00" className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground font-normal normal-case" /></label>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase">Stock<input type="number" min="0" value={stock} onChange={e=>setStock(e.target.value)} placeholder="0" className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground font-normal normal-case" /></label>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase">Units sold<input type="number" min="0" value={units} onChange={e=>setUnits(e.target.value)} placeholder="0" className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground font-normal normal-case" /></label>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase">Initial rev.<input type="number" min="0" value={revenue} onChange={e=>setRevenue(e.target.value)} placeholder="0.00" className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground font-normal normal-case" /></label>
          </div>
          {error&&<p className="text-sm text-expense">{error}</p>}
          <div className="flex gap-2 mt-2">
            <button onClick={submit} disabled={busy} className="h-11 flex-1 rounded-xl bg-primary font-semibold text-primary-foreground disabled:opacity-60">{busy?'Saving…':'Save changes'}</button>
            <button onClick={() => setConfirmDelete(true)} disabled={busy} className="h-11 px-4 rounded-xl border border-border text-expense hover:bg-expense/10 font-semibold">Delete</button>
          </div>
        </>
      )}
    </Modal>
  )
}
function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: { id: string; email?: string }) => void }) {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) {
      setMessage(result.error.message.toLowerCase().includes('invalid') ? 'Invalid email or password.' : result.error.message)
      return
    }
    if (result.data.user && result.data.session) {
      onAuthenticated({ id: result.data.user.id, email: result.data.user.email })
    } else {
      setMessage('Check your email to confirm your account, then sign in.')
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-primary text-primary-foreground">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center gap-10 px-5 py-10 md:flex-row md:items-center md:gap-16 md:px-10 lg:px-16">
        <div className="max-w-xl flex-1">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <WalletCards className="size-5" />
            </div>
            <div>
              <p className="font-semibold tracking-tight">Kolo Ledger</p>
              <p className="text-xs text-primary-foreground/65">Security Systems & Solutions</p>
            </div>
          </div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-accent">Private business workspace</p>
          <h1 className="max-w-lg text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            Know what came in. Know what went out.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-primary-foreground/70 md:text-lg">
            A calm, clear place for your team to record sales, track expenses, and protect every cedi.
          </p>
          <div className="mt-10 grid max-w-md grid-cols-2 gap-3">
            <div className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 p-4">
              <p className="text-2xl font-semibold">GHS</p>
              <p className="mt-1 text-sm text-primary-foreground/60">Your currency, built in</p>
            </div>
            <div className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 p-4">
              <p className="text-2xl font-semibold">100%</p>
              <p className="mt-1 text-sm text-primary-foreground/60">Clear team access</p>
            </div>
          </div>
          <p className="mt-10 text-sm text-primary-foreground/45">For authorised members of your business only.</p>
        </div>
        <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-sm text-card-foreground">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <WalletCards className="size-5" />
            </div>
            <div>
              <p className="font-semibold">Kolo Ledger</p>
              <p className="text-xs text-muted-foreground">Secure business records</p>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-card-foreground">Sign in to your ledger</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Manage sales, expenses, reports, and audit history in Ghana cedis.
          </p>
          
          <input
            required
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email address"
            className="mt-6 h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />

          <div className="relative mt-3">
            <input
              required
              minLength={6}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="h-11 w-full rounded-xl border border-input bg-background pl-3 pr-10 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground focus:outline-none"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>

          {message && <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">{message}</p>}
          <button className="mt-5 h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:opacity-90 transition-opacity">
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMessage('Please contact your administrator to receive an invitation email to request access.')}
            className="mt-4 w-full text-sm font-semibold text-primary hover:underline"
          >
            Need access? Contact your administrator
          </button>
        </form>
      </div>
    </main>
  )
}
function Modal({ title, close, children }: { title:string; close:()=>void; children:React.ReactNode }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4"><div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><button onClick={close} aria-label="Close dialog"><X className="size-5" /></button></div><div className="flex flex-col gap-3">{children}</div></div></div> }

function SetPasswordScreen({ onPasswordSet }: { onPasswordSet: () => void }) {
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setMessage('Passwords do not match.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setMessage(error.message)
      return
    }
    onPasswordSet()
  }

  return (
    <main className="min-h-screen overflow-hidden bg-primary text-primary-foreground">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center gap-10 px-5 py-10 md:flex-row md:items-center md:gap-16 md:px-10 lg:px-16">
        <div className="max-w-xl flex-1">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
              <WalletCards className="size-5" />
            </div>
            <div>
              <p className="font-semibold tracking-tight">Kolo Ledger</p>
              <p className="text-xs text-primary-foreground/65">Security Systems & Solutions</p>
            </div>
          </div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-accent">Private business workspace</p>
          <h1 className="max-w-lg text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            Set up your security password.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-primary-foreground/70 md:text-lg">
            Create a secure password to finalize your workspace credentials and secure your access.
          </p>
        </div>
        <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-border bg-card p-7 shadow-sm text-card-foreground">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <WalletCards className="size-5" />
            </div>
            <div>
              <p className="font-semibold">Kolo Ledger</p>
              <p className="text-xs text-muted-foreground">Secure password setup</p>
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-card-foreground">Set your password</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Enter a secure password for your new business accounting account.
          </p>
          
          <div className="relative mt-6">
            <input
              required
              minLength={6}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="New password (min 6 chars)"
              className="h-11 w-full rounded-xl border border-input bg-background pl-3 pr-10 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground focus:outline-none"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>

          <input
            required
            minLength={6}
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="mt-3 h-11 w-full rounded-xl border border-input bg-background px-3 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />

          {message && <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">{message}</p>}
          
          <button
            type="submit"
            disabled={loading}
            className="mt-5 h-11 w-full rounded-xl bg-primary font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Saving password...' : 'Save password & continue'}
          </button>
        </form>
      </div>
    </main>
  )
}

export { LedgerDashboard }
