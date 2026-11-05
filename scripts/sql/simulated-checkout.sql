-- Additive checkout table: preserve all existing customers, orders, and histories.
CREATE TABLE IF NOT EXISTS retail.simulated_checkouts (
  id text PRIMARY KEY CHECK (id LIKE 'sim_%'),
  user_id text NOT NULL REFERENCES retail.customers(id),
  request_id uuid NOT NULL,
  cart_hash text NOT NULL,
  order_id uuid NOT NULL UNIQUE REFERENCES retail.orders(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, request_id)
);
