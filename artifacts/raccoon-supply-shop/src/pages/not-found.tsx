import { Link } from 'wouter';
import { Layout } from '@/components/kit';

export default function NotFound() {
  return <Layout><main className="shell py-24 text-center"><p className="mono text-[10px] uppercase tracking-[.2em] text-[hsl(var(--primary))]">Error 404 / off the trail</p><h1 className="serif mx-auto mt-5 max-w-2xl text-6xl leading-[.95]">Something rummaged through this page.</h1><p className="mx-auto mt-5 max-w-md text-[hsl(var(--muted-foreground))]">The link may be old, or the page wandered off after dark.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/" className="btn-primary" data-testid="link-home">Back to the porch</Link><Link href="/help" className="btn-ghost">Help center</Link></div></main></Layout>;
}
