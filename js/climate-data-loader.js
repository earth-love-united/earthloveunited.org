/*
 * Climate Data Loader — zero-overhead frontend module.
 *
 * Loads events-core.csv at boot (2-5MB, flat typed arrays for GPU).
 * Lazy-loads events-meta.json only when user clicks an event.
 *
 * Usage:
 *     const loader = new ClimateDataLoader();
 *     await loader.init('events-core.csv', 'events-meta.json');
 *
 *     // Per frame: get visible events for current time window
 *     const visible = loader.getVisible(startUnix, endUnix);
 *
 *     // On click: get metadata
 *     const meta = loader.getMeta(eventId);
 *
 * Design:
 *     - Core data stored as Float32Array/Int32Array for zero-copy to WebGL
 *     - No nested objects, no arrays-of-arrays
 *     - Binary search on sorted timestamps for O(log n) range queries
 *     - Metadata is a plain object lookup, loaded once on first click
 */

class ClimateDataLoader {
    constructor() {
        // Core render arrays (flat, GPU-ready)
        this.ids = [];           // string[] — event IDs
        this.lats = null;        // Float32Array
        this.lngs = null;        // Float32Array
        this.starts = null;      // Int32Array — unix timestamps
        this.ends = null;        // Int32Array
        this.types = null;       // Int8Array  — 1-6
        this.sevs = null;        // Int8Array  — 1-3
        this.count = 0;

        // Sorted index for binary search (by start time)
        this._sortedIdx = null;

        // Metadata (lazy loaded)
        this._meta = null;
        this._metaUrl = null;
        this._metaLoaded = false;
        this._metaPromise = null;

        // Type color map (RGB, 0-1)
        this.TYPE_COLORS = {
            1: [1.0, 0.3, 0.0],   // fire — red-orange
            2: [0.0, 0.4, 1.0],   // flood — blue
            3: [0.6, 0.0, 1.0],   // storm — purple
            4: [1.0, 0.8, 0.0],   // earthquake — yellow
            5: [1.0, 0.1, 0.1],   // volcano — red
            6: [0.8, 0.5, 0.0],   // drought — brown
        };

        // Severity size multiplier
        this.SEV_SIZES = { 1: 0.5, 2: 1.0, 3: 2.0 };
    }

    /**
     * Initialize: fetch core CSV, parse into typed arrays.
     * @param {string} coreUrl  — URL to events-core.csv
     * @param {string} metaUrl  — URL to events-meta.json (lazy loaded)
     */
    async init(coreUrl, metaUrl) {
        this._metaUrl = metaUrl;

        const resp = await fetch(coreUrl);
        const text = await resp.text();
        this._parseCore(text);

        console.log(
            `[ClimateData] Loaded ${this.count} events ` +
            `(${(text.length / 1024).toFixed(0)} KB CSV)`
        );
    }

    /**
     * Parse CSV text into flat typed arrays.
     * Expected columns: id,lat,lng,start,end,type,sev
     *
     * Handles quoted fields (RFC 4180 basic): fields containing commas
     * or newlines wrapped in double quotes. Our core CSV should not have
     * quoted numeric fields, but IDs may contain special characters.
     */
    _parseCore(text) {
        const lines = text.trim().split('\n');
        // Skip header
        const n = lines.length - 1;
        this.count = n;

        // Pre-allocate typed arrays
        this.ids = new Array(n);
        this.lats = new Float32Array(n);
        this.lngs = new Float32Array(n);
        this.starts = new Int32Array(n);
        this.ends = new Int32Array(n);
        this.types = new Int8Array(n);
        this.sevs = new Int8Array(n);

        for (let i = 0; i < n; i++) {
            const parts = this._parseCSVLine(lines[i + 1]);
            this.ids[i] = parts[0];
            this.lats[i] = parseFloat(parts[1]);
            this.lngs[i] = parseFloat(parts[2]);
            this.starts[i] = parseInt(parts[3], 10);
            this.ends[i] = parseInt(parts[4], 10);
            this.types[i] = parseInt(parts[5], 10);
            this.sevs[i] = parseInt(parts[6], 10);
        }

        // Build sorted index by start time for binary search
        this._sortedIdx = new Uint32Array(n);
        for (let i = 0; i < n; i++) this._sortedIdx[i] = i;
        // Sort indices by start time
        this._sortedIdx.sort((a, b) => this.starts[a] - this.starts[b]);
    }

    /**
     * Parse a single CSV line, handling quoted fields (RFC 4180).
     * Returns array of field values.
     */
    _parseCSVLine(line) {
        const fields = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"') {
                    // Check for escaped quote ("")
                    if (i + 1 < line.length && line[i + 1] === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    current += ch;
                }
            } else {
                if (ch === '"') {
                    inQuotes = true;
                } else if (ch === ',') {
                    fields.push(current);
                    current = '';
                } else {
                    current += ch;
                }
            }
        }
        fields.push(current);
        return fields;
    }

    /**
     * Binary search: find first index where starts[idx] >= target
     */
    _lowerBound(target) {
        let lo = 0, hi = this.count;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (this.starts[this._sortedIdx[mid]] < target) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        return lo;
    }

    /**
     * Binary search: find first index where starts[idx] > target
     */
    _upperBound(target) {
        let lo = 0, hi = this.count;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (this.starts[this._sortedIdx[mid]] <= target) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        return lo;
    }

    /**
     * Get all events visible in a time window [windowStart, windowEnd].
     * An event is visible if: start <= windowEnd AND end >= windowStart
     * (i.e., the event overlaps the window at all).
     *
     * Returns a lightweight view object — no data copied.
     *
     * @param {number} windowStart — unix timestamp (seconds)
     * @param {number} windowEnd   — unix timestamp (seconds)
     * @returns {{ ids, lats, lngs, types, sevs, count }}
     */
    getVisible(windowStart, windowEnd) {
        // Find range of events whose start <= windowEnd
        const endIdx = this._upperBound(windowEnd);

        // Collect indices where end >= windowStart
        const result = [];
        for (let si = 0; si < endIdx; si++) {
            const idx = this._sortedIdx[si];
            if (this.ends[idx] >= windowStart) {
                result.push(idx);
            }
        }

        return {
            indices: result,
            count: result.length,
            // Convenience: direct array access
            getLat: (i) => this.lats[result[i]],
            getLng: (i) => this.lngs[result[i]],
            getType: (i) => this.types[result[i]],
            getSev: (i) => this.sevs[result[i]],
            getId: (i) => this.ids[result[i]],
        };
    }

    /**
     * Get metadata for a specific event ID.
     * Triggers lazy load of events-meta.json on first call.
     */
    getMeta(eventId) {
        if (!this._metaLoaded && !this._metaPromise) {
            this._metaPromise = this._loadMeta();
        }
        if (this._metaLoaded) {
            return this._meta[eventId] || null;
        }
        return null; // not yet loaded — caller should retry or await
    }

    /**
     * Async version: always returns metadata (loads if needed).
     */
    async getMetaAsync(eventId) {
        if (!this._metaLoaded) {
            if (!this._metaPromise) {
                this._metaPromise = this._loadMeta();
            }
            await this._metaPromise;
        }
        return this._meta[eventId] || null;
    }

    async _loadMeta() {
        if (!this._metaUrl) return;
        try {
            const resp = await fetch(this._metaUrl);
            this._meta = await resp.json();
            this._metaLoaded = true;
            console.log(`[ClimateData] Metadata loaded: ${Object.keys(this._meta).length} entries`);
        } catch (err) {
            console.warn('[ClimateData] Metadata load failed:', err);
            this._meta = {};
            this._metaLoaded = true;
        }
    }

    /**
     * Get color for event type (RGB, 0-1 range).
     */
    getTypeColor(typeInt) {
        return this.TYPE_COLORS[typeInt] || [1, 1, 1];
    }

    /**
     * Get size multiplier for severity.
     */
    getSevSize(sevInt) {
        return this.SEV_SIZES[sevInt] || 1.0;
    }

    /**
     * Get stats about the loaded dataset.
     */
    getStats() {
        const typeCounts = {};
        const sevCounts = {};
        let minYear = Infinity, maxYear = -Infinity;
        for (let i = 0; i < this.count; i++) {
            const t = this.types[i];
            const s = this.sevs[i];
            typeCounts[t] = (typeCounts[t] || 0) + 1;
            sevCounts[s] = (sevCounts[s] || 0) + 1;
            const yr = new Date(this.starts[i] * 1000).getUTCFullYear();
            if (yr < minYear) minYear = yr;
            if (yr > maxYear) maxYear = yr;
        }
        return {
            total: this.count,
            typeCounts,
            sevCounts,
            yearRange: [minYear, maxYear],
        };
    }

    /**
     * Destroy: release all typed arrays.
     */
    destroy() {
        this.ids = [];
        this.lats = null;
        this.lngs = null;
        this.starts = null;
        this.ends = null;
        this.types = null;
        this.sevs = null;
        this._sortedIdx = null;
        this._meta = null;
        this._metaPromise = null;
        this.count = 0;
    }
}

// Export for bare-metal JS (no module system)
if (typeof window !== 'undefined') {
    window.ClimateDataLoader = ClimateDataLoader;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ClimateDataLoader };
}
