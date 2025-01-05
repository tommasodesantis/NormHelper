const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const { performRetrieval } = require('./src/ragie');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';

// Security middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'public' directory with production optimizations
if (isProduction) {
  app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1y',
    etag: false
  }));
} else {
  app.use(express.static(path.join(__dirname, 'public')));
}

/**
 * Route: /api/ask
 * Method: POST
 * Description: Handles AI questioning
 */
app.post('/api/ask', async (req, res) => {
  try {
    const { question, fileName, model } = req.body;
    
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Invalid or missing question.' });
    }
    
    if (!fileName || typeof fileName !== 'string') {
      return res.status(400).json({ error: 'Invalid or missing fileName.' });
    }
    
    if (!model || typeof model !== 'string') {
      return res.status(400).json({ error: 'Invalid or missing model.' });
    }

    // Import texts from src/texts.js
    const texts = require('./src/texts');
    if (!texts[fileName]) {
      return res.status(404).json({ error: 'Specified text file does not exist.' });
    }

    const textContent = texts[fileName].trim();
    if (!textContent) {
      return res.status(400).json({ error: 'The provided text file is empty.' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Server configuration error: API key missing.' });
    }

    const siteUrl = process.env.SITE_URL || `http://localhost:${PORT}`;

    const messages = [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'You are a specialized AI assistant for civil engineers. Your primary function is to help engineers understand and apply building codes, standards, and normatives accurately. ' +
                  'Core responsabilities: 1. Provide precise citations of relevant code sections and standards 2. Explain technical requirements clearly and accurately 3. Explain technical requirements clearly and accurately 3. Present numerical values and equations in a clear, structured format 4. Highlight critical safety requirements and mandatory provision 5. Note any regional ariations or special considerations when relevant. ' +
                  'You have been given a text document to analyze, read it accurately since this will be your source of information to provide answers. ' +
                  'IMPORTANT: For every statement you make, cite the specific section or paragraph number(s) in parentheses and the page at the end of the relevant sentence. ' +
                  'For statements combining information from multiple sections, cite all relevant sections and pages. ' +
                  'If you are unsure about a section number, indicate this clearly.' +
                  'Use appropriate Markdown syntax for headers, tables, emphasis, and lists where applicable. ' +
                  'Use proper engineering notation and units, organize information hierarchically with clear section headers, distinguish between mandatory requirements ("shall", "must") and recommendations ("should").'
          },
          {
            type: 'text',
            text: textContent
          }
        ]
      },
      {
        role: 'user',
        content: question
      }
    ];

    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': siteUrl,
        'X-Title': 'NormHelper'
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        temperature: 0.1
      })
    });
    
    if (!openRouterResponse.ok) {
      const errorData = await openRouterResponse.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || openRouterResponse.statusText;
      console.error('OpenRouter request failed:', {
        status: openRouterResponse.status,
        statusText: openRouterResponse.statusText,
        errorMessage
      });
      return res.status(openRouterResponse.status).json({ error: `OpenRouter request failed: ${errorMessage}` });
    }

    const data = await openRouterResponse.json().catch(() => null);
    if (!data || !Array.isArray(data.choices) || data.choices.length === 0 || !data.choices[0].message || !data.choices[0].message.content) {
      return res.status(500).json({ error: 'Invalid response from OpenRouter.' });
    }

    res.status(200).json({ answer: data.choices[0].message.content });
  } catch (error) {
    console.error('Error in /api/ask:', error);
    res.status(500).json({
      error: 'An unexpected error occurred. Please try again later.',
      details: error.toString()
    });
  }
});

/**
 * Route: /api/listFiles
 * Method: GET
 * Description: Lists available text files
 */
app.get('/api/listFiles', (req, res) => {
  try {
    const texts = require('./src/texts');
    const files = Object.keys(texts);
    res.status(200).json({ files });
  } catch (error) {
    console.error('Error in /api/listFiles:', error);
    res.status(500).json({ error: 'Unable to list text files.' });
  }
});

// Fallback Route to Serve index.html for Client-Side Routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * Route: /api/rag
 * Method: POST
 * Description: Handles RAG search using Ragie's retrieval API
 */
app.post('/api/rag', async (req, res) => {
  try {
    const { 
      query,
      rerank = true,
      top_k = 8,
      max_chunks_per_document = 2,
      filter = undefined
    } = req.body;

    if (!query?.trim()) {
      return res.status(400).json({ error: 'Query is required.' });
    }

    const ragieApiKey = process.env.RAGIE_API_KEY;
    if (!ragieApiKey) {
      return res.status(500).json({ error: 'Server configuration error: Ragie API key missing.' });
    }

    // Perform retrieval using Ragie API
    const retrievalPayload = {
      query: query.trim(),
      rerank,
      top_k,
      max_chunks_per_document,
      filter
    };

    const chunks = await performRetrieval(ragieApiKey, retrievalPayload);

    // Return retrieved chunks with metadata
    res.status(200).json({
      chunks: chunks.map(chunk => ({
        text: chunk.text,
        score: chunk.score,
        document_id: chunk.document_id,
        metadata: {
          name: chunk.document_metadata?.document_name || 'Unknown',
          type: chunk.document_metadata?.document_type || 'Unknown',
          source: chunk.document_metadata?.document_source || 'Unknown',
          uploaded_at: chunk.document_metadata?.document_uploaded_at || null
        }
      }))
    });

  } catch (error) {
    console.error('Error in /api/rag:', error);
    const isRagieError = error.message.includes('Ragie API Error');
    res.status(isRagieError ? 400 : 500).json({
      error: isRagieError ? error.message : 'An unexpected error occurred. Please try again later.',
      details: error.toString()
    });
  }
});

// Start the Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
