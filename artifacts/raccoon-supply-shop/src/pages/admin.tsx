import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldAlert } from 'lucide-react';
import {
  useGetAdminOverview, useModerateCommunity, useUpdateOrderShipping, useUpdateReturnStatus, useUpdateTicketStatus,
  getGetAdminOverviewQueryKey, getGetDashboardQueryKey, getGetOrderQueryKey, getGetTicketQueryKey, getListDiscussionsQueryKey, getListOrdersQueryKey, getListReturnsQueryKey, getListTicketsQueryKey, getListCategoriesQueryKey,
  ShippingInputStatus, ReturnStatusInputStatus, TicketStatusInputStatus,
  type ModerationInputAction, type Order, type ShippingInputStatus as ShipStatus,
} from '@workspace/api-client-react';
import { Bone, EmptyState, ErrorState, Layout, ListSkeleton, PageHead, RequireAuth, StatusPill, useMe } from '@/components/kit';
import { errorMessage, formatDate, formatMoney, useSignedIn } from '@/lib/store';

const sections = ['Moderation', 'Tickets', 'Returns', 'Shipping'] as const;

export function AdminPage() {
  return <Layout><RequireAuth title="The desk is staff only."><AdminInner /></RequireAuth></Layout>;
}

function AdminInner() {
  const { signedIn } = useSignedIn();
  const me = useMe();
  const staff = me.data?.role === 'admin' || me.data?.role === 'staff';
  const overview = useGetAdminOverview({ query: { enabled: signedIn && staff, queryKey: getGetAdminOverviewQueryKey() } });
  const [tab, setTab] = useState<(typeof sections)[number]>('Moderation');
  const qc = useQueryClient();
  const moderate = useModerateCommunity();
  const ticketStatus = useUpdateTicketStatus();
  const returnStatus = useUpdateReturnStatus();
  const refresh = () => qc.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
  const mod = (id: string, action: ModerationInputAction) => moderate.mutate({ data: { id, action } }, { onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: getListDiscussionsQueryKey() }); qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() }); } });
  if (me.isLoading) return <main className="shell py-16"><Bone className="h-14 w-72" /><div className="mt-8"><ListSkeleton /></div></main>;
  if (me.isError) return <main className="shell py-16"><ErrorState onRetry={() => me.refetch()} /></main>;
  if (!staff) return <main className="shell py-16"><EmptyState title="This room is for the support desk." message="Your account does not have staff access." action={<Link href="/account" className="btn-primary">Back to your account</Link>} /></main>;
  const o = overview.data;
  const counts = { Moderation: (o?.pendingDiscussions.length ?? 0) + (o?.pendingReplies.length ?? 0), Tickets: o?.tickets.filter((t) => t.status === 'Open' || t.status === 'Pending').length ?? 0, Returns: o?.returns.length ?? 0, Shipping: o?.orders.length ?? 0 };
  const actionError = moderate.isError ? moderate.error : ticketStatus.isError ? ticketStatus.error : returnStatus.isError ? returnStatus.error : null;
  return <main className="shell py-12 md:py-16"><PageHead eyebrow={`The desk / ${me.data?.role}`} title="Back of house." intro={o ? `${o.userCount} customers on file.` : undefined} />
    <div className="mt-8 flex gap-2 overflow-x-auto" role="tablist">{sections.map((s) => <button key={s} role="tab" aria-selected={tab === s} onClick={() => setTab(s)} className={`focus-ring flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${tab === s ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`} data-testid={`tab-admin-${s.toLowerCase()}`}>{s}<span className="mono rounded-full bg-[hsl(var(--background)/.3)] px-1.5 text-[10px]">{counts[s]}</span></button>)}</div>
    {actionError && <p className="mt-4 flex items-center gap-2 text-sm text-[hsl(var(--destructive))]" role="alert"><ShieldAlert size={14} />{errorMessage(actionError)}</p>}
    <div className="mt-8">{overview.isLoading ? <ListSkeleton rows={4} /> : overview.isError || !o ? <ErrorState onRetry={() => overview.refetch()} /> : <>
      {tab === 'Moderation' && <div className="grid gap-10 lg:grid-cols-2">
        <section><h2 className="serif text-2xl">Pending discussions</h2><div className="mt-4 grid gap-3">{o.pendingDiscussions.length ? o.pendingDiscussions.map((d) => <div key={d.id} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5" data-testid={`card-pending-discussion-${d.id}`}><Link href={`/community/discussions/${d.slug}`} className="serif text-xl hover:text-[hsl(var(--primary))]">{d.title}</Link><p className="mono mt-1 text-[10px] uppercase text-[hsl(var(--muted-foreground))]">{d.category} / {d.authorName} / {formatDate(d.createdAt)}</p><p className="mt-3 line-clamp-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{d.body}</p><div className="mt-4 flex flex-wrap gap-2"><button disabled={moderate.isPending} onClick={() => mod(d.id, 'publish')} className="btn-primary px-4 py-2 text-sm" data-testid={`button-publish-${d.id}`}>Publish</button><button disabled={moderate.isPending} onClick={() => mod(d.id, d.locked ? 'unlock' : 'lock')} className="btn-ghost px-4 py-2 text-sm">{d.locked ? 'Unlock' : 'Lock'}</button><button disabled={moderate.isPending} onClick={() => mod(d.id, 'hide')} className="btn-ghost px-4 py-2 text-sm text-[hsl(var(--destructive))]" data-testid={`button-hide-${d.id}`}>Hide</button></div></div>) : <EmptyState title="Nothing waiting." />}</div></section>
        <section><h2 className="serif text-2xl">Pending replies</h2><div className="mt-4 grid gap-3">{o.pendingReplies.length ? o.pendingReplies.map((r) => <div key={r.id} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5" data-testid={`card-pending-reply-${r.id}`}><p className="text-sm font-semibold">{r.authorName}<span className="mono ml-2 text-[10px] uppercase text-[hsl(var(--muted-foreground))]">{formatDate(r.createdAt, true)}</span></p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{r.body}</p><div className="mt-4 flex gap-2"><button disabled={moderate.isPending} onClick={() => mod(r.id, 'publish-reply')} className="btn-primary px-4 py-2 text-sm" data-testid={`button-publish-reply-${r.id}`}>Publish reply</button><button disabled={moderate.isPending} onClick={() => mod(r.id, 'hide-reply')} className="btn-ghost px-4 py-2 text-sm text-[hsl(var(--destructive))]">Hide reply</button></div></div>) : <EmptyState title="No replies in the queue." />}</div></section>
      </div>}
      {tab === 'Tickets' && <div className="grid gap-3">{o.tickets.length ? o.tickets.map((t) => <div key={t.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5" data-testid={`row-admin-ticket-${t.id}`}><div className="min-w-[200px] flex-1"><Link href={`/support/tickets/${t.id}`} className="font-semibold hover:text-[hsl(var(--primary))]">{t.subject}</Link><p className="mono mt-1 text-[10px] uppercase text-[hsl(var(--muted-foreground))]">{t.category} / {formatDate(t.createdAt)} / {t.messages.length} messages</p></div><StatusPill status={t.status} /><select aria-label="Ticket status" value={t.status} disabled={ticketStatus.isPending} onChange={(e) => ticketStatus.mutate({ ticketId: t.id, data: { status: e.target.value as TicketStatusInputStatus } }, { onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: getGetTicketQueryKey(t.id) }); qc.invalidateQueries({ queryKey: getListTicketsQueryKey() }); } })} className="input w-36 py-2 text-sm" data-testid={`select-ticket-status-${t.id}`}>{Object.values(TicketStatusInputStatus).map((s) => <option key={s} value={s}>{s}</option>)}</select></div>) : <EmptyState title="Inbox zero." />}</div>}
      {tab === 'Returns' && <div className="grid gap-3">{o.returns.length ? o.returns.map((r) => <div key={r.id} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5" data-testid={`row-admin-return-${r.id}`}><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">Order {r.orderNumber}<span className="mono ml-2 text-[10px] uppercase text-[hsl(var(--muted-foreground))]">{r.kind} / {formatDate(r.createdAt)}</span></p><StatusPill status={r.status} /></div><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{r.reason}</p><div className="mt-4 flex flex-wrap gap-2">{Object.values(ReturnStatusInputStatus).map((s) => <button key={s} disabled={returnStatus.isPending || r.status === s} onClick={() => returnStatus.mutate({ returnId: r.id, data: { status: s } }, { onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: getListReturnsQueryKey() }); } })} className={`${s === 'Approved' ? 'btn-primary' : 'btn-ghost'} px-4 py-2 text-sm`} data-testid={`button-return-${s.toLowerCase()}-${r.id}`}>{s}</button>)}</div></div>) : <EmptyState title="No return requests." />}</div>}
      {tab === 'Shipping' && <div className="grid gap-3">{o.orders.length ? o.orders.map((ord) => <ShippingRow key={ord.id} order={ord} />) : <EmptyState title="No orders to ship." />}</div>}
    </>}</div>
  </main>;
}

function ShippingRow({ order }: { order: Order }) {
  const qc = useQueryClient();
  const ship = useUpdateOrderShipping();
  const options = Object.values(ShippingInputStatus);
  const [status, setStatus] = useState<ShipStatus>(options.find((s) => s === order.status) ?? 'Processing');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 3) { setErr('Add a short note (3+ characters).'); return; }
    setErr('');
    ship.mutate({ orderId: order.id, data: { status, description: description.trim() } }, { onSuccess: () => {
      setDescription('');
      qc.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
      qc.invalidateQueries({ queryKey: getGetOrderQueryKey(order.id) });
      qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    } });
  };
  return <form onSubmit={submit} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5" data-testid={`row-admin-order-${order.id}`}><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-semibold">Order {order.number}<span className="mono ml-2 text-[10px] uppercase text-[hsl(var(--muted-foreground))]">{formatDate(order.createdAt)} / {formatMoney(order.totalCents)}</span></p><StatusPill status={order.status} /></div>
    <div className="mt-4 flex flex-wrap gap-2"><select value={status} onChange={(e) => setStatus(e.target.value as ShipStatus)} className="input w-44 py-2 text-sm" aria-label="Shipping status" data-testid={`select-ship-status-${order.id}`}>{options.map((s) => <option key={s} value={s}>{s}</option>)}</select><input value={description} onChange={(e) => setDescription(e.target.value.slice(0, 1000))} placeholder="Scan note, e.g. Left Portland facility" className="input min-w-[200px] flex-1 py-2 text-sm" data-testid={`input-ship-note-${order.id}`} /><button type="submit" disabled={ship.isPending} className="btn-primary px-4 py-2 text-sm" data-testid={`button-ship-update-${order.id}`}>{ship.isPending ? 'Saving…' : 'Add event'}</button></div>
    {(err || ship.isError) && <p className="mt-2 text-sm text-[hsl(var(--destructive))]" role="alert">{err || errorMessage(ship.error)}</p>}</form>;
}
