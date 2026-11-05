-- Development schema. Managed publishing applies the reviewed schema diff.
CREATE SCHEMA IF NOT EXISTS retail;
CREATE TABLE IF NOT EXISTS retail.products (
  id text PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  price_cents integer NOT NULL CHECK(price_cents>0),
  image text NOT NULL,
  category text NOT NULL,
  sizes jsonb NOT NULL DEFAULT '["One size"]',
  featured boolean NOT NULL DEFAULT false,
  badge text
);
CREATE TABLE IF NOT EXISTS retail.customers (
 id text PRIMARY KEY, clerk_id text UNIQUE, display_name text NOT NULL,
 email text NOT NULL DEFAULT '', role text NOT NULL DEFAULT 'customer'
 CHECK(role IN ('customer','staff','admin')), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS retail.orders (
  id uuid PRIMARY KEY, number text UNIQUE NOT NULL,
 user_id text NOT NULL REFERENCES retail.customers(id),
 status text NOT NULL,
 subtotal_cents integer NOT NULL, shipping_cents integer NOT NULL DEFAULT 0,
 total_cents integer NOT NULL CHECK(total_cents>=0), delivered_at timestamptz,
 tracking_number text, carrier text, synthetic boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS retail_orders_owner ON retail.orders(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS retail.order_items (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES retail.orders(id),
 slug text NOT NULL, name text NOT NULL, price_cents integer NOT NULL CHECK(price_cents>=0),
 quantity integer NOT NULL CHECK(quantity>0), size text NOT NULL DEFAULT 'One size',
 image text NOT NULL
);
CREATE TABLE IF NOT EXISTS retail.shipping_events (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES retail.orders(id),
 status text NOT NULL, description text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS retail.return_requests (
 id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES retail.orders(id),
 user_id text NOT NULL REFERENCES retail.customers(id), reason text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('return','refund')),
 status text NOT NULL DEFAULT 'Requested'
 CHECK(status IN ('Requested','Approved','Rejected','Inspected')),
 condition_confirmed boolean NOT NULL CHECK(condition_confirmed),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS retail_return_active ON retail.return_requests(order_id)
 WHERE status <> 'Rejected';
CREATE TABLE IF NOT EXISTS retail.tickets (
 id uuid PRIMARY KEY, user_id text NOT NULL REFERENCES retail.customers(id),
 subject text NOT NULL, description text NOT NULL, category text NOT NULL,
 status text NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','Pending','Solved','Closed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS retail_ticket_owner ON retail.tickets(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS retail.ticket_messages (
 id uuid PRIMARY KEY, ticket_id uuid NOT NULL REFERENCES retail.tickets(id),
 author_id text NOT NULL REFERENCES retail.customers(id), body text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS retail.categories (
 slug text PRIMARY KEY, name text NOT NULL, description text NOT NULL
);
CREATE TABLE IF NOT EXISTS retail.discussions (
 id uuid PRIMARY KEY, slug text UNIQUE NOT NULL, title text NOT NULL,
 category text NOT NULL REFERENCES retail.categories(slug),
 body text NOT NULL, author_id text NOT NULL REFERENCES retail.customers(id),
 approved boolean NOT NULL DEFAULT false, locked boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS retail.replies (
 id uuid PRIMARY KEY, discussion_id uuid NOT NULL REFERENCES retail.discussions(id),
 author_id text NOT NULL REFERENCES retail.customers(id), body text NOT NULL,
 hidden boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS retail.integration_credentials (
 id uuid PRIMARY KEY, user_id text NOT NULL REFERENCES retail.customers(id),
 token_hash text NOT NULL UNIQUE, scopes text[] NOT NULL, label text NOT NULL,
 expires_at timestamptz NOT NULL, revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS retail.simulated_checkouts (
  id text PRIMARY KEY CHECK (id LIKE 'sim_%'),
  user_id text NOT NULL REFERENCES retail.customers(id),
  request_id uuid NOT NULL, cart_hash text NOT NULL,
  order_id uuid NOT NULL UNIQUE REFERENCES retail.orders(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,request_id)
);
CREATE TABLE IF NOT EXISTS retail.audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id text,
 action text NOT NULL, resource_id text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS retail.rate_limits (
 key text PRIMARY KEY, starts_at timestamptz NOT NULL DEFAULT now(), count integer NOT NULL DEFAULT 1
);
