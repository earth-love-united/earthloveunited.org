/**
 * DESIGN TOKENS REFERENCE
 * Machine-readable design system for agents.
 * Prevents agents from inventing colors or fonts.
 *
 * Console commands:
 *   DesignTokens.list()         — all tokens with computed values
 *   DesignTokens.colors()       — color palette only
 *   DesignTokens.fonts()        — typography only
 *   DesignTokens.get('teal')    — get a specific token value
 *   DesignTokens.suggest(task)  — suggest tokens for a task ('error', 'success', 'heading', etc.)
 *   DesignTokens.swatch()       — visual color swatches in console
 */

const DesignTokens = (() => {

  // ── Token definitions (from base.css :root) ──
  const TOKENS = {
    // Backgrounds
    bg:    { var: '--bg',    category: 'background', desc: 'Page background (near-black)',       usage: 'body, .sections, overlays' },
    bg2:   { var: '--bg2',   category: 'background', desc: 'Card/surface background (dark)',     usage: 'cards, panels, inputs' },
    bg3:   { var: '--bg3',   category: 'background', desc: 'Elevated surface (darkest-gray)',    usage: 'hover states, active cards' },

    // Primary palette
    teal:  { var: '--teal',  category: 'accent',     desc: 'Primary accent (aqua-teal)',         usage: 'buttons, links, highlights, borders' },
    mint:  { var: '--mint',  category: 'accent',     desc: 'Light accent (mint-green)',           usage: 'logo, headings, gradient-end' },
    ocean: { var: '--ocean', category: 'accent',     desc: 'Deep accent (ocean-blue)',            usage: 'secondary highlights, chart lines' },
    deep:  { var: '--deep',  category: 'accent',     desc: 'Deepest accent (navy)',               usage: 'chart backgrounds, depth layers' },

    // Semantic
    leaf:  { var: '--leaf',  category: 'semantic',   desc: 'Positive/success (green)',            usage: 'positive values, growth, verified' },
    amber: { var: '--amber', category: 'semantic',   desc: 'Warning/caution (warm amber)',        usage: 'partial recovery, moderate values' },
    warn:  { var: '--warn',  category: 'semantic',   desc: 'Negative/error (terracotta-red)',     usage: 'NDVI crash, fire, bad values' },

    // Text hierarchy
    text:  { var: '--text',  category: 'text',       desc: 'Primary text (warm white)',           usage: 'body text, headings' },
    text2: { var: '--text2', category: 'text',       desc: 'Secondary text (muted stone)',        usage: 'labels, descriptions, metadata' },
    text3: { var: '--text3', category: 'text',       desc: 'Tertiary text (dim stone)',           usage: 'captions, timestamps, fine print' },

    // Fonts
    mono:    { var: '--mono',    category: 'font', desc: 'Monospace (JetBrains Mono)',   usage: 'data values, code, stat numbers' },
    display: { var: '--display', category: 'font', desc: 'Display (Cormorant Garamond)', usage: 'logo, site title, hero heading' },
    body:    { var: '--body',    category: 'font', desc: 'Body (Outfit)',                usage: 'paragraphs, buttons, labels' },
  };

  // ── Engagement state colors (from gaia-bubble.css / globe-overlay.css) ──
  const STATE_TOKENS = {
    locked:    { var: '--locked',    category: 'state', desc: 'Node locked',    usage: 'unvisited globe nodes' },
    available: { var: '--available', category: 'state', desc: 'Node available', usage: 'discoverable globe nodes' },
    explored:  { var: '--explored',  category: 'state', desc: 'Node explored',  usage: 'partially explored' },
    mastered:  { var: '--mastered',  category: 'state', desc: 'Node mastered',  usage: 'fully explored nodes' },
  };

  // ── Task suggestions ──
  const SUGGESTIONS = {
    error:     ['warn', 'text'],
    success:   ['leaf', 'text'],
    warning:   ['amber', 'text'],
    info:      ['teal', 'text2'],
    heading:   ['mint', 'display'],
    subheading:['text', 'display'],
    body:      ['text', 'body'],
    caption:   ['text3', 'body'],
    stat:      ['teal', 'mono'],
    positive:  ['leaf', 'mono'],
    negative:  ['warn', 'mono'],
    button:    ['teal', 'body', 'bg'],
    card:      ['bg2', 'text', 'teal'],
    overlay:   ['bg', 'text', 'teal'],
    chart:     ['teal', 'leaf', 'amber', 'warn'],
    link:      ['teal', 'body'],
    divider:   ['text3'],
  };

  // ── List all tokens with computed values ──
  function list() {
    const root = getComputedStyle(document.documentElement);
    
    console.group('%c🎨 DESIGN TOKENS', 'color: #4ecdc4; font-weight: bold; font-size: 14px;');
    
    const allTokens = { ...TOKENS, ...STATE_TOKENS };
    const byCategory = {};
    
    for (const [name, token] of Object.entries(allTokens)) {
      const val = root.getPropertyValue(token.var).trim();
      const cat = token.category;
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push({
        Token: `var(${token.var})`,
        Value: val,
        Description: token.desc,
        Usage: token.usage,
      });
    }

    for (const [cat, items] of Object.entries(byCategory)) {
      console.group(`${cat.toUpperCase()}`);
      console.table(items);
      console.groupEnd();
    }

    console.groupEnd();
  }

  // ── Color palette only ──
  function colors() {
    const root = getComputedStyle(document.documentElement);
    const colorTokens = Object.entries(TOKENS).filter(([, t]) => 
      ['background', 'accent', 'semantic', 'text'].includes(t.category)
    );

    console.group('%c🎨 COLOR PALETTE', 'color: #4ecdc4; font-weight: bold;');
    console.table(colorTokens.map(([name, token]) => ({
      Name: name,
      CSS: `var(${token.var})`,
      Value: root.getPropertyValue(token.var).trim(),
      Use: token.desc,
    })));
    console.groupEnd();
  }

  // ── Typography only ──
  function fonts() {
    const root = getComputedStyle(document.documentElement);
    const fontTokens = Object.entries(TOKENS).filter(([, t]) => t.category === 'font');

    console.group('%c✏️ TYPOGRAPHY', 'color: #4ecdc4; font-weight: bold;');
    console.table(fontTokens.map(([name, token]) => ({
      Name: name,
      CSS: `var(${token.var})`,
      Value: root.getPropertyValue(token.var).trim(),
      Use: token.desc,
    })));
    console.groupEnd();
  }

  // ── Get a specific token ──
  function get(name) {
    const token = TOKENS[name] || STATE_TOKENS[name];
    if (!token) {
      console.warn(`[DesignTokens] Unknown token: ${name}. Available:`, Object.keys(TOKENS));
      return null;
    }
    const val = getComputedStyle(document.documentElement).getPropertyValue(token.var).trim();
    return { name, css: `var(${token.var})`, value: val, ...token };
  }

  // ── Suggest tokens for a task ──
  function suggest(task) {
    const lowerTask = task.toLowerCase();
    const match = SUGGESTIONS[lowerTask];
    if (!match) {
      console.log(`[DesignTokens] No suggestions for "${task}". Available tasks:`, Object.keys(SUGGESTIONS));
      return null;
    }

    const root = getComputedStyle(document.documentElement);
    console.group(`%c💡 SUGGESTED TOKENS FOR: ${task}`, 'color: #ffd700; font-weight: bold;');
    match.forEach(name => {
      const token = TOKENS[name];
      if (token) {
        const val = root.getPropertyValue(token.var).trim();
        console.log(`  ${name}: var(${token.var}) → ${val} — ${token.desc}`);
      }
    });
    console.groupEnd();
    return match.map(name => get(name)).filter(Boolean);
  }

  // ── Visual swatches ──
  function swatch() {
    const root = getComputedStyle(document.documentElement);
    const colorTokens = Object.entries(TOKENS).filter(([, t]) => 
      ['background', 'accent', 'semantic', 'text'].includes(t.category)
    );

    console.log('%c🎨 COLOR SWATCHES', 'font-weight: bold; font-size: 14px; color: #4ecdc4;');
    colorTokens.forEach(([name, token]) => {
      const val = root.getPropertyValue(token.var).trim();
      console.log(
        `%c  ██  %c ${name} %c ${val} %c ${token.desc}`,
        `background: ${val}; color: ${val};`,
        'font-weight: bold; color: inherit;',
        `color: ${val};`,
        'color: #9a9590; font-size: 10px;'
      );
    });
  }

  return { list, colors, fonts, get, suggest, swatch, TOKENS, SUGGESTIONS };
})();
window.DesignTokens = DesignTokens;
