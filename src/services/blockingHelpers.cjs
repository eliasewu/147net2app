// =================================================================
// blockingHelpers.cjs — shared blocking helper functions
// Used by both server.cjs and external-api.cjs (attached to pool).
// Extracted so unit tests can import the real implementation.
// =================================================================
// @ts-nocheck

/**
 * Attach blocking helper functions to a pool-like object with a .query()
 * method. Returns the pool for chaining.
 *
 * @param {object} pool - Pool-like object with async .query(sql, params) → { rows }
 */
function attachBlockingHelpers(pool) {
  // ===================== BLOCKING HELPERS (server.cjs + external-api.cjs) =====================
  // Number prefix blacklist check — rejects destinations matching any active prefix.
  // Scoped globally AND per-client AND per-supplier.
  // Returns { blocked: boolean, reason?: string }
  pool.checkNumberBlacklist = async function (destination, clientId = null, supplierId = null) {
    try {
      const digits = String(destination || '').replace(/[^0-9]/g, '');
      if (!digits) return { blocked: false };

      // Match: global rules (client_id IS NULL AND supplier_id IS NULL),
      //        per-client rules (client_id = $2),
      //        per-supplier rules (supplier_id = $3)
      const r = await pool.query(
        `SELECT prefix, client_id, supplier_id FROM number_blacklists
         WHERE is_active = true
           AND ((client_id IS NULL AND supplier_id IS NULL)
                OR (client_id = $2)
                OR (supplier_id = $3))
           AND $1 LIKE prefix || '%'
         LIMIT 1`,
        [digits, clientId || null, supplierId || null]
      );
      if (r.rows.length) {
        const entry = r.rows[0];
        const scope = entry.client_id ? `client #${entry.client_id}` : (entry.supplier_id ? `supplier #${entry.supplier_id}` : 'global');
        return { blocked: true, reason: `Destination prefix "${entry.prefix}" is blacklisted (scope: ${scope})` };
      }
      return { blocked: false };
    } catch (e) {
      console.warn('[number-blacklist] check failed (allowing by default):', e.message);
      return { blocked: false };
    }
  };

  // Keyword content filter check — rejects messages containing any active keyword.
  // Supports substring and whole-word matching with full Unicode.
  // Scoped globally AND per-client AND per-supplier.
  // Returns { blocked: boolean, reason?: string }
  pool.checkKeywordFilter = async function (message, clientId = null, supplierId = null) {
    try {
      const text = String(message || '');
      if (!text) return { blocked: false };

      const r = await pool.query(
        `SELECT keyword, match_mode, client_id, supplier_id FROM keyword_filters
         WHERE is_active = true
           AND ((client_id IS NULL AND supplier_id IS NULL)
                OR (client_id = $1)
                OR (supplier_id = $2))
         ORDER BY id`,
        [clientId || null, supplierId || null]
      );

      for (const entry of r.rows) {
        const kw = entry.keyword;
        if (entry.match_mode === 'whole_word') {
          // Whole-word: keyword surrounded by word boundaries (Unicode-aware).
          // Includes Bengali danda (। U+0964) and double danda (॥ U+0965).
          const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const re = new RegExp('(?:^|[\\s,.!?;:\\-\\u0964\\u0965\\u2000-\\u206F\\u3000\\u3001\\u3002])' + escaped + '(?:$|[\\s,.!?;:\\-\\u0964\\u0965\\u2000-\\u206F\\u3000\\u3001\\u3002])', 'iu');
          if (re.test(text)) {
            const scope = entry.client_id ? `client #${entry.client_id}` : (entry.supplier_id ? `supplier #${entry.supplier_id}` : 'global');
            return { blocked: true, reason: `Message contains blocked keyword "${kw}" (${entry.match_mode}, scope: ${scope})` };
          }
        } else {
          // Substring: case-insensitive match anywhere in text (Unicode-aware)
          if (text.toLowerCase().includes(kw.toLowerCase())) {
            const scope = entry.client_id ? `client #${entry.client_id}` : (entry.supplier_id ? `supplier #${entry.supplier_id}` : 'global');
            return { blocked: true, reason: `Message contains blocked keyword "${kw}" (${entry.match_mode}, scope: ${scope})` };
          }
        }
      }
      return { blocked: false };
    } catch (e) {
      console.warn('[keyword-filter] check failed (allowing by default):', e.message);
      return { blocked: false };
    }
  };

  // Convenience: combined blocking check — runs number blacklist + keyword filter.
  // Returns first blocking reason found, or { blocked: false }.
  pool.checkBlockingRules = async function (destination, message, clientId = null, supplierId = null) {
    const nb = await pool.checkNumberBlacklist(destination, clientId, supplierId);
    if (nb.blocked) return nb;
    const kw = await pool.checkKeywordFilter(message, clientId, supplierId);
    if (kw.blocked) return kw;
    return { blocked: false };
  };

  return pool;
}

module.exports = { attachBlockingHelpers };
