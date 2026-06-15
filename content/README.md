# Editing your website content

The site's text, services, prices, reviews, blog posts, FAQ, and photo captions
live as data files in this `content/` folder, in a format called **JSON**.
Editing these files changes the site — no need to touch any page code.

> **Coming soon:** a friendly admin editor at `/admin` so you can change all of
> this from simple web forms instead of editing JSON by hand. Until that's set
> up, this guide covers editing the files directly.

## Before you start: how to view the site

The site loads this content behind the scenes, which means **you can't just
double-click an `.html` file anymore** — the browser will block it and the page
will look empty. View the site through a web address instead:

- The **live site** (once hosted), or
- A **local preview**: open a terminal in the `polishedskinv2/` folder, run
  `python3 -m http.server 8000`, then visit `http://localhost:8000`.

## What each file controls

| File | Controls | Shows up on |
|------|----------|-------------|
| `services.json` | Treatments, prices, durations, descriptions, categories | Home (featured cards) + Services page |
| `treatments.json` | In-depth treatment detail pages | "Learn more" treatment pages |
| `packages.json` | Treatment plans (curated series) | Packages page |
| `reviews.json` | Client testimonials | Home (featured) + Reviews page |
| `posts.json` | Blog articles | Blog page + each article page |
| `faq.json` | Frequently asked questions | FAQ section |
| `gallery.json` | Before/after pairs + photo grid | Reviews page |

## JSON rules (read this first)

JSON is stricter than a normal document — a single typo can break the file, so:

- Wrap **all** text in straight double quotes: `"like this"`.
- Separate items with commas, but **never put a comma after the last** item in a
  list `[ ]` or block `{ }`.
- **No comments** are allowed in the file.
- To use a `"` inside your text, write `\"` (a backslash first). To start a new
  paragraph in long text, use `<p>...</p>` rather than pressing Enter.
- When you're done, paste the whole file into <https://jsonlint.com> to confirm
  it's valid **before** publishing. If the site goes blank, a JSON typo is
  almost always why.

## Field reference

### services.json
Shape: `{ "categories": [ … ], "services": [ … ] }`

**categories** — the groupings on the Services page:
- `name` — category title (e.g. `"Signature Facials"`)
- `sub` — one-line description under the title

**services** — each treatment:
- `name` — the treatment name
- `category` — must exactly match one of the category `name`s above
- `duration` — e.g. `"60 min"`  ·  `price` — e.g. `"$179+"`
- `blurb` — short line on the **home** featured cards
- `desc` — longer line on the **Services** menu
- `featured` — `true` shows it as a card on the home page (pick up to **4**)
- `link` — optional detail page, e.g. `"treatment.html?slug=glo2facial"`
- `img` — `"img/yourphoto.jpg"`, or `""` for the teal sparkle placeholder

### treatments.json
Shape: `[ … ]` — one block per "Learn more" detail page.
- `slug` — web name (letters/dashes), **must be unique**; the link is
  `treatment.html?slug=THIS`
- `name` — page heading  ·  `tagline` — one line under it  ·  `price`
- `facts` — quick-facts strip: `{ duration, downtime, series, bestFor }`
  (and optional `suitableFor`)
- `lead` — opening paragraph (plain text; `<br>` allowed)
- `sections` — `[ { "h": "Heading", "body": "<p>HTML…</p>" } ]`
- `benefits` — bullet list; `benefitsTitle` optionally names that list
- `closingSections` — same shape as `sections`, shown after the benefits
- `img` — photo path, or `""` for the placeholder

### packages.json
Shape: `[ … ]` — one block per treatment plan.
- `name` · `tagline` · `forWho` · `desc`
- `includes` — list of what's in the plan
- `note` — pricing/scheduling note (e.g. `"Series of 3"`)
- `popular` — `true` adds a "Most Popular" ribbon

### reviews.json
Shape: `[ … ]` — first 3 show on the home page; all show on the Reviews page.
- `name` — reviewer (e.g. `"Sarah M."`)  ·  `service` — which treatment
- `text` — the review (no quote marks needed; they're added automatically)
- `featured` — `true` uses it as the big quote (only the first featured is used)

### posts.json
Shape: `[ … ]` — newest first.
- `slug` — unique web name (letters/dashes) → link is `post.html?slug=THIS`
- `title` · `tag` (category label) · `date` · `readTime`
- `excerpt` — 1–2 sentence preview on the blog list
- `body` — the article; write paragraphs in `<p>…</p>`, subheads in `<h2>…</h2>`,
  lists in `<ul><li>…</li></ul>`
- `img` — photo path, or `""` for the placeholder

### faq.json
Shape: `[ … ]` — `q` (question) and `a` (answer; HTML allowed).

### gallery.json
Shape: `{ "beforeAfter": [ … ], "gallery": [ … ] }`
- **beforeAfter** — `treatment`, `before` (photo path or `""`), `after`
- **gallery** — `treatment` (caption) and `img` (photo path or `""`)

## Adding real photos

1. Put the image file in the `img/` folder (e.g. `img/glo2facial.jpg`).
2. Set the relevant `img` field to its path: `"img/glo2facial.jpg"`.
3. Leave `img` as `""` to use the teal sparkle placeholder instead.

Keep photos reasonably small (ideally under ~500 KB) so pages load fast.

## Things still to fill in (search the code for `TODO`)
- Real photos for the hero, About, service cards, before/after, and blog.
- Confirm BioRePeel & Microdermabrasion pricing.
- The studio's direct "Leave a Google Review" link on the Reviews page.
- The ProCell badge link URL on the Home and About pages.

> **Note:** the site is currently hidden from Google (preview mode) until
> launch. See `LAUNCH.md` in the project root for the full go-live checklist.
