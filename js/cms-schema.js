/* ============================================================
   cms-schema.js — PER-SITE config for the side-panel editor.

   This is the ONLY file that changes per client. The editor engine
   (editor.js) is generic: it reads window.CMS_SCHEMA to know what fields a
   "record" has and which widget to show for each. To reuse the editor on a
   new site, copy editor.js untouched and write one of these.

   A record is marked in the rendered HTML with:
       data-cms-record="<file>.<path.to.object>"   e.g. reviews.reviews.3
       data-cms-type="<type below>"                e.g. review
   Clicking it in edit mode opens the panel with the fields defined here.

   Field widget types:
     text      – one-line input
     textarea  – multi-line input
     stars     – 1–5 star picker (number)
     toggle    – on/off (boolean)
     list      – add/remove list of one-line strings
     hours     – weekly day / time / closed grid (for a business's hours array)
   Optional `default` is used when the field is missing from the data.
   ============================================================ */
window.CMS_SCHEMA = {
  review: {
    label: 'Review',
    fields: [
      { key: 'name',     label: 'Reviewer name',        type: 'text' },
      { key: 'text',     label: 'Review',               type: 'textarea' },
      { key: 'service',  label: 'Service / treatment',  type: 'text' },
      { key: 'rating',   label: 'Star rating',          type: 'stars',  default: 5 },
      { key: 'verified', label: 'Google verified',      type: 'toggle', default: true },
      { key: 'featured', label: 'Feature on home page', type: 'toggle', default: false }
    ]
  },

  service: {
    label: 'Service',
    fields: [
      { key: 'name',     label: 'Name',                     type: 'text' },
      { key: 'price',    label: 'Price',                    type: 'text' },
      { key: 'duration', label: 'Duration',                 type: 'text' },
      { key: 'category', label: 'Category',                 type: 'text' },
      { key: 'blurb',    label: 'Short blurb (home card)',  type: 'textarea' },
      { key: 'desc',     label: 'Description (menu)',       type: 'textarea' },
      { key: 'featured', label: 'Feature on home page',     type: 'toggle', default: false }
    ]
  },

  package: {
    label: 'Treatment plan',
    fields: [
      { key: 'name',     label: 'Name',                type: 'text' },
      { key: 'tagline',  label: 'Tagline',             type: 'text' },
      { key: 'desc',     label: 'Description',          type: 'textarea' },
      { key: 'forWho',   label: 'Best for',            type: 'text' },
      { key: 'includes', label: "What's included",     type: 'list' },
      { key: 'note',     label: 'Footnote',            type: 'text' },
      { key: 'popular',  label: 'Mark "Most Popular"', type: 'toggle', default: false }
    ]
  },

  post: {
    label: 'Blog post',
    fields: [
      { key: 'title',    label: 'Title',               type: 'text' },
      { key: 'tag',      label: 'Tag / category',      type: 'text' },
      { key: 'excerpt',  label: 'Excerpt (blog card)', type: 'textarea' },
      { key: 'body',     label: 'Body (Markdown)',     type: 'textarea' },
      { key: 'date',     label: 'Date',                type: 'text' },
      { key: 'readTime', label: 'Read time',           type: 'text' },
      { key: 'slug',     label: 'URL slug (web address)', type: 'text' }
    ]
  },

  galleryPhoto: {
    label: 'Photo',
    fields: [
      { key: 'treatment', label: 'Caption (words under the photo)', type: 'text' }
    ]
  },

  beforeAfter: {
    label: 'Before / After',
    fields: [
      { key: 'treatment', label: 'Caption', type: 'text' }
    ]
  },

  partner: {
    label: 'Partner brand',
    fields: [
      { key: 'name', label: 'Brand name', type: 'text' }
    ]
  },

  business: {
    label: 'Business info',
    fields: [
      { key: 'name',         label: 'Business name',       type: 'text' },
      { key: 'phone',        label: 'Phone',               type: 'text' },
      { key: 'addressLine',  label: 'Street address',      type: 'text' },
      { key: 'cityStateZip', label: 'City, State ZIP',     type: 'text' },
      { key: 'hours',        label: 'Weekly hours',        type: 'hours' }
    ]
  }
};

/* ============================================================
   CMS_MEDIA — the Photos grid registry (per-site, like CMS_SCHEMA).
   Lists every image on the site with a label. The editor's "🖼 Photos"
   view builds a tile per entry (collections expand one tile per item;
   {name}/{title}/{n} are filled from the content).

   dropboxAppKey: paste a Dropbox app key to enable "Choose from Dropbox"
   (create a free app at dropbox.com/developers, add this site's domain
   under the app's Chooser/Saver domains). Leave '' to hide Dropbox.
   ============================================================ */
window.CMS_MEDIA = {
  dropboxAppKey: '',
  // aspect = frame width/height, used by the crop tool (matches the CSS frames).
  fields: [
    { key: 'home.hero.img',        label: 'Homepage — hero photo', aspect: 4 / 5 },
    { key: 'home.about.img',       label: 'Homepage — clinic photo', aspect: 4 / 5 },
    { key: 'home.results.beforeImg', label: 'Homepage — before/after: Before', aspect: 4 / 5 },
    { key: 'home.results.afterImg',  label: 'Homepage — before/after: After', aspect: 4 / 5 },
    { key: 'about.clinicPhoto',  label: 'About page — clinic photo', aspect: 4 / 5 },
    { collection: 'services.services',     imgKey: 'img', label: 'Service: {name}', aspect: 3 / 2 },
    { collection: 'treatments.treatments', imgKey: 'img', label: 'Treatment: {name}', aspect: 2 / 1 },
    { collection: 'posts.posts',           imgKey: 'img', label: 'Blog: {title}', aspect: 16 / 10 },
    { collection: 'gallery.gallery',       imgKey: 'img', label: 'Gallery #{n}', aspect: 1 },
    { pairCollection: 'gallery.beforeAfter', keys: ['before', 'after'], label: 'Before/After #{n}', aspect: 3 / 4 }
  ]
};

/* ============================================================
   CMS_COLLECTIONS — the JSON array paths that support add / delete / reorder
   (edited as whole arrays). Must match the data-cms-record paths your
   content.js stamps AND the arrays your applyDraftCollections() overlays.
   ============================================================ */
window.CMS_COLLECTIONS = [
  'reviews.reviews',
  'services.services',
  'packages.packages',
  'posts.posts',
  'gallery.gallery',
  'gallery.beforeAfter',
  'home.partners.items'
];
