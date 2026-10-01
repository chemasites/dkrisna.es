# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: people from Caravaca de la Cruz and nearby towns who already know D'Krisna and come back regularly. They open the site on their phone to check a price, a duration, or the hours, then book the service on Booksy.

Secondary: new local clients who found the salon on Google or Instagram, and English-speaking visitors who use the English version. Neither audience is the main design target.

## Product Purpose

Marketing and booking site for D'Krisna, a nail, beauty and massage salon in Caravaca de la Cruz (Murcia, Spain). It lists every service with its current price and duration, links each one to its Booksy booking widget, and gives the address, hours and contact channels.

Success means a returning client goes from landing to the right Booksy booking with no friction, and a first-time visitor trusts the salon enough to book.

## Positioning

Four confirmed differentiators:

- Nails, brows and lashes, massages, facials and wood therapy under one roof, with a nail team and a massage therapist.
- Careful nail work and nail art.
- A calm visit with personal attention and a focus on wellbeing.
- Convenient: open Monday to Saturday, 09:00 to 21:00, with online booking.

## Operating Context

- Bookings happen on Booksy (external). The site deep-links each service with `?do=open-widget&variantId=<id>`.
- Services, prices and reviews sync weekly from the public Booksy profile through GitHub Actions. They live in `static/data/services.json`, `services.en.json` and `booksy-reviews.json`. Never hardcode prices or reviews.
- Contact channels: phone +34 722 27 59 75, WhatsApp, email dkrisnanails@gmail.com, Instagram, Facebook, TikTok.
- Address: Carretera de Murcia, 45, 30400 Caravaca de la Cruz, Murcia. Sunday closed.

## Capabilities and Constraints

- Zola 0.23 static site with Tera v2 templates and SCSS, deployed to GitHub Pages on push to `main`.
- Bilingual: Spanish (default, `/`) and English (`/en/`). Every page and UI string exists in both languages, and UI text goes through `trans()`.
- Pages: home, manicura (hands, feet, brows and lashes), masajes (massages, facials, wood therapy, wood therapy packs), team, location, legal, 404.
- Service categories and the number of services change with Booksy data, so layouts must handle varying counts.
- Local SEO is a requirement: JSON-LD (BeautySalon, Service, BreadcrumbList), hreflang, and Caravaca de la Cruz keywords in the copy.
- Redesign scope: the landing page first, as one shippable slice. Other pages follow in later changes.

## Brand Commitments

- Name: D'Krisna (Booksy listing "D'Krisna Nails"). Instagram handle `d_krisnanails`.
- The current logo (`static/images/logo.webp`) is fixed: keep it as is.
- The site is about manicure and massages in Caravaca de la Cruz. That identity leads every page; the home headline stays "Manicura y masajes en Caravaca de la Cruz" / "Manicure and massages in Caravaca de la Cruz".
- Never name or reference the Caballos del Vino festival or religious imagery, even when a visual direction borrows embroidery craft.
- Keep the current visual identity: light pages, the logo's pink, Cormorant Garamond with Montserrat, rounded buttons. Improve it in place. A dark, gold, embroidered redesign was tried and rejected (2026-10-01) as too heavy, kitsch, and off-brand.

## Evidence on Hand

- Real Booksy reviews: rating 5/5 from 32 reviews, with 16 review texts in `static/data/booksy-reviews.json`.
- Real work photos exist: 4 in `static/images/gallery/`, and the user has more (for example from Instagram) to supply.
- Service photos in `static/images/services/`, a hero image, and an about image.
- Team: Deyanira (manicurist), Nazareth (manicurist) and Carlos (massage therapist). No team portraits; the site uses silhouettes. Salon interior photos: none confirmed. Do not invent portraits, interior shots, testimonials, awards or years in business.

## Product Principles

1. Booking first: every path ends in the right Booksy booking in as few taps as possible.
2. Mobile-first for a returning local: prices, durations, hours and contact are always one glance away.
3. Show the real work: real nail photos and real Booksy reviews carry the trust, never stock imagery or invented claims.
4. One salon, two crafts: nails and body treatments are presented as one place, not two separate businesses.
5. Equal bilingual quality: Spanish leads, and English is complete, not an afterthought.
