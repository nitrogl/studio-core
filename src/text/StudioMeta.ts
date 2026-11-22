/**
 * The layout and the view state of the diagram, kept in a comment of the
 * model.
 *
 * Stores what only the studio needs (where lanes and blocks are, which
 * messages the user linked by hand, which roles are shown mirrored) in a
 * comment at the end of the model, which backends would ignore,
 * opened by the id of the application (StudioCore.app.id), here piestudio:
 *
 *   (* piestudio: {
 *   "lanes":{"R:A":{"x":40,"y":0}},
 *   "blocks":{"R:A#out:out(c, m)#0":{"dx":0,"dy":24}}
 *   } *)
 *
 * The comment is written with the delimiters of the language
 * (StudioCore.app.comment); with a comment that ends with its line, such
 * as "//", the JSON is on that one line.
 *
 * The text stays the single source of truth, and undo
 * covers moves in the diagram like any other edit.
 *
 * @author Roberto Metere
 * @license MIT
 */
class StudioMeta {
  /**
   * @return {string} The marker that opens the metadata comment: the id of
   *   the application and a colon.
   */
  static tag(): string {
    return StudioCore.app.id + ":";
  }

  /**
   * @param {string} text A text.
   * @return {string} The text, as a regular expression that matches it.
   */
  static escape(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
  }

  /**
   * @return {string} The pattern of the opening of the metadata comment.
   */
  static opening(): string {
    return StudioMeta.escape(StudioCore.app.comment.open) + "\\s*" + StudioMeta.escape(StudioMeta.tag());
  }
  
  /**
   * @return {RegExp} The pattern of the metadata comment (the JSON is in
   *   group 1).
   */
  static pattern(): RegExp {
    return new RegExp("^" + StudioMeta.opening() + "\\s*([\\s\\S]*?)\\s*" + StudioMeta.escape(StudioCore.app.comment.close) + "$");
  }
  
  /**
   * Tells whether a comment is the metadata comment.
   *
   * @param {string} text The comment.
   * @return {boolean} True when it is.
   */
  static isMeta(text: string): boolean {
    return new RegExp("^" + StudioMeta.opening()).test(text);
  }
  
  /**
   * Finds the metadata comment among the comments of a model
   * (the last one wins).
   * 
   * TODO: think if changing behaviour is better
   *
   * @param {Array} comments The comments of the model, [{text, start, end}].
   * @return {Object} {value, range} where range is [start, end] or null.
   */
  static read(comments: any[]) {
    let found = null;
    for (const c of comments || []) {
      const m = c.text.match(StudioMeta.pattern());
      if (!m) continue;
      
      let value = {};
      try {
        value = JSON.parse(m[1]);
      } catch (e) {
        value = {};
      }
      
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        value = {};
      }
      found = { value, range: [c.start, c.end] };
    }
    return found || { value: {}, range: null };
  }
  
  /**
   * Tells whether a metadata object carries nothing.
   *
   * @param {Object} meta The object.
   * @return {boolean} True when every entry is empty.
   */
  static isEmpty(meta: any): boolean {
    if (!meta) {
      return true;
    }
    
    return Object.keys(meta).every(k => {
      const v = meta[k];
      if (v === null || v === undefined || v === false) {
        return true;
      }
      if (Array.isArray(v)) {
        return v.length === 0;
      }
      if (typeof v === "object") {
        return Object.keys(v).length === 0;
      }
      return false;
    });
  }
  
  /**
   * Renders a metadata object as the metadata comment, one top-level entry per line.
   *
   * @param {Object} meta The object.
   * @return {Object} The comment text, or '' for empty metadata.
   */
  static format(meta: any) {
    if (StudioMeta.isEmpty(meta)) {
      return "";
    }
    
    const keys = Object.keys(meta).filter(k => !StudioMeta.isEmpty({ [k]: meta[k] })).sort();
    const { open, close } = StudioCore.app.comment;
    // The delimiters can only occur inside JSON strings, where I escape their first character
    const unicode = c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0");
    const safe = s => [open, close].filter(d => d).reduce((t, d) => t.split(d).join(unicode(d[0]) + d.slice(1)), s);
    const entries = keys.map(k => safe(JSON.stringify(k) + ":" + JSON.stringify(meta[k])));
    
    if (!close) {
      return open + " " + StudioMeta.tag() + " {" + entries.join(",") + "}";
    }
    
    return open + " " + StudioMeta.tag() + " {\n" + entries.join(",\n") + "\n} " + close;
  }
  
  /**
   * Puts a metadata object into a text, replacing the previous metadata comment.
   *
   * @param {string} text The model.
   * @param {Object} range The range of the previous metadata comment, or null.
   * @param {Object} meta The new object.
   * @return {string} The new text.
   */
  static write(text: string, range: any, meta: any): string {
    const body = StudioMeta.format(meta);
    if (range) {
      let [a, b] = range;
      if (!body) {
        while (a > 0 && /[ \t]/.test(text[a - 1])) {
          a--;
        }
        
        while (a > 0 && /\n/.test(text[a - 1]) && a > 1 && /\n/.test(text[a - 2])) {
          a--;
        }
        
        if (a > 0 && text[a - 1] === "\n") {
          a--;
        }
        
        while (b < text.length && /[ \t]/.test(text[b])) {
          b++;
        }
      }
      return text.slice(0, a) + body + text.slice(b);
    }
    
    if (!body) {
      return text;
    }
    
    
    return text.replace(/\s*$/, "") + "\n\n" + body + "\n";
  }
  
  /**
   * Renames a lane in the metadata: its place, the offsets and links of its
   * blocks, its mirror.
   *
   * @param {Object} meta The metadata.
   * @param {number} from The old id of the lane (R:Name).
   * @param {number} to The new id.
   * @return {Object} The new metadata.
   */
  static renameLane(meta: any, from: string, to: string) {
    if (!meta || from === to) {
      return meta;
    }
    
    const key = k => {
      if (k === from) {
        return to;
      }
      
      if (k.startsWith(from + "#")) {
        return to + k.slice(from.length);
      }
      
      if (k === "mirror:" + from) {
        return "mirror:" + to;
      }
      
      if (k.startsWith("mirror:" + from + "#")) {
        return "mirror:" + to + k.slice(from.length + 7);
      }
      
      return k;
    };
    
    const obj = o => (o ? Object.fromEntries(Object.entries(o).map(([k, v]) => [key(k), v])) : o);
    const out = { ...meta };
    
    if (meta.lanes) {
      out.lanes = obj(meta.lanes);
    }
    
    if (meta.blocks) {
      out.blocks = obj(meta.blocks);
    }
    
    if (meta.links) {
      out.links = meta.links.map(l => ({ ...l, from: key(l.from), to: key(l.to) }));
    }
    
    if (meta.nolink) {
      out.nolink = meta.nolink.map(key);
    }
    
    if (meta.symmetric) {
      out.symmetric = meta.symmetric.map(key);
    }
    
    return out;
  }
  
  /**
   * Removes the metadata comment from a text (for the files given to the
   * verifier).
   *
   * @param {string} text The model.
   * @return {string} The text without the metadata comment.
   */
  static strip(text: string): string {
    const close = StudioCore.app.comment.close;
    const rest = close ? "[\\s\\S]*?" + StudioMeta.escape(close) : "[^\\n]*";
    
    return text.replace(new RegExp("\\n*[ \\t]*" + StudioMeta.opening() + rest + "[ \\t]*", "g"), "\n").replace(/\n{3,}$/, "\n\n");
  }
}
// ----------------------------------------------------------------
