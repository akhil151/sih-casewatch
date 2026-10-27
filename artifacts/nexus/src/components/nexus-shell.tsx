import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/auth/AuthContext';
import { NotificationCenter } from '@/components/notification-center';
import {
  Activity, Bell, Building2, ChartNoAxesCombined, ChevronDown, CircleHelp,
  ClipboardList, Clock3, Command, FileSearch, GitCompareArrows, Landmark,
  Menu, Search, Settings2, ShieldCheck, Sparkles, X,
} from 'lucide-react';

const nav = [
  { label: 'Overview', href: '/', icon: Command, group: 'Workspace' },
  { label: 'Institutions', href: '/institutions', icon: Building2, group: 'Workspace' },
  { label: 'Case register', href: '/complaints', icon: ClipboardList, group: 'Workspace' },
  { label: 'Coordination review', href: '/coordination', icon: GitCompareArrows, group: 'Workspace', badge: 'Review' },
  { label: 'Notifications', href: '/notifications', icon: Bell, group: 'Workspace' },
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
    <aside className="flex h-full w-[256px] shrink-0 flex-col bg-[hsl(var(--sidebar))] text-[hsl(var(--sidebar-foreground))]">
      <div className="flex h-[72px] items-center gap-3 border-b border-[hsl(var(--sidebar-border))] px-5">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-400/25 bg-emerald-500/10 text-emerald-300">
          <Landmark size={18} strokeWidth={1.9} />
        </div>
        <div>
          <div className="font-[var(--app-font-serif)] text-[16px] font-extrabold tracking-[.15em] text-white">NEXUS</div>
          <div className="text-[9px] font-medium uppercase tracking-[.18em] text-slate-400">Institutional Intelligence</div>
        </div>
      </div>
      <div className="mx-3.5 mt-4 rounded-lg border border-white/10 bg-white/[.04] px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" /> Operations workspace
        </div>
        <div className="mt-1 text-xs font-medium text-slate-200">AICTE · Technical Education</div>
      </div>
      <nav className="nexus-scroll mt-4 flex-1 overflow-y-auto px-3 pb-4">
        {['Workspace', 'Intelligence', 'Governance'].map((group) => (
          <div key={group} className="mb-4">
            <div className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[.18em] text-slate-400/80">{group}</div>
            <div className="space-y-0.5">
              {nav.filter((item) => item.group === group && (item.href !== '/administration' || mode === 'demo' || profile?.role === 'administrator')).map(({ label, href, icon: Icon, badge }) => {
                const active = location === href || (href !== '/' && location.startsWith(`${href}/`));
                return (
                  <Link key={href} href={href} onClick={closeMenu} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}
                    className={`group flex h-9 items-center gap-2.5 rounded-md text-[12px] transition-colors ${active ? 'border-l-[3px] border-[#4E9B7B] bg-white/[.09] pl-2.5 pr-3 font-semibold text-white shadow-2xs' : 'pl-3 pr-3 text-slate-300/85 hover:bg-white/[.045] hover:text-white'}`}>
                    <Icon size={15} strokeWidth={active ? 2 : 1.7} className={active ? 'text-emerald-300' : 'text-slate-400 group-hover:text-slate-200'} />
                    <span className="flex-1 truncate">{label}</span>
                    {badge && <span className="rounded-full border border-amber-400/30 bg-amber-400/15 px-2 py-0.2 text-[8px] font-bold tracking-wide text-amber-200">QUEUE</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-[hsl(var(--sidebar-border))] p-3.5">
        <Link href="/reliability" onClick={closeMenu} className="mb-2.5 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] text-slate-300/90 transition hover:bg-white/[.05] hover:text-white">
          <ShieldCheck size={14} className="text-emerald-300" /> Source integrity status
          <span className="ml-auto text-[9px] font-semibold text-emerald-300">ACTIVE</span>
        </Link>
        <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[.04] p-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-[11px] font-bold text-slate-100 shadow-2xs">{(profile?.displayName ?? 'MO').slice(0, 2).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-semibold text-white">{profile?.displayName ?? 'Monitoring officer'}</div>
            <div className="truncate text-[9px] text-slate-400">{profile?.role ?? (mode === 'demo' ? 'SIMULATED reviewer' : 'Officer workspace')}</div>
          </div>
          <button title={mode === 'demo' ? 'Leave simulated mode' : 'Sign out'} onClick={() => mode === 'demo' ? leaveDemoMode() : signOut()} className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white" data-testid="button-account-menu"><ChevronDown size={14} /></button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="fixed inset-y-0 left-0 z-30 hidden lg:block">{sidebar}</div>
      {mobileOpen && <div className="fixed inset-0 z-40 lg:hidden"><button aria-label="Close navigation" onClick={closeMenu} className="absolute inset-0 bg-slate-950/45 backdrop-blur-xs" /><div className="relative h-full w-[min(84vw,280px)] shadow-2xl">{sidebar}<button onClick={closeMenu} className="absolute right-3 top-3 rounded p-1 text-white" aria-label="Close menu"><X size={17} /></button></div></div>}
      <div className="min-h-[100dvh] lg:pl-[256px]">
        <header className="sticky top-0 z-20 flex h-[64px] items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/92 px-4 backdrop-blur-md sm:px-7">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} aria-label="Open navigation" className="rounded-lg border border-[hsl(var(--border))] bg-card p-2 text-muted-foreground shadow-2xs lg:hidden"><Menu size={16} /></button>
            <div className="hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex"><span>Operations</span><span className="text-slate-300">/</span><span className="font-semibold text-foreground">{title}</span></div>
            <div className="text-sm font-semibold sm:hidden">{title}</div>
          </div>
          <div className="flex items-center gap-2.5">
            <Link href="/coordination" className="hidden h-8 items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-card px-3 text-[11px] font-medium text-muted-foreground shadow-2xs transition hover:border-[#376B58]/40 hover:text-foreground md:flex"><Search size={13} /> Find a record <kbd className="ml-3 rounded border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">/</kbd></Link>
            <div className="hidden h-7 items-center rounded-full border border-[hsl(var(--border))] bg-card px-2.5 text-[9px] font-semibold uppercase tracking-[.1em] text-muted-foreground shadow-2xs sm:flex"><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${mode === 'demo' ? 'bg-amber-500' : 'bg-emerald-500'}`} />{mode === 'demo' ? 'Simulated Workspace' : 'Connected Workspace'}</div>
            <NotificationCenter />
            <Link href="/reliability" title="Help and data status" className="grid h-8 w-8 place-items-center rounded-lg border border-[hsl(var(--border))] bg-card text-muted-foreground shadow-2xs transition hover:border-[#376B58]/40 hover:text-primary"><CircleHelp size={15} /></Link>
          </div>
        </header>
        {mode === 'demo' && <div className="flex items-center justify-between border-b border-[#E3D9C0] bg-[#FAF6EA] px-4 py-2 text-[11px] text-[#6E5420] sm:px-7">
          <div><strong className="mr-1.5 font-bold uppercase tracking-[.09em]">Simulated mode</strong> This workspace contains demonstration records and workflow examples only. No official facts or external integrations are represented.</div>
          <button onClick={leaveDemoMode} className="ml-3 shrink-0 font-semibold underline underline-offset-2" data-testid="button-exit-demo">Exit demo</button>
        </div>}
        {mode === 'setup' && <div className="flex items-center gap-2 border-b border-sky-200 bg-sky-50 px-4 py-2 text-[11px] text-sky-900 sm:px-7"><FileSearch size={14} /> Configuration required. Live mode is unavailable until an administrator completes setup.</div>}
        <main className="page-enter mx-auto max-w-[1560px] px-4 py-6 sm:px-7 sm:py-8">{children}</main>
        <footer className="mx-auto flex max-w-[1560px] flex-col gap-1 border-t border-[hsl(var(--border))] px-4 py-4 text-[9px] font-medium uppercase tracking-[.12em] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <span>NEXUS · Institutional Complaint Coordination</span><span>Source-Attributed Lineage · Human Determination Governed</span>
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
    <div className="grid min-h-[100dvh] bg-[hsl(var(--background))] lg:grid-cols-[1.1fr_.9fr]">
      {/* Left Column: Sophisticated Hero Showcase */}
      <div className="relative hidden overflow-hidden bg-[#131B26] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        {/* Subtle Warm Ambient Backdrop Glows */}
        <div className="pointer-events-none absolute -right-28 -top-28 h-[540px] w-[540px] rounded-full bg-radial from-emerald-500/10 via-transparent to-transparent blur-2xl" />
        <div className="pointer-events-none absolute -bottom-36 left-10 h-[480px] w-[480px] rounded-full bg-radial from-[#376B58]/15 via-transparent to-transparent blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-20 h-[380px] w-[380px] rounded-full border border-white/[.06]" />
        <div className="pointer-events-none absolute -right-4 top-36 h-[220px] w-[220px] rounded-full border border-emerald-500/15" />

        <div className="relative flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-400/25 bg-emerald-500/10 text-emerald-300 shadow-sm">
            <Landmark size={20} strokeWidth={2} />
          </div>
          <div>
            <div className="font-[var(--app-font-serif)] text-lg font-extrabold tracking-[.16em] text-white">NEXUS</div>
            <div className="text-[9px] uppercase tracking-[.18em] text-slate-400">Complaint Intelligence Platform</div>
          </div>
        </div>

        <div className="relative max-w-xl pb-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.16em] text-emerald-300">
            <Sparkles size={11} /> AICTE Problem Statement 26264
          </div>
          <h1 className="font-[var(--app-font-serif)] text-4xl font-semibold leading-[1.12] tracking-[-.03em] text-white sm:text-5xl">
            See the record.<br />Keep the evidence.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed text-slate-300/90">
            A quiet, evidence-first coordination platform consolidating source-attributed complaints across Regional Bureaus (RB) and PGRC workflows with human-in-the-loop determination.
          </p>

          <div className="mt-8 grid max-w-lg gap-3.5 border-t border-white/10 pt-6">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-bold text-emerald-300">1</span>
              <div>
                <strong className="text-xs font-semibold text-white">Verifiable Attribution:</strong>
                <p className="text-[11px] text-slate-400">Originating bureau facts and procedural actions are preserved without lossy synthesis.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-bold text-emerald-300">2</span>
              <div>
                <strong className="text-xs font-semibold text-white">Transparent Coordination:</strong>
                <p className="text-[11px] text-slate-400">Potential cross-bureau overlap is surfaced as a review prompt, never as an unreviewed finding.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10 text-[10px] font-bold text-emerald-300">3</span>
              <div>
                <strong className="text-xs font-semibold text-white">Cryptographic Governance:</strong>
                <p className="text-[11px] text-slate-400">Role-governed Row Level Security with immutable audit logging for all determinations.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-between border-t border-white/10 pt-4 text-[10px] text-slate-400">
          <span>Evidence-First Architecture</span>
          <span>Access Restricted to Authorized Personnel</span>
        </div>
      </div>

      {/* Right Column: Refined SaaS Authentication Card */}
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-[420px] rounded-2xl border border-[hsl(var(--border))] bg-card p-8 shadow-lg sm:p-10">
          <div className="mb-6 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-700/20 bg-emerald-700/10 text-[#376B58]">
                <Landmark size={16} />
              </div>
              <span className="font-[var(--app-font-serif)] text-lg font-extrabold tracking-[.15em] text-[#1E2838]">NEXUS</span>
            </div>
          </div>

          <div className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#376B58]">
            {accessPending ? 'Account Review' : setupRequired ? 'Configuration Required' : 'Institutional Portal'}
          </div>

          <h2 className="font-[var(--app-font-serif)] text-2xl font-bold tracking-tight text-[#1E2838]">
            {accessPending ? 'Approval is Pending' : setupRequired ? 'Database Setup Required' : 'Sign in to NEXUS'}
          </h2>

          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {accessPending
              ? 'Your Google account is authenticated, but an approved administrator must verify your operational role before institutional records can be accessed.'
              : setupRequired
              ? 'Live access requires configuring the Supabase database URL and client key in artifacts/nexus/.env.local.'
              : 'Sign in with your authorized institutional Google account to access case registries and review queues.'}
          </p>

          {profile && (
            <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
              <div className="font-semibold">Review in progress</div>
              <div className="mt-1 text-[11px]">Role: <span className="font-mono">{profile.role}</span> · Status: <span className="font-mono">{profile.approvalStatus}</span></div>
            </div>
          )}

          {authError && (
            <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
              {authError}
            </div>
          )}

          {supabaseConfigured && !accessPending && (
            <div className="mt-7 space-y-3">
              <button
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await signInWithGoogle();
                  } catch {
                    /* Provider reports error in access panel */
                  } finally {
                    setBusy(false);
                  }
                }}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-[#D5D0C5] bg-[#FFFFFF] px-4 text-xs font-semibold text-[#1E2838] shadow-xs transition hover:border-[#376B58] hover:bg-[#FDFCF9] focus:outline-none focus:ring-2 focus:ring-[#376B58]/20 disabled:cursor-not-allowed disabled:opacity-50"
                data-testid="button-sign-in"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                {busy ? 'Initiating Google sign-in…' : 'Continue with Google Workspace'}
              </button>
            </div>
          )}

          {setupRequired && (
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-600">
              <strong className="text-slate-800">Disconnected state</strong>
              <p className="mt-1">Supabase URL and client key are not configured. Configure environment variables to activate live authentication.</p>
            </div>
          )}

          {/* Discreet Offline / Evaluation Mode Link (Maintains full offline capability without dominating UI) */}
          {!accessPending && (
            <div className="mt-8 border-t border-[hsl(var(--border))] pt-6 text-center">
              <p className="text-[11px] text-muted-foreground">Evaluating NEXUS or presenting offline?</p>
              <button
                onClick={enterDemoMode}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#376B58] transition hover:underline"
                data-testid="button-enter-demo"
              >
                Access simulated evaluation workspace &rarr;
              </button>
              <p className="mt-1 text-[9px] text-muted-foreground/80">
                Operates locally in-browser with simulated records without altering Supabase.
              </p>
            </div>
          )}

          {mode === 'signed-in' && (
            <button
              onClick={signOut}
              className="mt-4 w-full text-center text-xs text-muted-foreground transition hover:text-foreground hover:underline"
            >
              Sign out of active account
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

