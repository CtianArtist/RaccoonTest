import { createHash, randomBytes } from "node:crypto";
import { clerkClient } from "@clerk/express";
import { pool } from "@workspace/db";
import { categories, discussions } from "./community-content.mjs";
import { catalog } from "./catalog";
import { logger } from "../lib/logger";

function stableId(key: string) {
  const h = createHash("sha256").update(`raccoon-retail-fixture:${key}`).digest("hex").slice(0, 32);
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
export async function seedDevelopment() {
  // The application's product inventory exists independently of the payment provider.
  // Fictional checkout uses this inventory without a payment provider.
  for (const [index, item] of catalog.entries())
    await pool.query(`INSERT INTO retail.products(id,slug,name,description,price_cents,image,category,sizes,featured,badge)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(slug) DO NOTHING`,
      [`rsc_${item.slug}`, item.slug, item.name, item.description, item.price, item.image || `/products/${item.slug}.png`,
        item.category, JSON.stringify(item.sizes || ["One size"]), index === 0 || index >= 7 && index <= 9, item.badge || null]);
  if (process.env.NODE_ENV === "production") return;
  const authors: Record<string, string> = {};
  for (const name of ["Alice", "Bob", "Morgan"]) {
    const email = `${name.toLowerCase()}+clerk_test@example.com`;
    let identity: string | null = null;
    if (name !== "Morgan") {
      const existing = await clerkClient.users.getUserList({ emailAddress: [email] });
      const user = existing.data[0] || await clerkClient.users.createUser({
        firstName: name, emailAddress: [email], password: randomBytes(32).toString("base64url"),
      });
      identity = user.id;
    }
    const id = identity || `rsc_author_${name.toLowerCase()}`;
    authors[name] = id;
    await pool.query(`INSERT INTO retail.customers(id,clerk_id,display_name,email)
      VALUES($1,$2,$3,$4) ON CONFLICT(id) DO NOTHING`, [id, identity, name, email]);
  }
  for (const c of categories)
    await pool.query(`INSERT INTO retail.categories(slug,name,description) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,
      [c.slug, c.name, `Customer experiences and practical questions about ${c.name.toLowerCase()}.`]);
  for (const d of discussions) {
    const id = stableId(`discussion-${d.slug}`);
    await pool.query(`INSERT INTO retail.discussions(id,slug,title,category,body,author_id,approved,created_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,true,$7,$8) ON CONFLICT DO NOTHING`,
      [id, d.slug, d.title, d.category, d.body, authors[d.author], d.createdAt, d.updatedAt]);
    for (const [i, reply] of d.replies.entries())
      await pool.query(`INSERT INTO retail.replies(id,discussion_id,author_id,body,hidden,created_at)
        VALUES($1,$2,$3,$4,false,$5) ON CONFLICT DO NOTHING`,
        [stableId(`reply-${d.slug}-${i}`), id, authors[reply.author], reply.body, reply.createdAt]);
  }
  const fixtures = [
    { number: "RSC1001", owner: "Alice", slug: "trailblazer-backpack", status: "Delivered" },
    { number: "RSC1002", owner: "Bob", slug: "stormwatch-shell-jacket", status: "Shipped" },
    { number: "RSC1003", owner: "Alice", slug: "raccoon-ridge-lantern", status: "Processing" },
    { number: "RSC1004", owner: "Bob", slug: "campfire-fleece", status: "Delivered" },
  ];
  for (const fixture of fixtures) {
    const id = stableId(fixture.number), item = catalog.find(p => p.slug === fixture.slug)!;
    const shipping = item.price >= 7500 ? 0 : 695;
    await pool.query(`INSERT INTO retail.orders(id,number,user_id,status,subtotal_cents,shipping_cents,total_cents,
      delivered_at,carrier,tracking_number,synthetic,created_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,CASE WHEN $4='Delivered' THEN now()-interval '7 days' ELSE NULL END,
      'Raccoon sandbox carrier',$8,true,now()-interval '12 days') ON CONFLICT DO NOTHING`,
      [id, fixture.number, authors[fixture.owner], fixture.status, item.price, shipping, item.price + shipping, `SIM-${fixture.number}`]);
    await pool.query(`INSERT INTO retail.order_items(id,order_id,slug,name,price_cents,quantity,size,image)
      VALUES($1,$2,$3,$4,$5,1,$6,$7) ON CONFLICT DO NOTHING`,
      [stableId(fixture.number + "-item"), id, item.slug, item.name, item.price, item.sizes?.includes("M") ? "M" : "One size",
        item.image || `/products/${item.slug}.png`]);
    for (const [i, status] of ["Processing", ...(fixture.status === "Processing" ? [] : ["Packed", "Shipped"]),
      ...(fixture.status === "Delivered" ? ["Out for delivery", "Delivered"] : [])].entries())
      await pool.query(`INSERT INTO retail.shipping_events(id,order_id,status,description,created_at)
        VALUES($1,$2,$3,$4,now()-interval '12 days'+$5*interval '1 day') ON CONFLICT DO NOTHING`,
        [stableId(fixture.number + "-event-" + i), id, status, `${status} — synthetic carrier update.`, i]);
  }
  for (const name of ["Alice", "Bob"])
    await pool.query(`INSERT INTO retail.tickets(id,user_id,subject,description,category)
      VALUES($1,$2,$3,$4,'Product') ON CONFLICT DO NOTHING`, [stableId(`ticket-${name}`), authors[name],
      name === "Alice" ? "Backpack strap adjustment" : "Shell jacket layering question",
      name === "Alice" ? "How should I adjust the hip belt on my Trailblazer backpack for a comfortable fit?" :
        "Could you help me choose a fleece layer that fits comfortably beneath my shell jacket?"]);
  logger.info("Synthetic Alice/Bob account histories and preserved public discussions seeded; no passwords logged");
}
