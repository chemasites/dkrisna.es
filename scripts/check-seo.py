"""Check the built site against its Booksy sources before publishing.

Run after `zola build`: python3 scripts/check-seo.py [output-directory]
"""

import json
import re
import sys
from decimal import Decimal
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "public"


class Document(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.links = []
        self.schemas = []
        self.ids = set()
        self.robots = []
        self.meta = {}
        self.text = []
        self.hidden = False
        self.h1_count = 0
        self.review_count = 0
        self.json_text = None
        self.feed(text)

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag in ("script", "style"):
            self.hidden = True
        if tag == "h1":
            self.h1_count += 1
        if tag == "article" and "review-card" in attrs.get("class", "").split():
            self.review_count += 1
        if tag == "meta":
            self.meta[attrs.get("name", attrs.get("property"))] = attrs.get("content")
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if tag in ("link", "a"):
            self.links.append(attrs)
        if tag == "meta" and attrs.get("name") == "robots":
            self.robots.append(attrs["content"])
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self.json_text = ""

    def handle_data(self, text):
        if not self.hidden:
            self.text.append(text)
        if self.json_text is not None:
            self.json_text += text

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.hidden = False
        if tag == "script" and self.json_text is not None:
            data = json.loads(self.json_text)
            self.schemas.extend(data.get("@graph", [data]))
            self.json_text = None


def check_values(value):
    if isinstance(value, dict):
        for key, item in value.items():
            if key in ("url", "@id", "item", "image", "logo") and isinstance(item, str):
                assert urlparse(item).scheme == "https" and urlparse(item).netloc, item
                assert not re.search(r"&(?:#\w+|amp);", item), item
            check_values(item)
    elif isinstance(value, list):
        for item in value:
            check_values(item)


pages = {}
for file in sorted(PUBLIC.rglob("*.html")):
    path = "/" + str(file.relative_to(PUBLIC)).removesuffix("index.html")
    doc = Document(file.read_text())
    if file.name == "404.html":
        assert len(doc.robots) == 1 and "noindex" in doc.robots[0]
        assert not doc.schemas
        continue
    assert len(doc.robots) == 1 and "noindex" not in doc.robots[0], path
    assert doc.h1_count == 1, path
    assert doc.meta.get("description") == doc.meta.get("og:description") == doc.meta.get("twitter:description"), path
    assert doc.meta.get("og:title") == doc.meta.get("twitter:title"), path
    canonical = [a["href"] for a in doc.links if a.get("rel") == "canonical"]
    assert len(canonical) == 1 and urlparse(canonical[0]).path == path, (path, canonical)
    check_values(doc.schemas)
    assert sum(s.get("@type") == "BeautySalon" for s in doc.schemas) == 1, path
    assert not any("aggregateRating" in s or "review" in s or s.get("@type") == "FAQPage" for s in doc.schemas), path
    pages[path] = doc

for lang, prefix in (("es", "/"), ("en", "/en/")):
    source = ROOT / "static/data" / ("services.json" if lang == "es" else "services.en.json")
    categories = json.loads(source.read_text())["categories"]
    reviews = json.loads((ROOT / "static/data/booksy-reviews.json").read_text())
    home = pages[prefix]
    assert home.review_count == len(reviews["reviews"]), "Reviews missing from initial HTML"
    home_text = " ".join(" ".join(home.text).split())
    assert "{count}" not in home_text
    for review in reviews["reviews"]:
        assert " ".join(review["text"].split()) in home_text, "Review text differs from source"
    for slug, filters in (("manicura", ["manos", "pies", "cejas-pestanas"]),
                          ("masajes", ["masajes", "faciales", "maderoterapia", "bonos-maderoterapia"])):
        doc = pages[prefix + slug + "/"]
        actual = {s["name"]: s for s in doc.schemas if s.get("@type") == "Service"}
        expected = [s for c in categories if c["id"] in filters for s in c["services"] if s.get("variantId")]
        assert len(actual) == len(expected), (lang, slug)
        for service in expected:
            schema = actual[service["name"]]
            offer = schema["offers"]
            assert Decimal(offer["price"]) == Decimal(service["price"].replace(".", "").replace(",", ".").replace(" €", ""))
            assert offer["priceCurrency"] == "EUR"
            assert offer["url"].endswith("?do=open-widget&variantId=" + str(service["variantId"]))
            assert any(a.get("href") == offer["url"] for a in doc.links)
            assert urlparse(schema["url"]).fragment in doc.ids
            if service.get("description"):
                assert schema.get("description") == service["description"], "Description serialization changed the source"

sitemap = ElementTree.parse(PUBLIC / "sitemap.xml")
locations = sitemap.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
assert {urlparse(loc.text).path for loc in locations} == set(pages), "Sitemap differs from published pages"
for path, doc in pages.items():
    for link in doc.links:
        if link.get("hreflang"):
            assert urlparse(link["href"]).path in pages, (path, link)
            if link["hreflang"] == "x-default":
                assert urlparse(link["href"]).path == path.replace("/en/", "/"), (path, link)
print(f"SEO checks passed: {len(pages)} pages, sitemap, structured data and bilingual Booksy offers")
