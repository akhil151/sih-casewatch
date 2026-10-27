import { useMemo, useState, type ReactNode, type ElementType } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useLocation } from 'wouter';
import {
  Activity, AlertCircle, ArrowRight, BookOpen, Building2, Check, CheckCheck, CheckCircle2,
  ChevronRight, CircleHelp, ClipboardList, Clock3, Download, ExternalLink, FileClock, FileSearch,
  GitCompareArrows, Landmark, LockKeyhole, Plus, RefreshCw, Search, ShieldAlert,
  ShieldCheck, Sparkles, X,
} from 'lucide-react';
import {
  getAdministration, getAnalytics, getCase, getDashboard, getInstitution,
  getReliability, getTimeline, listCases, listCoordinationItems, listInstitutions,
  listNotifications, markAllNotificationsRead, markNotificationRead,
  resetSimulatedChanges, submitCoordinationReview, updateProfileAccess,
  upsertStatusMapping,
} from '@/data/nexus-data';
import type { ReviewDecision } from '@/data/nexus-data';
import { useAuth } from '@/auth/AuthContext';

type AnyRecord = Record<string, any>;
const decisions: { value: ReviewDecision; label: string; desc: string }[] = [
  { value: 'confirmed_same_matter', label: 'Confirmed — same matter', desc: 'Evidence supports one underlying matter.' },
  { value: 'related_but_distinct', label: 'Related, but distinct', desc: 'A documented relationship exists; matters remain separate.' },
  { value: 'legitimate_procedural_progression', label: 'Procedural progression', desc: 'The records reflect a legitimate referral or progression.' },
  { value: 'potential_parallel_action', label: 'Potential parallel action', desc: 'Concurrent action merits follow-up; not an official finding.' },
  { value: 'insufficient_evidence', label: 'Insufficient evidence', desc: 'Available sources do not support a determination.' },
  { value: 'dismissed_suggestion', label: 'Dismiss suggestion', desc: 'The proposed relationship is not supported.' },
];

function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-col gap-4 border-b border-[hsl(var(--border))] pb-5 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#376B58]">
        <span className="h-px w-5 bg-[#376B58]/40" />{eyebrow}
      </div>
      <h1 className="font-[var(--app-font-serif)] text-[26px] font-bold leading-tight tracking-[-.03em] text-[#1E2838] sm:text-[30px]">{title}</h1>
      <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>;
}

function Panel({ children, className = '', title, detail, action }: { children: ReactNode; className?: string; title?: string; detail?: string; action?: ReactNode }) {
  return <section className={`rounded-xl border border-[hsl(var(--card-border))] bg-card shadow-xs transition-shadow duration-200 ${className}`}>
    {title && <div className="flex items-start justify-between gap-3 border-b border-[hsl(var(--border))] px-5 py-3.5">
      <div>
        <h2 className="text-[12px] font-bold text-[#1E2838]">{title}</h2>
        {detail && <p className="mt-0.5 text-[10px] text-muted-foreground">{detail}</p>}
      </div>
      {action}
    </div>}
    {children}
  </section>;
}

function StatePanel({ loading, error, empty, retry, children, emptyTitle = 'No records found', emptyText = 'Adjust the selection or check again later.' }: { loading?: boolean; error?: unknown; empty?: boolean; retry?: () => void; children?: ReactNode; emptyTitle?: string; emptyText?: string }) {
  if (loading) return <div className="space-y-3 rounded-xl border border-[hsl(var(--border))] bg-card p-5"><div className="h-3 w-32 animate-pulse rounded bg-slate-200" /><div className="h-9 animate-pulse rounded bg-slate-100" /><div className="h-9 animate-pulse rounded bg-slate-100" /><div className="h-9 animate-pulse rounded bg-slate-100" /></div>;
  if (error) return <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-red-200 bg-[#FFFDFD] p-6 text-center"><AlertCircle size={22} className="mb-2 text-red-600" /><p className="text-sm font-semibold text-red-900">Records could not be loaded</p><p className="mt-1 max-w-sm text-[11px] leading-relaxed text-red-800/80">The source may be disconnected or temporarily unavailable. No records have been inferred.</p>{retry && <button onClick={retry} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-800 shadow-2xs hover:bg-red-50"><RefreshCw size={13} /> Retry</button>}</div>;
  if (empty) return <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-[hsl(var(--border))] bg-card px-6 py-8 text-center"><div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-[#E8F0E9] text-[#376B58]"><FileSearch size={18} /></div><p className="text-sm font-semibold text-[#1E2838]">{emptyTitle}</p><p className="mt-1 max-w-md text-[11px] leading-relaxed text-muted-foreground">{emptyText}</p></div>;
  return <>{children}</>;
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'blue' | 'green' | 'amber' | 'red' }) {
  const tones = {
    neutral: 'border-[#E5E1D8] bg-[#F5F3EC] text-[#55606E]',
    blue: 'border-[#CDE0DC] bg-[#EAF2F0] text-[#265349]',
    green: 'border-[#CFE3D5] bg-[#EEF5F0] text-[#245842]',
    amber: 'border-[#EFE1C3] bg-[#FDF8EC] text-[#825B1D]',
    red: 'border-[#F5D5D3] bg-[#FDF2F1] text-[#9A2D2A]',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold leading-4 tracking-wide ${tones[tone]}`}>{children}</span>;
}

function DataLabel({ children }: { children: ReactNode }) { return <div className="mb-1 text-[9px] font-bold uppercase tracking-[.14em] text-muted-foreground">{children}</div>; }
function fmt(value?: string | null) { if (!value) return 'Not recorded'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
function countLabel(n?: number) { return typeof n === 'number' ? n.toLocaleString('en-IN') : '—'; }
function toneFor(value?: string) { const s = value?.toLowerCase() ?? ''; return /stale|overdue|restricted|conflict|delayed|error|unresolved/.test(s) ? 'red' : /review|pending|partial|aging|warning/.test(s) ? 'amber' : /verified|fresh|resolved|active|complete/.test(s) ? 'green' : 'neutral'; }
function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return <label className="flex min-w-[130px] flex-col gap-1 text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">{label}<select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-lg border border-[hsl(var(--input))] bg-card px-2.5 text-[11px] font-medium normal-case tracking-normal text-slate-700 outline-none shadow-2xs focus:border-primary focus:ring-1 focus:ring-primary/20" data-testid={`filter-${label.toLowerCase().replaceAll(' ', '-')}`}><option value="">All {label.toLowerCase()}</option>{options.filter(Boolean).map((o) => <option value={o} key={o}>{o}</option>)}</select></label>;
}

function MetricCard({ label, value, note, icon: Icon, accent = 'blue' }: { label: string; value: ReactNode; note?: string; icon: ElementType; accent?: string }) {
  return <div className="relative overflow-hidden rounded-xl border border-[hsl(var(--card-border))] bg-card p-4 sm:p-5 shadow-xs transition hover:shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">{label}</div>
        <div className="mt-2 font-[var(--app-font-serif)] text-[27px] font-bold tracking-[-.04em] text-[#1E2838]">{value}</div>
      </div>
      <div className={`grid h-8 w-8 place-items-center rounded-lg border shadow-2xs ${accent === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-700' : accent === 'green' ? 'border-[#CFE3D5] bg-[#EEF5F0] text-[#245842]' : 'border-[#CFE3D5] bg-[#E8F0E9] text-[#376B58]'}`}>
        <Icon size={16} />
      </div>
    </div>
    {note && <div className="mt-2.5 border-t border-[hsl(var(--border))]/60 pt-2 text-[10px] text-muted-foreground">{note}</div>}
  </div>;
}

export function OverviewPage() {
  const { mode } = useAuth();
  const q = useQuery({ queryKey: ['nexus-dashboard'], queryFn: getDashboard });
  const d = q.data as unknown as AnyRecord | undefined;
  const metrics = d?.metrics ?? {};
  const metricEntries = [
    { label: 'Total source cases', value: metrics.totalSourceCases, note: 'Transfers counted once', icon: ClipboardList },
    { label: 'Pending', value: metrics.pendingCases, note: 'Awaiting next recorded action', icon: Clock3 },
    { label: 'Under process', value: metrics.underProcessCases, note: 'Source status: under process', icon: Activity },
    { label: 'Disposed', value: metrics.disposedCases, note: 'Source status: disposed', icon: Check },
    { label: 'Transferred', value: metrics.transferredCases, note: 'Current bureau shown separately', icon: ArrowRight },
    { label: 'Overdue', value: metrics.overdueCases, note: 'Expected disposal date has passed', icon: Clock3, accent: 'amber' },
    { label: 'Potential overlap alerts', value: metrics.potentialOverlapAlerts, note: 'Suggestions; human review required', icon: GitCompareArrows, accent: 'amber' },
    { label: 'Unresolved identities', value: metrics.unresolvedInstitutionIdentities, note: 'Candidate or unmapped identities', icon: Building2 },
  ];
  const statusRows = (d?.statusCounts ?? []) as Array<{ status: string; count: number }>;
  const bureauRows = (d?.bureauCounts ?? []) as Array<{ bureau: string; count: number }>;
  return <div>
    <PageHeader eyebrow="Operations overview" title="Good morning, officer" description="A source-attributed view of institutional complaints, procedural activity and coordination reviews." action={<div className="flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-card px-3 py-1.5 text-[10px] font-medium text-muted-foreground shadow-2xs"><span className={`h-2 w-2 rounded-full ${q.isError ? 'bg-red-500' : q.isLoading || mode === 'demo' ? 'bg-amber-500' : 'bg-emerald-500'}`} />Data status: {q.isError ? 'unavailable' : q.isLoading ? 'checking' : mode === 'demo' ? 'simulated' : 'available'}</div>} />
    <StatePanel loading={q.isLoading} error={q.error} retry={() => q.refetch()}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricEntries.map(({ label, value, note, icon, accent }) => <MetricCard key={label} label={label} value={typeof value === 'number' ? countLabel(value) : '—'} note={note} icon={icon} accent={accent ?? 'blue'} />)}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
        <Panel title="Cases by source status" detail="Mutually exclusive status totals for source cases">
          <div className="p-4 sm:p-5">
            {statusRows.length ? <div className="space-y-3">{statusRows.map(({ status: label, count }) => <div key={label} className="grid grid-cols-[minmax(95px,1fr)_2fr_42px] items-center gap-3"><span className="truncate text-[10px] font-medium text-slate-700">{label}</span><div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[#376B58]" style={{ width: `${Math.min(100, count * 100 / Math.max(1, ...statusRows.map((entry) => entry.count)))}%` }} /></div><span className="text-right font-mono text-[10px] text-slate-700">{countLabel(count)}</span></div>)}</div> : <div className="py-9 text-center text-[11px] text-muted-foreground">No status distribution is currently available.</div>}
          </div>
          <div className="border-t border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/60 px-4 py-3"><div className="mb-2 text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Current workload by bureau</div><div className="flex flex-wrap gap-2">{bureauRows.map(({ bureau: label, count }) => <div key={label} className="rounded-lg border border-[hsl(var(--border))] bg-card px-3 py-1.5 shadow-2xs"><span className="text-[10px] text-muted-foreground">{label}</span><strong className="ml-2 font-mono text-[10px] text-[#1E2838]">{countLabel(count)}</strong></div>)}</div></div>
        </Panel>
        <Panel title="Review priority" detail="System suggestions are triage cues, not official findings." action={<Link className="text-[11px] font-semibold text-primary hover:underline" href="/coordination">Open review queue <ArrowRight size={12} className="ml-1 inline" /></Link>}>
          <StatePanel empty={!d?.priorityItems?.length} emptyTitle="No priority items" emptyText="New items will appear when source evidence requires review.">
            <div className="divide-y divide-[hsl(var(--border))]/60">{(d?.priorityItems ?? []).slice(0, 5).map((item: AnyRecord, i: number) => <Link key={item.id ?? i} href={`/coordination?item=${item.id}`} className="flex items-start gap-3 px-4 py-3.5 transition hover:bg-[#FAF9F5]"><div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 shadow-2xs"><GitCompareArrows size={14} /></div><div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold text-[#1E2838]">{item.institutionName ?? 'Institution review'}</div><div className="mt-1 text-[10px] text-muted-foreground">{item.suggestedRelationship ?? item.reviewStatus ?? 'Evidence review needed'}</div></div><ChevronRight size={14} className="mt-1 text-slate-400" /></Link>)}</div>
          </StatePanel>
        </Panel>
      </div>
      <div className="mt-4"><Panel title="Complaint intake trend" detail="Source cases by received month; descriptive counts, not a forecast"><div className="p-4 sm:p-5"><TrendChart data={d?.monthlyTrend} /></div></Panel></div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <Panel title="Recent source updates" detail="Latest source-attributed record activity" action={<Link className="text-[11px] font-semibold text-primary hover:underline" href="/complaints">View register <ArrowRight size={12} className="ml-1 inline" /></Link>}>
          <StatePanel empty={!d?.recentUpdates?.length} emptyTitle="No recent updates" emptyText="Activity will appear after records have been synchronized or reviewed.">
            <div className="divide-y divide-[hsl(var(--border))]/60">{(d?.recentUpdates ?? []).slice(0, 5).map((item: AnyRecord, i: number) => <Link key={item.id ?? i} href={`/complaints/${item.id}`} className="flex items-start gap-3 px-4 py-3 transition hover:bg-[#FAF9F5]"><div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#376B58]" /><div className="min-w-0 flex-1"><div className="text-[11px] font-semibold text-[#1E2838]">{item.sourceCaseId ?? 'Source record updated'} · {item.institutionName ?? 'Institution unresolved'}</div><div className="mt-0.5 text-[10px] text-muted-foreground">{item.source ?? 'Source'} <span className="mx-1 text-slate-300">·</span>{fmt(item.lastUpdatedAt)}</div></div><Badge tone={toneFor(item.status)}>{item.status ?? 'Updated'}</Badge></Link>)}</div>
          </StatePanel>
        </Panel>
        <Panel title="Source reliability" detail="Freshness and coverage snapshot">
          <div className="space-y-4 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3"><div><DataLabel>Stale cases</DataLabel><div className="text-[20px] font-bold text-[#1E2838]">{countLabel(d?.reliability?.staleCases)}</div></div><div><DataLabel>Open discrepancies</DataLabel><div className="text-[20px] font-bold text-[#1E2838]">{countLabel(d?.reliability?.unresolvedIssues)}</div></div></div>
            <div className="border-t border-[hsl(var(--border))]/60 pt-3">{(d?.reliability?.sourceFreshness ?? []).map((s: AnyRecord, i: number) => <div key={s.bureau ?? i} className="flex items-center justify-between py-1.5"><span className="text-[10px] text-slate-700">{s.bureau} · {s.label}</span><Badge tone={toneFor(s.state)}>{s.state}</Badge></div>)}</div>
            <Link href="/reliability" className="block border-t border-[hsl(var(--border))]/60 pt-3 text-[10px] font-semibold text-primary hover:underline">View freshness and coverage details <ArrowRight size={12} className="ml-1 inline" /></Link>
          </div>
        </Panel>
      </div>
    </StatePanel>
  </div>;
}

export function InstitutionsPage() {
  const [query, setQuery] = useState('');
  const [state, setState] = useState('');
  const [identityState, setIdentityState] = useState('');
  const q = useQuery({ queryKey: ['nexus-institutions', query, state, identityState], queryFn: () => listInstitutions({ query: query || undefined, state: state || undefined, identityState: identityState || undefined }) });
  const states = useMemo(() => [...new Set((q.data ?? []).map((i) => i.state))], [q.data]);
  const identities = useMemo(() => [...new Set((q.data ?? []).map((i) => i.identityState))], [q.data]);
  return <div><PageHeader eyebrow="Registry" title="Institutions" description="Institution records are shown with source-attributed identifiers and identity resolution states." action={<div className="rounded-lg border border-[hsl(var(--border))] bg-card px-3 py-1.5 text-[10px] font-medium text-muted-foreground shadow-2xs"><Landmark size={13} className="mr-1.5 inline text-[#376B58]" /> Registry records</div>} />
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[hsl(var(--border))] bg-card p-3.5 shadow-xs sm:flex-row sm:items-end"><label className="flex flex-1 flex-col gap-1 text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Search registry<div className="relative"><Search size={14} className="absolute left-3 top-2.5 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, alias, permanent ID or address" className="h-9 w-full rounded-lg border border-[hsl(var(--input))] bg-card pl-9 pr-3 text-[11px] font-medium normal-case tracking-normal outline-none shadow-2xs focus:border-primary focus:ring-1 focus:ring-primary/20" data-testid="input-institution-search" /></div></label><FilterSelect label="State" value={state} onChange={setState} options={states} /><FilterSelect label="Identity state" value={identityState} onChange={setIdentityState} options={identities} /><div className="pb-1 text-[11px] font-medium text-muted-foreground">{q.data?.length ?? '—'} records</div></div>
    <Panel title="Institution registry" detail="Select a record to inspect identifiers, source labels and associated complaints.">
      <StatePanel loading={q.isLoading} error={q.error} retry={() => q.refetch()} empty={!q.isLoading && !q.error && !q.data?.length} emptyTitle={query || state || identityState ? 'No matching institutions' : 'No institution records'} emptyText="Try a broader search or clear one of the selected filters.">
        <div className="nexus-scroll overflow-x-auto"><table className="w-full min-w-[780px] text-left"><thead><tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))] text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground"><th className="px-5 py-3">Institution</th><th className="px-5 py-3">State / region</th><th className="px-5 py-3">Identity</th><th className="px-5 py-3">Source labels</th><th className="px-5 py-3 text-right">Cases</th><th className="px-5 py-3"></th></tr></thead><tbody>{q.data?.map((i) => <tr key={i.id} className="border-b border-[hsl(var(--border))]/50 last:border-0 hover:bg-[#FAF9F5] transition" data-testid={`row-institution-${i.id}`}><td className="px-5 py-3.5"><Link href={`/institutions/${i.id}`} className="text-[11px] font-bold text-[#1E2838] hover:text-primary">{i.name}</Link><div className="mt-1 font-mono text-[9px] text-muted-foreground">{i.permanentId ?? `Registry ref · ${i.id}`}</div>{i.aliases?.length > 0 && <div className="mt-1 max-w-[300px] truncate text-[9px] text-muted-foreground/80">Also known as: {i.aliases.join(', ')}</div>}</td><td className="px-5 py-3 text-[10px] text-slate-700">{i.state}<div className="mt-0.5 text-[9px] text-muted-foreground">{i.region ?? 'Region not recorded'}</div></td><td className="px-5 py-3"><Badge tone={toneFor(i.identityState)}>{i.identityState}</Badge></td><td className="px-5 py-3"><div className="flex max-w-[210px] flex-wrap gap-1">{i.sourceLabels.map((s, x) => <Badge key={`${s}-${x}`}>{s}</Badge>)}</div></td><td className="px-5 py-3 text-right font-mono text-[11px] text-[#1E2838] font-semibold">{countLabel(i.caseCount)}</td><td className="px-5 py-3"><Link aria-label={`Open ${i.name}`} href={`/institutions/${i.id}`} className="text-muted-foreground transition hover:text-primary"><ChevronRight size={15} /></Link></td></tr>)}</tbody></table></div>
      </StatePanel>
    </Panel>
  </div>;
}

export function InstitutionDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ['nexus-institution', id], queryFn: () => getInstitution(id), enabled: Boolean(id) });
  const cases = useQuery({ queryKey: ['nexus-institution-cases', id, q.data?.name], queryFn: () => listCases({ query: q.data?.name ?? id }), enabled: Boolean(q.data?.name || id) });
  const i = q.data;
  return <div><PageHeader eyebrow="Institution record" title={i?.name ?? 'Institution details'} description="Identity and complaint records remain attributed to their originating sources." action={<Link href="/institutions" className="rounded-lg border border-[hsl(var(--border))] bg-card px-3 py-1.5 text-[10px] font-semibold text-slate-700 shadow-2xs hover:border-[#376B58]/40 hover:text-primary">Back to registry</Link>} />
    <StatePanel loading={q.isLoading} error={q.error} retry={() => q.refetch()} empty={!q.isLoading && !q.error && !i} emptyTitle="Institution record not found" emptyText="The record may have been removed or the identifier may be invalid.">
      {i && <>
        <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]"><Panel title="Identity record" detail="Registry attributes supplied by listed sources"><div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5"><div className="sm:col-span-2"><DataLabel>Institution name</DataLabel><div className="text-sm font-semibold text-[#1E2838]">{i.name}</div></div><div><DataLabel>Permanent identifier</DataLabel><div className="font-mono text-[11px] text-slate-700">{i.permanentId ?? 'Not recorded'}</div></div><div><DataLabel>Identity state</DataLabel><Badge tone={toneFor(i.identityState)}>{i.identityState}</Badge></div><div><DataLabel>State / region</DataLabel><div className="text-[11px] text-slate-700">{i.state} · {i.region ?? 'Region not recorded'}</div></div><div><DataLabel>Address</DataLabel><div className="text-[11px] leading-5 text-slate-700">{i.address ?? 'Address not recorded'}</div></div><div className="sm:col-span-2"><DataLabel>Known aliases</DataLabel><div className="flex flex-wrap gap-1.5">{i.aliases.length ? i.aliases.map((a) => <Badge key={a}>{a}</Badge>) : <span className="text-[10px] text-muted-foreground">No aliases recorded</span>}</div></div><div className="sm:col-span-2"><DataLabel>Source labels</DataLabel><div className="flex flex-wrap gap-1.5">{i.sourceLabels.map((s) => <Badge key={s} tone="blue">{s}</Badge>)}</div></div></div></Panel>
        <Panel title="Complaint footprint" detail="Records found against this institution"><div className="p-5"><div className="font-[var(--app-font-serif)] text-4xl font-bold text-[#1E2838]">{countLabel(i.caseCount)}</div><div className="mt-1 text-[10px] text-muted-foreground">Source case records</div><div className="mt-5 rounded-lg border border-[#CFE3D5] bg-[#EEF5F0] p-3 text-[10px] leading-5 text-[#245842]"><ShieldCheck size={13} className="mr-1.5 inline" />Identity state: <strong>{i.identityState}</strong>. This registry view does not merge or resolve official identity beyond the source record.</div></div></Panel></div>
        <div className="mt-4"><Panel title="Related case records" detail="Case register entries matching this institution"><StatePanel loading={cases.isLoading} error={cases.error} retry={() => cases.refetch()} empty={!cases.isLoading && !cases.error && !cases.data?.length} emptyTitle="No case records found" emptyText="No complaint records are currently associated with this institution."><div className="divide-y divide-[hsl(var(--border))]/50">{cases.data?.map((c) => <Link key={c.id} href={`/complaints/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-[#FAF9F5]"><div className="min-w-0"><div className="truncate text-[11px] font-semibold text-[#1E2838]">{c.sourceCaseId} <span className="ml-1 font-normal text-muted-foreground">· {c.category}</span></div><div className="mt-1 text-[10px] text-muted-foreground">{c.receivingBureau} <span className="mx-1">→</span>{c.currentBureau} · Updated {fmt(c.lastUpdatedAt)}</div></div><Badge tone={toneFor(c.status)}>{c.status}</Badge></Link>)}</div></StatePanel></Panel></div>
      </>}
    </StatePanel>
  </div>;
}

export function CasesPage() {
  const [query, setQuery] = useState('');
  const [bureau, setBureau] = useState('');
  const [region, setRegion] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const q = useQuery({ queryKey: ['nexus-cases', query, bureau, region, category, status, from, to], queryFn: () => listCases({ query: query || undefined, bureau: bureau || undefined, region: region || undefined, category: category || undefined, status: status || undefined, from: from || undefined, to: to || undefined }) });
  const institutionRegions = useQuery({ queryKey: ['nexus-case-regions'], queryFn: () => listInstitutions() });
  const bureaus = useMemo(() => [...new Set((q.data ?? []).flatMap((c) => [c.currentBureau, c.receivingBureau]))], [q.data]);
  const regions = useMemo(() => [...new Set((institutionRegions.data ?? []).map((i) => i.region).filter(Boolean) as string[])], [institutionRegions.data]);
  const categories = useMemo(() => [...new Set((q.data ?? []).map((c) => c.category))], [q.data]);
  const statuses = useMemo(() => [...new Set((q.data ?? []).map((c) => c.status))], [q.data]);
  return <div><PageHeader eyebrow="Source case register" title="Complaints" description="Inspect source identifiers, receiving and current bureau, status and procedural actions without losing attribution." action={<button onClick={() => { setQuery(''); setBureau(''); setRegion(''); setCategory(''); setStatus(''); setFrom(''); setTo(''); }} className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-card px-3 py-1.5 text-[10px] font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"><RefreshCw size={12} /> Clear filters</button>} />
    <Panel title="Case register" detail={`${q.data?.length ?? '—'} case records · Filters apply to source records`}>
      <div className="grid gap-2.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/50 p-3.5 sm:grid-cols-2 lg:grid-cols-5"><label className="flex flex-col gap-1 text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground sm:col-span-2 lg:col-span-1">Search records<div className="relative"><Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Case ID or institution" className="h-9 w-full rounded-lg border border-[hsl(var(--input))] bg-card pl-8 pr-2 text-[10px] normal-case tracking-normal outline-none shadow-2xs focus:border-primary focus:ring-1 focus:ring-primary/20" data-testid="input-case-search" /></div></label><FilterSelect label="Bureau" value={bureau} onChange={setBureau} options={bureaus} /><FilterSelect label="Region" value={region} onChange={setRegion} options={regions} /><FilterSelect label="Category" value={category} onChange={setCategory} options={categories} /><FilterSelect label="Status" value={status} onChange={setStatus} options={statuses} /><label className="flex flex-col gap-1 text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Received from<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-lg border border-[hsl(var(--input))] bg-card px-2 text-[10px] normal-case tracking-normal outline-none shadow-2xs focus:border-primary focus:ring-1 focus:ring-primary/20" data-testid="filter-received-from" /></label><label className="flex flex-col gap-1 text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Received to<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-lg border border-[hsl(var(--input))] bg-card px-2 text-[10px] normal-case tracking-normal outline-none shadow-2xs focus:border-primary focus:ring-1 focus:ring-primary/20" data-testid="filter-received-to" /></label></div>
      <StatePanel loading={q.isLoading} error={q.error} retry={() => q.refetch()} empty={!q.isLoading && !q.error && !q.data?.length} emptyTitle="No case records match" emptyText="Clear or broaden filters to see other source-attributed cases.">
        <div className="nexus-scroll overflow-x-auto"><table className="w-full min-w-[970px] text-left"><thead><tr className="border-b border-[hsl(var(--border))] bg-card text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground"><th className="px-5 py-3">Source case</th><th className="px-5 py-3">Institution</th><th className="px-5 py-3">Bureau lineage</th><th className="px-5 py-3">Category / status</th><th className="px-5 py-3">Received</th><th className="px-5 py-3">Freshness</th><th></th></tr></thead><tbody>{q.data?.map((c) => <tr key={c.id} className="border-b border-[hsl(var(--border))]/50 last:border-0 hover:bg-[#FAF9F5] transition" data-testid={`row-case-${c.id}`}><td className="px-5 py-3.5"><Link href={`/complaints/${c.id}`} className="font-mono text-[10px] font-semibold text-primary">{c.sourceCaseId}</Link><div className="mt-1 text-[9px] text-muted-foreground">{c.source}</div></td><td className="max-w-[220px] px-5 py-3.5">{c.institutionId ? <Link href={`/institutions/${c.institutionId}`} className="line-clamp-2 text-[10px] font-semibold text-[#1E2838] hover:text-primary">{c.institutionName}</Link> : <span className="line-clamp-2 text-[10px] font-medium text-muted-foreground italic">{c.institutionName}</span>}</td><td className="px-5 py-3.5 text-[10px] text-slate-700">{c.receivingBureau}<div className="my-1 h-px w-8 bg-[hsl(var(--border))]" />{c.currentBureau}</td><td className="px-5 py-3.5"><div className="text-[10px] text-slate-700">{c.category}</div><div className="mt-1"><Badge tone={toneFor(c.status)}>{c.status}</Badge></div></td><td className="px-5 py-3.5 text-[10px] text-slate-600">{fmt(c.receivedAt)}<div className="mt-0.5 text-[9px] text-muted-foreground">Updated {fmt(c.lastUpdatedAt)}</div></td><td className="px-5 py-3.5"><Badge tone={toneFor(c.freshness)}>{c.freshness}</Badge></td><td className="px-5 py-3.5"><Link href={`/complaints/${c.id}`} className="text-muted-foreground hover:text-primary"><ChevronRight size={14} /></Link></td></tr>)}</tbody></table></div>
      </StatePanel>
    </Panel>
  </div>;
}

export function CaseDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ['nexus-case', id], queryFn: () => getCase(id), enabled: Boolean(id) });
  const c = q.data;
  return <div><PageHeader eyebrow="Source case record" title={c?.sourceCaseId ?? 'Case details'} description="The source record is the authoritative representation of its own facts. Cross-record suggestions are separately reviewed." action={<Link href="/complaints" className="rounded-lg border border-[hsl(var(--border))] bg-card px-3 py-1.5 text-[10px] font-semibold text-slate-700 shadow-2xs hover:bg-slate-50">Back to register</Link>} />
    <StatePanel loading={q.isLoading} error={q.error} retry={() => q.refetch()} empty={!q.isLoading && !q.error && !c} emptyTitle="Case record not found" emptyText="No source case is available for this identifier.">
      {c && <>
        {(c.status === 'Unmapped' || c.source === 'Unmapped' || c.currentBureau === 'Unmapped') && (
          <div className="mb-4 flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-[10px] leading-relaxed text-amber-900 shadow-2xs">
            <ShieldAlert size={14} className="mt-0.5 shrink-0 text-amber-700" />
            <span>
              <strong>Data quality notice:</strong> This source record contains unmapped values (Raw status: <code>{c.rawStatus ?? 'unknown'}</code>, Raw source: <code>{c.rawSource ?? 'unknown'}</code>). It is preserved as recorded but excluded from official canonical breakdowns until mapped.
            </span>
          </div>
        )}
        {c.restricted && <div className="mb-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[10px] leading-relaxed text-amber-900 shadow-2xs"><LockKeyhole size={14} className="mt-0.5 shrink-0 text-amber-700" /><span><strong>Restricted source record.</strong> Access and onward handling must follow the applicable source and role restrictions.</span></div>}
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]"><div className="space-y-4">
          <Panel title="Source facts" detail={`Attributed to ${c.source}${c.sourceRevision ? ` · revision ${c.sourceRevision}` : ''}`}><div className="grid gap-x-6 gap-y-5 p-4 sm:grid-cols-2 sm:p-5"><div><DataLabel>Source case ID</DataLabel><div className="font-mono text-[12px] font-semibold text-[#1E2838]">{c.sourceCaseId}</div></div><div><DataLabel>Source</DataLabel><div className="text-[11px] text-[#1E2838]">{c.source}</div></div><div className="sm:col-span-2"><DataLabel>Institution</DataLabel>{c.institutionId ? <Link href={`/institutions/${c.institutionId}`} className="text-[12px] font-semibold text-primary hover:underline">{c.institutionName} <ExternalLink size={12} className="ml-1 inline" /></Link> : <span className="text-[12px] font-medium text-slate-700 italic">{c.institutionName} <span className="ml-1 text-[10px] font-semibold text-amber-700">(Unresolved identity)</span></span>}</div><div><DataLabel>Category</DataLabel><div className="text-[11px] text-[#1E2838]">{c.category}</div></div><div><DataLabel>Current status</DataLabel><Badge tone={toneFor(c.status)}>{c.status}</Badge></div><div><DataLabel>Received by bureau</DataLabel><div className="text-[11px] text-[#1E2838]">{c.receivingBureau}</div></div><div><DataLabel>Current bureau</DataLabel><div className="text-[11px] text-[#1E2838]">{c.currentBureau}</div></div><div><DataLabel>Assigned officer</DataLabel><div className="text-[11px] text-[#1E2838]">{c.assignedOfficer ?? 'Not recorded'}</div></div><div><DataLabel>Freshness</DataLabel><Badge tone={toneFor(c.freshness)}>{c.freshness}</Badge></div><div><DataLabel>Received</DataLabel><div className="text-[11px] text-[#1E2838]">{fmt(c.receivedAt)}</div></div><div><DataLabel>Last updated</DataLabel><div className="text-[11px] text-[#1E2838]">{fmt(c.lastUpdatedAt)}</div></div><div><DataLabel>Expected disposal</DataLabel><div className="text-[11px] text-[#1E2838]">{fmt(c.expectedDisposalAt)}</div></div><div><DataLabel>Referral reference</DataLabel><div className="font-mono text-[10px] text-slate-700">{c.referralReference ?? 'Not recorded'}</div></div></div></Panel>
          <Panel title="Procedural actions" detail="Chronology is presented as recorded; sequence does not imply a finding."><StatePanel empty={!c.actions.length} emptyTitle="No procedural actions recorded" emptyText="The source has not supplied action history for this case."><div className="divide-y divide-[hsl(var(--border))]/50">{c.actions.map((a, index) => <div key={a.id} className="relative flex gap-3 px-4 py-4 sm:px-5"><div className="relative mt-0.5 flex w-5 justify-center"><div className="z-10 grid h-4 w-4 place-items-center rounded-full border border-[#CFE3D5] bg-white"><span className="h-1.5 w-1.5 rounded-full bg-[#376B58]" /></div>{index !== c.actions.length - 1 && <div className="absolute top-4 h-full w-px bg-[hsl(var(--border))]" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[11px] font-semibold text-[#1E2838]">{a.label}</span><Badge>{a.bureau}</Badge></div><div className="mt-1 text-[10px] text-muted-foreground">{fmt(a.occurredAt)} {a.sourceReference && <span className="ml-2 font-mono text-slate-400">Ref: {a.sourceReference}</span>}</div>{a.note && <p className="mt-2 text-[10px] leading-relaxed text-slate-600">{a.note}</p>}</div></div>)}</div></StatePanel></Panel>
        </div>
        <div className="space-y-4"><Panel title="Record control" detail="Source metadata"><div className="space-y-4 p-4 sm:p-5"><div><DataLabel>Source revision</DataLabel><div className="font-mono text-[10px] text-slate-700">{c.sourceRevision ?? 'Not supplied'}</div></div><div><DataLabel>Attribution</DataLabel><Badge tone="blue"><ShieldCheck size={11} />Source-provided</Badge></div><div><DataLabel>Record visibility</DataLabel><Badge tone={c.restricted ? 'amber' : 'green'}>{c.restricted ? 'Restricted' : 'Standard'}</Badge></div><div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 p-3 text-[10px] leading-relaxed text-muted-foreground">This page displays source facts without modifying the originating record.</div></div></Panel>
          <Panel title="Relationships" detail="Linked records are not automatically merged"><StatePanel empty={!c.relationships.length} emptyTitle="No linked records" emptyText="No relationships are recorded for this case."><div className="divide-y divide-[hsl(var(--border))]/50">{c.relationships.map((r) => <Link key={`${r.caseId}-${r.type}`} href={`/complaints/${r.caseId}`} className="flex items-start justify-between gap-2 px-4 py-3 transition hover:bg-[#FAF9F5]"><div><div className="font-mono text-[10px] font-semibold text-primary">{r.caseId}</div><div className="mt-0.5 text-[10px] text-slate-600">{r.label}</div></div><Badge>{r.type}</Badge></Link>)}</div></StatePanel></Panel></div></div>
      </>}
    </StatePanel>
  </div>;
}

export function CoordinationPage() {
  const [reviewStatus, setReviewStatus] = useState('');
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const urlItemId = searchParams.get('item');
  const [selected, setSelected] = useState<string | null>(urlItemId);
  const [decision, setDecision] = useState<ReviewDecision | ''>('');
  const [rationale, setRationale] = useState('');
  const [notice, setNotice] = useState('');
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['nexus-coordination', reviewStatus], queryFn: () => listCoordinationItems({ reviewStatus: reviewStatus || undefined }) });
  const mutation = useMutation({
    mutationFn: submitCoordinationReview,
    onSuccess: async () => {
      setNotice('Review submitted. The human decision is recorded separately from the system suggestion.');
      setRationale('');
      setDecision('');
      await qc.invalidateQueries({ queryKey: ['nexus-coordination'] });
      await qc.invalidateQueries({ queryKey: ['nexus-dashboard'] });
      await qc.invalidateQueries({ queryKey: ['nexus-analytics'] });
      await qc.invalidateQueries({ queryKey: ['nexus-notifications'] });
      await qc.invalidateQueries({ queryKey: ['nexus-unread-count'] });
    },
  });
  const item = q.data?.find((i) => i.id === (selected ?? urlItemId)) ?? q.data?.find((i) => i.reviewStatus === 'open') ?? q.data?.[0];
  const { profile, mode } = useAuth();
  const canReview = mode === 'demo' || ['administrator', 'bureau_officer', 'regional_officer'].includes(profile?.role ?? '');
  const submit = () => { if (!item || !decision || rationale.trim().length < 12) return; mutation.mutate({ itemId: item.id, decision, rationale: rationale.trim(), expectedUpdatedAt: item.updatedAt }); };
  return <div><PageHeader eyebrow="Coordination workbench" title="Evidence review" description="Review potential relationships as suggestions. Source facts, conflicts and missing evidence remain visible beside every human decision." action={<Badge tone="amber"><GitCompareArrows size={11} /> Human determination required</Badge>} />
    {notice && <div className="mb-4 flex items-center justify-between rounded-xl border border-emerald-200 bg-[#EEF5F0] p-3.5 text-[10px] text-[#245842] shadow-2xs"><span><CheckCircle2 size={14} className="mr-1.5 inline" />{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss confirmation"><X size={14} /></button></div>}
    {mutation.error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3.5 text-[10px] text-red-800 shadow-2xs">Review could not be submitted. Refresh the item to confirm it is still available and try again.</div>}
     <div className="mb-4 flex items-end gap-3 rounded-xl border border-[hsl(var(--border))] bg-card p-3.5 shadow-xs"><FilterSelect label="Review status" value={reviewStatus} onChange={setReviewStatus} options={['open', 'reviewed', 'dismissed']} /><div className="pb-1 text-[11px] font-medium text-muted-foreground">{q.data?.length ?? '—'} review items</div><div className="ml-auto hidden max-w-[370px] items-center gap-2 text-right text-[10px] leading-relaxed text-muted-foreground md:flex"><ShieldAlert size={14} className="shrink-0 text-amber-600" />A system-generated relationship is a review prompt; it is never an official fact.</div></div>
    <StatePanel loading={q.isLoading} error={q.error} retry={() => q.refetch()} empty={!q.isLoading && !q.error && !q.data?.length} emptyTitle="Review queue is clear" emptyText="No coordination items match this selection. New review prompts appear only when supplied by the data layer.">
      {item && <div className="grid gap-4 xl:grid-cols-[minmax(270px,.8fr)_minmax(0,1.55fr)]">
        <Panel title="Review queue" detail="Select an item to inspect the evidence"><div className="divide-y divide-[hsl(var(--border))]/50">{q.data?.map((it) => <button key={it.id} onClick={() => { setSelected(it.id); setDecision(''); setRationale(''); setNotice(''); }} className={`block w-full px-4 py-3.5 text-left transition ${item.id === it.id ? 'border-l-[3px] border-l-[#376B58] bg-[#F2F7F4] shadow-2xs' : 'border-l-[3px] border-l-transparent hover:bg-[#FAF9F5]'}`} data-testid={`button-review-item-${it.id}`}><div className="flex items-start justify-between gap-2"><span className="text-[11px] font-semibold leading-4 text-[#1E2838]">{it.institutionName}</span><Badge tone={toneFor(it.reviewStatus)}>{it.reviewStatus}</Badge></div><div className="mt-1 font-mono text-[9px] text-muted-foreground">{it.caseIds.join(' · ')}</div><div className="mt-2 text-[10px] text-slate-700 leading-snug">{it.suggestedRelationship}</div><div className="mt-2 flex items-center justify-between text-[9px] text-muted-foreground"><span>Updated {fmt(it.updatedAt)}</span><span>Rule {it.ruleVersion}</span></div></button>)}</div></Panel>
        <div className="space-y-4">
          <Panel title="Suggestion context" detail="SIMULATED workflow example when in demo mode. Treat suggestion as a prompt only." action={<Badge tone="blue"><Sparkles size={10} /> System suggestion</Badge>}>
            <div className="border-b border-[hsl(var(--border))] bg-[#F5F8F6] p-5"><div className="text-[9px] font-bold uppercase tracking-[.14em] text-[#376B58]">Suggested relationship</div><div className="mt-1 text-[16px] font-bold text-[#1E2838]">{item.suggestedRelationship}</div><div className="mt-2.5 flex flex-wrap gap-1.5">{item.bureaus.map((b) => <Badge key={b} tone="blue">{b}</Badge>)}</div><div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground"><span>Rule {item.ruleVersion}</span><span>·</span><span>Freshness: {item.freshness}</span><span>·</span><span>Suggested decision: {item.suggestedDecision.replaceAll('_', ' ')}</span></div></div>
            <div className="grid gap-0 divide-y divide-[hsl(var(--border))]/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0"><EvidenceColumn title="Matching evidence" tone="green" icon={CheckCircle2} items={item.matchingEvidence} /><EvidenceColumn title="Conflicting evidence" tone="amber" icon={AlertCircle} items={item.conflictingEvidence} /><EvidenceColumn title="Missing information" tone="neutral" icon={CircleHelp} items={item.missingInformation} /><div className="p-4 sm:p-5"><DataLabel>Procedural lineage</DataLabel><div className="space-y-2">{item.cases.map((c) => <Link key={c.id} href={`/complaints/${c.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-[hsl(var(--border))] bg-card px-3 py-2 shadow-2xs transition hover:border-[#376B58]/40"><div><span className="font-mono text-[9px] font-semibold text-primary">{c.sourceCaseId}</span><span className="ml-2 text-[9px] text-slate-700">{c.currentBureau}</span></div><ArrowRight size={12} className="text-muted-foreground" /></Link>)}</div></div></div>
          </Panel>
           <Panel title="Human review decision" detail="Choose an outcome and provide a concise rationale. The decision is attributable to the signed-in reviewer.">
             {item.reviewStatus !== 'open' ? <div className="p-4 sm:p-5"><div className="rounded-xl border border-emerald-200 bg-[#EEF5F0] p-3.5 text-[10px] leading-relaxed text-[#245842] shadow-2xs"><strong>Human review recorded:</strong> {item.reviewDecision?.replaceAll('_', ' ') ?? item.reviewStatus}. Source records and actions were not changed.</div><div className="mt-3 text-[10px] text-slate-700"><DataLabel>Recorded rationale</DataLabel>{item.rationale ?? 'No rationale supplied.'}</div></div> : !canReview ? <div className="p-4 sm:p-5"><div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[10px] leading-relaxed text-amber-900 shadow-2xs">This role can inspect the evidence but cannot record a coordination decision. Ask an administrator to review role access.</div></div> : <div className="p-4 sm:p-5">
              <div className="grid gap-2 sm:grid-cols-2">{decisions.map((option) => <button key={option.value} onClick={() => setDecision(option.value)} className={`rounded-xl border p-3.5 text-left transition ${decision === option.value ? 'border-[#376B58] bg-[#F2F7F4] ring-1 ring-[#376B58] shadow-2xs' : 'border-[hsl(var(--border))] bg-card hover:border-[#376B58]/40 hover:bg-[#FAF9F5]'}`} data-testid={`button-decision-${option.value}`}><div className="flex items-center gap-2 text-[11px] font-semibold text-[#1E2838]">{decision === option.value ? <Check size={13} className="text-[#376B58]" /> : <span className="h-[13px] w-[13px] rounded-full border border-slate-300" />}{option.label}</div><div className="mt-1 pl-5 text-[10px] leading-relaxed text-muted-foreground">{option.desc}</div></button>)}</div>
              <label className="mt-4 block text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground">Rationale <span className="normal-case tracking-normal text-red-700">Required · at least 12 characters</span><textarea value={rationale} onChange={(e) => setRationale(e.target.value)} rows={3} placeholder="Record the source evidence considered and the reason for this outcome." className="mt-1.5 w-full resize-y rounded-xl border border-[hsl(var(--input))] bg-card p-3 text-[11px] font-normal normal-case tracking-normal text-slate-800 outline-none shadow-2xs placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20" data-testid="input-review-rationale" /></label>
              <div className="mt-4 flex flex-col gap-2.5 border-t border-[hsl(var(--border))]/60 pt-3.5 sm:flex-row sm:items-center sm:justify-between"><p className="text-[10px] leading-relaxed text-muted-foreground">Reviewer: {profile?.displayName ?? 'Current reviewer'} · Review does not alter source facts.</p><button onClick={submit} disabled={!decision || rationale.trim().length < 12 || mutation.isPending} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#376B58] px-4 text-[11px] font-semibold text-white shadow-xs transition hover:bg-[#2C5747] disabled:cursor-not-allowed disabled:opacity-45" data-testid="button-submit-review">{mutation.isPending ? 'Submitting…' : 'Submit human decision'}<ArrowRight size={12} /></button></div>
             </div>}
          </Panel>
        </div>
      </div>}
    </StatePanel>
  </div>;
}

function EvidenceColumn({ title, items, tone, icon: Icon }: { title: string; items: string[]; tone: 'green' | 'amber' | 'neutral'; icon: ElementType }) {
  return <div className="p-4 sm:p-5"><DataLabel>{title}</DataLabel>{items.length ? <ul className="mt-2 space-y-2">{items.map((text, i) => <li key={`${text}-${i}`} className="flex gap-2 text-[10px] leading-5 text-slate-700"><Icon size={13} className={`mt-0.5 shrink-0 ${tone === 'green' ? 'text-emerald-700' : tone === 'amber' ? 'text-amber-700' : 'text-slate-500'}`} />{text}</li>)}</ul> : <div className="mt-2 text-[10px] text-muted-foreground">No evidence listed by the current rule.</div>}</div>;
}

export function TimelinePage() {
  const q = useQuery({ queryKey: ['nexus-timeline'], queryFn: getTimeline });
  return <div><PageHeader eyebrow="Procedural lineage" title="Timeline" description="A chronological, source-referenced view of case actions and transfers. Timeline sequence is not an adjudication." action={<Badge tone="blue"><FileClock size={11} /> Source events</Badge>} />
    <Panel title="Recorded events" detail={`${q.data?.length ?? '—'} events · Ordered by recorded occurrence`}>
      <StatePanel loading={q.isLoading} error={q.error} retry={() => q.refetch()} empty={!q.isLoading && !q.error && !q.data?.length} emptyTitle="No timeline events" emptyText="No procedural events are currently available from connected sources.">
        <div className="divide-y divide-[hsl(var(--border))]/50">{q.data?.map((e, i) => <div key={e.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[130px_20px_1fr] sm:px-5"><div className="sm:pt-1"><div className="text-[10px] font-semibold text-slate-700">{fmt(e.occurredAt)}</div><div className="mt-0.5 font-mono text-[9px] text-muted-foreground">{new Date(e.occurredAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div></div><div className="relative hidden justify-center sm:flex"><div className="z-10 mt-1 h-2.5 w-2.5 rounded-full border-2 border-[#376B58] bg-white shadow-2xs" />{i < (q.data?.length ?? 0) - 1 && <div className="absolute top-3 h-[calc(100%+24px)] w-px bg-[hsl(var(--border))]" />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-[11px] font-semibold text-[#1E2838]">{e.title}</h3><Badge tone="blue">{e.bureau}</Badge></div><p className="mt-1.5 text-[10px] leading-relaxed text-slate-600">{e.description}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-[9px] text-muted-foreground"><Link href={`/complaints/${e.caseId}`} className="font-mono font-semibold text-primary hover:underline">{e.sourceCaseId}</Link><span>· {e.relationType}</span>{e.sourceReference && <span>· Source ref: {e.sourceReference}</span>}</div></div></div>)}</div>
      </StatePanel>
    </Panel>
  </div>;
}

export function AnalyticsPage() {
  const q = useQuery({ queryKey: ['nexus-analytics'], queryFn: getAnalytics });
  const a = q.data as unknown as AnyRecord | undefined;

  const exportCasesCsv = async () => {
    try {
      const cases = await listCases();
      const headers = [
        'Source Case ID',
        'Source Bureau',
        'Receiving Bureau',
        'Current Bureau',
        'Institution Name',
        'Category',
        'Status',
        'Received Date',
        'Last Updated',
        'Freshness',
        'Restricted',
      ];
      const escape = (val: string | null | undefined) => `"${(val ?? '').replaceAll('"', '""')}"`;
      const rows = cases.map((c) => [
        escape(c.sourceCaseId),
        escape(c.source),
        escape(c.receivingBureau),
        escape(c.currentBureau),
        escape(c.institutionName),
        escape(c.category),
        escape(c.status),
        escape(c.receivedAt),
        escape(c.lastUpdatedAt),
        escape(c.freshness),
        escape(c.restricted ? 'Yes' : 'No'),
      ]);
      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nexus-cases-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    }
  };

  return <div><PageHeader eyebrow="Operational reporting" title="Analytics" description="Descriptive views of source records and human review outcomes. Counts are not findings about an institution." action={<div className="flex items-center gap-2"><button onClick={exportCasesCsv} className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-card px-3 py-1.5 text-[10px] font-semibold text-slate-700 shadow-2xs transition hover:border-[#376B58]/40 hover:text-primary" data-testid="button-export-cases-csv"><Download size={13} /> Export cases CSV</button><button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] bg-card px-3 py-1.5 text-[10px] font-semibold text-slate-700 shadow-2xs transition hover:border-[#376B58]/40 hover:text-primary" data-testid="button-print-report">Print report</button></div>} />
    <StatePanel loading={q.isLoading} error={q.error} retry={() => q.refetch()}>
      <div className="grid gap-4 xl:grid-cols-2">
        <DistributionPanel title="Case ageing" detail="Current age buckets from source records" data={a?.ageingBuckets} />
        <DistributionPanel title="Disposal rate" detail="Share of source cases with a reported disposed status" data={a?.disposalRate} />
        <DistributionPanel title="Current bureau distribution" detail="Cases by current handling bureau" data={a?.currentBureauCounts} />
        <DistributionPanel title="Cross-bureau overlap" detail="Potential overlaps pending human review" data={a?.overlapCounts} />
        <DistributionPanel title="Review outcomes" detail="Human decisions submitted to the coordination queue" data={a?.reviewOutcomes} />
        <DistributionPanel title="Source coverage" detail="Availability and mapped fields by source" data={a?.sourceCoverage} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]"><Panel title="Unresolved institution identities" detail="Candidate, unresolved or unlinked identity records"><ListState data={a?.unresolvedMappings} /></Panel><Panel title="Monthly trend" detail="Source-reported intake counts by received month"><div className="p-4"><TrendChart data={a?.monthlyTrend} /></div></Panel></div>
    </StatePanel>
  </div>;
}

function DistributionPanel({ title, detail, data }: { title: string; detail: string; data: unknown }) {
  const rows: [string, any][] = Array.isArray(data)
    ? data.map((x: AnyRecord, i: number) => [
        String(x.label ?? x.bureau ?? x.name ?? x.bucket ?? x.period ?? `Item ${i + 1}`),
        x.count ?? x.value ?? x.total ?? x.coverage ?? x.rate ?? '—',
      ])
    : typeof data === 'number'
      ? [['Overall', data]]
      : Object.entries((data as AnyRecord) ?? {});
  const max = Math.max(1, ...rows.map(([, v]) => Number(v) || 0));
  return <Panel title={title} detail={detail}><div className="space-y-3 p-4 sm:p-5">{rows.length ? rows.map(([label, value]) => <div key={label} className="grid grid-cols-[minmax(90px,1fr)_2fr_42px] items-center gap-3"><div className="truncate text-[10px] text-slate-700">{label}</div><div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[#376B58]" style={{ width: `${Math.max(3, Math.min(100, (Number(value) || 0) * 100 / max))}%` }} /></div><div className="text-right font-mono text-[10px] text-slate-700 font-semibold">{String(value)}</div></div>) : <div className="py-4 text-center text-[10px] text-muted-foreground">No reporting data available for this measure.</div>}</div></Panel>;
}

function ListState({ data }: { data: unknown }) {
  if (typeof data === 'number') return <div className="p-5"><DataLabel>Count from current records</DataLabel><div className="font-[var(--app-font-serif)] text-3xl font-bold text-[#1E2838]">{countLabel(data)}</div><div className="mt-2 text-[10px] text-muted-foreground">This count is descriptive and does not identify a verified institution.</div></div>;
  const rows = Array.isArray(data) ? data : [];
  return rows.length ? <div className="divide-y divide-[hsl(var(--border))]/50">{rows.map((item: AnyRecord, i: number) => <div key={item.id ?? i} className="flex items-start justify-between gap-3 px-5 py-3.5 transition hover:bg-[#FAF9F5]"><div><div className="text-[10px] font-semibold text-[#1E2838]">{item.label ?? item.field ?? item.name ?? item.type ?? item.caseId ?? 'Unresolved mapping'}</div><div className="mt-1 text-[9px] text-muted-foreground">{item.detail ?? item.description ?? item.source ?? item.mappingType ?? item.status ?? 'Source mapping review pending'}</div></div><Badge tone={toneFor(item.state ?? item.status)}>{item.state ?? item.status ?? 'Unresolved'}</Badge></div>)}</div> : <div className="px-4 py-8 text-center text-[10px] text-muted-foreground">No unresolved mapping data supplied.</div>;
}

function TrendChart({ data }: { data: unknown }) {
  const rows: AnyRecord[] = Array.isArray(data) ? data : [];
  if (!rows.length) return <div className="py-6 text-center text-[10px] text-muted-foreground">No monthly series available.</div>;
  const values = rows.map((r) => Number(r.intake ?? r.received ?? r.count ?? 0));
  const max = Math.max(1, ...values);
  return <div className="flex h-[150px] items-end gap-2 border-b border-l border-[hsl(var(--border))] px-2 pb-2">{rows.slice(-12).map((r, i) => <div key={r.period ?? r.month ?? i} className="group flex h-full flex-1 flex-col items-center justify-end gap-2"><div title={String(values[i])} className="w-full max-w-8 rounded-t-sm bg-[#3E7763] transition-colors group-hover:bg-[#326050]" style={{ height: `${Math.max(4, values[i] * 100 / max)}%` }} /><span className="rotate-[-35deg] origin-top-left whitespace-nowrap text-[8px] text-muted-foreground">{r.period ?? r.month ?? ''}</span></div>)}</div>;
}

export function ReliabilityPage() {
  const q = useQuery({ queryKey: ['nexus-reliability'], queryFn: getReliability });
  const r = q.data as unknown as AnyRecord | undefined;
  const notes = r?.coverageNotes ?? [];
  return <div><PageHeader eyebrow="Data quality" title="Source reliability" description="Understand freshness, coverage and discrepancies before relying on a record. Missing information is made visible rather than inferred." action={<Badge tone="blue"><ShieldCheck size={11} /> Source-aware</Badge>} />
    <StatePanel loading={q.isLoading} error={q.error} retry={() => q.refetch()}>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><Panel title="Configured source status" detail="Connection state, synchronization counts and unresolved records"><StatePanel empty={!r?.sources?.length} emptyTitle="No source status available" emptyText="Source status will appear when reliability metadata is available."><div className="nexus-scroll overflow-x-auto"><table className="w-full min-w-[790px] text-left"><thead><tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))] text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground"><th className="px-5 py-3">Source</th><th className="px-5 py-3">Connector</th><th className="px-5 py-3">Last success</th><th className="px-5 py-3">Received / processed</th><th className="px-5 py-3">Quarantined / open issues</th></tr></thead><tbody>{r?.sources?.map((s: AnyRecord, i: number) => <tr key={s.id ?? s.name ?? i} className="border-b border-[hsl(var(--border))]/50 last:border-0 hover:bg-[#FAF9F5] transition"><td className="px-5 py-3.5 text-[10px] font-semibold text-[#1E2838]">{s.name ?? s.bureau}</td><td className="px-5 py-3.5"><Badge tone={toneFor(s.connectionState)}>{s.connectionState ?? 'Unknown'}</Badge></td><td className="px-5 py-3.5 text-[10px] text-slate-600">{fmt(s.lastSuccessfulSync)}</td><td className="px-5 py-3.5 font-mono text-[10px] text-slate-700 font-semibold">{countLabel(s.received)} / {countLabel(s.processed)}</td><td className="px-5 py-3.5 font-mono text-[10px] text-slate-700 font-semibold">{countLabel(s.quarantined)} / {countLabel(s.unresolvedDiscrepancies)}</td></tr>)}</tbody></table></div></StatePanel></Panel>
        <Panel title="Coverage notes" detail="Known limitations and interpretation"><div className="divide-y divide-[hsl(var(--border))]/50">{notes.length ? notes.map((note: any, i: number) => <div key={i} className="flex gap-2.5 px-5 py-3.5 text-[10px] leading-relaxed text-slate-700"><BookOpen size={13} className="mt-0.5 shrink-0 text-[#376B58]" />{typeof note === 'string' ? note : note.description ?? note.text ?? JSON.stringify(note)}</div>) : <div className="px-4 py-8 text-center text-[10px] text-muted-foreground">No source coverage notes supplied.</div>}</div></Panel></div>
      <div className="mt-4"><Panel title="Discrepancies" detail="Conflicting or incomplete source values should be reviewed in context"><ListState data={r?.discrepancies} /></Panel></div>
      <div className="mt-4 flex gap-2.5 rounded-xl border border-[#CFE3D5] bg-[#EEF5F0] p-3.5 text-[10px] leading-relaxed text-[#245842] shadow-2xs"><ShieldAlert size={14} className="mt-0.5 shrink-0" /><span>Data freshness describes source synchronization only. It does not certify the accuracy of an underlying allegation or establish a finding.</span></div>
    </StatePanel>
  </div>;
}

type AdminRole = 'administrator' | 'bureau_officer' | 'regional_officer' | 'read_only_viewer';
type AdminApproval = 'pending' | 'approved' | 'suspended';
type AdminDraft = { role: AdminRole; approvalStatus: AdminApproval; region: string; bureau: string };

const adminRoles: { value: AdminRole; label: string }[] = [
  { value: 'administrator', label: 'Administrator' },
  { value: 'bureau_officer', label: 'Bureau officer' },
  { value: 'regional_officer', label: 'Regional officer' },
  { value: 'read_only_viewer', label: 'Read-only viewer' },
];

export function AdministrationPage() {
  const { profile, mode } = useAuth();
  const authorized = mode === 'demo' || profile?.role === 'administrator';
  const q = useQuery({ queryKey: ['nexus-administration'], queryFn: getAdministration, enabled: authorized });
  const sourcesQuery = useQuery({ queryKey: ['nexus-admin-source-config'], queryFn: getReliability, enabled: authorized });
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, AdminDraft>>({});
  const [mappingType, setMappingType] = useState<'status' | 'category' | 'bureau'>('status');
  const [sourceValue, setSourceValue] = useState('');
  const [canonicalValue, setCanonicalValue] = useState('');
  const [notice, setNotice] = useState('');
  const userMutation = useMutation({
    mutationFn: updateProfileAccess,
    onSuccess: async (_user, input) => {
      setDrafts((current) => { const next = { ...current }; delete next[input.userId]; return next; });
      setNotice('Access assignment saved and audited.');
      await qc.invalidateQueries({ queryKey: ['nexus-administration'] });
    },
  });
  const mappingMutation = useMutation({
    mutationFn: upsertStatusMapping,
    onSuccess: async () => {
      setSourceValue('');
      setCanonicalValue('');
      setNotice('Source mapping saved and audited.');
      await qc.invalidateQueries({ queryKey: ['nexus-administration'] });
    },
  });
  const a = q.data as unknown as AnyRecord | undefined;
  const sourceData = sourcesQuery.data as unknown as AnyRecord | undefined;
  const rules = a?.ruleVersions ?? [];
  const auditEvents = a?.auditEvents ?? [];

  if (!authorized) {
    return <div><PageHeader eyebrow="Governance" title="Administration" description="Administrative access is restricted to approved administrators." action={<Badge tone="amber"><LockKeyhole size={11} /> Restricted</Badge>} /><div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-[11px] leading-relaxed text-amber-900 shadow-2xs">Your account can’t access role assignments, source mappings or audit records. Ask an approved administrator to update your access.</div></div>;
  }

  const draftFor = (user: AnyRecord): AdminDraft => drafts[user.id] ?? ({
    role: user.role as AdminRole,
    approvalStatus: user.approvalStatus as AdminApproval,
    region: user.region ?? '',
    bureau: user.bureau ?? '',
  });
  const updateDraft = (user: AnyRecord, update: Partial<AdminDraft>) => {
    setDrafts((current) => ({ ...current, [user.id]: { ...draftFor(user), ...update } }));
  };

  return <div><PageHeader eyebrow="Governance" title="Administration" description="Manage approved access, bureau and status mappings, source configuration visibility and audit history." action={<Badge tone={mode === 'demo' ? 'amber' : 'green'}><LockKeyhole size={11} /> {mode === 'demo' ? 'Simulated admin' : 'Authorized access'}</Badge>} />
    {notice && <div className="mb-4 rounded-xl border border-emerald-200 bg-[#EEF5F0] p-3 text-[10px] text-[#245842] shadow-2xs">{notice}</div>}
    {(userMutation.error || mappingMutation.error) && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-[10px] text-red-800 shadow-2xs">{(userMutation.error ?? mappingMutation.error)?.message}</div>}
    <StatePanel loading={q.isLoading} error={q.error} retry={() => q.refetch()}>
      <div className="space-y-4">
        <Panel title="User and role assignments" detail="New OAuth profiles remain pending and read-only until approved by an administrator">
          <div className="nexus-scroll overflow-x-auto"><table className="w-full min-w-[960px] text-left"><thead><tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))] text-[9px] font-bold uppercase tracking-[.12em] text-muted-foreground"><th className="px-5 py-3">Officer</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Region / bureau scope</th><th className="px-5 py-3">Approval</th><th className="px-5 py-3"></th></tr></thead>
            <tbody>{(a?.users ?? []).map((user: AnyRecord) => {
              const draft = draftFor(user);
              return <tr key={user.id} className="border-b border-[hsl(var(--border))]/50 last:border-0 hover:bg-[#FAF9F5] transition">
                <td className="px-5 py-3.5"><div className="text-[10px] font-semibold text-[#1E2838]">{user.displayName ?? user.email}</div><div className="mt-0.5 text-[9px] text-muted-foreground">{user.email}</div></td>
                <td className="px-5 py-3.5"><select aria-label={`Role for ${user.email}`} value={draft.role} onChange={(event) => updateDraft(user, { role: event.target.value as AdminRole })} className="h-8 rounded-lg border border-[hsl(var(--input))] bg-card px-2 text-[10px] shadow-2xs outline-none focus:border-primary">{adminRoles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}</select></td>
                <td className="px-5 py-3.5">{draft.role === 'regional_officer' ? <input aria-label={`Region for ${user.email}`} value={draft.region} onChange={(event) => updateDraft(user, { region: event.target.value })} placeholder="Region" className="h-8 w-32 rounded-lg border border-[hsl(var(--input))] bg-card px-2 text-[10px] shadow-2xs outline-none focus:border-primary" /> : draft.role === 'bureau_officer' ? <select aria-label={`Bureau for ${user.email}`} value={draft.bureau} onChange={(event) => updateDraft(user, { bureau: event.target.value })} className="h-8 rounded-lg border border-[hsl(var(--input))] bg-card px-2 text-[10px] shadow-2xs outline-none focus:border-primary"><option value="">Choose bureau</option><option value="RB">RB</option><option value="PGRC">PGRC</option></select> : <span className="text-[10px] text-slate-600">{user.region ?? user.bureau ?? 'All permitted records'}</span>}</td>
                <td className="px-5 py-3.5"><select aria-label={`Approval status for ${user.email}`} value={draft.approvalStatus} onChange={(event) => updateDraft(user, { approvalStatus: event.target.value as AdminApproval })} className="h-8 rounded-lg border border-[hsl(var(--input))] bg-card px-2 text-[10px] shadow-2xs outline-none focus:border-primary"><option value="pending">Pending</option><option value="approved">Approved</option><option value="suspended">Suspended</option></select></td>
                <td className="px-5 py-3.5"><button onClick={() => userMutation.mutate({ userId: user.id, ...draft, region: draft.region || undefined, bureau: (draft.bureau || undefined) as 'RB' | 'PGRC' | undefined })} disabled={userMutation.isPending} className="rounded-lg bg-[#376B58] px-3.5 py-1.5 text-[10px] font-semibold text-white shadow-2xs hover:bg-[#2C5747] disabled:opacity-50">{userMutation.isPending ? 'Saving…' : 'Save access'}</button></td>
              </tr>;
            })}</tbody></table>{!a?.users?.length && <div className="p-8 text-center text-[10px] text-muted-foreground">No user access data supplied.</div>}</div>
        </Panel>
        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Source field mappings" detail="Normalize bureau-reported statuses, categories and bureau labels">
            <form onSubmit={(event) => { event.preventDefault(); mappingMutation.mutate({ sourceValue, canonicalValue, mappingType }); }} className="grid gap-2 border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/50 p-3.5 sm:grid-cols-[1fr_1fr_130px_auto]">
              <input aria-label="Source mapping value" value={sourceValue} onChange={(event) => setSourceValue(event.target.value)} placeholder="Source value" className="h-9 rounded-lg border border-[hsl(var(--input))] bg-card px-2.5 text-[10px] shadow-2xs outline-none focus:border-primary" />
              <input aria-label="Canonical mapping value" value={canonicalValue} onChange={(event) => setCanonicalValue(event.target.value)} placeholder="Canonical value" className="h-9 rounded-lg border border-[hsl(var(--input))] bg-card px-2.5 text-[10px] shadow-2xs outline-none focus:border-primary" />
              <select aria-label="Mapping type" value={mappingType} onChange={(event) => setMappingType(event.target.value as typeof mappingType)} className="h-9 rounded-lg border border-[hsl(var(--input))] bg-card px-2 text-[10px] shadow-2xs outline-none focus:border-primary"><option value="status">Status</option><option value="category">Category</option><option value="bureau">Bureau</option></select>
              <button type="submit" disabled={mappingMutation.isPending || !sourceValue.trim() || !canonicalValue.trim()} className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#376B58] px-3.5 py-2 text-[10px] font-semibold text-white shadow-2xs hover:bg-[#2C5747] disabled:opacity-50"><Plus size={12} /> Save</button>
            </form>
            <div className="divide-y divide-[hsl(var(--border))]/50">{(a?.mappings ?? []).map((mapping: AnyRecord, index: number) => <div key={`${mapping.mappingType}-${mapping.sourceValue}-${index}`} className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-[#FAF9F5]"><div className="min-w-0"><div className="truncate text-[10px] font-semibold text-[#1E2838]">{mapping.sourceValue} <ArrowRight size={11} className="mx-1 inline text-muted-foreground" /> {mapping.canonicalValue}</div><div className="mt-0.5 text-[9px] text-muted-foreground">{mapping.mappingType}</div></div><Badge tone="blue">Mapped</Badge></div>)}{!a?.mappings?.length && <div className="p-6 text-center text-[10px] text-muted-foreground">No source mappings configured.</div>}</div>
          </Panel>
          <Panel title="Configured source systems" detail="Read-only connection and synchronization state; no live AICTE connector is configured">
            <div className="divide-y divide-[hsl(var(--border))]/50">{(sourceData?.sources ?? []).map((source: AnyRecord, index: number) => <div key={source.id ?? index} className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-[#FAF9F5]"><div><div className="text-[10px] font-semibold text-[#1E2838]">{source.name ?? source.bureau}</div><div className="mt-0.5 text-[9px] text-muted-foreground">Last attempt {fmt(source.lastAttemptedSync)} · success {fmt(source.lastSuccessfulSync)}</div></div><Badge tone={toneFor(source.connectionState)}>{source.connectionState ?? 'Unknown'}</Badge></div>)}{!sourceData?.sources?.length && <div className="p-6 text-center text-[10px] text-muted-foreground">{sourcesQuery.isLoading ? 'Loading source configuration…' : 'No source configuration supplied.'}</div>}</div>
          </Panel>
          <Panel title="Coordination rule versions" detail="Deterministic rule metadata; no trained-model claims are made"><div className="divide-y divide-[hsl(var(--border))]/50">{rules.length ? rules.map((rule: AnyRecord, index: number) => <div key={rule.id ?? rule.version ?? index} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5 transition hover:bg-[#FAF9F5]"><div><div className="text-[10px] font-semibold text-[#1E2838]">{rule.name ?? 'Coordination rule set'}</div><div className="mt-0.5 text-[9px] text-muted-foreground">{rule.description ?? `Updated ${fmt(rule.updatedAt)}`}</div></div><div className="flex items-center gap-2"><Badge tone={rule.active ? 'green' : 'neutral'}>{rule.active ? 'Active' : 'Archived'}</Badge><span className="font-mono text-[9px] text-slate-600 font-semibold">{rule.version ?? rule.ruleVersion}</span></div></div>) : <div className="p-8 text-center text-[10px] text-muted-foreground">No rule version metadata supplied.</div>}</div></Panel>
          <Panel title="Audit events" detail="Recent administrative and review activity"><div className="divide-y divide-[hsl(var(--border))]/50">{auditEvents.length ? auditEvents.slice(0, 12).map((event: AnyRecord, index: number) => <div key={event.id ?? index} className="flex gap-3 px-5 py-3.5 transition hover:bg-[#FAF9F5]"><div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-[hsl(var(--border))] bg-card text-[#376B58] shadow-2xs"><Activity size={12} /></div><div className="min-w-0 flex-1"><div className="text-[10px] font-semibold text-[#1E2838]">{event.action ?? event.event ?? 'Audit event'}</div><div className="mt-0.5 text-[9px] text-muted-foreground">{event.actor ?? event.user ?? 'System'} · {fmt(event.occurredAt ?? event.createdAt)}</div><div className="mt-0.5 text-[9px] text-slate-600">{event.target ?? event.detail ?? ''}</div></div></div>) : <div className="p-8 text-center text-[10px] text-muted-foreground">No audit events supplied.</div>}</div></Panel>
        </div>
      </div>
      {mode === 'demo' && <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#E3D9C0] bg-[#FAF6EA] p-3.5 text-[10px] leading-relaxed text-[#6E5420] shadow-2xs sm:flex-row sm:items-center sm:justify-between"><span>Changes in this demo are stored only in this browser. They do not change source records or connect to an external system.</span><button onClick={() => { resetSimulatedChanges(); setNotice('Local simulated review and admin changes were reset.'); void qc.invalidateQueries(); }} className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold shadow-2xs hover:bg-amber-50">Reset simulated changes</button></div>}
    </StatePanel>
  </div>;
}

export function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const { mode } = useAuth();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const q = useQuery({
    queryKey: ['nexus-notifications', unreadOnly],
    queryFn: () => listNotifications({ unreadOnly }),
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['nexus-unread-count'] });
      await qc.invalidateQueries({ queryKey: ['nexus-notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['nexus-unread-count'] });
      await qc.invalidateQueries({ queryKey: ['nexus-notifications'] });
    },
  });

  const items = useMemo(() => {
    let list = q.data ?? [];
    if (typeFilter) {
      list = list.filter((n) => n.type === typeFilter);
    }
    return list;
  }, [q.data, typeFilter]);

  const unreadCount = useMemo(() => (q.data ?? []).filter((n) => !n.readAt).length, [q.data]);

  return (
    <div>
      <PageHeader
        eyebrow="Activity Center"
        title="Notifications"
        description="System events, coordination review requests, access assignments and operational data quality alerts."
        action={
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-card px-3 py-1.5 text-[10px] font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50"
                data-testid="button-page-mark-all-read"
              >
                <CheckCheck size={13} className="text-[#376B58]" />
                Mark all as read
              </button>
            )}
            <Badge tone={mode === 'demo' ? 'amber' : 'green'}>
              {mode === 'demo' ? 'Simulated notifications' : 'Secure notifications'}
            </Badge>
          </div>
        }
      />

      <Panel title="Notifications log" detail={`${items.length} notifications ${unreadOnly ? '(unread only)' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/50 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setUnreadOnly(false)}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold transition ${
                !unreadOnly ? 'bg-[#376B58] text-white shadow-2xs' : 'border border-[hsl(var(--border))] bg-card text-slate-700 hover:bg-slate-50'
              }`}
              data-testid="filter-all-notifications"
            >
              All notices ({q.data?.length ?? 0})
            </button>
            <button
              onClick={() => setUnreadOnly(true)}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-semibold transition ${
                unreadOnly ? 'bg-[#376B58] text-white shadow-2xs' : 'border border-[hsl(var(--border))] bg-card text-slate-700 hover:bg-slate-50'
              }`}
              data-testid="filter-unread-notifications"
            >
              Unread only ({unreadCount})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Type:
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="ml-1.5 h-8 rounded-lg border border-[hsl(var(--input))] bg-card px-2 text-[10px] font-normal text-slate-700 shadow-2xs outline-none focus:border-primary"
                data-testid="select-notification-type-filter"
              >
                <option value="">All types</option>
                <option value="coordination_available">Review queue</option>
                <option value="coordination_reviewed">Review outcome</option>
                <option value="access_updated">Access updated</option>
                <option value="operational_alert">System alert</option>
              </select>
            </label>
          </div>
        </div>

        <StatePanel
          loading={q.isLoading}
          error={q.error}
          retry={() => q.refetch()}
          empty={!q.isLoading && !q.error && items.length === 0}
          emptyTitle={unreadOnly ? 'No unread notifications' : 'No notifications found'}
          emptyText={unreadOnly ? 'All notifications have been marked as read.' : 'No system notifications match the selected filter.'}
        >
          <div className="divide-y divide-[hsl(var(--border))]/50">
            {items.map((notification) => {
              const isUnread = !notification.readAt;
              return (
                <div
                  key={notification.id}
                  className={`flex flex-col gap-3 p-4 transition sm:flex-row sm:items-start sm:justify-between ${
                    isUnread ? 'border-l-[3px] border-l-[#376B58] bg-[#F5F8F6]' : 'border-l-[3px] border-l-transparent bg-card hover:bg-[#FAF9F5]'
                  }`}
                  data-testid={`notification-row-${notification.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-2 w-2 shrink-0 items-center justify-center">
                      {isUnread && <span className="h-2 w-2 rounded-full bg-[#376B58]" />}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={notification.type === 'operational_alert' ? 'amber' : notification.type === 'access_updated' ? 'green' : 'blue'}>
                          {notification.type.replaceAll('_', ' ')}
                        </Badge>
                        {notification.isSimulated && (
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.2 text-[8px] font-bold text-amber-800">
                            SIMULATED
                          </span>
                        )}
                        <h3 className={`text-xs font-semibold ${isUnread ? 'text-[#1E2838] font-bold' : 'text-slate-700'}`}>
                          {notification.title}
                        </h3>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                        {notification.message}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[9px] text-muted-foreground">
                        <span>Recorded {fmt(notification.createdAt)}</span>
                        {notification.readAt && (
                          <span>· Read {fmt(notification.readAt)}</span>
                        )}
                        {notification.dedupeKey && (
                          <span className="font-mono text-muted-foreground/80">Ref: {notification.dedupeKey}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                    {notification.destinationPath && (
                      <button
                        onClick={() => {
                          if (isUnread) markReadMutation.mutate(notification.id);
                          setLocation(notification.destinationPath);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-[hsl(var(--border))] bg-card px-2.5 py-1.5 text-[10px] font-semibold text-primary shadow-2xs hover:bg-slate-50"
                        data-testid={`button-open-record-${notification.id}`}
                      >
                        Open record <ExternalLink size={11} />
                      </button>
                    )}
                    {isUnread && (
                      <button
                        onClick={() => markReadMutation.mutate(notification.id)}
                        disabled={markReadMutation.isPending}
                        className="rounded-lg border border-[hsl(var(--border))] bg-card px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 shadow-2xs hover:bg-slate-50"
                        title="Mark as read"
                        data-testid={`button-row-mark-read-${notification.id}`}
                      >
                        <Check size={12} className="mr-1 inline text-slate-500" />
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </StatePanel>
      </Panel>
    </div>
  );
}

