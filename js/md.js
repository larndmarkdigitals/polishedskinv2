/* ============================================================
   md.js — tiny Markdown -> HTML renderer for Polished Skin.
   Handles just the subset the CMS rich-text editor produces:
   headings (##, ###), bold (**), italic (* or _), links, bullet &
   numbered lists, and blank-line-separated paragraphs.
   Content is trusted (authored by the owner), so it is not sanitised.
   Exposed as window.PSE_md (and module.exports for tests).
   ============================================================ */
(function (root) {
  function inline(s) {
    return String(s)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/(^|[^_\w])_([^_\n]+)_/g, '$1<em>$2</em>');
  }

  function mdToHtml(src) {
    src = String(src == null ? '' : src).replace(/\r\n?/g, '\n').trim();
    if (!src) return '';
    return src.split(/\n{2,}/).map(function (block) {
      var lines = block.split('\n');
      var h = lines[0].match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        var lvl = h[1].length;
        var out = '<h' + lvl + '>' + inline(h[2].trim()) + '</h' + lvl + '>';
        var rest = lines.slice(1).join('\n').trim();
        if (rest) out += '<p>' + inline(rest.replace(/\n/g, ' ')) + '</p>';
        return out;
      }
      if (lines.every(function (l) { return /^\s*[-*]\s+/.test(l); })) {
        return '<ul>' + lines.map(function (l) {
          return '<li>' + inline(l.replace(/^\s*[-*]\s+/, '').trim()) + '</li>';
        }).join('') + '</ul>';
      }
      if (lines.every(function (l) { return /^\s*\d+\.\s+/.test(l); })) {
        return '<ol>' + lines.map(function (l) {
          return '<li>' + inline(l.replace(/^\s*\d+\.\s+/, '').trim()) + '</li>';
        }).join('') + '</ol>';
      }
      return '<p>' + inline(block.replace(/\n/g, ' ').trim()) + '</p>';
    }).join('\n');
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = mdToHtml;
  if (root) root.PSE_md = mdToHtml;
})(typeof window !== 'undefined' ? window : null);
