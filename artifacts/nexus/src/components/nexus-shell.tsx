import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/auth/AuthContext';
import {
  Activity, Building2, ChartNoAxesCombined, ChevronDown, CircleHelp,
  ClipboardList, Clock3, Command, FileSearch, GitCompareArrows, Landmark,
  Menu, Search, Settings2, ShieldCheck, X,
} from 'lucide-react';

const nav = [
  { label: 'Overview', href: '/', icon: Command, group: 'Workspace' },
  { label: 'Institutions', href: '/institutions', icon: Building2, group: 'Workspace' },
  { label: 'Case register', href: '/complaints', icon: ClipboardList, group: 'Workspace' },
  { label: 'Coordination review', href: '/coordination', icon: GitCompareArrows, group: 'Workspace', badge: 'Review' },
  { label: 'Procedural lineage', href: '/timeline', icon: Clock3, group: 'Workspace' },
  { label: 'Reports', href: '/analytics', icon: ChartNoAxesCombined, group: 'Intelligence' },
  { label: 'Source reliability', href: '/reliability', icon: Activity, group: 'Intelligence' },
  { label: 'Administration', href: '/administration', icon: Settings2, group: 'Governance' },
];

export function NexusShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { mode, profile, enterDemoMode, leaveDemoMode, signOut } = useAuth();
  const title = nav.find((item) => item.href === location)?.label ??
    (location.startsWith('/institutions/') ? 'Institution record' : location.startsWith('/complaints/') ? 'Case record' : 'NEXUS');
  const closeMenu = () => setMobileOpen(false);
  const sidebar = (
    <aside className="flex h-full w-[254px] shrink-0 flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
      <div className="flex h-[76px] items-center gap-3 border-b border-[hsl(var(--sidebar-border))] px-6">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-white/15 bg-white/5 text-[hsl(var(--sidebar-primary))]">
          <Landmark size={18} strokeWidth={1.8} />
        </div>
        <div>
          <div className="font-[var(--app-font-serif)] text-[17px] font-extrabold tracking-[.14em] text-white">NEXUS</div>
          <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.16em] text-slate-400">Institution coordination</div>
        </div>
      </div>
      <div className="mx-4 mt-5 rounded-md border border-white/10 bg-white/[.045] px-3 py-2.5">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.13em] text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Operations workspace
        </div>
        <div className="mt-1.5 text-xs font-medium text-slate-100">Technical education</div>
      </div>
      <nav className="nexus-scroll mt-5 flex-1 overflow-y-auto px-3 pb-4">
        {['Workspace', 'Intelligence', 'Governance'].map((group) => (
          <div key={group} className="mb-5">
            <div className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[.17em] text-slate-500">{group}</div>
            <div className="space-y-1">
              {nav.filter((item) => item.group === group && (item.href !== '/administration' || mode === 'demo' || profile?.role === 'administrator')).map(({ label, href, icon: Icon, badge }) => {
                const active = location === href || (href !== '/' && location.startsWith(`${href}/`));
                return (
                  <Link key={href} href={href} onClick={closeMenu} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}
                    className={`group flex h-10 items-center gap-3 rounded-md px-3 text-[12px] transition-colors ${active ? 'bg-white/10 font-semibold text-white' : 'text-slate-300 hover:bg-white/[.06] hover:text-white'}`}>
                    <Icon size={16} strokeWidth={1.8} className={active ? 'text-[hsl(var(--sidebar-primary))]' : 'text-slate-400 group-hover:text-slate-200'} />
                    <span className="flex-1">{label}</span>
                    {badge && <span className="rounded bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-amber-200">QUEUE</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-[hsl(var(--sidebar-border))] p-4">
        <Link href="/reliability" onClick={closeMenu} className="mb-3 flex items-center gap-2 rounded-md px-2 py-2 text-[11px] text-slate-300 hover:bg-white/[.06]">
          <ShieldCheck size={15} className="text-emerald-300" /> Source integrity status
          <span className="ml-auto text-[9px] font-medium text-emerald-300">VIEW</span>
        </Link>
        <div className="flex items-center gap-2.5 rounded-md bg-white/[.05] p-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-500/35 text-[11px] font-bold text-slate-100">{(profile?.displayName ?? 'MO').slice(0, 2).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold text-white">{profile?.displayName ?? 'Monitoring officer'}</div>
            <div className="truncate text-[9px] text-slate-400">{profile?.role ?? (mode === 'demo' ? 'SIMULATED reviewer' : 'Officer workspace')}</div>
          </div>
          <button title={mode === 'demo' ? 'Leave simulated mode' : 'Sign out'} onClick={() => mode === 'demo' ? leaveDemoMode() : signOut()} className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white" data-testid="button-account-menu"><ChevronDown size={15} /></button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">{sidebar}</div>
      {mobileOpen && <div className="fixed inset-0 z-40 lg:hidden"><button aria-label="Close navigation" onClick={closeMenu} className="absolute inset-0 bg-slate-950/40" /><div className="relative h-full w-[min(84vw,280px)] shadow-2xl">{sidebar}<button onClick={closeMenu} className="absolute right-3 top-3 rounded p-1 text-white" aria-label="Close menu"><X size={17} /></button></div></div>}
      <div className="min-h-[100dvh] lg:pl-[254px]">
        <header className="sticky top-0 z-20 flex h-[66px] items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 px-4 backdrop-blur-md sm:px-7">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="rounded-md border border-[hsl(var(--border))] bg-card p-2 text-muted-foreground lg:hidden"><Menu size={17} /></button>
            <div className="hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex"><span>Operations</span><span className="text-slate-300">/</span><span className="font-semibold text-foreground">{title}</span></div>
            <div className="text-sm font-semibold sm:hidden">{title}</div>
          </div>
          <div className="flex items-center gap-2.5">
            <Link href="/coordination" className="hidden h-8 items-center gap-2 rounded-md border border-[hsl(var(--border))] bg-card px-3 text-[11px] font-medium text-muted-foreground hover:text-foreground md:flex"><Search size={13} /> Find a record <kbd className="ml-3 rounded border px-1 py-0.5 font-mono text-[9px]">/</kbd></Link>
            <div className="hidden h-7 items-center rounded border border-[hsl(var(--border))] bg-card px-2 text-[9px] font-semibold uppercase tracking-[.1em] text-muted-foreground sm:flex"><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${mode === 'demo' ? 'bg-amber-500' : 'bg-emerald-500'}`} />{mode === 'demo' ? 'Demo session' : 'Secure workspace'}</div>
            <Link href="/reliability" title="Help and data status" className="grid h-8 w-8 place-items-center rounded-md border border-[hsl(var(--border))] bg-card text-muted-foreground hover:text-primary"><CircleHelp size={15} /></Link>
          </div>
        </header>
        {mode === 'demo' && <div className="flex items-center justify-between border-b border-amber-200 bg-[#fbf4df] px-4 py-2 text-[11px] text-[#715625] sm:px-7">
          <div><strong className="mr-1.5 font-bold uppercase tracking-[.09em]">Simulated data</strong> This workspace contains demonstration records and workflow examples only. No official facts or external integrations are represented.</div>
          <button onClick={leaveDemoMode} className="ml-3 shrink-0 font-semibold underline underline-offset-2" data-testid="button-exit-demo">Exit demo</button>
        </div>}
        {mode === 'setup' && <div className="flex items-center gap-2 border-b border-sky-200 bg-sky-50 px-4 py-2 text-[11px] text-sky-900 sm:px-7"><FileSearch size={14} /> Configuration required. Live mode is unavailable until an administrator completes setup.</div>}
        <main className="page-enter mx-auto max-w-[1560px] px-4 py-6 sm:px-7 sm:py-8">{children}</main>
        <footer className="mx-auto flex max-w-[1560px] flex-col gap-1 border-t border-[hsl(var(--border))] px-4 py-4 text-[9px] font-medium uppercase tracking-[.1em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <span>NEXUS · Institutional complaint coordination</span><span>Source-attributed records · Human review remains authoritative</span>
        </footer>
      </div>
    </div>
  );
}

export function AccessGate() {
  const { mode, isLoading, profile, supabaseConfigured, authError, signInWithGoogle, enterDemoMode, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  if (isLoading) return <div className="grid min-h-[100dvh] place-items-center bg-[hsl(var(--background))]"><div className="w-[260px] space-y-3"><div className="h-3 w-28 animate-pulse rounded bg-slate-200" /><div className="h-8 animate-pulse rounded bg-slate-200" /><div className="h-3 w-3/4 animate-pulse rounded bg-slate-200" /></div></div>;
  const setupRequired = !supabaseConfigured;
  const accessPending = mode === 'signed-in' && profile?.approvalStatus !== 'approved';
  if (mode === 'demo' || (mode === 'signed-in' && !accessPending)) return null;
  return (
    <div className="grid min-h-[100dvh] bg-[#eef2f6] lg:grid-cols-[1.05fr_.95fr]">
      <div className="relative hidden overflow-hidden bg-[#1b2b42] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-28 h-[560px] w-[560px] rounded-full border border-white/10" /><div className="absolute -right-12 top-8 h-[400px] w-[400px] rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-lg border border-white/20 bg-white/5 text-sky-200"><Landmark size={20} /></div><div><div className="font-[var(--app-font-serif)] text-lg font-extrabold tracking-[.16em]">NEXUS</div><div className="text-[9px] uppercase tracking-[.18em] text-slate-400">Coordination workspace</div></div></div>
        <div className="relative max-w-xl pb-14">
          <div className="mb-5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-sky-200"><span className="h-px w-7 bg-sky-300" />Institution-first operations</div>
          <h1 className="font-[var(--app-font-serif)] text-5xl font-semibold leading-[1.08] tracking-[-.04em]">See the record.<br />Keep the evidence.</h1>
          <p className="mt-6 max-w-md text-sm leading-6 text-slate-300">A careful workspace for complaint lineage, source coverage and human-led coordination across technical education administration.</p>
        </div>
        <div className="relative flex items-center justify-between border-t border-white/15 pt-5 text-[10px] text-slate-400"><span>Evidence-first by design</span><span>Access is governed by role</span></div>
      </div>
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-[410px] rounded-xl border border-[#dce3ea] bg-white p-7 shadow-[0_16px_45px_rgba(32,50,70,.07)] sm:p-9">
          <div className="mb-7 lg:hidden"><div className="font-[var(--app-font-serif)] text-xl font-extrabold tracking-[.15em] text-[#20344e]">NEXUS</div><div className="mt-1 text-[10px] uppercase tracking-[.13em] text-slate-500">Institution coordination</div></div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[.15em] text-[#58718c]">{accessPending ? 'Account review' : setupRequired ? 'Workspace configuration' : 'Officer access'}</div>
          <h2 className="font-[var(--app-font-serif)] text-[26px] font-bold tracking-[-.035em] text-[#203149]">{accessPending ? 'Approval is pending' : setupRequired ? 'Secure access is not configured' : 'Sign in to NEXUS'}</h2>
          <p className="mt-2 text-[12px] leading-5 text-slate-600">{accessPending ? 'Your account is authenticated, but an administrator must approve its role before institutional records are available.' : setupRequired ? 'Live access requires an administrator to complete the authentication configuration.' : 'Use your authorized account to access institutional records and review work.'}</p>
          {profile && <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Your account is awaiting approval. Access status: {profile.approvalStatus}.</div>}
          {authError && <div role="alert" className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{authError}</div>}
          {supabaseConfigured && !accessPending && <button disabled={busy} onClick={async () => { setBusy(true); try { await signInWithGoogle(); } catch { /* The provider reports the error in the access panel. */ } finally { setBusy(false); } }} className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#233a56] text-xs font-semibold text-white transition hover:bg-[#1a2e46] disabled:cursor-not-allowed disabled:opacity-50" data-testid="button-sign-in">
            <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-white text-[11px] font-bold text-[#34495e]">G</span>{busy ? 'Connecting…' : 'Continue with Google'}
          </button>}
          {setupRequired && <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-600"><strong className="text-slate-800">Disconnected state</strong><br />Supabase URL and public key are not configured. No live data or authentication is available.</div>}
          {!accessPending && <><div className="my-6 flex items-center gap-3 text-[9px] font-semibold uppercase tracking-[.12em] text-slate-400"><span className="h-px flex-1 bg-slate-200" />Demonstration access<span className="h-px flex-1 bg-slate-200" /></div>
          <button onClick={enterDemoMode} className="h-10 w-full rounded-md border border-slate-300 bg-white text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50" data-testid="button-enter-demo">Enter simulated workspace</button>
          <p className="mt-3 text-center text-[10px] leading-4 text-slate-500">SIMULATED records only. Demo actions do not represent official decisions.</p></>}
          {mode === 'signed-in' && <button onClick={signOut} className="mt-3 w-full text-[10px] text-slate-500 underline">Sign out</button>}
        </div>
      </div>
    </div>
  );
}
