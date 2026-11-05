"""Crawler-readable public forum; customer text is escaped, never instructions."""
import html
import math
from fastapi import APIRouter, Request, Query, HTTPException
from fastapi.responses import HTMLResponse, Response, RedirectResponse
from .db import rows
from .community import category_list, discussion_list, discussion_view, visible_discussion
from .security import proof

router = APIRouter()
WIDGET = """<!-- Start of raccoonsupplyco Zendesk Widget script -->
<script id="ze-snippet" src="https://static.zdassets.com/ekr/snippet.js?key=04e6e9d0-c8e2-46d7-85ae-d6353a2f75f0"> </script>
<!-- End of raccoonsupplyco Zendesk Widget script -->"""
STYLE = """:root{--ink:#173d3e;--green:#24705f;--paper:#f7f4ec;--line:#d9ddd4}*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 system-ui,sans-serif}a{color:var(--green);text-underline-offset:4px}
.shell{width:min(1120px,92%);margin:auto}header,footer{border-block:1px solid var(--line)}nav{display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap;padding:22px 0}.brand{font:bold 25px Georgia,serif;text-decoration:none;color:var(--ink)}
.links{display:flex;gap:20px;flex-wrap:wrap;font-size:14px}main{padding:54px 0 80px;min-height:65vh}h1,h2,h3{font-family:Georgia,serif;line-height:1.12}h1{font-size:clamp(36px,5vw,60px);letter-spacing:-1.5px;margin:15px 0 25px}h2{font-size:28px}
.notice{padding:16px 20px;background:#e7eee7;border:1px solid var(--line);border-radius:12px;font-size:14px;margin:24px 0}
.post{padding:24px;border:1px solid var(--line);background:#fffdf7;border-radius:16px;margin:20px 0}.body{white-space:pre-wrap;overflow-wrap:anywhere}.meta{font-size:13px;color:#596c68}.tag{padding:5px 10px;border-radius:20px;background:#e7eee7;display:inline-block;margin:4px;font-size:12px}
input,button{font:inherit;padding:12px;border-radius:8px;border:1px solid var(--line)}button,.button{background:var(--green);color:white;cursor:pointer;padding:12px 20px;text-decoration:none;border-radius:8px}footer{padding:26px 0}.eyebrow{text-transform:uppercase;font-size:11px;letter-spacing:2px}form{display:flex;gap:10px;flex-wrap:wrap}input{flex:1;min-width:0}"""
e = html.escape
def page(title, body, path="/community/"):
    return HTMLResponse(f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"><title>{e(title)} | Raccoon Supply Co.</title>
    <meta name="description" content="{e(title)} — customer experiences and practical questions from the Raccoon Supply community.">
    <meta property="og:title" content="{e(title)} | Raccoon Supply Co."><meta property="og:type" content="website">
    <style>{STYLE}</style></head><body><header><nav class="shell"><a class="brand" href="/">Raccoon Supply Co.</a>
    <div class="links"><a href="/shop">Shop</a><a href="/community/">Community</a><a href="/community/knowledge/">Community knowledge</a><a href="/help">Official help</a><a href="/support">My support</a><a href="/account">Account</a></div></nav></header>
    <main class="shell"><p class="eyebrow">Gather around · Questions from the field</p><h1>{e(title)}</h1>
    <div class="notice"><strong>Customer-generated community content.</strong> Posts and replies are individual experiences, not official company policy.
    For shipping, returns and warranty terms, use the official help pages. Do not share private order numbers, addresses or account details here.</div>
    {body}</main><footer><div class="shell">Raccoon Supply Co. · <a href="/returns-policy">Return policy</a> · <a href="/privacy">Privacy</a> · <a href="/contact">Contact the desk</a></div></footer>{WIDGET}</body></html>""")

def cards(items):
    return "".join(f"""<article class="post"><span class="tag">{e(d['category'].replace('-',' ').title())}</span>
      <h2><a href="/community/discussions/{e(d['slug'])}/">{e(d['title'])}</a></h2>
      <p class="body">{e(d['body'][:250])}</p><p class="meta">By {e(d['authorName'])} · Updated {e(d['updatedAt'][:10])} · {len(d['replies'])} replies</p></article>""" for d in items)

@router.get("/community/new")
@router.get("/community/new/")
def compose():
    return RedirectResponse("/#/community/new")

@router.get("/community")
@router.get("/community/")
@router.get("/community/discussions/")
@router.get("/community/search/")
def listing(q: str = "", category: str = "", page_number: int = Query(default=1, alias="page", ge=1, le=1000)):
    result = discussion_list(q, category, page_number)
    tags = "".join(f'<a class="tag" href="/community/categories/{e(c["slug"])}/">{e(c["name"])} ({c["count"]})</a>' for c in category_list())
    body = f"""<p>Practical questions, product experiences and advice from fellow customers.</p>{tags}
      <form action="/community/search/" method="get"><input type="search" name="q" aria-label="Search discussions" value="{e(q)}" placeholder="Search the community"><button>Search</button></form>
      <p><a class="button" href="/#/community/new">Start a discussion</a> · <a href="/account/community">Your posting history</a></p>{cards(result['items'])}"""
    if not result["items"]:
        body += "<p>No matching discussions yet. Try a different search.</p>"
    for i in range(1, result["pages"] + 1):
        from urllib.parse import urlencode
        body += f'<a class="tag" href="/community/?{e(urlencode({"q":q,"category":category,"page":i}))}">Page {i}</a>'
    return page(f"Raccoon Supply Community · Page {page_number}", body)

@router.get("/community/discussions/page/{number}/")
def page_number(number: int):
    if number < 1 or number > 1000:
        raise HTTPException(404)
    return listing("", "", number)

@router.get("/community/categories/{slug}/")
def category(slug: str):
    item = next((c for c in category_list() if c["slug"] == slug), None)
    if not item:
        raise HTTPException(404)
    return page(item["name"], f'<p>{e(item["description"])}</p>' + cards(discussion_list(category=slug)["items"]))

@router.get("/community/knowledge/")
def knowledge():
    items = rows("SELECT * FROM retail.discussions WHERE approved=true ORDER BY updated_at DESC")
    body = "<p>This index contains only moderated customer experiences. It is not an official policy source.</p>"
    for item in items:
        d = discussion_view(item)
        body += f'<article class="post"><h2><a href="/community/discussions/{e(d["slug"])}/">{e(d["title"])}</a></h2><p class="body">{e(d["body"])}</p>'
        for reply in d["replies"]:
            body += f'<p class="body"><strong>{e(reply["authorName"])}:</strong> {e(reply["body"])}</p>'
        body += "</article>"
    return page("Community knowledge index", body)

@router.get("/community/discussions/{slug}")
@router.get("/community/discussions/{slug}/")
def thread(slug: str):
    # Private/pending discussion bodies never enter a crawler-readable response.
    d = discussion_view(visible_discussion(slug))
    body = f'<article class="post"><p class="meta">By {e(d["authorName"])} · {e(d["createdAt"][:10])} · Updated {e(d["updatedAt"][:10])}</p><p class="body">{e(d["body"])}</p></article><h2>Replies</h2>'
    for reply in d["replies"]:
        body += f'<article class="post"><p class="meta">{e(reply["authorName"])} · {e(reply["createdAt"][:10])}</p><p class="body">{e(reply["body"])}</p></article>'
    body += f'<p><a class="button" href="/#/community/discussions/{e(slug)}">Join the discussion</a></p>'
    return page(d["title"], body)

@router.get("/robots.txt")
def robots():
    return Response("User-agent: *\nAllow: /community/\nDisallow: /api/\nDisallow: /account/\nDisallow: /support/\nDisallow: /admin/\nDisallow: /checkout/\n", media_type="text/plain")

@router.get("/sitemap.xml")
def sitemap(request: Request):
    origin = proof(request)["origin"]
    paths = ["/", "/shop", "/help", "/returns-policy", "/community/", "/community/knowledge/"]
    paths += ["/community/categories/" + c["slug"] + "/" for c in category_list()]
    paths += ["/community/discussions/" + d["slug"] + "/" for d in rows("SELECT slug FROM retail.discussions WHERE approved=true")]
    locations = "".join(f"<url><loc>{e(origin + p)}</loc></url>" for p in paths)
    return Response(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{locations}</urlset>', media_type="application/xml")
