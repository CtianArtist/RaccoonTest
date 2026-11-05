import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Headphones, Lock, MessageSquare, Pencil, Plus, Search, Send } from 'lucide-react';
import {
  useCreateDiscussion, useCreateTicket, useEditDiscussion, useGetDiscussion, useGetTicket, useListCategories, useListDiscussions, useListTickets,
  useModerateCommunity, useReplyToDiscussion, useReplyToTicket,
  getGetAdminOverviewQueryKey, getGetCommunityHistoryQueryKey, getGetDiscussionQueryKey, getGetTicketQueryKey, getListCategoriesQueryKey, getListDiscussionsQueryKey, getListTicketsQueryKey,
  TicketInputCategory, type Message, type TicketInputCategory as TicketCat,
} from '@workspace/api-client-react';
import { Bone, EmptyState, ErrorState, Eyebrow, Field, Layout, ListSkeleton, PageHead, RequireAuth, StatusPill, useMe } from '@/components/kit';
import { SUPPORT_EMAIL, errorMessage, formatDate, openSupport, signInHref, useSignedIn } from '@/lib/store';

function Initials({ name }: { name: string }) {
  const i = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'RS';
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[hsl(var(--secondary))] text-xs font-bold">{i}</span>;
}

function Thread({ messages, viewerId }: { messages: Message[]; viewerId?: string }) {
  return <ul className="grid gap-4">{messages.map((m) => <li key={m.id} className={`fade-up flex gap-3 ${m.hidden ? 'opacity-60' : ''}`} data-testid={`message-${m.id}`}><Initials name={m.authorName} /><div className="flex-1 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{m.authorName}{m.authorId === viewerId && <span className="ml-2 text-xs font-normal text-[hsl(var(--muted-foreground))]">(you)</span>}</p><span className="mono text-[10px] uppercase text-[hsl(var(--muted-foreground))]">{formatDate(m.createdAt, true)}</span>{m.hidden && <StatusPill status="Pending" />}</div><p className="mt-2 whitespace-pre-wrap text-sm leading-7">{m.body}</p>{m.hidden && <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Awaiting moderator review. Only you and the desk can see this.</p>}</div></li>)}</ul>;
}

function Composer({ onSend, pending, error, placeholder, label, disabled }: { onSend: (body: string, reset: () => void) => void; pending: boolean; error?: string; placeholder: string; label: string; disabled?: boolean }) {
  const [body, setBody] = useState('');
  const [local, setLocal] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); if (body.trim().length < 3) { setLocal('Write at least 3 characters.'); return; } setLocal(''); onSend(body.trim(), () => setBody('')); };
  return <form onSubmit={submit} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4" noValidate><label className="sr-only" htmlFor="composer">{label}</label><textarea id="composer" value={body} onChange={(e) => setBody(e.target.value.slice(0, 10000))} placeholder={placeholder} disabled={disabled} className="input min-h-[110px] border-0 bg-transparent p-0 focus:shadow-none" data-testid="input-reply" /><div className="mt-3 flex items-center justify-between gap-3 border-t border-[hsl(var(--border))] pt-3"><span className="text-sm text-[hsl(var(--destructive))]" role="alert">{local || error}</span><button type="submit" disabled={pending || disabled} className="btn-primary px-5 py-2 text-sm" data-testid="button-send-reply"><Send size={14} /> {pending ? 'Sending…' : label}</button></div></form>;
}

// ------------------------------ Support tickets ------------------------------
const ticketCats = Object.values(TicketInputCategory);

export function SupportPage() {
  const { signedIn } = useSignedIn();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const tickets = useListTickets({ query: { enabled: signedIn, queryKey: getListTicketsQueryKey() } });
  const create = useCreateTicket();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCat>('Order');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (subject.trim().length < 4) next.subject = 'At least 4 characters.';
    if (description.trim().length < 10) next.description = 'At least 10 characters, please.';
    setErrors(next); if (Object.keys(next).length) return;
    create.mutate({ data: { subject: subject.trim(), category, description: description.trim() } }, { onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: getListTicketsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
      setLocation(`/support/tickets/${t.id}`);
    } });
  };
  return <Layout><main className="shell py-12 md:py-16"><PageHead eyebrow="Private support" title="Talk to the desk." intro="Tickets are private between you and our support staff. For quick questions, live chat is always a click away."><button onClick={openSupport} className="btn-ghost" data-testid="button-support-chat"><Headphones size={16} /> Live chat</button></PageHead>
    <RequireAuth title="Sign in to open a support ticket.">
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        <form onSubmit={submit} className="h-fit rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:p-8" noValidate><h2 className="serif text-3xl">New ticket</h2><div className="mt-6 grid gap-5">
          <Field label="Subject" error={errors.subject}><input value={subject} onChange={(e) => setSubject(e.target.value.slice(0, 160))} className="input" placeholder="Where is order RS-1042?" data-testid="input-ticket-subject" /></Field>
          <Field label="Topic"><div className="flex flex-wrap gap-2">{ticketCats.map((c) => <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={category === c} className={`focus-ring rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${category === c ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]'}`} data-testid={`button-ticket-category-${c}`}>{c}</button>)}</div></Field>
          <Field label="Details" hint={`${description.length}/10000`} error={errors.description}><textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 10000))} className="input" placeholder="Include your order number if it is about an order. Please never share passwords or card numbers." data-testid="input-ticket-description" /></Field>
          {create.isError && <p className="text-sm text-[hsl(var(--destructive))]" role="alert">{errorMessage(create.error)}</p>}
          <button type="submit" disabled={create.isPending} className="btn-primary" data-testid="button-create-ticket">{create.isPending ? 'Opening…' : 'Open ticket'}</button>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Prefer email? Write to {SUPPORT_EMAIL}.</p></div></form>
        <section><h2 className="serif text-3xl">Your tickets</h2><div className="mt-5">{tickets.isLoading ? <ListSkeleton rows={4} /> : tickets.isError ? <ErrorState onRetry={() => tickets.refetch()} /> : tickets.data && tickets.data.length ? <ul className="grid gap-3 stagger">{tickets.data.map((t) => <li key={t.id}><Link href={`/support/tickets/${t.id}`} className="hover-lift focus-ring group flex items-center justify-between gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5" data-testid={`row-ticket-${t.id}`}><div className="min-w-0"><p className="truncate font-semibold">{t.subject}</p><p className="mono mt-1 text-[10px] uppercase text-[hsl(var(--muted-foreground))]">{t.category} / {formatDate(t.createdAt)} / {t.messages.length} messages</p></div><div className="flex items-center gap-3"><StatusPill status={t.status} /><ArrowRight size={15} className="text-[hsl(var(--primary))] transition-transform group-hover:translate-x-1" /></div></Link></li>)}</ul> : <EmptyState title="No tickets yet." message="When you open one, the whole conversation lives here." />}</div></section>
      </div>
    </RequireAuth>
  </main></Layout>;
}

export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const { signedIn } = useSignedIn();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { data: t, isLoading, isError, error, refetch } = useGetTicket(id, { query: { enabled: signedIn && Boolean(id), queryKey: getGetTicketQueryKey(id), retry: 1 } });
  const reply = useReplyToTicket();
  const closed = t?.status === 'Closed';
  const status = (error as { status?: number } | null)?.status;
  return <Layout><RequireAuth><main className="shell max-w-3xl py-12 md:py-16"><Link href="/support" className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">← All tickets</Link>
    {isLoading ? <div className="mt-8"><Bone className="h-12 w-2/3" /><div className="mt-8"><ListSkeleton /></div></div> : status === 404 || status === 403 ? <div className="mt-8"><EmptyState title="That ticket is not here." message="It may belong to another account." /></div> : isError || !t ? <div className="mt-8"><ErrorState onRetry={() => refetch()} /></div> : <>
      <div className="mt-8 fade-up"><div className="flex flex-wrap items-center gap-3"><Eyebrow>{t.category} / opened {formatDate(t.createdAt)}</Eyebrow><StatusPill status={t.status} /></div><h1 className="serif mt-3 text-5xl leading-tight" data-testid="text-ticket-subject">{t.subject}</h1></div>
      <div className="mt-8 rounded-2xl bg-[hsl(var(--secondary)/.35)] p-5 text-sm leading-7 whitespace-pre-wrap">{t.description}</div>
      <div className="mt-8"><Thread messages={t.messages} viewerId={me?.id} /></div>
      <div className="mt-8">{closed ? <p className="rounded-2xl bg-[hsl(var(--muted)/.6)] p-4 text-sm text-[hsl(var(--muted-foreground))]">This ticket is closed. Open a new one if you need more help.</p>
        : <Composer label="Reply" placeholder="Add a reply for the desk…" pending={reply.isPending} error={reply.isError ? errorMessage(reply.error) : undefined} onSend={(body, reset) => reply.mutate({ ticketId: id, data: { body } }, { onSuccess: (updated) => { reset(); qc.setQueryData(getGetTicketQueryKey(id), updated); qc.invalidateQueries({ queryKey: getListTicketsQueryKey() }); } })} />}</div>
    </>}
  </main></RequireAuth></Layout>;
}

// ------------------------------ Community ------------------------------
export function CommunityList() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { const t = window.setTimeout(() => { setDebounced(q.trim()); setPage(1); }, 300); return () => window.clearTimeout(t); }, [q]);
  const cats = useListCategories({ query: { queryKey: getListCategoriesQueryKey(), staleTime: 5 * 60_000 } });
  const params = { page, ...(debounced ? { q: debounced } : {}), ...(category ? { category } : {}) };
  const list = useListDiscussions(params, { query: { queryKey: getListDiscussionsQueryKey(params), placeholderData: (prev) => prev } });
  const catName = (slug: string) => cats.data?.find((c) => c.slug === slug)?.name ?? slug;
  return <Layout><main className="shell py-12 md:py-16"><PageHead eyebrow="The porch / community" title="Trail reports and midnight questions." intro="Swap gear notes with other night walkers. Posts are reviewed by a moderator before they appear."><Link href="/community/new" className="btn-primary" data-testid="link-new-discussion"><Plus size={16} /> New discussion</Link></PageHead>
    <div className="mt-10 grid gap-8 lg:grid-cols-[260px_1fr]">
      <aside className="grid h-fit gap-2"><label className="mb-3 flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2 transition-shadow focus-within:shadow-md"><Search size={15} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search discussions" className="w-full bg-transparent text-sm outline-none" data-testid="input-community-search" /></label>
        <button onClick={() => { setCategory(''); setPage(1); }} className={`focus-ring rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-colors ${!category ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'hover:bg-[hsl(var(--card))]'}`} data-testid="button-community-all">All discussions</button>
        {cats.isLoading ? [0, 1, 2, 3].map((i) => <Bone key={i} className="h-10" />) : (cats.data ?? []).map((c) => <button key={c.slug} onClick={() => { setCategory(c.slug); setPage(1); }} title={c.description} className={`focus-ring flex items-center justify-between rounded-xl px-4 py-2.5 text-left text-sm font-semibold transition-colors ${category === c.slug ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'hover:bg-[hsl(var(--card))]'}`} data-testid={`button-community-category-${c.slug}`}>{c.name}<span className="mono text-[10px] opacity-70">{c.count}</span></button>)}
        <a href={`${import.meta.env.BASE_URL}community/knowledge/`} className="mt-4 rounded-xl border border-dashed border-[hsl(var(--border))] p-4 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="link-knowledge">Browse the knowledge archive →</a>
      </aside>
      <section>{list.isLoading ? <ListSkeleton rows={5} /> : list.isError ? <ErrorState onRetry={() => list.refetch()} /> : list.data && list.data.items.length ? <>
        <ul className={`grid gap-3 transition-opacity stagger ${list.isFetching ? 'opacity-70' : ''}`}>{list.data.items.map((d) => <li key={d.id}><Link href={`/community/discussions/${d.slug}`} className="hover-lift focus-ring group flex gap-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5" data-testid={`row-discussion-${d.id}`}><Initials name={d.authorName} /><div className="min-w-0 flex-1"><p className="serif text-xl leading-tight group-hover:text-[hsl(var(--primary))]">{d.title}{d.locked && <Lock size={13} className="ml-2 inline text-[hsl(var(--muted-foreground))]" />}</p><p className="mt-1 line-clamp-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{d.body}</p><p className="mono mt-2 text-[10px] uppercase text-[hsl(var(--muted-foreground))]">{catName(d.category)} / {d.authorName} / {formatDate(d.createdAt)}</p></div><span className="flex shrink-0 items-start gap-1 text-sm text-[hsl(var(--muted-foreground))]"><MessageSquare size={14} className="mt-1" />{d.replies.filter((r) => !r.hidden).length}</span></Link></li>)}</ul>
        {list.data.pages > 1 && <nav className="mt-8 flex items-center justify-between" aria-label="Pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn-ghost text-sm" data-testid="button-prev-page">← Newer</button><span className="mono text-xs text-[hsl(var(--muted-foreground))]" data-testid="text-page">Page {list.data.page} of {list.data.pages} / {list.data.total} threads</span><button disabled={page >= list.data.pages} onClick={() => setPage(page + 1)} className="btn-ghost text-sm" data-testid="button-next-page">Older →</button></nav>}
      </> : <EmptyState title={debounced || category ? 'No threads match.' : 'The porch is quiet.'} message={debounced || category ? 'Try a different word or shelf.' : 'Be the first to share a trail report.'} action={<Link href="/community/new" className="btn-primary">Start a discussion</Link>} />}</section>
    </div>
  </main></Layout>;
}

export function NewDiscussion() {
  const qc = useQueryClient();
  const cats = useListCategories({ query: { queryKey: getListCategoriesQueryKey() } });
  const create = useCreateDiscussion();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [posted, setPosted] = useState<{ slug: string; title: string } | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (title.trim().length < 8) next.title = 'Titles need at least 8 characters.';
    if (!category) next.category = 'Pick a category.';
    if (body.trim().length < 20) next.body = 'Give it at least 20 characters.';
    setErrors(next); if (Object.keys(next).length) return;
    create.mutate({ data: { title: title.trim(), category, body: body.trim() } }, { onSuccess: (d) => {
      setPosted({ slug: d.slug, title: d.title });
      qc.invalidateQueries({ queryKey: getGetCommunityHistoryQueryKey() });
      qc.invalidateQueries({ queryKey: getListDiscussionsQueryKey() });
      qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() });
    } });
  };
  return <Layout><main className="shell max-w-3xl py-12 md:py-16"><Link href="/community" className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">← Community</Link>
    <RequireAuth title="Sign in to start a discussion.">
      {posted ? <div className="mt-10"><EmptyState title="Sent to the moderators." message={`"${posted.title}" is pending review. It appears publicly once approved, and you can see it in your posting history now.`} action={<div className="flex flex-wrap justify-center gap-3"><Link href={`/community/discussions/${posted.slug}`} className="btn-primary">View your post</Link><Link href="/account/community" className="btn-ghost">Posting history</Link></div>} /></div>
      : <form onSubmit={submit} className="mt-8 fade-up" noValidate><Eyebrow>New discussion</Eyebrow><h1 className="serif mt-3 text-5xl">What is on your mind?</h1>
        <div className="mt-8 grid gap-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:p-8">
          <Field label="Title" hint={`${title.length}/180`} error={errors.title}><input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 180))} className="input" placeholder="Best lantern setting for a foggy creek walk?" data-testid="input-discussion-title" /></Field>
          <Field label="Category" error={errors.category}>{cats.isLoading ? <Bone className="h-11" /> : <select value={category} onChange={(e) => setCategory(e.target.value)} className="input" data-testid="select-discussion-category"><option value="">Choose a shelf</option>{(cats.data ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select>}</Field>
          <Field label="Your post" hint={`${body.length}/10000`} error={errors.body}><textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, 10000))} className="input min-h-[220px]" placeholder="Share the details. Plain text is perfect." data-testid="input-discussion-body" /></Field>
          {create.isError && <p className="text-sm text-[hsl(var(--destructive))]" role="alert">{errorMessage(create.error)}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[hsl(var(--muted-foreground))]">A moderator reviews every new thread before it goes public.</p><button type="submit" disabled={create.isPending} className="btn-primary" data-testid="button-submit-discussion">{create.isPending ? 'Posting…' : 'Submit for review'}</button></div>
        </div></form>}
    </RequireAuth>
  </main></Layout>;
}

export function DiscussionDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { ready, signedIn } = useSignedIn();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const { data: d, isLoading, isError, error, refetch } = useGetDiscussion(slug, { query: { queryKey: getGetDiscussionQueryKey(slug), enabled: ready, retry: 1 } });
  const reply = useReplyToDiscussion();
  const edit = useEditDiscussion();
  const moderate = useModerateCommunity();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const isAuthor = Boolean(me && d && me.id === d.authorId);
  const staff = me?.role === 'admin' || me?.role === 'staff';
  const status = (error as { status?: number } | null)?.status;
  const refresh = () => { qc.invalidateQueries({ queryKey: getGetDiscussionQueryKey(slug) }); qc.invalidateQueries({ queryKey: getListDiscussionsQueryKey() }); qc.invalidateQueries({ queryKey: getGetCommunityHistoryQueryKey() }); qc.invalidateQueries({ queryKey: getGetAdminOverviewQueryKey() }); };
  return <Layout><main className="shell max-w-3xl py-12 md:py-16"><Link href="/community" className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">← Community</Link>
    {isLoading || !ready ? <div className="mt-8"><Bone className="h-14 w-4/5" /><Bone className="mt-6 h-32 w-full" /></div> : status === 404 ? <div className="mt-8"><EmptyState title="That thread is not on the porch." message="It may be awaiting review or was removed." action={<Link href="/community" className="btn-primary">Back to community</Link>} /></div> : isError || !d ? <div className="mt-8"><ErrorState onRetry={() => refetch()} /></div> : <article className="mt-8">
      <div className="fade-up"><div className="flex flex-wrap items-center gap-2"><Eyebrow>{d.category}</Eyebrow>{!d.approved && <StatusPill status="Pending" />}{d.locked && <StatusPill status="Locked" />}</div><h1 className="serif mt-4 text-5xl leading-[1.02]" data-testid="text-discussion-title">{d.title}</h1><div className="mt-5 flex items-center gap-3"><Initials name={d.authorName} /><p className="text-sm"><span className="font-semibold">{d.authorName}</span><span className="text-[hsl(var(--muted-foreground))]"> / {formatDate(d.createdAt)}{d.updatedAt !== d.createdAt && ' / edited'}</span></p></div></div>
      {!d.approved && <p className="mt-6 rounded-xl bg-[hsl(var(--secondary)/.5)] p-4 text-sm">This thread is pending moderator review and is only visible to you and the desk.</p>}
      {editing ? <form className="mt-8" onSubmit={(e) => { e.preventDefault(); if (draft.trim().length < 3) return; edit.mutate({ slug, data: { body: draft.trim() } }, { onSuccess: (updated) => { qc.setQueryData(getGetDiscussionQueryKey(slug), updated); setEditing(false); refresh(); } }); }}><textarea value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 10000))} className="input min-h-[200px]" data-testid="input-edit-body" />{edit.isError && <p className="mt-2 text-sm text-[hsl(var(--destructive))]">{errorMessage(edit.error)}</p>}<div className="mt-3 flex gap-2"><button type="submit" disabled={edit.isPending} className="btn-primary text-sm" data-testid="button-save-edit">{edit.isPending ? 'Saving…' : 'Save changes'}</button><button type="button" onClick={() => setEditing(false)} className="btn-ghost text-sm">Cancel</button></div></form>
        : <div className="mt-8 whitespace-pre-wrap border-y border-[hsl(var(--border))] py-8 text-lg leading-8" data-testid="text-discussion-body">{d.body}</div>}
      {(isAuthor || staff) && !editing && <div className="mt-4 flex flex-wrap gap-2">{isAuthor && <button onClick={() => { setDraft(d.body); setEditing(true); }} className="btn-ghost text-sm" data-testid="button-edit-discussion"><Pencil size={14} /> Edit post</button>}{staff && <>{!d.approved && <button onClick={() => moderate.mutate({ data: { id: d.id, action: 'publish' } }, { onSuccess: refresh })} className="btn-ghost text-sm" data-testid="button-mod-publish">Publish</button>}<button onClick={() => moderate.mutate({ data: { id: d.id, action: d.locked ? 'unlock' : 'lock' } }, { onSuccess: refresh })} className="btn-ghost text-sm" data-testid="button-mod-lock">{d.locked ? 'Unlock' : 'Lock'}</button><button onClick={() => moderate.mutate({ data: { id: d.id, action: 'hide' } }, { onSuccess: refresh })} className="btn-ghost text-sm text-[hsl(var(--destructive))]" data-testid="button-mod-hide">Hide</button></>}</div>}
      <section className="mt-12"><h2 className="serif text-3xl">{d.replies.length} {d.replies.length === 1 ? 'reply' : 'replies'}</h2><div className="mt-6">{d.replies.length ? <Thread messages={d.replies} viewerId={me?.id} /> : <p className="text-sm text-[hsl(var(--muted-foreground))]">No replies yet.</p>}</div>
        <div className="mt-8">{d.locked ? <p className="flex items-center gap-2 rounded-2xl bg-[hsl(var(--muted)/.6)] p-4 text-sm text-[hsl(var(--muted-foreground))]"><Lock size={14} /> This thread is locked.</p> : !signedIn ? <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-6 text-center"><p className="text-sm">Sign in to join the conversation.</p><Link href={signInHref()} className="btn-primary mt-4 text-sm">Sign in <ArrowRight size={14} /></Link></div>
          : <Composer label="Reply" placeholder="Add to the thread. Replies are reviewed before they appear publicly." pending={reply.isPending} error={reply.isError ? errorMessage(reply.error) : undefined} onSend={(body, reset) => reply.mutate({ slug, data: { body } }, { onSuccess: (updated) => { reset(); qc.setQueryData(getGetDiscussionQueryKey(slug), updated); refresh(); } })} />}</div></section>
    </article>}
  </main></Layout>;
}
