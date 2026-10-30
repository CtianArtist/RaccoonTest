import { pool } from '@workspace/db';
export { pool };
export async function initializeSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rsc_users(
      id uuid PRIMARY KEY, email text NOT NULL UNIQUE, display_name text NOT NULL,
      password_hash text NOT NULL, role text NOT NULL DEFAULT 'customer' CHECK(role IN('customer','staff','admin')),
      created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS rsc_sessions(
      token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES rsc_users(id) ON DELETE CASCADE,
      csrf text NOT NULL, expires_at timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS rsc_discussions(
      id uuid PRIMARY KEY, slug text NOT NULL UNIQUE, title text NOT NULL, category text NOT NULL,
      author_id uuid NOT NULL REFERENCES rsc_users(id), body text NOT NULL,
      approved boolean NOT NULL DEFAULT false, locked boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS rsc_posts(
      id uuid PRIMARY KEY, discussion_id uuid NOT NULL REFERENCES rsc_discussions(id) ON DELETE CASCADE,
      author_id uuid NOT NULL REFERENCES rsc_users(id), body text NOT NULL,
      hidden boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS rsc_tickets(
      id uuid PRIMARY KEY, customer_id uuid NOT NULL REFERENCES rsc_users(id), subject text NOT NULL,
      description text NOT NULL, category text NOT NULL, status text NOT NULL DEFAULT 'Open' CHECK(status IN('Open','Pending','Solved','Closed')),
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS rsc_ticket_messages(
      id uuid PRIMARY KEY, ticket_id uuid NOT NULL REFERENCES rsc_tickets(id), author_id uuid NOT NULL REFERENCES rsc_users(id),
      body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS rsc_orders(
      id text PRIMARY KEY, customer_id uuid NOT NULL REFERENCES rsc_users(id), product text NOT NULL,
      status text NOT NULL, shipping_method text NOT NULL, estimated_delivery date, tracking_status text NOT NULL);
    CREATE TABLE IF NOT EXISTS rsc_returns(
      id uuid PRIMARY KEY, order_id text NOT NULL REFERENCES rsc_orders(id), customer_id uuid NOT NULL REFERENCES rsc_users(id),
      reason text NOT NULL, status text NOT NULL DEFAULT 'Requested', created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS rsc_service_credentials(
      id uuid PRIMARY KEY, token_hash text NOT NULL UNIQUE, customer_id uuid NOT NULL REFERENCES rsc_users(id),
      scopes text[] NOT NULL, expires_at timestamptz NOT NULL, revoked boolean NOT NULL DEFAULT false);
    CREATE TABLE IF NOT EXISTS rsc_audit(
      id bigserial PRIMARY KEY, actor_id uuid, method text NOT NULL, path text NOT NULL,
      status integer NOT NULL, result text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE IF NOT EXISTS rsc_limits(
      key text PRIMARY KEY, count integer NOT NULL, resets_at timestamptz NOT NULL);
    CREATE INDEX IF NOT EXISTS rsc_discussions_public ON rsc_discussions(approved,updated_at DESC);
    CREATE INDEX IF NOT EXISTS rsc_posts_thread ON rsc_posts(discussion_id,created_at);
    CREATE INDEX IF NOT EXISTS rsc_tickets_owner ON rsc_tickets(customer_id);
    CREATE INDEX IF NOT EXISTS rsc_audit_created ON rsc_audit(created_at DESC);
  `);
}
