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
