import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AccessGate, NexusShell } from '@/components/nexus-shell';
import {
  AdministrationPage, AnalyticsPage, CaseDetailPage, CasesPage,
  CoordinationPage, InstitutionDetailPage, InstitutionsPage, NotificationsPage, OverviewPage,
  ReliabilityPage, TimelinePage,
} from '@/pages/nexus-pages';
import { useAuth, AuthProvider } from '@/auth/AuthContext';
import NotFound from '@/pages/not-found';
import {
  Redirect,
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

function Protected({ children }: { children: ReactNode }) {
  const { mode, isLoading, profile } = useAuth();
  if (isLoading) return <div className="min-h-[100dvh] bg-[#edf1f5] p-8"><div className="mx-auto max-w-5xl space-y-4"><div className="h-7 w-56 animate-pulse rounded bg-slate-200" /><div className="h-28 animate-pulse rounded bg-slate-200" /><div className="h-64 animate-pulse rounded bg-slate-200" /></div></div>;
  if (mode !== 'signed-in' && mode !== 'demo') return <AccessGate />;
  if (mode === 'signed-in' && profile?.approvalStatus !== 'approved') return <AccessGate />;
  return <NexusShell>{children}</NexusShell>;
}

function AuthRoute() {
  const { mode, isLoading } = useAuth();
  if (isLoading) return <AccessGate />;
  if (mode === 'signed-in' || mode === 'demo') return <Redirect to="/" />;
  return <AccessGate />;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/signin" component={AuthRoute} />
        <Route path="/setup" component={AuthRoute} />
        <Route path="/auth/callback" component={AuthRoute} />
        <Route path="/"><Protected><OverviewPage /></Protected></Route>
        <Route path="/institutions"><Protected><InstitutionsPage /></Protected></Route>
        <Route path="/institutions/:id"><Protected><InstitutionDetailPage /></Protected></Route>
        <Route path="/complaints"><Protected><CasesPage /></Protected></Route>
        <Route path="/complaints/:id"><Protected><CaseDetailPage /></Protected></Route>
        <Route path="/coordination"><Protected><CoordinationPage /></Protected></Route>
        <Route path="/timeline"><Protected><TimelinePage /></Protected></Route>
        <Route path="/analytics"><Protected><AnalyticsPage /></Protected></Route>
        <Route path="/reliability"><Protected><ReliabilityPage /></Protected></Route>
        <Route path="/administration"><Protected><AdministrationPage /></Protected></Route>
        <Route path="/notifications"><Protected><NotificationsPage /></Protected></Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
