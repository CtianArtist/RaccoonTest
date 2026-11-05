import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@clerk/react';
import { ArrowRight, Headphones, LogIn, Menu, RotateCw, ShoppingBag, UserRound, X } from 'lucide-react';
import { useGetMe, getGetMeQueryKey, type Product } from '@workspace/api-client-react';
import { formatMoney, openSupport, productImage, productTone, publicAsset, signInHref, useBag, useSignedIn } from '@/lib/store';

export function Logo() {
  return <Link href="/" className="focus-ring group flex items-center gap-3" data-testid="link-logo">
    <img src={publicAsset('logo.svg')} alt="" className="h-10 w-10 transition-transform duration-500 group-hover:rotate-[-8deg]" />
    <span><span className="serif block text-xl leading-none">Raccoon Supply</span><span className="mono text-[10px] uppercase tracking-[.22em] text-[hsl(var(--muted-foreground))]">Co. / Field goods</span></span>
  </Link>;
}

export function useMe() {
  const { signedIn } = useSignedIn();
  return useGetMe({ query: { enabled: signedIn, queryKey: getGetMeQueryKey(), staleTime: 60_000 } });
}

function NavLink({ href, children, onClick, testId }: { href: string; children: ReactNode; onClick: () => void; testId: string }) {
  const [location] = useLocation();
  const active = href === '/' ? location === '/' : location.startsWith(href);
  return <Link href={href} onClick={onClick} className={`focus-ring nav-link text-sm font-semibold ${active ? 'is-active' : ''}`} data-testid={testId}>{children}</Link>;
}

function Header() {
  const [open, setOpen] = useState(false);
  const { count } = useBag();
  const { isLoaded, isSignedIn } = useAuth();
  const { data: me } = useMe();
  const close = () => setOpen(false);
  const staff = me?.role === 'admin' || me?.role === 'staff';
  return <header className="sticky top-0 z-40 border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/.94)] backdrop-blur-md">
    <div className="shell flex min-h-[76px] items-center justify-between gap-5"><Logo />
      <nav className={`${open ? 'absolute left-0 right-0 top-[76px] flex' : 'hidden'} flex-col gap-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5 lg:static lg:flex lg:flex-row lg:items-center lg:gap-6 lg:border-0 lg:bg-transparent lg:p-0`} aria-label="Primary navigation">
        <NavLink href="/shop" onClick={close} testId="link-shop">Shop</NavLink>
        <NavLink href="/help" onClick={close} testId="link-help">Help center</NavLink>
        <NavLink href="/community" onClick={close} testId="link-community">Community</NavLink>
        <NavLink href="/support" onClick={close} testId="link-support">Support</NavLink>
        <NavLink href="/contact" onClick={close} testId="link-contact">Contact</NavLink>
        {staff && <NavLink href="/admin" onClick={close} testId="link-admin">Desk</NavLink>}
      </nav>
      <div className="flex items-center gap-2">
        <button className="focus-ring hidden items-center gap-2 rounded-full border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold transition-colors hover:bg-[hsl(var(--card))] xl:flex" onClick={openSupport} data-testid="button-open-chat"><Headphones size={16} /> Contact support</button>
        {isLoaded && (isSignedIn
          ? <Link href="/account" className="focus-ring grid h-10 w-10 place-items-center rounded-full border border-[hsl(var(--border))] transition-colors hover:bg-[hsl(var(--card))]" aria-label="Your account" data-testid="link-account"><UserRound size={17} /></Link>
          : <Link href={signInHref()} className="focus-ring hidden items-center gap-2 rounded-full border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold sm:flex" data-testid="link-sign-in"><LogIn size={15} /> Sign in</Link>)}
        <Link href="/bag" aria-label={`Shopping bag, ${count} items`} className="focus-ring relative grid h-10 w-10 place-items-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] transition-transform active:scale-95" data-testid="link-bag"><ShoppingBag size={17} />{count > 0 && <span key={count} className="pop absolute -right-1 -top-1 rounded-full bg-[hsl(var(--secondary))] px-1.5 text-xs text-[hsl(var(--foreground))]" data-testid="text-bag-count">{count}</span>}</Link>
        <button className="focus-ring grid h-10 w-10 place-items-center rounded-full border border-[hsl(var(--border))] lg:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu" aria-expanded={open} data-testid="button-toggle-menu">{open ? <X size={18} /> : <Menu size={18} />}</button>
      </div>
    </div>
  </header>;
}

function Footer() {
  return <footer className="mt-24 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/.45)]">
    <div className="shell grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
      <div><Logo /><p className="mt-4 max-w-xs text-sm leading-6 text-[hsl(var(--muted-foreground))]">Useful little goods for people who notice the night shift.</p></div>
      <div><p className="mono mb-4 text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Explore</p><div className="grid gap-2 text-sm"><Link href="/shop">Shop the goods</Link><Link href="/community">Community</Link><Link href="/help">Help center</Link><Link href="/contact">Contact the desk</Link></div></div>
      <div><p className="mono mb-4 text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Your things</p><div className="grid gap-2 text-sm"><Link href="/account">Account</Link><Link href="/account/orders">Orders</Link><Link href="/account/returns">Returns</Link><Link href="/support">Support tickets</Link></div></div>
      <div><p className="mono mb-4 text-[10px] uppercase text-[hsl(var(--muted-foreground))]">The small print</p><div className="grid gap-2 text-sm"><Link href="/returns-policy">Returns policy</Link><Link href="/privacy">Privacy information</Link></div></div>
    </div>
    <div className="shell flex flex-wrap justify-between gap-3 border-t border-[hsl(var(--border))] py-5"><p className="mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">© {new Date().getFullYear()} Raccoon Supply Co. All rights reserved.</p><p className="mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Fictional research store. No payments or shipments.</p></div>
  </footer>;
}

export function Layout({ children }: { children: ReactNode }) {
  return <div className="grain min-h-[100dvh]"><Header />{children}<Footer /></div>;
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{children}</p>;
}

export function PageHead({ eyebrow, title, intro, children }: { eyebrow: string; title: ReactNode; intro?: ReactNode; children?: ReactNode }) {
  return <div className="fade-up flex flex-col justify-between gap-6 md:flex-row md:items-end"><div className="max-w-2xl"><Eyebrow>{eyebrow}</Eyebrow><h1 className="serif mt-4 text-[clamp(2.6rem,6vw,4rem)] leading-[.95] tracking-[-.03em]">{title}</h1>{intro && <p className="mt-5 text-lg leading-8 text-[hsl(var(--muted-foreground))]">{intro}</p>}</div>{children}</div>;
}

export function Bone({ className = '' }: { className?: string }) {
  return <div className={`bone rounded-xl ${className}`} />;
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return <div className="grid gap-3" aria-busy="true" aria-label="Loading">{Array.from({ length: rows }).map((_, i) => <div key={i} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><Bone className="h-4 w-1/3" /><Bone className="mt-3 h-3 w-2/3" /></div>)}</div>;
}

export function ErrorState({ title = 'That did not load.', message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return <div className="rounded-2xl border border-[hsl(var(--destructive)/.35)] bg-[hsl(var(--destructive)/.06)] p-8" role="alert" data-testid="state-error"><p className="serif text-2xl">{title}</p><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{message ?? 'The connection dropped somewhere between here and the workshop.'}</p>{onRetry && <button onClick={onRetry} className="focus-ring mt-5 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 text-sm font-semibold" data-testid="button-retry"><RotateCw size={14} /> Try again</button>}</div>;
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return <div className="paper-grid relative overflow-hidden rounded-2xl border border-dashed border-[hsl(var(--border))] p-12 text-center" data-testid="state-empty">
    <svg aria-hidden viewBox="0 0 64 24" className="mx-auto mb-5 h-6 w-16 text-[hsl(var(--muted-foreground)/.5)]"><path d="M2 12h10M18 12h8M32 12h6M44 12h4M54 12h2" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
    <p className="serif text-3xl">{title}</p>{message && <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[hsl(var(--muted-foreground))]">{message}</p>}{action && <div className="mt-6">{action}</div>}</div>;
}

const pillTones: Record<string, string> = {
  paid: 'teal', processing: 'sand', packed: 'sand', shipped: 'teal', 'out for delivery': 'teal', delivered: 'green',
  open: 'rust', pending: 'sand', solved: 'green', closed: 'muted', approved: 'green', rejected: 'rust', inspected: 'teal', requested: 'sand',
  published: 'green', locked: 'muted', cancelled: 'muted', refunded: 'muted',
};
export function StatusPill({ status }: { status: string }) {
  const tone = pillTones[status.toLowerCase()] ?? 'sand';
  return <span className={`pill pill-${tone}`} data-testid={`status-${status.toLowerCase().replace(/\s+/g, '-')}`}><i />{status}</span>;
}

export function RequireAuth({ children, title = 'This shelf is for signed-in visitors.' }: { children: ReactNode; title?: string }) {
  const { ready, signedIn } = useSignedIn();
  if (!ready) return <main className="shell py-20"><Bone className="h-12 w-72" /><div className="mt-10"><ListSkeleton /></div></main>;
  if (!signedIn) return <main className="shell py-20"><div className="mx-auto max-w-xl rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-10 text-center fade-up"><img src={publicAsset('logo.svg')} alt="" className="mx-auto h-14 w-14" /><h1 className="serif mt-6 text-4xl leading-tight">{title}</h1><p className="mt-4 text-[hsl(var(--muted-foreground))]">Sign in to see your orders, returns, support tickets, and community posts. Your bag stays right where you left it.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Link href={signInHref()} className="btn-primary" data-testid="link-gate-sign-in">Sign in <ArrowRight size={16} /></Link><Link href="/sign-up" className="btn-ghost" data-testid="link-gate-sign-up">Create an account</Link></div></div></main>;
  return <>{children}</>;
}

export function ProductCard({ product }: { product: Product }) {
  return <Link href={`/product/${product.slug}`} className="hover-lift focus-ring group flex flex-col overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]" data-testid={`card-product-${product.slug}`}>
    <div className="relative aspect-[1.08] overflow-hidden" style={{ backgroundColor: productTone(product.slug) }}><img src={productImage(product.image)} alt={product.name} loading="lazy" className="h-full w-full object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-105" /><span className="absolute left-4 top-4 rounded-full bg-[hsl(var(--card)/.86)] px-3 py-1 text-[10px] font-bold uppercase tracking-[.13em]">{product.badge ?? product.category}</span></div>
    <div className="flex flex-1 flex-col p-5"><div className="flex items-start justify-between gap-3"><h3 className="serif text-2xl">{product.name}</h3><span className="font-semibold" data-testid={`text-price-${product.slug}`}>{formatMoney(product.priceCents)}</span></div><p className="mt-2 line-clamp-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{product.description}</p><span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-bold text-[hsl(var(--primary))]">Inspect the goods <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" /></span></div>
  </Link>;
}

export function ProductCardSkeleton() {
  return <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]"><Bone className="aspect-[1.08] rounded-none" /><div className="p-5"><Bone className="h-6 w-2/3" /><Bone className="mt-3 h-3 w-full" /><Bone className="mt-2 h-3 w-4/5" /></div></div>;
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return <label className="grid gap-2"><span className="flex items-baseline justify-between gap-3"><span className="text-sm font-semibold">{label}</span>{hint && <span className="mono text-[10px] uppercase text-[hsl(var(--muted-foreground))]">{hint}</span>}</span>{children}{error && <span className="text-sm text-[hsl(var(--destructive))]" role="alert">{error}</span>}</label>;
}
