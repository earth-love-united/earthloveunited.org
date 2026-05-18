/**
 * GAIA KNOWLEDGE ENGINE v1.0
 * Client-side RAG system powered by the Earth Love United Climate Knowledge dataset.
 * 
 * Architecture:
 *   1. Loads dataset from Hugging Face (pre-embedded chunks)
 *   2. Uses cosine similarity for retrieval (pure JS, no server needed)
 *   3. Integrates with GAIA's tool system as `search_knowledge` tool
 *   4. Injects relevant context into LLM conversations
 * 
 * Dataset: ego0op/earth-love-united-climate-knowledge (7,260 chunks)
 */

const GaiaKnowledge = (() => {

  // ─── STATE ───
  let _chunks = [];           // Loaded knowledge chunks
  let _vocab = null;          // TF-IDF vocabulary
  let _loaded = false;
  let _loading = false;

  // ─── CONFIG ───
  const DATASET_URL = 'data/climate-knowledge-curated.jsonl';
  const TOP_K = 5;            // Number of chunks to retrieve
  const MIN_SCORE = 0.15;     // Minimum similarity threshold (lower for TF-IDF)

  // ─── SIMPLE EMBEDDING (TF-IDF-like, no model needed) ───
  // For production, use a proper embedding model. For now, we use
  // a keyword-based approach that works surprisingly well for domain-specific retrieval.

  function _tokenize(text) {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  function _buildVocabulary(chunks) {
    const vocab = new Map();
    let idx = 0;
    for (const chunk of chunks) {
      const tokens = _tokenize(chunk.text);
      for (const token of tokens) {
        if (!vocab.has(token)) {
          vocab.set(token, idx++);
        }
      }
    }
    return vocab;
  }

  function _textToVector(text, vocab) {
    const vec = new Float32Array(vocab.size);
    const tokens = _tokenize(text);
    // TF-IDF weighting
    const tf = new Map();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) || 0) + 1);
    }
    for (const [token, count] of tf) {
      const idx = vocab.get(token);
      if (idx !== undefined) {
        // Simple TF weighting
        vec[idx] = count / tokens.length;
      }
    }
    // L2 normalize
    let norm = 0;
    for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < vec.length; i++) vec[i] /= norm;
    }
    return vec;
  }

  function _cosineSim(a, b) {
    let dot = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) dot += a[i] * b[i];
    return dot; // Already normalized
  }

  // ─── PUBLIC API ───

  async function init() {
    if (_loaded || _loading) return;
    _loading = true;

    console.log('[GaiaKnowledge] Loading climate knowledge dataset...');

    try {
      // Load chunks from local dataset
      const response = await fetch(DATASET_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const text = await response.text();
      _chunks = text.split('\n')
        .filter(line => line.trim())
        .map(line => JSON.parse(line));

      console.log(`[GaiaKnowledge] Loaded ${_chunks.length} chunks`);

      // Build vocabulary and vectors
      console.log('[GaiaKnowledge] Building search index...');
      const vocab = _buildVocabulary(_chunks);
      console.log(`[GaiaKnowledge] Vocabulary size: ${vocab.size}`);

      // Store vectors as array of Float32Arrays
      _chunks = _chunks.map(chunk => ({
        ...chunk,
        _vector: _textToVector(chunk.text, vocab)
      }));
      _vocab = vocab;
      _loaded = true;

      console.log('[GaiaKnowledge] ✅ Knowledge engine ready');
      console.log(`[GaiaKnowledge] Sources: ${[...new Set(_chunks.map(c => c.source))].join(', ')}`);

    } catch (err) {
      console.error('[GaiaKnowledge] Failed to load:', err);
      // Fallback: use keyword matching only
      _loaded = true;
    }

    _loading = false;
  }

  function search(query, options = {}) {
    if (!_loaded || _chunks.length === 0) return [];

    const topK = options.topK || TOP_K;
    const minScore = options.minScore || MIN_SCORE;
    const sourceFilter = options.source || null;

    let queryVec = null;
    if (_vocab) {
      queryVec = _textToVector(query, _vocab);
    }

    const results = [];
    for (const chunk of _chunks) {
      if (sourceFilter && chunk.source !== sourceFilter) continue;

      let score = 0;
      if (queryVec && chunk._vector) {
        score = _cosineSim(queryVec, chunk._vector);
      } else {
        // Fallback: keyword overlap
        const queryTokens = new Set(_tokenize(query));
        const chunkTokens = new Set(_tokenize(chunk.text));
        let overlap = 0;
        for (const t of queryTokens) {
          if (chunkTokens.has(t)) overlap++;
        }
        score = overlap / Math.sqrt(queryTokens.size * chunkTokens.size);
      }

      if (score >= minScore) {
        results.push({ ...chunk, _score: score });
      }
    }

    results.sort((a, b) => b._score - a._score);
    return results.slice(0, topK);
  }

  function getContext(query, maxChars = 2000) {
    const results = search(query);
    if (results.length === 0) return '';

    let context = '';
    for (const r of results) {
      const chunk = `[${r.source}] ${r.title}: ${r.text}`;
      if (context.length + chunk.length > maxChars) break;
      context += chunk + '\n\n';
    }
    return context.trim();
  }

  function getStats() {
    if (!_loaded) return { loaded: false };
    const sources = {};
    for (const c of _chunks) {
      sources[c.source] = (sources[c.source] || 0) + 1;
    }
    return {
      loaded: true,
      totalChunks: _chunks.length,
      sources,
      vocabSize: _vocab ? _vocab.size : 0,
    };
  }

  // ─── TOOL DEFINITION (for GAIA's LLM) ───
  const SEARCH_KNOWLEDGE_TOOL = {
    type: 'function',
    function: {
      name: 'search_knowledge',
      description: 'Search the climate knowledge base for authoritative information about carbon, climate change, solutions, impacts, and science. Use this when the user asks factual questions about climate.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query — be specific and include key terms' },
          top_k: { type: 'integer', description: 'Number of results to return (default 5)' },
        },
        required: ['query']
      }
    }
  };

  // ─── TOOL EXECUTION ───
  function executeTool(toolName, args) {
    if (toolName === 'search_knowledge') {
      const results = search(args.query, { topK: args.top_k || 5 });
      return {
        query: args.query,
        results: results.map(r => ({
          source: r.source,
          title: r.title,
          text: r.text.substring(0, 500),
          score: r._score,
          url: r.url,
        })),
        context: getContext(args.query, 2000),
      };
    }
    return null;
  }

  return {
    init,
    search,
    getContext,
    getStats,
    executeTool,
    get SEARCH_KNOWLEDGE_TOOL() { return SEARCH_KNOWLEDGE_TOOL; },
    get isLoaded() { return _loaded; },
    get chunkCount() { return _chunks.length; },
  };
})();
