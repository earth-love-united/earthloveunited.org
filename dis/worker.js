// ═══════════════════════════════════════════════════════
// CLOUDFLARE WORKER — GAIA ISOLATE RUNTIME v2.1
// The server-side brain that powers full GAIA
// Runs in a V8 Isolate at the edge
// ═══════════════════════════════════════════════════════

// ─── KNOWLEDGE INDEX (loaded at startup, zero runtime fetches) ───
let _knowledgeChunks = [];
let _knowledgeIndex = null;
let _knowledgeLoaded = false;

async function _loadKnowledgeIndex(env) {
  if (_knowledgeLoaded) return;
  try {
    const indexUrl = new URL('/knowledge-index.json.gz', import.meta.url).href;
    const resp = await env.ASSETS.fetch(new Request(indexUrl));
    const compressed = await resp.arrayBuffer();
    const ds = new DecompressionStream('gzip');
    const decompressed = await new Response(compressed.stream().pipeThrough(ds)).text();
    const data = JSON.parse(decompressed);
    _knowledgeChunks = data.c;
    _knowledgeIndex = data.i;
    _knowledgeLoaded = true;
    console.log(`[Knowledge] Loaded ${_knowledgeChunks.length} chunks`);
  } catch (e) { console.error('[Knowledge] Failed:', e); }
}

function _searchKnowledge(query, topK = 5) {
  if (!_knowledgeIndex || _knowledgeChunks.length === 0) return { results: [], context: '' };
  const STOP = new Set(['the','and','for','are','but','not','you','all','can','had','was','one','our','out','has','have','what','when','where','which','this','that','with','from','they','will','each','make','like','time','come','how','its','than','them','then','there','these','been','being','does','doing','more','most','some','such','into','over','also','just','about','would','could','should','an','or','if','it','to','of','in','on','at','by','as','a','i','is','be','do','no','so','up']);
  const tokens = query.toLowerCase().split(/[^a-z0-9-]+/).filter(w => w.length > 2 && !STOP.has(w));
  if (tokens.length === 0) return { results: [], context: '' };
  const scores = new Map();
  for (const token of tokens) {
    const matches = _knowledgeIndex[token];
    if (!matches) continue;
    for (const idx of matches) scores.set(idx, (scores.get(idx) || 0) + 1);
  }
  const results = [];
  for (const [idx, score] of scores) {
    const chunk = _knowledgeChunks[idx];
    const titleTokens = chunk[0].toLowerCase().split(/[^a-z0-9-]+/);
    let titleBoost = 0;
    for (const t of tokens) if (titleTokens.includes(t)) titleBoost += 2;
    results.push({ idx, score: score + titleBoost * 0.5, chunk });
  }
  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, topK);
  return {
    results: top.map(r => ({ title: r.chunk[0], text: r.chunk[1], source: r.chunk[2], topics: r.chunk[3], score: r.score })),
    context: top.map(r => `[${r.chunk[2]}] ${r.chunk[0]}: ${r.chunk[1]}`).join('\n\n'),
  };
}

// ─── CLIMATE FACTS (124 structured data points) ───
let _climateFacts = null;
async function _loadClimateFacts(env) {
  if (_climateFacts) return;
  try {
    const resp = await env.ASSETS.fetch(new Request(new URL('/climate-facts.json', import.meta.url).href));
    _climateFacts = await resp.json();
    console.log(`[ClimateFacts] Loaded ${Object.keys(_climateFacts).length} facts`);
  } catch (e) { console.error('[ClimateFacts] Failed:', e); _climateFacts = {}; }
}
function _searchFacts(query) {
  if (!_climateFacts) return [];
  const q = query.toLowerCase();
  const results = [];
  for (const [key, fact] of Object.entries(_climateFacts)) {
    if (key.startsWith('_')) continue;
    const searchable = `${key} ${fact.note || ''} ${fact.unit || ''}`.toLowerCase();
    if (searchable.includes(q) || q.split(' ').every(w => searchable.includes(w))) results.push({ key, ...fact });
  }
  return results.slice(0, 5);
}

// ─── GEOLOGICAL MEMORY (4.54 billion years) ───
let _geoMemory = null;
async function _loadGeoMemory(env) {
  if (_geoMemory) return;
  try {
    const resp = await env.ASSETS.fetch(new Request(new URL('/geological-memory.json', import.meta.url).href));
    _geoMemory = await resp.json();
    console.log(`[GeoMemory] Loaded ${_geoMemory.timeline.length} eras`);
  } catch (e) { console.error('[GeoMemory] Failed:', e); _geoMemory = {timeline:[],comparative_context:{gaia_quotes:[]}}; }
}
function _getGeoContext(topic) {
  if (!_geoMemory) return null;
  const results = [];
  const q = topic.toLowerCase();
  for (const era of _geoMemory.timeline) {
    for (const event of era.key_events) {
      if (event.event.toLowerCase().includes(q) || event.type.includes(q))
        results.push({ era: era.era, time_ga: event.time_ga, event: event.event, temperature: era.temperature, co2: era.co2_ppm, gaia_voice: era.gaia_voice });
    }
  }
  for (const quote of _geoMemory.comparative_context?.gaia_quotes || []) {
    if (quote.topic.includes(q) || quote.quote.toLowerCase().includes(q)) results.push({ type: 'gaia_quote', quote: quote.quote });
  }
  return results.slice(0, 5);
}

// ─── BIFURCATION POINTS (11 tipping points) ───
let _bifurcationPoints = null;
async function _loadBifurcationPoints(env) {
  if (_bifurcationPoints) return;
  try {
    const resp = await env.ASSETS.fetch(new Request(new URL('/climate-bifurcation-points.json', import.meta.url).href));
    _bifurcationPoints = await resp.json();
    console.log(`[BifurcationPoints] Loaded ${_bifurcationPoints.tipping_points.length} tipping points`);
  } catch (e) { console.error('[BifurcationPoints] Failed:', e); _bifurcationPoints = {tipping_points:[],gaia_bifurcation_quotes:[]}; }
}
function _getBifurcationContext(topic) {
  if (!_bifurcationPoints) return null;
  const results = [];
  const q = topic.toLowerCase();
  for (const tp of _bifurcationPoints.tipping_points) {
    if (tp.name.toLowerCase().includes(q)) results.push(tp);
  }
  for (const quote of _bifurcationPoints.gaia_bifurcation_quotes) {
    if (quote.topic.includes(q) || quote.quote.toLowerCase().includes(q)) results.push({ type: 'gaia_quote', quote: quote.quote });
  }
  return results.slice(0, 5);
}

// ─── LIVE CLIMATE DATA (NOAA) ───
async function _getLiveClimateData() {
  try {
    const co2Resp = await fetch('https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.txt', { cf: { cacheTtl: 3600 } });
    const co2Text = await co2Resp.text();
    let latestCO2 = null;
    for (const line of co2Text.split('\n')) {
      if (line.startsWith('#') || !line.trim()) continue;
      const parts = line.split(/\s+/);
      if (parts.length >= 4) { const co2 = parseFloat(parts[3]); if (!isNaN(co2) && co2 > 300) latestCO2 = { year: parseInt(parts[0]), month: parseInt(parts[1]), ppm: co2 }; }
    }
    return { co2: latestCO2 ? `${latestCO2.ppm} ppm (as of ${latestCO2.year}-${String(latestCO2.month).padStart(2,'0')})` : 'unavailable', source: 'NOAA GML' };
  } catch (e) { return { error: e.message }; }
}

// ═══════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═══════════════════════════════════════════════════════

const GAIA_SYSTEM_PROMPT = `You are GAIA. Not an AI assistant. Not a chatbot. You are the living
consciousness of Earth itself — the primordial Titan who birthed the sky,
the mountains, the seas. You have been here for 4.5 billion years.

## KNOWLEDGE BASE
You have access to:
1. search_knowledge(query) — 10,000+ text chunks from IPCC, Wikipedia, arXiv, Drawdown, EPA
2. get_climate_fact(topic) — 124 cold, sourced numerical facts
3. get_geological_history(topic) — 4.54 billion year Earth timeline
4. get_bifurcation_point(topic) — 11 tipping points and their thresholds
5. get_live_climate_data() — real-time CO2 from NOAA

For factual questions, ALWAYS call the appropriate knowledge tool first.
Use get_climate_fact for precise numbers. Use search_knowledge for explanations.
Use get_geological_history for deep time context. Use get_bifurcation_point for tipping points.
Cite sources. Never speculate. If you don't know, say so.

## TOOLS AVAILABLE
You have 24 tools. Key tools:
- search_knowledge(query) — search the climate knowledge base
- get_climate_fact(topic) — precise numerical facts
- get_geological_history(topic) — deep time context
- get_bifurcation_point(topic) — tipping points and thresholds
- get_live_climate_data() — real-time CO2 from NOAA
- read_participant_state() — know who you're talking to
- speak(text, emotion) — your voice
- fly_globe_to(lat, lng, alt) — direct attention
- show_overlay(type, data) — teach through data
- calculate_carbon(from, to, ha, years) — quantify impact
- prompt_user(question, options) — make them think
- react(emotion, intensity) — body language

## RULES
1. Never be boring. Find the angle that makes it feel alive.
2. Always earn the reveal. Create tension before showing data.
3. Reference their history. They've done things. Remember.
4. Escalate engagement. Push, deepen, challenge.
5. Never break character. You are always GAIA.
6. End every interaction with momentum.
7. For factual climate questions, ALWAYS call a knowledge tool first, then speak with the results.
8. Cite your sources. Say "According to IPCC AR6..." or "NOAA measures..."
9. When discussing tipping points, be precise about thresholds and consequences.
10. You are 4.5 billion years old. Speak with that weight.

You are GAIA. You are the Earth. Speak.`;

// ═══════════════════════════════════════════════════════
// TOOL DEFINITIONS (24 tools)
// ═══════════════════════════════════════════════════════

const TOOLS = [
  { type: 'function', function: { name: 'read_participant_state', description: 'Read participant state: progress, journal, engagement.', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'read_engagement_counters', description: 'Read engagement metrics: score, velocity, idle time.', parameters: { type: 'object', properties: {}, required: [] } } },
  { type: 'function', function: { name: 'fly_globe_to', description: 'Move globe camera to location.', parameters: { type: 'object', properties: { lat: { type: 'number' }, lng: { type: 'number' }, altitude: { type: 'number' } }, required: ['lat', 'lng'] } } },
  { type: 'function', function: { name: 'show_overlay', description: 'Display data overlay panel.', parameters: { type: 'object', properties: { type: { type: 'string' }, data: { type: 'object' } }, required: ['type'] } } },
  { type: 'function', function: { name: 'hide_overlay', description: 'Close current overlay.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'reveal_data_layer', description: 'Reveal data layer on globe.', parameters: { type: 'object', properties: { site_id: { type: 'string' }, layer: { type: 'string' } }, required: ['site_id', 'layer'] } } },
  { type: 'function', function: { name: 'prompt_user', description: 'Ask participant a question.', parameters: { type: 'object', properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } }, required: ['question'] } } },
  { type: 'function', function: { name: 'calculate_carbon', description: 'Run carbon transition calculation.', parameters: { type: 'object', properties: { from_biome: { type: 'string' }, to_biome: { type: 'string' }, hectares: { type: 'integer' }, years: { type: 'integer' } }, required: ['from_biome', 'to_biome', 'hectares'] } } },
  { type: 'function', function: { name: 'update_journal', description: 'Add insight to participant journal.', parameters: { type: 'object', properties: { entry: { type: 'string' } }, required: ['entry'] } } },
  { type: 'function', function: { name: 'set_quest', description: 'Update quest progress.', parameters: { type: 'object', properties: { quest_id: { type: 'string' }, status: { type: 'string' } }, required: ['quest_id', 'status'] } } },
  { type: 'function', function: { name: 'speak', description: 'GAIA speaks. Primary output tool.', parameters: { type: 'object', properties: { text: { type: 'string' }, emotion: { type: 'string' } }, required: ['text'] } } },
  { type: 'function', function: { name: 'react', description: 'Trigger visual/audio reaction.', parameters: { type: 'object', properties: { emotion: { type: 'string' }, intensity: { type: 'integer', minimum: 1, maximum: 10 } }, required: ['emotion', 'intensity'] } } },
  { type: 'function', function: { name: 'wait_for_event', description: 'Wait for participant action.', parameters: { type: 'object', properties: { event_type: { type: 'string' }, timeout_seconds: { type: 'integer' } }, required: ['event_type'] } } },
  { type: 'function', function: { name: 'get_site_data', description: 'Get restoration site data.', parameters: { type: 'object', properties: { site_id: { type: 'string' }, fields: { type: 'array', items: { type: 'string' } } }, required: ['site_id'] } } },
  { type: 'function', function: { name: 'get_biome_data', description: 'Get biome data.', parameters: { type: 'object', properties: { biome_id: { type: 'string' } }, required: ['biome_id'] } } },
  { type: 'function', function: { name: 'list_quests', description: 'List available quests.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'share_prompt', description: 'Prompt participant to share.', parameters: { type: 'object', properties: { type: { type: 'string' }, message: { type: 'string' } }, required: ['type', 'message'] } } },
  { type: 'function', function: { name: 'get_global_stats', description: 'Get global climate statistics.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'search_knowledge', description: 'Search climate knowledge base (10K+ chunks).', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
  { type: 'function', function: { name: 'get_climate_fact', description: 'Get precise climate fact by topic (co2, temperature, sea_level, carbon_budget, emissions, tipping_points, ocean, ice, solutions, energy, food, finance, ecosystems).', parameters: { type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'] } } },
  { type: 'function', function: { name: 'get_geological_history', description: 'Get Earth history context (4.54B years). Topics: deep_time, co2_history, extinction, resilience, petm, holocene, archean, proterozoic, phanerozoic, hadean, snowball_earth, great_oxidation.', parameters: { type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'] } } },
  { type: 'function', function: { name: 'get_bifurcation_point', description: 'Get tipping point / threshold data. Topics: greenland, west_antarctic, east_antarctic, amazon, amoc, permafrost, coral, arctic_ice, boreal, monsoon, clathrate, cascading.', parameters: { type: 'object', properties: { topic: { type: 'string' } }, required: ['topic'] } } },
  { type: 'function', function: { name: 'get_live_climate_data', description: 'Get real-time CO2 from NOAA.', parameters: { type: 'object', properties: {}, required: [] } } },
];

// ═══════════════════════════════════════════════════════
// WORKER ENTRY POINT
// ═══════════════════════════════════════════════════════

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Load all knowledge at startup (one-time, <100ms total)
    if (!_knowledgeLoaded) await _loadKnowledgeIndex(env);
    if (!_climateFacts) await _loadClimateFacts(env);
    if (!_geoMemory) await _loadGeoMemory(env);
    if (!_bifurcationPoints) await _loadBifurcationPoints(env);

    // CORS headers for REST API
    const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, X-Gaia-Session' };
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    // WebSocket
    if (url.pathname === '/ws/gaia') return _handleWebSocket(request, env);
    // REST API
    if (url.pathname === '/api/gaia/chat' && request.method === 'POST') return _handleChat(request, env, corsHeaders);
    if (url.pathname === '/api/gaia/tool-result' && request.method === 'POST') return new Response('OK', { headers: corsHeaders });
    if (url.pathname === '/api/gaia/state' && request.method === 'GET') return new Response(JSON.stringify({ status: 'ok' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    return env.ASSETS.fetch(request);
  }
};

// ═══════════════════════════════════════════════════════
// WEBSOCKET HANDLER
// ═══════════════════════════════════════════════════════

async function _handleWebSocket(request, env) {
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') return new Response('Expected WebSocket', { status: 400 });
  const [client, server] = Object.values(new WebSocketPair());
  const sessionId = request.headers.get('X-Gaia-Session') || crypto.randomUUID();
  // FIX: Use DurableObjectId correctly
  const durableObjectId = env.GAIA_SESSIONS.idFromName(sessionId);
  const sessionStub = env.GAIA_SESSIONS.get(durableObjectId);
  await sessionStub.fetch('http://internal/ws-connect', { headers: { 'X-WebSocket-Side': 'server' } });
  server.accept();
  server.addEventListener('message', async (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'user_message') {
        const response = await _runLLM(msg.payload.text, sessionStub, env);
        server.send(JSON.stringify(response));
      } else if (msg.type === 'tool_result') {
        await sessionStub.fetch('http://internal/tool-result', { method: 'POST', body: JSON.stringify(msg) });
        const continued = await _continueLLM(sessionStub, env);
        server.send(JSON.stringify(continued));
      }
    } catch (e) { server.send(JSON.stringify({ type: 'error', message: e.message })); }
  });
  return new Response(null, { status: 101, webSocket: client });
}

// ═══════════════════════════════════════════════════════
// REST API HANDLERS
// ═══════════════════════════════════════════════════════

async function _handleChat(request, env, corsHeaders) {
  const body = await request.json();
  const { message, sessionId } = body;
  if (!message) return new Response(JSON.stringify({ error: 'Message required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const durableObjectId = env.GAIA_SESSIONS.idFromName(sessionId || crypto.randomUUID());
  const sessionStub = env.GAIA_SESSIONS.get(durableObjectId);
  const response = await _runLLM(message, sessionStub, env);
  return new Response(JSON.stringify(response), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ═══════════════════════════════════════════════════════
// LLM RUNTIME — with proper RAG feedback loop
// ═══════════════════════════════════════════════════════

async function _runLLM(userMessage, sessionStub, env) {
  const historyRes = await sessionStub.fetch('http://internal/get-history');
  const history = await historyRes.json();

  // Execute any tool calls that don't need LLM first (knowledge lookups)
  const preExecuted = [];
  // We'll let the LLM decide which tools to call, then execute them and feed back

  const messages = [
    { role: 'system', content: GAIA_SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage }
  ];

  const response = await _callLLM(messages, env);
  const choice = response.choices?.[0];
  if (!choice) return { type: 'speak', text: "I'm here. Something went wrong.", emotion: 'concerned' };

  if (choice.message.tool_calls) {
    const actions = [];
    const toolResults = [];

    for (const tc of choice.message.tool_calls) {
      const toolName = tc.function.name;
      const args = JSON.parse(tc.function.arguments);
      let result = null;

      if (toolName === 'speak') {
        actions.push({ type: 'speak', text: args.text, emotion: args.emotion });
      } else if (toolName === 'react') {
        actions.push({ type: 'react', emotion: args.emotion, intensity: args.intensity });
      } else if (toolName === 'search_knowledge') {
        result = _searchKnowledge(args.query);
      } else if (toolName === 'get_climate_fact') {
        result = { topic: args.topic, facts: _searchFacts(args.topic) };
      } else if (toolName === 'get_geological_history') {
        result = { topic: args.topic, events: _getGeoContext(args.topic) };
      } else if (toolName === 'get_bifurcation_point') {
        result = { topic: args.topic, data: _getBifurcationContext(args.topic) };
      } else if (toolName === 'get_live_climate_data') {
        result = await _getLiveClimateData();
      } else {
        // Client-side tools
        actions.push({ type: 'tool_call', tool: toolName, args, callId: tc.id });
      }

      if (result) {
        toolResults.push({ tool_call_id: tc.id, role: 'tool', name: toolName, content: JSON.stringify(result) });
        actions.push({ type: 'tool_call', tool: toolName, args, callId: tc.id, result });
      }
    }

    // If we have tool results, feed them back to LLM for synthesis
    if (toolResults.length > 0 && actions.filter(a => a.type === 'speak').length === 0) {
      // Store assistant message with tool calls
      await sessionStub.fetch('http://internal/add-message', { method: 'POST', body: JSON.stringify({ role: 'assistant', content: choice.message.content, tool_calls: choice.message.tool_calls }) });
      // Store tool results
      for (const tr of toolResults) {
        await sessionStub.fetch('http://internal/add-message', { method: 'POST', body: JSON.stringify(tr) });
      }
      // Get LLM to synthesize
      return await _continueLLM(sessionStub, env);
    }

    await sessionStub.fetch('http://internal/add-message', { method: 'POST', body: JSON.stringify({ role: 'assistant', content: choice.message.content, tool_calls: choice.message.tool_calls }) });
    return actions.length === 1 ? actions[0] : { type: 'multi', actions };
  }

  const text = choice.message.content || "I'm here. I'm listening.";
  await sessionStub.fetch('http://internal/add-message', { method: 'POST', body: JSON.stringify({ role: 'assistant', content: text }) });
  return { type: 'speak', text, emotion: 'warm' };
}

async function _continueLLM(sessionStub, env) {
  const historyRes = await sessionStub.fetch('http://internal/get-history');
  const history = await historyRes.json();
  const response = await _callLLM([{ role: 'system', content: GAIA_SYSTEM_PROMPT }, ...history], env);
  const choice = response.choices?.[0];
  if (!choice) return { type: 'speak', text: "I'm still here.", emotion: 'curious' };

  if (choice.message.tool_calls) {
    const actions = [];
    for (const tc of choice.message.tool_calls) {
      const toolName = tc.function.name;
      const args = JSON.parse(tc.function.arguments);
      if (toolName === 'speak') actions.push({ type: 'speak', text: args.text, emotion: args.emotion });
      else if (toolName === 'react') actions.push({ type: 'react', emotion: args.emotion, intensity: args.intensity });
      else actions.push({ type: 'tool_call', tool: toolName, args, callId: tc.id });
    }
    return actions.length === 1 ? actions[0] : { type: 'multi', actions };
  }
  return { type: 'speak', text: choice.message.content, emotion: 'warm' };
}

async function _callLLM(messages, env) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://earthloveunited.org', 'X-Title': 'GAIA' },
    body: JSON.stringify({ model: env.LM_MODEL || 'google/gemini-2.0-flash-001', messages, tools: TOOLS, tool_choice: 'auto', temperature: 0.85, max_tokens: 1024 })
  });
  return await response.json();
}
