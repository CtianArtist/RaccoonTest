import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Logo } from '@/components/kit';
import { BagProvider, basePath, publicAsset } from '@/lib/store';
import NotFound from '@/pages/not-found';
import { Bag, CheckoutCancel, CheckoutSuccess, Home, ProductDetail, Shop } from '@/pages/shop';
import { ArticlePage, Contact, Help, Privacy, ReturnsPolicy } from '@/pages/help';
import { AccountDashboard, CommunityHistory, OrderDetail, OrdersPage, ReturnsPage } from '@/pages/account';
import { CommunityList, DiscussionDetail, NewDiscussion, SupportPage, TicketDetail } from '@/pages/community';
import { AdminPage } from '@/pages/admin';

// Preserve old hash bookmarks (#/shop, #/help/article/x) by converting them once to real paths.
if (typeof window !== 'undefined' && window.location.hash.startsWith('#/')) {
  const target = window.location.hash.slice(1);
  window.history.replaceState(null, '', `${basePath}${target}`);
}


const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const ink = 'hsl(190 26% 19%)';
const clerkAppearance = {
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(169 42% 31%)',
    colorForeground: ink,
    colorMutedForeground: 'hsl(188 14% 38%)',
    colorDanger: 'hsl(6 64% 46%)',
    colorBackground: 'hsl(39 45% 98%)',
    colorInput: 'hsl(36 38% 95%)',
    colorInputForeground: ink,
    colorNeutral: 'hsl(190 26% 19%)',
    fontFamily: "'DM Sans', sans-serif",
    borderRadius: '0.85rem',
  },
  elements: {
    rootBox: { width: '100%', display: 'flex', justifyContent: 'center' },
    cardBox: { background: 'hsl(39 45% 98%)', borderRadius: '1.6rem', width: '440px', maxWidth: '100%', overflow: 'hidden', border: '1px solid hsl(34 22% 83%)', boxShadow: '0 24px 60px hsl(190 26% 19% / .14)' },
    card: { boxShadow: 'none', border: 0, background: 'transparent', borderRadius: 0 },
    footer: { boxShadow: 'none', border: 0, background: 'hsl(35 25% 89% / .6)', borderRadius: 0 },
    headerTitle: { fontFamily: "'Fraunces', Georgia, serif", fontSize: '1.9rem', letterSpacing: '-.02em', color: ink },
    headerSubtitle: { color: 'hsl(188 14% 38%)' },
    socialButtonsBlockButtonText: { color: ink, fontWeight: 600 },
    formFieldLabel: { color: ink, fontWeight: 600 },
    footerActionLink: { color: 'hsl(169 42% 31%)', fontWeight: 700 },
    footerActionText: { color: 'hsl(188 14% 38%)' },
    dividerText: { color: 'hsl(188 14% 38%)' },
    identityPreviewEditButton: { color: 'hsl(169 42% 31%)' },
    formFieldSuccessText: { color: 'hsl(169 42% 26%)' },
    alertText: { color: ink },
    logoBox: { height: '56px', justifyContent: 'center' },
    logoImage: { height: '56px', width: '56px' },
    socialButtonsBlockButton: { border: '1px solid hsl(34 22% 83%)', background: 'hsl(39 45% 98%)' },
    formButtonPrimary: { background: 'hsl(169 42% 31%)', color: 'hsl(36 38% 95%)', borderRadius: '999px', fontWeight: 600, textTransform: 'none' as const, padding: '12px' },
    formFieldInput: { background: 'hsl(36 38% 95%)', border: '1px solid hsl(34 22% 83%)', color: ink },
    footerAction: { justifyContent: 'center' },
    dividerLine: { background: 'hsl(34 22% 83%)' },
    alert: { background: 'hsl(6 64% 46% / .08)', border: '1px solid hsl(6 64% 46% / .3)' },
    otpCodeFieldInput: { border: '1px solid hsl(34 22% 83%)', color: ink },
    formFieldRow: { marginBottom: '4px' },
    main: { gap: '20px' },
  },
};

function AuthFrame({ children, note }: { children: ReactNode; note: string }) {
  return <div className="grain grid min-h-[100dvh] bg-[hsl(var(--background))] lg:grid-cols-[1fr_1.05fr]">
    <aside className="relative hidden overflow-hidden lg:block"><img src={publicAsset('raccoon-hero.jpg')} alt="" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[hsl(190_26%_12%/.75)] via-transparent to-transparent" /><div className="absolute bottom-10 left-10 right-10 text-[hsl(36_38%_95%)]"><p className="mono text-[10px] uppercase tracking-[.2em] opacity-80">Dispatch note 015</p><p className="serif mt-3 max-w-md text-4xl leading-tight">{note}</p></div></aside>
    <div className="flex flex-col"><div className="p-6"><Logo /></div><div className="flex flex-1 items-center justify-center px-4 pb-16 fade-up">{children}</div><p className="pb-6 text-center text-xs text-[hsl(var(--muted-foreground))]"><Link href="/privacy" className="underline">Privacy</Link> / Your bag stays saved while you sign in.</p></div>
  </div>;
}

function SignInPage() {
  return <AuthFrame note="Welcome back to the porch. Your orders and tickets are right where you left them.">
    <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
  </AuthFrame>;
}

function SignUpPage() {
  return <AuthFrame note="One account for orders, returns, private support, and the community porch.">
    <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
  </AuthFrame>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);
  return null;
}

function CustomerQueryBoundary({ children }: { children: ReactNode }) {
  const { user } = useUser();
  // Separate caches at render time, not just an after-render invalidation.
  // In-flight responses for a previous customer can never fill the next customer's cache.
  const client = useMemo(() => new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
  }), [user?.id]);
  useEffect(() => () => { client.clear(); }, [client]);
  // Query/mutation observers retain their original client for their lifetime.
  // Remount them as well as replacing the cache when the authenticated identity changes.
  return <QueryClientProvider key={user?.id ?? 'signed-out'} client={client}><ClerkQueryClientCacheInvalidator />{children}</QueryClientProvider>;
}

function Routes() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/shop" component={Shop} />
    <Route path="/product/:slug" component={ProductDetail} />
    <Route path="/bag" component={Bag} />
    <Route path="/checkout/success" component={CheckoutSuccess} />
    <Route path="/checkout/cancel" component={CheckoutCancel} />
    <Route path="/account" component={AccountDashboard} />
    <Route path="/account/orders" component={OrdersPage} />
    <Route path="/account/orders/:id" component={OrderDetail} />
    <Route path="/account/returns" component={ReturnsPage} />
    <Route path="/account/community" component={CommunityHistory} />
    <Route path="/support" component={SupportPage} />
    <Route path="/support/tickets/:id" component={TicketDetail} />
    <Route path="/community" component={CommunityList} />
    <Route path="/community/new" component={NewDiscussion} />
    <Route path="/community/discussions/:slug" component={DiscussionDetail} />
    <Route path="/admin" component={AdminPage} />
    <Route path="/help" component={Help} />
    <Route path="/help/article/:slug" component={ArticlePage} />
    <Route path="/contact" component={Contact} />
    <Route path="/privacy" component={Privacy} />
    <Route path="/returns-policy" component={ReturnsPolicy} />
    <Route path="/sign-in/*?" component={SignInPage} />
    <Route path="/sign-up/*?" component={SignUpPage} />
    <Route component={NotFound} />
  </Switch>;
}

function ScrollReset() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location]);
  return null;
}

function ClerkProviderWithRoutes() {
  const [location, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to Raccoon Supply Co.' } },
        signUp: { start: { title: 'Join the night shift', subtitle: 'Create your Raccoon Supply Co. account' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <CustomerQueryBoundary>
        <TooltipProvider>
          <BagProvider>
            <ScrollReset />
            <ErrorBoundary resetKey={location}><Routes /></ErrorBoundary>
          </BagProvider>
          <Toaster />
        </TooltipProvider>
      </CustomerQueryBoundary>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
