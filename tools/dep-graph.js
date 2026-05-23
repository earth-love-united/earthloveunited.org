/**
 * FILE DEPENDENCY GRAPH
 * Generates a visual dependency graph from the static impact analysis.
 * Outputs as Mermaid diagram and adjacency list.
 *
 * Console commands:
 *   DepGraph.mermaid()       — generate Mermaid diagram (paste into ARCHITECTURE.md)
 *   DepGraph.adjacency()     — show adjacency list
 *   DepGraph.critical()      — show critical path (files that break the most things)
 *   DepGraph.cycles()        — detect circular dependencies
 */

const DepGraph = (() => {

  // ── Build graph from Impact's dependency map ──
  function _buildGraph() {
    if (typeof Impact === 'undefined') {
      console.error('[DepGraph] Impact analyzer not loaded');
      return null;
    }

    // We need to access Impact's DEPENDENCY_MAP — reconstruct from calls/calledBy
    // Use the known module structure
    const files = {
      'app.js':                { calls: ['GlobeModule', 'Data', 'Quiz', 'GAIA_NODES', 'GLOBE_OVERLAY', 'GAIA_BUBBLE', 'GAIA_ENGAGEMENT', 'GAIA_JOURNAL', 'GAIA_PRESENCE', 'CARBON_CLOCK', 'DELEGATION'], exports: ['App'] },
      'globe.js':              { calls: ['GAIA_NODES', 'SITE_PANEL', 'PLEDGE_PANEL', 'GAIA_PRESENCE', 'GAIA_ENGAGEMENT', 'Data'], exports: ['GlobeModule'] },
      'gaia-nodes.js':         { calls: ['GLOBE_OVERLAY', 'GAIA_BUBBLE', 'GAIA_VOICE', 'GAIA_ENGAGEMENT', 'GAIA_CHARTS', 'GAIA_KNOWLEDGE', 'Data'], exports: ['GAIA_NODES'] },
      'globe-overlay.js':      { calls: ['GAIA_NODES'], exports: ['GLOBE_OVERLAY'] },
      'site-panel.js':         { calls: ['GLOBE_OVERLAY', 'GlobeModule', 'Data', 'COUNTRY_DATA'], exports: ['SITE_PANEL', 'PLEDGE_PANEL'] },
      'data.js':               { calls: [], exports: ['Data'] },
      'gaia-bubble.js':        { calls: ['GAIA_VOICE', 'GAIA_ENGAGEMENT'], exports: ['GAIA_BUBBLE'] },
      'gaia-voice.js':         { calls: [], exports: ['GAIA_VOICE'] },
      'gaia-engagement.js':    { calls: [], exports: ['GAIA_ENGAGEMENT'] },
      'gaia-presence.js':      { calls: ['GAIA_VOICE', 'GAIA_ENGAGEMENT'], exports: ['GAIA_PRESENCE'] },
      'gaia-journal.js':       { calls: ['GAIA_ENGAGEMENT'], exports: ['GAIA_JOURNAL'] },
      'gaia-overlay-knowledge.js': { calls: [], exports: ['GAIA_KNOWLEDGE'] },
      'carbon-clock.js':       { calls: [], exports: ['CARBON_CLOCK'] },
      'pledge-wall.js':        { calls: [], exports: ['PLEDGE_WALL'] },
      'ndvi-verifier.js':      { calls: ['Data'], exports: ['NDVIVerifier'] },
      'quiz.js':               { calls: [], exports: ['Quiz'] },
      'country-data.js':       { calls: [], exports: ['COUNTRY_DATA'] },
      'delegation.js':         { calls: [], exports: ['DELEGATION'] },
      'registry-check.js':     { calls: ['Data'], exports: ['RegistryCheck'] },
    };

    // Build export-to-file map
    const exportMap = {};
    for (const [file, info] of Object.entries(files)) {
      info.exports.forEach(exp => { exportMap[exp] = file; });
    }

    // Build edges: file → file
    const edges = [];
    for (const [caller, info] of Object.entries(files)) {
      for (const dep of info.calls) {
        const target = exportMap[dep];
        if (target && target !== caller) {
          edges.push({ from: caller, to: target, via: dep });
        }
      }
    }

    return { files, exportMap, edges };
  }

  // ── Generate Mermaid diagram ──
  function mermaid() {
    const graph = _buildGraph();
    if (!graph) return '';

    let md = 'graph TD\n';
    
    // Style definitions
    const seen = new Set();
    for (const { from, to, via } of graph.edges) {
      const edgeKey = `${from}-->${to}`;
      if (seen.has(edgeKey)) continue;
      seen.add(edgeKey);
      
      const fromId = from.replace(/[.-]/g, '_');
      const toId = to.replace(/[.-]/g, '_');
      md += `  ${fromId}["${from}"] -->|${via}| ${toId}["${to}"]\n`;
    }

    // Add leaf nodes that have no edges
    for (const file of Object.keys(graph.files)) {
      const id = file.replace(/[.-]/g, '_');
      const hasEdge = graph.edges.some(e => e.from === file || e.to === file);
      if (!hasEdge) {
        md += `  ${id}["${file}"]\n`;
      }
    }

    // Style critical files
    md += '\n  style app_js fill:#ff4444,color:#fff\n';
    md += '  style globe_js fill:#ff8c00,color:#fff\n';
    md += '  style data_js fill:#ff4444,color:#fff\n';
    md += '  style gaia_nodes_js fill:#ff8c00,color:#fff\n';
    md += '  style globe_overlay_js fill:#ff8c00,color:#fff\n';

    console.group('%c📊 MERMAID DEPENDENCY GRAPH', 'color: #4ecdc4; font-weight: bold; font-size: 14px;');
    console.log('Copy this into ARCHITECTURE.md:\n');
    console.log('```mermaid');
    console.log(md);
    console.log('```');
    console.groupEnd();
    
    return md;
  }

  // ── Adjacency list ──
  function adjacency() {
    const graph = _buildGraph();
    if (!graph) return;

    console.group('%c📋 ADJACENCY LIST', 'color: #4ecdc4; font-weight: bold;');
    for (const [file, info] of Object.entries(graph.files)) {
      const deps = info.calls.map(c => graph.exportMap[c]).filter(Boolean);
      const uniqueDeps = [...new Set(deps)];
      if (uniqueDeps.length > 0) {
        console.log(`${file} → ${uniqueDeps.join(', ')}`);
      } else {
        console.log(`${file} → (leaf node)`);
      }
    }
    console.groupEnd();
  }

  // ── Critical path analysis ──
  function critical() {
    const graph = _buildGraph();
    if (!graph) return;

    // Count how many files depend on each file (direct + transitive)
    const depCount = {};
    for (const file of Object.keys(graph.files)) {
      depCount[file] = 0;
    }

    for (const { to } of graph.edges) {
      depCount[to] = (depCount[to] || 0) + 1;
    }

    const sorted = Object.entries(depCount).sort((a, b) => b[1] - a[1]);

    console.group('%c🔥 CRITICAL PATH (most depended-on files)', 'color: #ff6b6b; font-weight: bold;');
    console.table(sorted.filter(([, c]) => c > 0).map(([file, count]) => ({
      File: file,
      'Direct Dependents': count,
      Risk: count >= 4 ? '🔴 CRITICAL' : count >= 2 ? '🟡 HIGH' : '🟢 LOW',
    })));
    console.groupEnd();
  }

  // ── Cycle detection ──
  function cycles() {
    const graph = _buildGraph();
    if (!graph) return;

    // Build adjacency map for DFS
    const adj = {};
    for (const file of Object.keys(graph.files)) {
      adj[file] = new Set();
    }
    for (const { from, to } of graph.edges) {
      adj[from].add(to);
    }

    // DFS cycle detection
    const visited = new Set();
    const stack = new Set();
    const foundCycles = [];

    function dfs(node, path) {
      if (stack.has(node)) {
        const cycleStart = path.indexOf(node);
        foundCycles.push(path.slice(cycleStart).concat(node));
        return;
      }
      if (visited.has(node)) return;

      visited.add(node);
      stack.add(node);

      for (const neighbor of (adj[node] || [])) {
        dfs(neighbor, [...path, node]);
      }

      stack.delete(node);
    }

    for (const file of Object.keys(graph.files)) {
      dfs(file, []);
    }

    console.group('%c🔄 CYCLE DETECTION', 'color: #9b59b6; font-weight: bold;');
    if (foundCycles.length === 0) {
      console.log('✅ No circular dependencies found');
    } else {
      foundCycles.forEach((cycle, i) => {
        console.warn(`⚠️ Cycle ${i + 1}: ${cycle.join(' → ')}`);
      });
    }
    console.groupEnd();
    return foundCycles;
  }

  return { mermaid, adjacency, critical, cycles };
})();
window.DepGraph = DepGraph;
