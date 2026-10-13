import { createContext, useContext, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ArrowRight, Check, CircleHelp, Clock3, Headphones, Menu, Package, Search, ShoppingBag, Sparkles, X } from 'lucide-react';
import { Link, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
type Product = { slug: string; name: string; price: string; eyebrow: string; description: string; image: string; color: string };
type Article = { slug: string; title: string; category: string; read: string; intro: string; body: ReactNode };
const publicAsset = (filename: string) => `${import.meta.env.BASE_URL}${filename}`;
const pagesLocationHook = import.meta.env.BASE_URL === '/' ? undefined : useHashLocation;

declare global {
  interface Window { zE?: (...args: string[]) => void }
}

function openSupport() {
  if (typeof window.zE !== 'function') {
    window.alert('Support chat is not available right now. Please check your connection and try again.');
    return;
  }
  window.zE('messenger', 'open');
}

const products: Product[] = [
  { slug: 'night-shift-field-kit', name: 'Night Shift Field Kit', price: '$58.00', eyebrow: 'Bestseller', description: 'A small, useful collection for late-night porch patrols and curious people.', image: publicAsset('field-kit.jpg'), color: '#d9b18f' },
  { slug: 'ranger-cap', name: 'Ranger Cap', price: '$32.00', eyebrow: 'Headwear', description: 'Soft cotton twill, a low-profile fit, and one very quiet raccoon patch.', image: publicAsset('ranger-cap.jpg'), color: '#c4d0bd' },
  { slug: 'porch-watch-mug', name: 'Porch Watch Mug', price: '$24.00', eyebrow: 'Kitchen', description: 'A sturdy enamel camp mug for coffee, cocoa, and watching the fence line.', image: publicAsset('field-kit.jpg'), color: '#e7c3a1' },
  { slug: 'bandit-bandana', name: 'Bandit Bandana', price: '$18.00', eyebrow: 'Soft goods', description: 'Rust cotton, generous 22-inch cut, and a hand-drawn tail map.', image: publicAsset('field-kit.jpg'), color: '#c97f5c' },
  { slug: 'midnight-sticker-sheet', name: 'Midnight Sticker Sheet', price: '$9.00', eyebrow: 'Paper goods', description: 'Eight weather-resistant marks for bins, notebooks, and good hiding spots.', image: publicAsset('ranger-cap.jpg'), color: '#a8bbb0' },
  { slug: 'little-paws-key-tag', name: 'Little Paws Key Tag', price: '$14.00', eyebrow: 'Small things', description: 'Brushed brass with a satisfying weight and a tiny stamped paw trail.', image: publicAsset('field-kit.jpg'), color: '#e5c987' },
];

const articles: Article[] = [
  { slug: 'shipping-times', title: 'When will my order arrive?', category: 'Shipping & delivery', read: '3 min read', intro: 'Most orders leave our little packing bench within 1–3 business days. Here is what happens after that.', body: <><p>We pack orders Monday through Friday from our workshop in Portland, Oregon. Standard domestic delivery usually takes <strong>3–6 business days after dispatch</strong>. During a seasonal release, packing can take a little longer.</p><h2>The short version</h2><ul><li>Order received: an email confirmation.</li><li>Packing: usually 1–3 business days.</li><li>Transit: usually 3–6 business days in the contiguous U.S.</li></ul><p>These are estimates, not guarantees. Weather and carrier volume can affect the timeline. Your tracking page is the best source once a parcel is on its way.</p></> },
  { slug: 'tracking-your-order', title: 'How do I track my order?', category: 'Shipping & delivery', read: '2 min read', intro: 'A tracking link appears in the dispatch email when your parcel leaves our bench.', body: <><p>When your order is dispatched, the dispatch email includes a carrier link and tracking number. It can take up to 24 hours for the first scan to appear.</p><h2>No scan yet?</h2><p>If the link says “label created,” give it one business day for the first carrier scan. If there is still no movement after 48 hours, contact support with your order number.</p></> },
  { slug: 'change-address-before-dispatch', title: 'Can I change my address before dispatch?', category: 'Orders', read: '2 min read', intro: 'Sometimes. Contact us quickly and we will try to catch the order before it is packed.', body: <><p>Contact support with your order number and the updated shipping address. Address changes are possible while an order is still unfulfilled.</p><p>Once a dispatch email has been sent, a change cannot be guaranteed. We will explain the next available step.</p></> },
  { slug: 'returns-and-exchanges', title: 'What is your returns policy?', category: 'Returns & refunds', read: '4 min read', intro: 'Unused items can be returned within 30 days of delivery.', body: <><p>We accept returns of unused, unwashed items in their original condition within 30 days of delivery.</p><h2>Return steps</h2><ol><li>Contact support with your order number, item, and reason for return.</li><li>Wait for return authorization and packing instructions.</li><li>Pack the item securely with your order reference and keep your tracking details.</li></ol><p>Original shipping charges are not refundable. Personalized or clearly used items are not eligible. Exchanges are handled as a return followed by a new order.</p></> },
  { slug: 'refund-timing', title: 'When will my refund arrive?', category: 'Returns & refunds', read: '2 min read', intro: 'Approved refunds are processed within 3 business days after a return is received.', body: <><p>After a return reaches our workshop, we inspect it and process the approved refund within 3 business days. Your payment provider may then take another 5–10 business days to show the credit.</p><p>If that window has passed, contact support with your order number and return tracking details.</p></> },
  { slug: 'cancel-an-order', title: 'Can I cancel my order?', category: 'Orders', read: '2 min read', intro: 'Cancellation is possible only before the order enters packing.', body: <><p>Contact support as soon as possible with your order number so we can check its fulfillment status.</p><p>If packing has started, cancellation may no longer be possible. You can ask about a return after delivery instead.</p></> },
  { slug: 'processing-delays', title: 'Why is my order taking longer to process?', category: 'Orders', read: '3 min read', intro: 'Small-batch packing can run a little behind during launches, restocks, and rainy weeks.', body: <><p>Our packing bench usually works through orders in 1–3 business days. Processing can stretch to 5 business days during a new collection, a restock, or an unexpected supply delay.</p><p>If your order has been processing longer than 5 business days, contact support with your order number. We will check its status and explain the next step.</p></> },
  { slug: 'account-help', title: 'Help finding your order details', category: 'Account & contact', read: '2 min read', intro: 'Find your confirmation email or contact the desk for help with an order reference.', body: <><p>Start with the confirmation email sent to the address used for your order. Check your spam folder if it has not arrived.</p><p>Need a hand locating your order details? Contact support with your order reference and the email address used. Do not share your password or full payment card number in chat.</p></> },
  { slug: 'contact-support', title: 'How can I contact support?', category: 'Account & contact', read: '2 min read', intro: 'Open the support chat from any page to ask a question.', body: <><p>Select “Contact support” or open the Help button to talk with the support desk. Include your order reference when your question relates to an order.</p><p>You can also browse these help articles for shipping, returns, and delivery information. Please do not share passwords or full payment card numbers in chat.</p></> },
];
const categories = ['All topics', 'Shipping & delivery', 'Orders', 'Returns & refunds', 'Account & contact'];

type BagItem = { slug: string; quantity: number };
type BagState = { items: BagItem[]; update: (slug: string, delta: number) => void };
const BagContext = createContext<BagState>({ items: [], update: () => undefined });
function BagProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BagItem[]>(() => {
    try {
      const saved: unknown = JSON.parse(sessionStorage.getItem('raccoon-bag') || '[]');
      return Array.isArray(saved) ? saved.filter((i) => products.some((p) => p.slug === i?.slug) && Number.isInteger(i?.quantity) && i.quantity > 0 && i.quantity <= 99) : [];
    } catch { return []; }
  });
  const update = (slug: string, delta: number) => setItems((current) => {
    const quantity = Math.max(0, Math.min(99, (current.find((i) => i.slug === slug)?.quantity || 0) + delta));
    const next = current.filter((i) => i.slug !== slug);
    if (quantity) next.push({ slug, quantity });
    try { sessionStorage.setItem('raccoon-bag', JSON.stringify(next)); } catch { /* Bag remains available in memory. */ }
    return next;
  });
  return <BagContext.Provider value={{ items, update }}>{children}</BagContext.Provider>;
}

function Logo() {
  return <Link href="/" className="focus-ring flex items-center gap-3" data-testid="link-logo"><span className="grid h-10 w-10 place-items-center rounded-full border-2 border-[hsl(var(--primary))] bg-[hsl(var(--secondary))] text-xl font-bold">RS</span><span><span className="serif block text-xl leading-none">Raccoon Supply</span><span className="mono text-[10px] uppercase tracking-[.22em] text-[hsl(var(--muted-foreground))]">Co. / Field goods</span></span></Link>;
}
function Header() {
  const [open, setOpen] = useState(false);
  const { items } = useContext(BagContext);
  const count = items.reduce((total, item) => total + item.quantity, 0);
  return <header className="sticky top-0 z-40 border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/.94)] backdrop-blur-md">
    <div className="shell flex min-h-[76px] items-center justify-between gap-5"><Logo />
      <nav className={`${open ? 'absolute left-0 right-0 top-[76px] flex' : 'hidden'} flex-col gap-4 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5 md:static md:flex md:flex-row md:items-center md:border-0 md:bg-transparent md:p-0`} aria-label="Primary navigation">
        <Link href="/shop" onClick={() => setOpen(false)} className="focus-ring text-sm font-semibold" data-testid="link-shop">Shop</Link>
        <Link href="/help" onClick={() => setOpen(false)} className="focus-ring text-sm font-semibold" data-testid="link-help">Help center</Link>
        <Link href="/contact" onClick={() => setOpen(false)} className="focus-ring text-sm font-semibold" data-testid="link-contact">Contact</Link>
      </nav>
      <div className="flex items-center gap-2">
        <button className="focus-ring hidden items-center gap-2 rounded-full border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold md:flex" onClick={openSupport} data-testid="button-open-chat"><Headphones size={16} /> Contact support</button>
        <Link href="/bag" aria-label={`Shopping bag, ${count} items`} className="focus-ring relative grid h-10 w-10 place-items-center rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" data-testid="link-bag"><ShoppingBag size={17} />{count > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-[hsl(var(--secondary))] px-1.5 text-xs text-[hsl(var(--foreground))]">{count}</span>}</Link>
        <button className="focus-ring grid h-10 w-10 place-items-center rounded-full border border-[hsl(var(--border))] md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu" aria-expanded={open} data-testid="button-toggle-menu">{open ? <X size={18} /> : <Menu size={18} />}</button>
      </div>
    </div>
  </header>;
}
function Footer() {
  return <footer className="mt-24 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted)/.45)]">
    <div className="shell grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
      <div><Logo /><p className="mt-4 max-w-xs text-sm leading-6 text-[hsl(var(--muted-foreground))]">Useful little goods for people who notice the night shift.</p></div>
      <div><p className="mono mb-4 text-[10px] uppercase text-[hsl(var(--muted-foreground))]">Explore</p><div className="grid gap-2 text-sm"><Link href="/shop">Shop the goods</Link><Link href="/help">Help center</Link><Link href="/contact">Contact the desk</Link><Link href="/privacy">Privacy information</Link></div></div>
      <div><p className="mono mb-4 text-[10px] uppercase text-[hsl(var(--muted-foreground))]">From our bench to yours</p><p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">Small-batch goods, thoughtful packing, and a helping hand when you need one.</p></div>
    </div>
    <div className="shell border-t border-[hsl(var(--border))] py-5"><p className="mono text-[10px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">© {new Date().getFullYear()} Raccoon Supply Co. All rights reserved.</p></div>
  </footer>;
}
function Layout({ children }: { children: ReactNode }) {
  return <div className="grain min-h-[100dvh]"><Header />{children}<Footer /></div>;
}
function Home() {
  const [, setLocation] = useLocation();
  return <Layout><main>
    <section className="shell grid min-h-[620px] items-center gap-10 py-12 md:grid-cols-[.85fr_1.15fr] md:py-20">
      <div className="fade-up relative z-10"><p className="mono mb-5 text-xs uppercase tracking-[.22em] text-[hsl(var(--primary))]">Est. somewhere after midnight / field goods</p><h1 className="serif max-w-xl text-[clamp(3.5rem,8vw,7.2rem)] leading-[.88] tracking-[-.06em]">Good things for the <em className="text-[hsl(var(--primary))]">night curious.</em></h1><p className="mt-7 max-w-md text-lg leading-8 text-[hsl(var(--muted-foreground))]">Raccoon Supply Co. makes small, useful goods for porch watchers, pocket collectors, and anyone who prefers their adventures after dark.</p>
        <div className="mt-8 flex flex-wrap gap-3"><button onClick={() => setLocation('/shop')} className="focus-ring inline-flex items-center gap-3 rounded-full bg-[hsl(var(--primary))] px-6 py-3 font-semibold text-[hsl(var(--primary-foreground))]" data-testid="button-shop-collection">Shop the collection <ArrowRight size={17} /></button><button onClick={openSupport} className="focus-ring inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] px-5 py-3 font-semibold" data-testid="button-home-chat">Contact support</button></div>
        <div className="mt-12 flex gap-7 text-sm">{[['30', 'day returns'], ['1–3', 'days to pack'], ['6', 'field favorites']].map(([number, label]) => <span key={label}><strong className="serif text-2xl">{number}</strong><br /><span className="text-[hsl(var(--muted-foreground))]">{label}</span></span>)}</div>
      </div>
      <div className="relative min-h-[430px] overflow-hidden rounded-[2.2rem] bg-[#bfd0c1]"><img src={publicAsset('raccoon-hero.jpg')} alt="A raccoon beside a canvas field kit in a warm cabin" className="absolute inset-0 h-full w-full object-cover" /><div className="absolute bottom-5 left-5 rounded-xl border border-white/40 bg-[#f8f0df]/85 px-4 py-3 backdrop-blur-sm"><p className="mono text-[10px] uppercase text-[hsl(var(--primary))]">Dispatch note 014</p><p className="mt-1 text-sm">Pack light. Look closely.</p></div></div>
    </section>
    <section className="paper-grid border-y border-[hsl(var(--border))]"><div className="shell grid gap-8 py-16 md:grid-cols-[.7fr_1.3fr]"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">The field notes</p><h2 className="serif mt-4 text-4xl leading-tight">A small shop with a large soft spot for the overlooked.</h2></div><div className="grid gap-5 sm:grid-cols-3">
      <div className="rounded-2xl bg-[hsl(var(--card))] p-5"><Sparkles className="text-[hsl(var(--accent))]" size={20} /><h3 className="mt-7 font-semibold">Useful first</h3><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Goods that earn their space on a shelf, a hook, or a nightstand.</p></div>
      <div className="rounded-2xl bg-[hsl(var(--card))] p-5"><Package className="text-[hsl(var(--accent))]" size={20} /><h3 className="mt-7 font-semibold">Small batch</h3><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Packed by hand in our workshop, usually within three days.</p></div>
      <div className="rounded-2xl bg-[hsl(var(--card))] p-5"><CircleHelp className="text-[hsl(var(--accent))]" size={20} /><h3 className="mt-7 font-semibold">Clear answers</h3><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">A help center that says what happens next, plainly.</p></div>
    </div></div></section>
    <section className="shell py-20"><div className="flex items-end justify-between gap-5"><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">On the bench</p><h2 className="serif mt-3 text-5xl">A few good finds</h2></div><Link href="/shop" className="focus-ring hidden items-center gap-2 text-sm font-bold md:flex">View all goods <ArrowRight size={15} /></Link></div><div className="mt-9 grid gap-5 md:grid-cols-3">{products.slice(0, 3).map((product) => <ProductCard key={product.slug} product={product} />)}</div><Link href="/shop" className="focus-ring mt-7 inline-flex items-center gap-2 text-sm font-bold md:hidden">View all goods <ArrowRight size={15} /></Link></section>
    <section className="shell pb-20"><div className="grid overflow-hidden rounded-[2rem] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] md:grid-cols-[1fr_.8fr]"><div className="p-8 md:p-14"><p className="mono text-[10px] uppercase tracking-[.2em] opacity-70">Need a hand?</p><h2 className="serif mt-4 max-w-md text-5xl leading-[.95]">The answers live in the help center.</h2><p className="mt-5 max-w-md leading-7 opacity-80">Shipping windows, tracking, returns, cancellations, account questions — all in one calm, searchable place.</p><Link href="/help" className="focus-ring mt-8 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--secondary))] px-5 py-3 font-semibold text-[hsl(var(--foreground))]">Browse help center <ArrowRight size={16} /></Link></div><div className="paper-grid min-h-[270px] bg-[hsl(var(--secondary)/.16)] p-8 md:p-14"><p className="serif text-3xl">“If it feels like a secret, we probably need a better article.”</p><p className="mono mt-8 text-[10px] uppercase opacity-70">— desk rule no. 02</p></div></div></section>
  </main></Layout>;
}
function ProductCard({ product }: { product: Product }) {
  return <Link href={`/product/${product.slug}`} className="hover-lift focus-ring group overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]" data-testid={`card-product-${product.slug}`}><div className="relative aspect-[1.08] overflow-hidden" style={{ backgroundColor: product.color }}><img src={product.image} alt={product.name} className="h-full w-full object-cover mix-blend-multiply transition-transform duration-500 group-hover:scale-105" /><span className="absolute left-4 top-4 rounded-full bg-[hsl(var(--card)/.86)] px-3 py-1 text-[10px] font-bold uppercase tracking-[.13em]">{product.eyebrow}</span></div><div className="p-5"><div className="flex items-start justify-between gap-3"><h3 className="serif text-2xl">{product.name}</h3><span className="font-semibold">{product.price}</span></div><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{product.description}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[hsl(var(--primary))]">Inspect the goods <ArrowRight size={14} /></span></div></Link>;
}
function Shop() {
  const [query, setQuery] = useState('');
  const filtered = products.filter((p) => `${p.name} ${p.description} ${p.eyebrow}`.toLowerCase().includes(query.toLowerCase()));
  return <Layout><main className="shell py-14 md:py-20"><div className="max-w-2xl"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">The collection</p><h1 className="serif mt-4 text-6xl leading-[.92]">Goods for the curious.</h1><p className="mt-6 text-lg leading-8 text-[hsl(var(--muted-foreground))]">Nothing here is urgent. Everything here is meant to be used, kept, and noticed.</p></div><div className="mt-12 flex flex-col justify-between gap-4 border-y border-[hsl(var(--border))] py-4 sm:flex-row sm:items-center"><p className="mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">{filtered.length} pieces on the bench</p><label className="flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 py-2"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search goods" className="w-44 bg-transparent text-sm outline-none" data-testid="input-product-search" /></label></div><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((product) => <ProductCard key={product.slug} product={product} />)}</div>{!filtered.length && <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-16 text-center"><p className="serif text-3xl">Nothing found in the cupboard.</p><button onClick={() => setQuery('')} className="mt-5 font-semibold text-[hsl(var(--primary))]">Clear search</button></div>}<div className="mt-16 flex items-center gap-3 rounded-2xl bg-[hsl(var(--secondary)/.45)] p-5 text-sm text-[hsl(var(--muted-foreground))]"><Clock3 size={18} /><span>Packed with care in 1–3 business days. Questions? The support desk is here to help.</span></div></main></Layout>;
}
function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const product = products.find((item) => item.slug === slug);
  const { update } = useContext(BagContext);
  const [addedFor, setAddedFor] = useState('');
  if (!product) return <NotFound />;
  const added = addedFor === slug;
  return <Layout><main className="shell py-12 md:py-20"><Link href="/shop" className="focus-ring text-sm font-semibold text-[hsl(var(--muted-foreground))]">← Back to collection</Link><div className="mt-8 grid gap-10 md:grid-cols-[1.1fr_.9fr] md:items-center"><div className="overflow-hidden rounded-[2rem]" style={{ backgroundColor: product.color }}><img src={product.image} alt={product.name} className="aspect-square h-full w-full object-cover mix-blend-multiply" /></div><div><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{product.eyebrow}</p><h1 className="serif mt-4 text-6xl leading-[.9]">{product.name}</h1><p className="mt-5 text-2xl font-semibold">{product.price}</p><p className="mt-5 text-lg leading-8 text-[hsl(var(--muted-foreground))]">{product.description}</p><div className="my-8 border-y border-[hsl(var(--border))] py-5"><p className="font-semibold">Made to be used, kept, and noticed.</p><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Packed with care in 1–3 business days. Unused items may be returned within 30 days of delivery.</p></div><button onClick={() => { update(product.slug, 1); setAddedFor(product.slug); }} className="focus-ring inline-flex items-center gap-3 rounded-full bg-[hsl(var(--primary))] px-6 py-3 font-semibold text-[hsl(var(--primary-foreground))]" data-testid="button-add-to-bag">{added ? <><Check size={17} /> Added to bag</> : <><ShoppingBag size={17} /> Add to bag</>}</button>{added && <Link href="/bag" className="focus-ring ml-4 inline-block text-sm font-semibold text-[hsl(var(--primary))]">View your bag →</Link>}</div></div></main></Layout>;
}
function Bag() {
  const { items, update } = useContext(BagContext);
  const subtotal = items.reduce((total, item) => total + Number(products.find((p) => p.slug === item.slug)!.price.slice(1)) * item.quantity, 0);
  return <Layout><main className="shell max-w-4xl py-14 md:py-20"><p className="mono text-xs uppercase tracking-[.2em] text-[hsl(var(--primary))]">Your collection</p><h1 className="serif mt-4 text-6xl">Shopping bag</h1>{items.length ? <><div className="mt-10 grid gap-4">{items.map((item) => {
    const product = products.find((p) => p.slug === item.slug)!;
    return <div key={item.slug} className="flex flex-wrap items-center gap-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><img src={product.image} alt={product.name} className="h-20 w-20 rounded-xl object-cover" /><div className="flex-1"><Link href={`/product/${product.slug}`} className="serif text-2xl">{product.name}</Link><p className="mt-2">{product.price}</p></div><div className="flex items-center gap-4"><button aria-label={`Remove one ${product.name}`} onClick={() => update(item.slug, -1)} className="focus-ring h-9 w-9 rounded-full border">−</button><span aria-label="Quantity">{item.quantity}</span><button aria-label={`Add one ${product.name}`} onClick={() => update(item.slug, 1)} className="focus-ring h-9 w-9 rounded-full border">+</button><button onClick={() => update(item.slug, -item.quantity)} className="focus-ring ml-2 text-sm underline">Remove</button></div></div>;
  })}</div><div className="mt-8 flex items-center justify-between border-t border-[hsl(var(--border))] pt-6"><p className="serif text-3xl">Subtotal</p><p className="text-2xl font-semibold">${subtotal.toFixed(2)}</p></div></> : <p className="mt-10 text-lg text-[hsl(var(--muted-foreground))]">Your bag is waiting for a few good finds.</p>}<Link href="/shop" className="focus-ring mt-8 inline-flex items-center gap-3 rounded-full bg-[hsl(var(--primary))] px-6 py-3 font-semibold text-[hsl(var(--primary-foreground))]">Continue shopping <ArrowRight size={17} /></Link></main></Layout>;
}
function Help() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All topics');
  const filtered = articles.filter((article) => (category === 'All topics' || article.category === category) && `${article.title} ${article.intro} ${article.category}`.toLowerCase().includes(query.toLowerCase()));
  return <Layout><main className="shell py-14 md:py-20"><div className="mx-auto max-w-3xl text-center"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">The help center</p><h1 className="serif mt-4 text-6xl leading-[.92]">Clear answers for the next step.</h1><p className="mt-6 text-lg leading-8 text-[hsl(var(--muted-foreground))]">Search the desk notes or browse by topic. Shipping, returns, and order questions — answered plainly.</p><label className="mx-auto mt-8 flex max-w-xl items-center gap-3 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-5 py-3 text-left shadow-sm"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search shipping, returns, address..." className="w-full bg-transparent outline-none" data-testid="input-help-search" /></label></div><div className="mt-14 flex flex-wrap justify-center gap-2">{categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold ${category === item ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border border-[hsl(var(--border))] bg-[hsl(var(--card))]'}`}>{item}</button>)}</div><div className="mx-auto mt-12 max-w-4xl space-y-10">{categories.slice(1).map((group) => {
    const matches = filtered.filter((article) => article.category === group);
    return matches.length ? <section key={group}><div className="mb-4 flex items-center gap-3"><h2 className="serif text-3xl">{group}</h2><span className="mono text-[10px] text-[hsl(var(--muted-foreground))]">{matches.length} notes</span></div><div className="grid gap-3">{matches.map((article) => <Link key={article.slug} href={`/help/article/${article.slug}`} className="hover-lift focus-ring flex items-center justify-between gap-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5"><div><p className="font-semibold">{article.title}</p><p className="mt-1 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{article.intro}</p></div><ArrowRight className="shrink-0 text-[hsl(var(--primary))]" size={18} /></Link>)}</div></section> : null;
  })}{!filtered.length && <div className="rounded-2xl border border-dashed border-[hsl(var(--border))] p-14 text-center"><p className="serif text-3xl">No desk note matches that search.</p><button onClick={() => { setQuery(''); setCategory('All topics'); }} className="mt-4 font-semibold text-[hsl(var(--primary))]">Show all articles</button></div>}</div></main></Layout>;
}
function Article() {
  const { slug } = useParams<{ slug: string }>();
  const article = articles.find((item) => item.slug === slug);
  if (!article) return <NotFound />;
  return <Layout><main className="shell py-14 md:py-20"><div className="mx-auto max-w-3xl"><Link href="/help" className="focus-ring text-sm font-semibold text-[hsl(var(--muted-foreground))]">← Back to help center</Link><div className="mt-12"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">{article.category} / {article.read}</p><h1 className="serif mt-5 text-6xl leading-[.92]">{article.title}</h1><p className="mt-6 text-xl leading-8 text-[hsl(var(--muted-foreground))]">{article.intro}</p></div><article className="prose prose-stone mt-12 max-w-none border-t border-[hsl(var(--border))] pt-10 text-[hsl(var(--foreground))] prose-headings:font-serif prose-headings:font-bold prose-p:leading-8 prose-li:leading-8">{article.body}</article><div className="mt-14 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[hsl(var(--secondary)/.45)] p-5"><div><p className="font-semibold">Still need a hand?</p><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Talk with the support desk.</p></div><button onClick={openSupport} className="focus-ring inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))]">Contact support <ArrowRight size={14} /></button></div></div></main></Layout>;
}
function Contact() {
  return <Layout><main className="shell py-14 md:py-20"><div className="mx-auto max-w-3xl"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">The support desk</p><h1 className="serif mt-4 text-6xl leading-[.92]">A little help, right here.</h1><p className="mt-6 text-lg leading-8 text-[hsl(var(--muted-foreground))]">Have a question about your order or something on the bench? Talk with the support desk.</p><div className="mt-10 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 md:p-8"><h2 className="serif text-3xl">Contact support</h2><p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">Keep your order reference handy so we can help with shipping, returns, or an order update.</p><button onClick={openSupport} className="focus-ring mt-6 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--primary))] px-6 py-3 font-semibold text-[hsl(var(--primary-foreground))]" data-testid="button-contact-support"><Headphones size={18} /> Start a conversation</button></div><p className="mt-8 text-sm text-[hsl(var(--muted-foreground))]">Looking for written answers? <Link href="/help" className="font-semibold text-[hsl(var(--primary))]">Browse the help center.</Link></p></div></main></Layout>;
}
function Privacy() {
  return <Layout><main className="shell py-14 md:py-20"><div className="mx-auto max-w-3xl"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">The small print</p><h1 className="serif mt-4 text-6xl leading-[.92]">Privacy information</h1><p className="mt-6 text-xl leading-8 text-[hsl(var(--muted-foreground))]">How information is handled when you browse or contact the desk.</p><div className="prose prose-stone mt-12 max-w-none border-t border-[hsl(var(--border))] pt-10 prose-headings:font-serif prose-p:leading-8"><h2>Contact and support</h2><p>When you use support chat, your message and the details you provide are handled by our support service to respond to your request. Please do not share passwords or full payment card numbers in chat.</p><h2>Support chat and cookies</h2><p>The support service may receive technical information such as your IP address and browser details when it loads, and may use cookies to operate the conversation.</p><h2>Your shopping bag</h2><p>Your bag is stored in this browser tab. It contains product references and quantities and does not contain payment information.</p><h2>Hosting and fonts</h2><p>This site is hosted on GitHub Pages and uses Google Fonts. These providers may receive standard request information when you visit. We do not add a separate analytics service.</p><h2>Questions</h2><p>Contact the support desk if you have a question about information shared in a conversation.</p></div><Link href="/contact" className="focus-ring mt-10 inline-block font-semibold text-[hsl(var(--primary))]">Contact the support desk →</Link></div></main></Layout>;
}
function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/shop" component={Shop} /><Route path="/product/:slug" component={ProductDetail} /><Route path="/bag" component={Bag} /><Route path="/help" component={Help} /><Route path="/help/article/:slug" component={Article} /><Route path="/contact" component={Contact} /><Route path="/privacy" component={Privacy} /><Route component={NotFound} /></Switch>;
}
function LayoutRouter() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Router /></ErrorBoundary>;
}
export default function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><BagProvider><WouterRouter hook={pagesLocationHook}><LayoutRouter /></WouterRouter></BagProvider><Toaster /></TooltipProvider></QueryClientProvider>;
}
