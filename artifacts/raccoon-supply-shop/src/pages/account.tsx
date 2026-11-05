import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useParams, useSearch } from 'wouter';
import { useClerk, useUser } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Box, LogOut, MessageSquare, Package, RotateCcw, Truck } from 'lucide-react';
import {
  useCreateReturn, useGetCommunityHistory, useGetDashboard, useGetOrder, useListOrders, useListReturns,
  getGetCommunityHistoryQueryKey, getGetDashboardQueryKey, getGetOrderQueryKey, getListOrdersQueryKey, getListReturnsQueryKey,
  type Order,
} from '@workspace/api-client-react';
import { Bone, EmptyState, ErrorState, Eyebrow, Field, Layout, ListSkeleton, RequireAuth, StatusPill } from '@/components/kit';
import { basePath, errorMessage, formatDate, formatMoney, productImage, productTone, useSignedIn } from '@/lib/store';

const tabs = [['/account', 'Overview'], ['/account/orders', 'Orders'], ['/account/returns', 'Returns'], ['/support', 'Support'], ['/account/community', 'Community posts']] as const;

function AccountShell({ children, title, eyebrow }: { children: ReactNode; title: string; eyebrow: string }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  return <Layout><RequireAuth><main className="shell py-12 md:py-16">
    <div className="fade-up flex flex-wrap items-end justify-between gap-4"><div><Eyebrow>{eyebrow}</Eyebrow><h1 className="serif mt-3 text-5xl leading-none md:text-6xl">{title}</h1></div><button onClick={() => signOut({ redirectUrl: basePath || '/' })} className="btn-ghost text-sm" data-testid="button-sign-out"><LogOut size={15} /> Sign out</button></div>
    <nav className="mt-8 flex gap-1 overflow-x-auto border-b border-[hsl(var(--border))]" aria-label="Account sections">{tabs.map(([href, label]) => {
      const active = href === '/account' ? location === '/account' : location.startsWith(href);
      return <Link key={href} href={href} className={`focus-ring relative whitespace-nowrap px-4 py-3 text-sm font-semibold transition-colors ${active ? 'text-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`} data-testid={`tab-${label.toLowerCase().replace(/\s+/g, '-')}`}>{label}{active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded bg-[hsl(var(--accent))]" />}</Link>;
    })}</nav>
    <div className="mt-10">{children}</div>
  </main></RequireAuth></Layout>;
}

function OrderRow({ order }: { order: Order }) {
  return <Link href={`/account/orders/${order.id}`} className="hover-lift focus-ring group flex flex-wrap items-center gap-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4" data-testid={`row-order-${order.id}`}>
    <div className="flex -space-x-3">{order.items.slice(0, 3).map((i) => <div key={i.slug + i.size} className="h-14 w-14 overflow-hidden rounded-xl border-2 border-[hsl(var(--card))]" style={{ backgroundColor: productTone(i.slug) }}><img src={productImage(i.image)} alt="" className="h-full w-full object-cover mix-blend-multiply" /></div>)}</div>
    <div className="min-w-[160px] flex-1"><p className="font-semibold">Order {order.number}{order.synthetic && <span className="mono ml-2 text-[10px] uppercase text-[hsl(var(--muted-foreground))]">sample</span>}</p><p className="text-sm text-[hsl(var(--muted-foreground))]">{formatDate(order.createdAt)} / {order.items.reduce((t, i) => t + i.quantity, 0)} items</p></div>
    <StatusPill status={order.status} /><p className="w-24 text-right font-semibold tabular-nums">{formatMoney(order.totalCents)}</p><ArrowRight size={16} className="text-[hsl(var(--primary))] transition-transform group-hover:translate-x-1" />
  </Link>;
}

export function AccountDashboard() {
  const { signedIn } = useSignedIn();
  const { user } = useUser();
  const { data, isLoading, isError, refetch } = useGetDashboard({ query: { enabled: signedIn, queryKey: getGetDashboardQueryKey() } });
  const name = data?.customer.displayName || user?.firstName || 'friend';
  return <AccountShell eyebrow="Your account" title={`Evening, ${name.split(' ')[0]}.`}>
    {isLoading ? <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Bone key={i} className="h-28 rounded-2xl" />)}</div>
      : isError || !data ? <ErrorState onRetry={() => refetch()} />
      : <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger">
          {[[Package, 'Orders', String(data.orderCount)], [Truck, 'On the way', String(data.activeOrders)], [RotateCcw, 'Returns', String(data.returnCount)], [Box, 'Spent with us', formatMoney(data.spentCents)]].map(([Icon, label, value]) => {
            const I = Icon as typeof Package;
            return <div key={label as string} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><I size={18} className="text-[hsl(var(--accent))]" /><p className="serif mt-5 text-4xl tabular-nums" data-testid={`stat-${(label as string).toLowerCase().replace(/\s+/g, '-')}`}>{value as string}</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">{label as string}</p></div>;
          })}
        </div>
        <div className="mt-12 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <section><div className="flex items-end justify-between"><h2 className="serif text-3xl">Recent orders</h2><Link href="/account/orders" className="text-sm font-bold text-[hsl(var(--primary))]">All orders</Link></div><div className="mt-5 grid gap-3">{data.recentOrders.length ? data.recentOrders.map((o) => <OrderRow key={o.id} order={o} />) : <EmptyState title="No orders yet." message="When you check out, your orders and tracking appear here." action={<Link href="/shop" className="btn-primary">Visit the shop</Link>} />}</div></section>
          <aside className="grid content-start gap-4"><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><p className="mono text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Signed in as</p><p className="mt-2 font-semibold" data-testid="text-display-name">{data.customer.displayName}</p><p className="text-sm text-[hsl(var(--muted-foreground))]" data-testid="text-email">{data.customer.email}</p>{data.customer.role !== 'customer' && <Link href="/admin" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-[hsl(var(--primary))]">Open the desk <ArrowRight size={14} /></Link>}</div>
            <Link href="/account/returns" className="hover-lift focus-ring rounded-2xl bg-[hsl(var(--secondary)/.5)] p-6"><RotateCcw size={18} /><p className="serif mt-4 text-2xl">Start a return</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Within 30 days of delivery.</p></Link>
            <Link href="/support" className="hover-lift focus-ring rounded-2xl bg-[hsl(var(--primary))] p-6 text-[hsl(var(--primary-foreground))]"><MessageSquare size={18} /><p className="serif mt-4 text-2xl">Ask the desk privately</p><p className="mt-1 text-sm opacity-80">Open a support ticket.</p></Link></aside>
        </div>
      </>}
  </AccountShell>;
}

export function OrdersPage() {
  const { signedIn } = useSignedIn();
  const { data, isLoading, isError, refetch } = useListOrders({ query: { enabled: signedIn, queryKey: getListOrdersQueryKey() } });
  return <AccountShell eyebrow="Your account" title="Orders">
    {isLoading ? <ListSkeleton rows={4} /> : isError ? <ErrorState onRetry={() => refetch()} /> : data && data.length ? <div className="grid gap-3 stagger">{data.map((o) => <OrderRow key={o.id} order={o} />)}</div> : <EmptyState title="No orders on file." message="Simulated checkout saves fictional orders here with tracking." action={<Link href="/shop" className="btn-primary">Shop the collection</Link>} />}
  </AccountShell>;
}

const stages = ['Processing', 'Packed', 'Shipped', 'Out for delivery', 'Delivered'];

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { signedIn } = useSignedIn();
  const { data: order, isLoading, isError, error, refetch } = useGetOrder(id, { query: { enabled: signedIn && Boolean(id), queryKey: getGetOrderQueryKey(id), retry: 1 } });
  const status = (error as { status?: number } | null)?.status;
  const reached = order ? Math.max(stages.findIndex((s) => s.toLowerCase() === order.status.toLowerCase()), ...order.events.map((e) => stages.findIndex((s) => s.toLowerCase() === e.status.toLowerCase())), order.status.toLowerCase() === 'paid' ? 0 : -1) : -1;
  return <AccountShell eyebrow="Order detail" title={order ? `Order ${order.number}` : 'Order'}>
    <Link href="/account/orders" className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">← All orders</Link>
    <div className="mt-6">{isLoading ? <ListSkeleton rows={3} /> : status === 404 || status === 403 ? <EmptyState title="We could not find that order." message="It may belong to a different account." action={<Link href="/account/orders" className="btn-primary">Your orders</Link>} /> : isError || !order ? <ErrorState onRetry={() => refetch()} /> : <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
      <div className="grid content-start gap-6">
        <section className="rounded-2xl border border-[hsl(var(--border))] p-5" data-testid="order-status-summary">
          <p className="text-sm">Shipping: <strong>{order.shippingStatus}</strong></p>
          <p className="mt-2 text-sm">Return: <strong>{order.returnStatus}</strong></p>
          {order.synthetic && <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">Fictional research order. No real payment or shipment.</p>}
        </section>
        <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="serif text-2xl">Tracking</h2><StatusPill status={order.status} /></div>
          <ol className="mt-6 grid grid-cols-5 gap-2" aria-label="Shipping progress">{stages.map((s, i) => <li key={s} className="text-center"><div className={`h-1.5 rounded-full transition-colors duration-700 ${i <= reached ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--muted))]'}`} /><p className={`mt-2 text-[11px] font-semibold ${i <= reached ? '' : 'text-[hsl(var(--muted-foreground))]'}`}>{s}</p></li>)}</ol>
          {order.trackingNumber && <p className="mt-6 text-sm" data-testid="text-tracking">{order.carrier ?? 'Carrier'} tracking <span className="mono font-semibold">{order.trackingNumber}</span></p>}
          <ul className="mt-6 border-l-2 border-[hsl(var(--border))] pl-5">{order.events.length ? [...order.events].reverse().map((e, i) => <li key={i} className="relative pb-5 last:pb-0"><span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-[hsl(var(--card))] ${i === 0 ? 'bg-[hsl(var(--accent))]' : 'bg-[hsl(var(--border))]'}`} /><p className="text-sm font-semibold">{e.status}</p><p className="text-sm text-[hsl(var(--muted-foreground))]">{e.description}</p><p className="mono mt-1 text-[10px] uppercase text-[hsl(var(--muted-foreground))]">{formatDate(e.createdAt, true)}</p></li>) : <li className="text-sm text-[hsl(var(--muted-foreground))]">No scans yet. Updates appear here as the order moves.</li>}</ul>
        </section>
        <section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><h2 className="serif text-2xl">Items</h2><ul className="mt-4 divide-y divide-[hsl(var(--border))]">{order.items.map((i) => <li key={i.slug + i.size} className="flex items-center gap-4 py-3"><div className="h-14 w-14 overflow-hidden rounded-xl" style={{ backgroundColor: productTone(i.slug) }}><img src={productImage(i.image)} alt="" className="h-full w-full object-cover mix-blend-multiply" /></div><div className="flex-1"><Link href={`/product/${i.slug}`} className="font-semibold hover:text-[hsl(var(--primary))]">{i.name}</Link><p className="text-sm text-[hsl(var(--muted-foreground))]">{i.size ? `Size ${i.size} / ` : ''}Qty {i.quantity}</p></div><p className="tabular-nums">{formatMoney(i.priceCents * i.quantity)}</p></li>)}</ul></section>
      </div>
      <aside className="grid content-start gap-4"><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><dl className="grid gap-3 text-sm"><div className="flex justify-between"><dt>Placed</dt><dd>{formatDate(order.createdAt)}</dd></div>{order.deliveredAt && <div className="flex justify-between"><dt>Delivered</dt><dd>{formatDate(order.deliveredAt)}</dd></div>}<div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{formatMoney(order.subtotalCents)}</dd></div><div className="flex justify-between"><dt>Shipping</dt><dd className="tabular-nums">{formatMoney(order.shippingCents)}</dd></div><div className="flex justify-between border-t border-[hsl(var(--border))] pt-3 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatMoney(order.totalCents)}</dd></div></dl></div>
        {order.returnEligible ? <Link href={`/account/returns?order=${order.id}`} className="btn-primary" data-testid="link-return-order">Request a return <ArrowRight size={16} /></Link> : <p className="rounded-2xl bg-[hsl(var(--muted)/.6)] p-4 text-sm text-[hsl(var(--muted-foreground))]">Returns open after delivery, for 30 days.</p>}
        <Link href="/support" className="btn-ghost">Ask about this order</Link></aside>
    </div>}</div>
  </AccountShell>;
}

export function ReturnsPage() {
  const { signedIn } = useSignedIn();
  const search = useSearch();
  const qc = useQueryClient();
  const orders = useListOrders({ query: { enabled: signedIn, queryKey: getListOrdersQueryKey() } });
  const returns = useListReturns({ query: { enabled: signedIn, queryKey: getListReturnsQueryKey() } });
  const create = useCreateReturn();
  const eligible = (orders.data ?? []).filter((o) => o.returnEligible);
  const [orderId, setOrderId] = useState(() => new URLSearchParams(search).get('order') ?? '');
  const [kind, setKind] = useState<'return' | 'refund'>('return');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!orderId) next.order = 'Choose an order.';
    if (reason.trim().length < 10) next.reason = 'Tell us a little more (at least 10 characters).';
    if (!confirmed) next.confirm = 'Please confirm the item condition.';
    setErrors(next);
    if (Object.keys(next).length) return;
    create.mutate({ data: { orderId, kind, reason: reason.trim(), conditionConfirmed: true } }, { onSuccess: (r) => {
      setDone(r.orderNumber); setReason(''); setConfirmed(false); setOrderId('');
      qc.invalidateQueries({ queryKey: getListReturnsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      qc.invalidateQueries({ queryKey: getGetOrderQueryKey(r.orderId) });
    } });
  };
  return <AccountShell eyebrow="Returns" title="Send something back.">
    <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr]">
      <form onSubmit={submit} className="h-fit rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:p-8" noValidate>
        <p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">Unused, unwashed items in original condition, within 30 days of delivery. Approved refunds are processed within 3 business days after inspection; your payment provider may take another 5–10 business days.</p>
        {done && <div className="pop mt-5 rounded-xl bg-[hsl(var(--primary)/.1)] p-4 text-sm font-semibold text-[hsl(var(--primary))]" role="status" data-testid="text-return-success">Request received for order {done}. We will email authorization and packing steps.</div>}
        <div className="mt-6 grid gap-5">
          <Field label="Order" error={errors.order}>{orders.isLoading ? <Bone className="h-11" /> : eligible.length ? <select value={orderId} onChange={(e) => setOrderId(e.target.value)} className="input" data-testid="select-return-order"><option value="">Select a delivered order</option>{eligible.map((o) => <option key={o.id} value={o.id}>Order {o.number} / {formatDate(o.deliveredAt ?? o.createdAt)} / {formatMoney(o.totalCents)}</option>)}</select> : <p className="rounded-xl bg-[hsl(var(--muted)/.6)] p-3 text-sm text-[hsl(var(--muted-foreground))]">No orders are currently eligible. Returns open once an order is delivered.</p>}</Field>
          <Field label="What would you like?"><div className="grid grid-cols-2 gap-2">{(['return', 'refund'] as const).map((k) => <button type="button" key={k} onClick={() => setKind(k)} aria-pressed={kind === k} className={`focus-ring rounded-xl border p-3 text-left text-sm transition-colors ${kind === k ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.08)]' : 'border-[hsl(var(--border))]'}`} data-testid={`button-kind-${k}`}><span className="font-semibold capitalize">{k}</span><span className="block text-xs text-[hsl(var(--muted-foreground))]">{k === 'return' ? 'Send it back for a replacement path' : 'Send it back for your money'}</span></button>)}</div></Field>
          <Field label="Reason" hint={`${reason.trim().length}/3000`} error={errors.reason}><textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 3000))} className="input" placeholder="Wrong size, changed my mind, arrived damaged…" data-testid="input-return-reason" /></Field>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" data-testid="checkbox-condition" /><span>I confirm the item is unused, unwashed, and in its original condition, and it was delivered within the last 30 days.{errors.confirm && <span className="block text-[hsl(var(--destructive))]" role="alert">{errors.confirm}</span>}</span></label>
          {create.isError && <p className="text-sm text-[hsl(var(--destructive))]" role="alert">{errorMessage(create.error)}</p>}
          <button type="submit" disabled={create.isPending || !eligible.length} className="btn-primary" data-testid="button-submit-return">{create.isPending ? 'Sending…' : 'Submit request'}</button>
        </div>
      </form>
      <section><h2 className="serif text-3xl">History</h2><div className="mt-5">{returns.isLoading ? <ListSkeleton /> : returns.isError ? <ErrorState onRetry={() => returns.refetch()} /> : returns.data && returns.data.length ? <ul className="grid gap-3 stagger">{returns.data.map((r) => <li key={r.id} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5" data-testid={`row-return-${r.id}`}><div className="flex flex-wrap items-center justify-between gap-2"><Link href={`/account/orders/${r.orderId}`} className="font-semibold hover:text-[hsl(var(--primary))]">Order {r.orderNumber}</Link><StatusPill status={r.status} /></div><p className="mono mt-1 text-[10px] uppercase text-[hsl(var(--muted-foreground))]">{r.kind} / {formatDate(r.createdAt)}</p><p className="mt-3 line-clamp-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{r.reason}</p></li>)}</ul> : <EmptyState title="Nothing sent back." message="Return and refund requests you make will be tracked here." />}</div></section>
    </div>
  </AccountShell>;
}

export function CommunityHistory() {
  const { signedIn } = useSignedIn();
  const { data, isLoading, isError, refetch } = useGetCommunityHistory({ query: { enabled: signedIn, queryKey: getGetCommunityHistoryQueryKey() } });
  return <AccountShell eyebrow="Community" title="Your posts">
    <div className="mb-6 flex justify-end"><Link href="/community/new" className="btn-primary" data-testid="link-new-discussion">Start a discussion <ArrowRight size={16} /></Link></div>
    {isLoading ? <ListSkeleton /> : isError ? <ErrorState onRetry={() => refetch()} /> : data && data.length ? <ul className="grid gap-3 stagger">{data.map((d) => <li key={d.id}><Link href={`/community/discussions/${d.slug}`} className="hover-lift focus-ring flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5" data-testid={`row-history-${d.id}`}><div><p className="font-semibold">{d.title}</p><p className="mono mt-1 text-[10px] uppercase text-[hsl(var(--muted-foreground))]">{d.category} / {formatDate(d.createdAt)} / {d.replies.length} replies</p></div><div className="flex gap-2">{d.locked && <StatusPill status="Locked" />}<StatusPill status={d.approved ? 'Published' : 'Pending'} /></div></Link></li>)}</ul> : <EmptyState title="You have not posted yet." message="New discussions are reviewed by a moderator before they go public." />}
  </AccountShell>;
}
