import json
from fastapi import APIRouter, HTTPException
from .db import rows

router = APIRouter()

def products():
    result = rows("SELECT * FROM retail.products ORDER BY name")
    output = []
    for item in result:
        output.append({"id": item["id"], "slug": item["slug"], "name": item["name"],
            "description": item["description"], "priceCents": item["price_cents"],
            "image": item["image"], "category": item["category"],
            "featured": item["featured"], "sizes": item["sizes"],
            "badge": item["badge"]})
    return output

@router.get("/products")
def list_products(category: str = "", q: str = ""):
    return [{k: v for k, v in p.items() if not k.startswith("_")} for p in products()
            if (not category or p["category"].lower() == category.lower())
            and (not q or q.lower() in (p["name"] + p["description"]).lower())]

@router.get("/products/{slug}")
def get_product(slug: str):
    item = next((p for p in products() if p["slug"] == slug), None)
    if not item:
        raise HTTPException(404, "Product not found")
    return {k: v for k, v in item.items() if not k.startswith("_")}
