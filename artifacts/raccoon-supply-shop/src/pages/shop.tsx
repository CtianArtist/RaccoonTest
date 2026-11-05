import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, CircleHelp, Clock3, Lock, Minus, Moon, Package, Plus, Search, ShieldCheck, ShoppingBag, Sparkles, Trash2, Users } from 'lucide-react';
import {
  useCreateCheckout, useGetCheckoutStatus, useGetOrder, useGetProduct, useListProducts,
  getGetCheckoutStatusQueryKey, getGetDashboardQueryKey, getGetOrderQueryKey, getGetProductQueryKey, getListOrdersQueryKey, getListProductsQueryKey,
  type Product,
} from '@workspace/api-client-react';
import { Bone, EmptyState, ErrorState, Eyebrow, Layout, ProductCard, ProductCardSkeleton, StatusPill } from '@/components/kit';
import { MAX_QTY, errorMessage, formatMoney, openSupport, productImage, productTone, publicAsset, signInHref, useBag, useSignedIn } from '@/lib/store';

function useCatalog() {
  return useListProducts(undefined, { query: { queryKey: getListProductsQueryKey(), staleTime: 5 * 60_000 } });
}

export function Home() {
  const [, setLocation] = useLocation();
  const { data: products, isLoading, isError, refetch } = useCatalog();
  const featured = useMemo(() => {
    if (!products) return [];
    const f = products.filter((p) => p.featured);
    return (f.length >= 3 ? f : products).slice(0, 3);
  }, [products]);
  const fresh = useMemo(() => (products ?? []).filter((p) => !featured.includes(p)).slice(-3), [products, featured]);
  return <Layout><main>
    <section className="shell grid min-h-[620px] items-center gap-10 py-12 md:grid-cols-[.85fr_1.15fr] md:py-20">
      <div className="fade-up relative z-10"><p className="mono mb-5 text-xs uppercase tracking-[.22em] text-[hsl(var(--primary))]">Est. somewhere after midnight / field goods</p><h1 className="serif max-w-xl text-[clamp(3.5rem,8vw,7.2rem)] leading-[.88] tracking-[-.06em]">Good things for the <em className="text-[hsl(var(--primary))]">night curious.</em></h1><p className="mt-7 max-w-md text-lg leading-8 text-[hsl(var(--muted-foreground))]">Raccoon Supply Co. makes small, useful goods for porch watchers, pocket collectors, and anyone who prefers their adventures after dark.</p>
        <div className="mt-8 flex flex-wrap gap-3"><button onClick={() => setLocation('/shop')} className="btn-primary" data-testid="button-shop-collection">Shop the collection <ArrowRight size={17} /></button><button onClick={openSupport} className="btn-ghost" data-testid="button-home-chat">Contact support</button></div>
        <div className="mt-12 flex gap-7 text-sm">{[['30', 'day returns'], ['1–3', 'days to pack'], [String(products?.length ?? 12), 'field favorites']].map(([n, l]) => <span key={l}><strong className="serif text-2xl">{n}</strong><br /><span className="text-[hsl(var(--muted-foreground))]">{l}</span></span>)}</div>
      </div>
      <div className="relative min-h-[430px] overflow-hidden rounded-[2.2rem] bg-[#bfd0c1]"><img src={publicAsset('raccoon-hero.jpg')} alt="A raccoon beside a canvas field kit in a warm cabin" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute bottom-5 left-5 rounded-xl border border-white/40 bg-[#f8f0df]/85 px-4 py-3 backdrop-blur-sm"><p className="mono text-[10px] uppercase text-[hsl(var(--primary))]">Dispatch note 014</p><p className="mt-1 text-sm">Pack light. Look closely.</p></div></div>
    </section>
    <section className="paper-grid border-y border-[hsl(var(--border))]"><div className="shell grid gap-8 py-16 md:grid-cols-[.7fr_1.3fr]"><div><Eyebrow>The field notes</Eyebrow><h2 className="serif mt-4 text-4xl leading-tight">A small shop with a large soft spot for the overlooked.</h2></div><div className="grid gap-5 sm:grid-cols-3">
      <div className="rounded-2xl bg-[hsl(var(--card))] p-5"><Sparkles className="text-[hsl(var(--accent))]" size={20} /><h3 className="mt-7 font-semibold">Useful first</h3><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Goods that earn their space on a shelf, a hook, or a nightstand.</p></div>
      <div className="rounded-2xl bg-[hsl(var(--card))] p-5"><Package className="text-[hsl(var(--accent))]" size={20} /><h3 className="mt-7 font-semibold">Small batch</h3><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Packed by hand in our workshop, usually within three days.</p></div>
      <div className="rounded-2xl bg-[hsl(var(--card))] p-5"><CircleHelp className="text-[hsl(var(--accent))]" size={20} /><h3 className="mt-7 font-semibold">Clear answers</h3><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">A help center that says what happens next, plainly.</p></div>
    </div></div></section>
    <section className="shell py-20"><div className="flex items-end justify-between gap-5"><div><Eyebrow>On the bench</Eyebrow><h2 className="serif mt-3 text-5xl">A few good finds</h2></div><Link href="/shop" className="focus-ring hidden items-center gap-2 text-sm font-bold md:flex">View all goods <ArrowRight size={15} /></Link></div>
      {isError ? <div className="mt-9"><ErrorState message="The bench did not load. The shelves are still here." onRetry={() => refetch()} /></div> : <div className="mt-9 grid gap-5 md:grid-cols-3 stagger">{isLoading ? [0, 1, 2].map((i) => <ProductCardSkeleton key={i} />) : featured.map((p) => <ProductCard key={p.slug} product={p} />)}</div>}
      <Link href="/shop" className="focus-ring mt-7 inline-flex items-center gap-2 text-sm font-bold md:hidden">View all goods <ArrowRight size={15} /></Link></section>
    {fresh.length > 0 && <section className="shell pb-20"><div className="grid gap-8 rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:grid-cols-[.8fr_2fr] md:p-10"><div><Moon className="text-[hsl(var(--accent))]" size={22} /><h2 className="serif mt-5 text-4xl leading-tight">For the longer walk home.</h2><p className="mt-4 text-sm leading-6 text-[hsl(var(--muted-foreground))]">New trail layers and carry goods for quiet late-night adventures. Same small bench, bigger outdoors.</p><Link href="/shop" className="focus-ring mt-6 inline-flex items-center gap-2 text-sm font-bold text-[hsl(var(--primary))]">See the trail shelf <ArrowRight size={14} /></Link></div><div className="grid gap-4 sm:grid-cols-3">{fresh.map((p) => <Link key={p.slug} href={`/product/${p.slug}`} className="focus-ring group" data-testid={`link-fresh-${p.slug}`}><div className="aspect-square overflow-hidden rounded-2xl" style={{ backgroundColor: productTone(p.slug) }}><img src={productImage(p.image)} alt={p.name} loading="lazy" className="h-full w-full object-cover mix-blend-multiply transition-transform duration-700 group-hover:scale-105" /></div><p className="serif mt-3 text-lg leading-tight">{p.name}</p><p className="text-sm text-[hsl(var(--muted-foreground))]">{formatMoney(p.priceCents)}</p></Link>)}</div></div></section>}
    <section className="shell pb-20"><div className="grid overflow-hidden rounded-[2rem] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] md:grid-cols-[1fr_.8fr]"><div className="p-8 md:p-14"><p className="mono text-[10px] uppercase tracking-[.2em] opacity-70">Need a hand?</p><h2 className="serif mt-4 max-w-md text-5xl leading-[.95]">The answers live in the help center.</h2><p className="mt-5 max-w-md leading-7 opacity-80">Shipping windows, tracking, returns, cancellations, account questions — all in one calm, searchable place.</p><Link href="/help" className="focus-ring mt-8 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--secondary))] px-5 py-3 font-semibold text-[hsl(var(--foreground))]">Browse help center <ArrowRight size={16} /></Link></div><div className="paper-grid min-h-[270px] bg-[hsl(var(--secondary)/.16)] p-8 md:p-14"><p className="serif text-3xl">“If it feels like a secret, we probably need a better article.”</p><p className="mono mt-8 text-[10px] uppercase opacity-70">— desk rule no. 02</p></div></div></section>
    <section className="shell pb-8"><Link href="/community" className="hover-lift focus-ring flex flex-col items-start justify-between gap-6 rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--secondary)/.35)] p-8 md:flex-row md:items-center md:p-12" data-testid="link-home-community"><div className="flex items-start gap-5"><Users className="mt-1 shrink-0 text-[hsl(var(--primary))]" size={26} /><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">The porch</p><p className="serif mt-2 text-3xl leading-tight md:text-4xl">Trail reports, gear questions, and midnight sightings.</p></div></div><span className="btn-primary shrink-0">Join the conversation <ArrowRight size={16} /></span></Link></section>
  </main></Layout>;
}

export function Shop() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  useEffect(() => { const t = window.setTimeout(() => setDebounced(query.trim()), 250); return () => window.clearTimeout(t); }, [query]);
  const all = useCatalog();
  const params = { ...(debounced ? { q: debounced } : {}), ...(category ? { category } : {}) };
  const hasParams = Boolean(debounced || category);
  const filtered = useListProducts(params, { query: { queryKey: getListProductsQueryKey(params), enabled: hasParams, placeholderData: (prev) => prev } });
  const source = hasParams ? filtered : all;
  const cats = useMemo(() => Array.from(new Set((all.data ?? []).map((p) => p.category))).sort(), [all.data]);
  const list = source.data ?? [];
  return <Layout><main className="shell py-14 md:py-20"><div className="max-w-2xl fade-up"><Eyebrow>The collection</Eyebrow><h1 className="serif mt-4 text-6xl leading-[.92]">Goods for the curious.</h1><p className="mt-6 text-lg leading-8 text-[hsl(var(--muted-foreground))]">Nothing here is urgent. Everything here is meant to be used, kept, and noticed.</p></div>
    <div className="mt-12 flex flex-col gap-4 border-y border-[hsl(var(--border))] py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">{['', ...cats].map((c) => <button key={c || 'all'} onClick={() => setCategory(c)} className={`focus-ring rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${category === c ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))]'}`} data-testid={`button-category-${c || 'all'}`}>{c || 'Everything'}</button>)}</div>
      <div className="flex items-center gap-4"><p className="mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]" data-testid="text-result-count">{source.isLoading ? 'Counting…' : `${list.length} pieces on the bench`}</p><label className="flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 transition-shadow focus-within:shadow-md"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search goods" className="w-44 bg-transparent text-sm outline-none" data-testid="input-product-search" /></label></div>
    </div>
    {source.isError ? <div className="mt-8"><ErrorState onRetry={() => source.refetch()} /></div>
      : source.isLoading ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)}</div>
      : list.length ? <div className={`mt-8 grid gap-5 transition-opacity sm:grid-cols-2 lg:grid-cols-3 stagger ${source.isFetching ? 'opacity-70' : ''}`}>{list.map((p) => <ProductCard key={p.slug} product={p} />)}</div>
      : <div className="mt-8"><EmptyState title="Nothing found in the cupboard." message="Try a broader word or another shelf." action={<button onClick={() => { setQuery(''); setCategory(''); }} className="btn-ghost" data-testid="button-clear-search">Clear search</button>} /></div>}
    <div className="mt-16 flex items-center gap-3 rounded-2xl bg-[hsl(var(--secondary)/.45)] p-5 text-sm text-[hsl(var(--muted-foreground))]"><Clock3 size={18} /><span>Packed with care in 1–3 business days. Questions? The support desk is here to help.</span></div>
  </main></Layout>;
}

export function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading, isError, error, refetch } = useGetProduct(slug, { query: { queryKey: getGetProductQueryKey(slug), retry: 1 } });
  const { add } = useBag();
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [sizeError, setSizeError] = useState(false);
  useEffect(() => { setSize(''); setQty(1); setAdded(false); }, [slug]);
  useEffect(() => { if (!added) return; const t = window.setTimeout(() => setAdded(false), 4000); return () => window.clearTimeout(t); }, [added]);
  const notFound = isError && (error as { status?: number } | null)?.status === 404;
  return <Layout><main className="shell py-12 md:py-20"><Link href="/shop" className="focus-ring text-sm font-semibold text-[hsl(var(--muted-foreground))]">← Back to collection</Link>
    {isLoading ? <div className="mt-8 grid gap-10 md:grid-cols-[1.1fr_.9fr]"><Bone className="aspect-square rounded-[2rem]" /><div><Bone className="h-3 w-24" /><Bone className="mt-5 h-16 w-4/5" /><Bone className="mt-5 h-6 w-24" /><Bone className="mt-6 h-20 w-full" /></div></div>
      : notFound ? <div className="mt-8"><EmptyState title="That piece wandered off." message="It may have been retired from the bench." action={<Link href="/shop" className="btn-primary">Back to the shop</Link>} /></div>
      : isError || !product ? <div className="mt-8"><ErrorState onRetry={() => refetch()} /></div>
      : <ProductBody product={product} size={size} setSize={(s) => { setSize(s); setSizeError(false); }} qty={qty} setQty={setQty} added={added} sizeError={sizeError}
        onAdd={() => { if (product.sizes.length && !size) { setSizeError(true); return; } add(product.slug, size, qty); setAdded(true); }} />}
  </main></Layout>;
}

function ProductBody({ product, size, setSize, qty, setQty, added, sizeError, onAdd }: { product: Product; size: string; setSize: (s: string) => void; qty: number; setQty: (n: number) => void; added: boolean; sizeError: boolean; onAdd: () => void }) {
  return <div className="mt-8 grid gap-10 md:grid-cols-[1.1fr_.9fr] md:items-center">
    <div className="fade-up overflow-hidden rounded-[2rem]" style={{ backgroundColor: productTone(product.slug) }}><img src={productImage(product.image)} alt={product.name} className="aspect-square h-full w-full object-cover mix-blend-multiply" data-testid="img-product" /></div>
    <div className="fade-up"><Eyebrow>{product.badge ? `${product.badge} / ${product.category}` : product.category}</Eyebrow><h1 className="serif mt-4 text-6xl leading-[.9]" data-testid="text-product-name">{product.name}</h1><p className="mt-5 text-2xl font-semibold" data-testid="text-product-price">{formatMoney(product.priceCents)}</p><p className="mt-5 text-lg leading-8 text-[hsl(var(--muted-foreground))]">{product.description}</p>
      {product.sizes.length > 0 && <fieldset className="mt-7"><legend className="flex w-full justify-between text-sm font-semibold">Size {sizeError && <span className="text-[hsl(var(--destructive))]" role="alert">Pick a size first</span>}</legend><div className={`mt-3 flex flex-wrap gap-2 ${sizeError ? 'animate-[shake_.3s]' : ''}`}>{product.sizes.map((s) => <button key={s} type="button" onClick={() => setSize(s)} aria-pressed={size === s} className={`focus-ring min-w-12 rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${size === s ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : sizeError ? 'border-[hsl(var(--destructive))] bg-[hsl(var(--card))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))]'}`} data-testid={`button-size-${s}`}>{s}</button>)}</div></fieldset>}
      <div className="mt-6 flex items-center gap-3"><span className="text-sm font-semibold">Quantity</span><Stepper value={qty} onChange={setQty} label={product.name} testId="product" /></div>
      <div className="my-8 border-y border-[hsl(var(--border))] py-5"><p className="font-semibold">Made to be used, kept, and noticed.</p><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Packed with care in 1–3 business days. Unused, unwashed items in original condition may be returned within 30 days of delivery.</p></div>
      <div className="flex flex-wrap items-center gap-4"><button onClick={onAdd} className="btn-primary" data-testid="button-add-to-bag">{added ? <><Check size={17} /> Added to bag</> : <><ShoppingBag size={17} /> Add to bag</>}</button>{added && <Link href="/bag" className="focus-ring pop text-sm font-semibold text-[hsl(var(--primary))]" data-testid="link-view-bag">View your bag →</Link>}</div>
    </div>
  </div>;
}

function Stepper({ value, onChange, label, testId }: { value: number; onChange: (n: number) => void; label: string; testId: string }) {
  return <div className="inline-flex items-center rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))]"><button type="button" aria-label={`Remove one ${label}`} disabled={value <= 1} onClick={() => onChange(value - 1)} className="focus-ring grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-[hsl(var(--muted))] disabled:opacity-40" data-testid={`button-decrease-${testId}`}><Minus size={14} /></button><span key={value} className="pop w-8 text-center font-semibold tabular-nums" aria-label="Quantity" data-testid={`text-quantity-${testId}`}>{value}</span><button type="button" aria-label={`Add one ${label}`} disabled={value >= MAX_QTY} onClick={() => onChange(value + 1)} className="focus-ring grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-[hsl(var(--muted))] disabled:opacity-40" data-testid={`button-increase-${testId}`}><Plus size={14} /></button></div>;
}

function newRequestId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function Bag() {
  const { items, setQuantity, remove } = useBag();
  const { data: products, isLoading, isError, refetch } = useCatalog();
  const { ready, signedIn } = useSignedIn();
  const checkout = useCreateCheckout();
  const [redirecting, setRedirecting] = useState(false);
  const bagSignature = JSON.stringify(items);
  // One idempotency key per distinct bag; retries of the same bag reuse it.
  const requestId = useMemo(() => newRequestId(), [bagSignature]); // eslint-disable-line react-hooks/exhaustive-deps
  const lines = items.map((i) => ({ ...i, product: products?.find((p) => p.slug === i.slug) }));
  const valid = lines.filter((l) => l.product);
  const subtotal = valid.reduce((t, l) => t + l.product!.priceCents * l.quantity, 0);
  const startCheckout = () => {
    checkout.mutate({ data: { requestId, items: valid.map((l) => ({ slug: l.slug, quantity: l.quantity, ...(l.size ? { size: l.size } : {}) })) } }, {
      onSuccess: (link) => { setRedirecting(true); window.location.assign(link.url); },
    });
  };
  return <Layout><main className="shell max-w-5xl py-14 md:py-20"><div className="fade-up"><Eyebrow>Your collection</Eyebrow><h1 className="serif mt-4 text-6xl">Shopping bag</h1></div>
    {!items.length ? <div className="mt-10"><EmptyState title="Your bag is waiting for a few good finds." message="Everything you add stays here, even if you sign in or step away from checkout." action={<Link href="/shop" className="btn-primary" data-testid="link-continue-shopping">Continue shopping <ArrowRight size={17} /></Link>} /></div>
      : isLoading ? <div className="mt-10 grid gap-4">{items.map((i) => <Bone key={i.slug + i.size} className="h-28 rounded-2xl" />)}</div>
      : isError ? <div className="mt-10"><ErrorState message="We could not check prices for your bag." onRetry={() => refetch()} /></div>
      : <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px]">
        <ul className="grid content-start gap-4 stagger">{lines.map((l) => {
          const id = `${l.slug}-${l.size || 'one'}`;
          if (!l.product) return <li key={id} className="flex items-center justify-between gap-4 rounded-2xl border border-dashed border-[hsl(var(--border))] p-5 text-sm"><span>An item in your bag is no longer on the bench.</span><button onClick={() => remove(l.slug, l.size)} className="font-semibold underline" data-testid={`button-remove-${id}`}>Remove</button></li>;
          return <li key={id} className="flex flex-wrap items-center gap-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4" data-testid={`row-bag-${id}`}><div className="h-20 w-20 overflow-hidden rounded-xl" style={{ backgroundColor: productTone(l.slug) }}><img src={productImage(l.product.image)} alt={l.product.name} className="h-full w-full object-cover mix-blend-multiply" /></div><div className="min-w-[140px] flex-1"><Link href={`/product/${l.slug}`} className="serif text-2xl hover:text-[hsl(var(--primary))]">{l.product.name}</Link><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{formatMoney(l.product.priceCents)}{l.size ? ` / Size ${l.size}` : ''}</p></div><div className="flex items-center gap-3"><Stepper value={l.quantity} onChange={(n) => setQuantity(l.slug, l.size, n)} label={l.product.name} testId={id} /><button onClick={() => remove(l.slug, l.size)} aria-label={`Remove ${l.product.name}`} className="focus-ring grid h-9 w-9 place-items-center rounded-full text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--destructive))]" data-testid={`button-remove-${id}`}><Trash2 size={16} /></button></div><p className="w-20 text-right font-semibold tabular-nums">{formatMoney(l.product.priceCents * l.quantity)}</p></li>;
        })}</ul>
        <aside className="h-fit rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 lg:sticky lg:top-24"><p className="serif text-2xl">Summary</p><dl className="mt-5 grid gap-3 text-sm"><div className="flex justify-between"><dt>Subtotal</dt><dd className="font-semibold tabular-nums" data-testid="text-subtotal">{formatMoney(subtotal)}</dd></div><div className="flex justify-between text-[hsl(var(--muted-foreground))]"><dt>Shipping</dt><dd>Calculated at checkout</dd></div></dl>
          <div className="mt-6 border-t border-[hsl(var(--border))] pt-6">{!ready ? <Bone className="h-12 rounded-full" />
            : signedIn ? <button onClick={startCheckout} disabled={!valid.length || checkout.isPending || redirecting} className="btn-primary w-full" data-testid="button-checkout">{checkout.isPending || redirecting ? <><span className="lantern-pulse inline-block h-2 w-2 rounded-full bg-current" /> Creating fictional order…</> : <><Lock size={16} /> Simulate checkout</>}</button>
            : <Link href={signInHref(`${window.location.origin}${import.meta.env.BASE_URL}bag`)} className="btn-primary w-full" data-testid="link-sign-in-checkout">Sign in to check out <ArrowRight size={16} /></Link>}
            {checkout.isError && <p className="mt-3 text-sm text-[hsl(var(--destructive))]" role="alert" data-testid="text-checkout-error">{errorMessage(checkout.error, 'Checkout could not start. Your bag is safe — please try again.')}</p>}
            <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[hsl(var(--muted-foreground))]"><ShieldCheck size={14} className="mt-0.5 shrink-0" /> Fictional research checkout. No payment details, charges, or real shipments. Your order is saved to your account.</p></div></aside>
      </div>}
  </main></Layout>;
}

export function CheckoutSuccess() {
  const search = useSearch();
  const sessionId = new URLSearchParams(search).get('session_id') ?? '';
  const { ready, signedIn } = useSignedIn();
  const { clear } = useBag();
  const qc = useQueryClient();
  const [startedAt] = useState(() => Date.now());
  const [timedOut, setTimedOut] = useState(false);
  const status = useGetCheckoutStatus(sessionId, { query: {
    queryKey: getGetCheckoutStatusQueryKey(sessionId), enabled: signedIn && Boolean(sessionId) && !timedOut,
    refetchInterval: (q) => (q.state.data?.state === 'pending' || !q.state.data ? 2000 : false),
  } });
  const state = status.data?.state;
  const orderId = state === 'completed' ? status.data?.orderId ?? '' : '';
  const order = useGetOrder(orderId, { query: { queryKey: getGetOrderQueryKey(orderId), enabled: Boolean(orderId) } });
  useEffect(() => {
    if (state !== 'pending' && state !== undefined) return;
    const t = window.setTimeout(() => setTimedOut(true), Math.max(0, 90_000 - (Date.now() - startedAt)));
    return () => window.clearTimeout(t);
  }, [state, startedAt]);
  const cleared = useRef(false);
  useEffect(() => {
    if (state === 'completed' && orderId && order.data && !cleared.current) {
      cleared.current = true; clear();
      qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    }
  }, [state, orderId, order.data, clear, qc]);

  let body;
  if (!sessionId) body = <EmptyState title="No checkout to confirm." message="This page shows your saved fictional order. Your bag is untouched." action={<Link href="/bag" className="btn-primary">Back to your bag</Link>} />;
  else if (!ready) body = <Waiting text="Checking your session…" />;
  else if (!signedIn) body = <EmptyState title="Sign in to confirm your order." message="Orders are tied to your account. Your bag is still here." action={<Link href={signInHref()} className="btn-primary">Sign in</Link>} />;
  else if (status.isError) body = <ErrorState title="We could not find this checkout." message={errorMessage(status.error, 'Your bag is safe. Try again in a moment.')} onRetry={() => status.refetch()} />;
  else if (state === 'expired' || state === 'failed') body = <EmptyState title={state === 'expired' ? 'That checkout expired.' : 'Checkout did not complete.'} message="No payment is involved and your bag is just as you left it." action={<Link href="/bag" className="btn-primary">Return to your bag</Link>} />;
  else if (state === 'completed' && order.data) body = <OrderConfirmed orderId={order.data.id} number={order.data.number} total={order.data.totalCents} items={order.data.items} status={order.data.status} />;
  else if (state === 'completed' && order.isError) body = <ErrorState title="Order saved, details still loading." message="Your fictional order is saved. Please retry loading its details." onRetry={() => order.refetch()} />;
  else if (timedOut) body = <div className="text-center"><Waiting text="Your order is taking longer to load." still /><div className="mt-6 flex justify-center gap-3"><button onClick={() => { setTimedOut(false); status.refetch(); }} className="btn-primary" data-testid="button-check-again">Check again</button><Link href="/account/orders" className="btn-ghost">View orders</Link></div><p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">Your bag stays put until the order loads.</p></div>;
  else body = <Waiting text="Loading your fictional order…" />;
  return <Layout><main className="shell max-w-3xl py-16 md:py-24">{body}</main></Layout>;
}

function Waiting({ text, still }: { text: string; still?: boolean }) {
  return <div className="text-center fade-up" data-testid="state-checkout-pending"><div className="relative mx-auto h-20 w-20"><img src={publicAsset('logo.svg')} alt="" className="h-20 w-20" />{!still && <span className="lantern-pulse absolute -right-1 top-1 h-4 w-4 rounded-full bg-[hsl(var(--accent))]" />}</div><p className="serif mt-6 text-3xl">{text}</p><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">This research environment creates fictional orders only. No payment is required.</p></div>;
}

function OrderConfirmed({ orderId, number, total, items, status }: { orderId: string; number: string; total: number; items: { slug: string; name: string; quantity: number; size: string; priceCents: number }[]; status: string }) {
  return <div className="fade-up" data-testid="state-order-confirmed"><div className="text-center"><span className="pop mx-auto grid h-16 w-16 place-items-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Check size={28} /></span><Eyebrow>Order {number}</Eyebrow><h1 className="serif mt-4 text-5xl leading-tight">Fictional order created.</h1><p className="mt-4 text-[hsl(var(--muted-foreground))]">Saved to your account for authorized security research. No charge was made and no items will be shipped.</p></div>
    <div className="mt-10 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><div className="flex items-center justify-between"><p className="serif text-2xl">Receipt</p><StatusPill status={status} /></div><ul className="mt-4 divide-y divide-[hsl(var(--border))]">{items.map((i) => <li key={i.slug + i.size} className="flex justify-between py-3 text-sm"><span>{i.name}{i.size ? ` / ${i.size}` : ''} <span className="text-[hsl(var(--muted-foreground))]">x {i.quantity}</span></span><span className="tabular-nums">{formatMoney(i.priceCents * i.quantity)}</span></li>)}</ul><div className="flex justify-between border-t border-[hsl(var(--border))] pt-4 font-semibold"><span>Total</span><span data-testid="text-order-total">{formatMoney(total)}</span></div></div>
    <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href={`/account/orders/${orderId}`} className="btn-primary" data-testid="link-track-order">Track this order <ArrowRight size={16} /></Link><Link href="/shop" className="btn-ghost">Keep browsing</Link></div></div>;
}

export function CheckoutCancel() {
  const { count } = useBag();
  return <Layout><main className="shell max-w-3xl py-16 md:py-24"><EmptyState title="Checkout paused." message={count ? `No charge was made. Your bag still holds ${count} ${count === 1 ? 'item' : 'items'}, right where you left them.` : 'No charge was made.'} action={<div className="flex flex-wrap justify-center gap-3"><Link href="/bag" className="btn-primary" data-testid="link-return-bag">Return to your bag <ArrowRight size={16} /></Link><Link href="/shop" className="btn-ghost">Keep browsing</Link></div>} /></main></Layout>;
}
