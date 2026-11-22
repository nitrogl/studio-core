/**
 * Writes the honest run of a protocol as a TikZ message sequence chart:
 * one lifeline per party, its actions in the notation of
 * the Design mode, and one arrow per message paired by the diagram (dashed
 * on private channels). A party is a lane, or a branch of a parallel
 * composition after the first, which runs on its own. Messages that no
 * party receives, or that come from no party, go to a lifeline of the
 * network.
 * 
 * TODO try msc or other packages?
 *
 * @author Roberto Metere
 * @license MIT
 */
class TikzWriter {
  /**
   * Distance between two lifelines, in centimetres.
   *
   * @type {number}
   */
  static LANE_WIDTH = 4.5;

  /**
   * Distance between two steps, in centimetres.
   *
   * @type {number}
   */
  static STEP = 0.75;

  /**
   * Writes the chart.
   *
   * @param {Object} model The DiagramModel of the model.
   * @param {LatexWriter} writer The writer of formulas.
   * @param {string} fileName The name of the model, for the comment.
   * @return {string} The LaTeX of the picture.
   */
  static write(model: any, writer: any, fileName: string): string {
    const linked = new Set();
    model.links.forEach(link => {
      linked.add(link.from);
      linked.add(link.to);
    });
    const lanes = TikzWriter.parties(model).filter(party => party.root && (party.lane.kind === "macro" || party.lane.kind === "mirror")
      || party.blocks.some(block => linked.has(block.id)));
    const sequences = lanes.map(party => party.blocks);
    const senderOf = new Map(model.links.map(link => [link.to, link.from]));
    // A step for every block: an input waits for the output it receives
    const y = new Map();
    const cursor = lanes.map(() => 0);
    const next = lanes.map(() => 0);
    let progress = true;
    
    while (progress) {
      progress = false;
      sequences.forEach((sequence, i) => {
        while (next[i] < sequence.length) {
          const block = sequence[next[i]];
          const sender = senderOf.get(block.id);
          if (sender && !y.has(sender)) {
            break;
          }
          cursor[i] = Math.max(cursor[i] + 1, sender ? y.get(sender) : 0);
          y.set(block.id, cursor[i]);
          next[i]++;
          progress = true;
        }
      });
    }
    
    const network = sequences.some(sequence => sequence.some(block => 
    (block.kind === "In" || block.kind === "Out") && !linked.has(block.id)));
    const depth = Math.max(1, ...cursor) + 1;
    const x = i => (i*TikzWriter.LANE_WIDTH).toFixed(2);
    const at = step => (-step*TikzWriter.STEP).toFixed(2);
    const math = tex => "$" + TikzWriter.plain(tex) + "$";
    const lines = [
        "% The honest run of " + fileName + ", written by " + StudioCore.app.name + "."
      , "% Needs \\usepackage{tikz} and \\usetikzlibrary{arrows.meta}."
      , "\\begin{tikzpicture}["
      , "    party/.style={draw, rounded corners, minimum width=3cm, minimum height=7mm, font=\\small},"
      , "    action/.style={anchor=west, font=\\scriptsize, inner sep=1.5pt},"
      , "    event/.style={action, draw=green!50!black, rounded corners},"
      , "    table/.style={action, draw=violet, rounded corners},"
      , "    message/.style={-{Latex[length=2mm]}, semithick},"
      , "    private/.style={message, dashed}"
      , "  ]"
    ];
    
    lanes.forEach((party, i) => {
      lines.push("  \\node[party] at (" + x(i) + ", 0) {" + TikzWriter.text(party.title) + "};");
      lines.push("  \\draw[gray] (" + x(i) + ", -0.35) -- (" + x(i) + ", " + at(depth) + ");");
    });
    
    if (network) {
      lines.push("  \\node[party, dashed] at (" + x(lanes.length) + ", 0) {network};");
      lines.push("  \\draw[gray, dashed] (" + x(lanes.length) + ", -0.35) -- (" + x(lanes.length) + ", " + at(depth) + ");");
    }
    
    sequences.forEach((sequence, i) => {
      sequence.forEach(block => {
        const step = y.get(block.id);
        if (step === undefined) {
          return;
        }

        let tex = null;
        try {
          tex = block.kind === "Out" ? writer.term(block.node.msg) : block.kind === "In" ? null : writer.action(block.node);
        } catch (e) {
          tex = null;
        }
        
        if (block.kind === "Out" && !linked.has(block.id)) {
          lines.push("  \\draw[" + (block.private ? "private" : "message") + "] (" + x(i) + ", " + at(step) + ") -- node[above, font=\\scriptsize] {" + math(tex || "") + "} (" + x(lanes.length) + ", " + at(step) + ");");
        } else if (block.kind === "In" && !linked.has(block.id)) {
          lines.push("  \\draw[message] (" + x(lanes.length) + ", " + at(step) + ") -- (" + x(i) + ", " + at(step) + ");");
        } else if (block.kind !== "In" && block.kind !== "Out" && tex) {
          const style = block.kind === "Event" ? "event" : block.kind === "Insert" || block.kind === "Get" ? "table" : "action";
          lines.push("  \\node[" + style + "] at (" + (Number(x(i)) + 0.1).toFixed(2) + ", " + at(step) + ") {" + math(tex) + "};");
        }
      });
    });
    model.links.forEach(link => {
      const from = sequences.findIndex(sequence => sequence.some(block => block.id === link.from));
      const to = sequences.findIndex(sequence => sequence.some(block => block.id === link.to));
      
      if (from < 0 || to < 0 || !y.has(link.from) || !y.has(link.to)) {
        return;
      }
      
      const out = model.blocks.get(link.from);
      let tex = "";
      try {
        tex = writer.term(out.node.msg);
      } catch (e) {
        tex = "";
      }
      
      lines.push("  \\draw[" + (link.private ? "private" : "message") + "] (" + x(from) + ", " + at(y.get(link.from)) + ") -- node[above, sloped, font=\\scriptsize] {"
        + math(tex) + "} (" + x(to) + ", " + at(y.get(link.to)) + ");");
    });
    lines.push("\\end{tikzpicture}");
    
    return lines.join("\n") + "\n";
  }

  /**
   * Lists the parties of a model, each with its blocks in order: a lane
   * follows the first branch of its tests and of its parallel compositions,
   * and the body of its replications; every other branch of a parallel
   * composition is a party of its own, named by its label or by its lane.
   *
   * @param {Object} model The DiagramModel.
   * @return {Array<Object>} The parties, {title, lane, root, blocks}, the
   *   blocks without the end of the process.
   */
  static parties(model: any) {
    const kinds = StudioCore.app.diagram;
    const parties = [];
    const walk = (first, title, lane, root) => {
      const party = { title: title, lane: lane, root: root, blocks: [] };
      const later = [];
      let block = first;
      parties.push(party);
      
      while (block && party.blocks.length < 500) {
        if (![kinds.end, kinds.branch, kinds.replication, kinds.parallel].includes(block.kind)) {
          party.blocks.push(block);
        }
        
        if (block.kind === kinds.parallel && block.branches) {
          block.branches.slice(1).forEach((branch, k) => later.push({ block: branch.block, title: branch.label || title + " " + (k + 2) }));
        }
        
        if (block.next) {
          block = block.next;
        } else if (block.body) {
          block = block.body;
        } else if (block.branches && block.branches.length && block.branches[0].block) {
          block = block.branches[0].block;
        } else {
          block = null;
        }
      }
      
      later.forEach(item => walk(item.block, item.title, lane, false));
    };
    
    model.lanes.forEach(lane => {
      if (lane.root) {
        walk(lane.root, lane.title || lane.id, lane, true);
      }
    });
    
    return parties;
  }

  /**
   * Turns the LaTeX of KaTeX into plain LaTeX: the classes that frame the
   * types are dropped, their content kept.
   *
   * @param {string} tex The LaTeX of the Design mode.
   * @return {string} The LaTeX for a document.
   */
  static plain(tex: string): string {
    let text = String(tex);
    let at = text.indexOf("\\htmlClass{");
    
    while (at >= 0) {
      const classEnd = text.indexOf("}", at);
      let depth = 0;
      let end = classEnd + 1;
      for (; end < text.length; end++) {
        if (text[end] === "{") {
          depth++;
        } else if (text[end] === "}") {
          depth--;
          if (depth === 0) {
            break;
          }
        }
      }
      text = text.slice(0, at) + text.slice(classEnd + 2, end) + text.slice(end + 1);
      at = text.indexOf("\\htmlClass{");
    }
    
    return text;
  }

  /**
   * Escapes plain text for LaTeX.
   *
   * @param {string} text The text.
   * @return {string} The LaTeX.
   */
  static text(text: string): string {
    return String(text).replace(/([\\{}$&#%_^~])/g, "\\$1");
  }
}
// ----------------------------------------------------------------
