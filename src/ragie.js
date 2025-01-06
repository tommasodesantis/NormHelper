const fetch = require('node-fetch');

const RAGIE_API_URL = 'https://api.ragie.ai/retrievals';

/**
 * Perform a retrieval using Ragie API
 * @param {string} apiKey - Ragie API Key
 * @param {object} payload - Retrieval parameters including query, top_k, rerank, etc.
 * @returns {Promise<object>} - Retrieved chunks with scores and metadata
 */
async function performRetrieval(apiKey, payload) {
  try {
    console.log('Sending request to Ragie API...');
    const response = await fetch(RAGIE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: payload.query,
        top_k: payload.top_k || 8,
        rerank: payload.rerank !== undefined ? payload.rerank : true,
        max_chunks_per_document: payload.max_chunks_per_document || 2,
        filter: payload.filter || undefined
      }),
    });

    const rawResponse = await response.text();
    console.log('Raw Ragie API response:', rawResponse);
    
    if (!response.ok) {
      const errorData = JSON.parse(rawResponse);
      const errorMessage = errorData?.detail || errorData?.title || response.statusText;
      throw new Error(`Ragie API Error: ${errorMessage}`);
    }

    const data = JSON.parse(rawResponse);
    console.log('Parsed Ragie response:', JSON.stringify(data, null, 2));
    
    if (!data || !Array.isArray(data.scored_chunks)) {
      throw new Error('Invalid response format from Ragie API');
    }

    return data.scored_chunks.map(chunk => ({
      text: chunk.text,
      score: chunk.score,
      document_id: chunk.document_id,
      document_metadata: chunk.document_metadata || {}
    }));
  } catch (error) {
    if (error.message.includes('Ragie API Error')) {
      throw error;
    }
    throw new Error(`Failed to perform retrieval: ${error.message}`);
  }
}

module.exports = { performRetrieval };
