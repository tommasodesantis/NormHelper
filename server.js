const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Route: /api/ask
 * Method: POST
 * Description: Handles AI questioning
 */
app.post('/api/ask', async (req, res) => {
  try {
    const { question, fileName, model } = req.body;

    if (!fileName) {
      return res.status(400).json({ error: 'No text file specified.' });
    }

    if (!model) {
      return res.status(400).json({ error: 'No AI model specified.' });
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
            text: 'You are a helpful assistant specialized in analyzing technical engineering documents. ' +
                  'You have been given a text document to analyze. Please read it carefully and provide detailed, accurate answers. ' +
                  'For every statement you make, cite the specific section or paragraph number(s) in parentheses and the page at the end of the relevant sentence. ' +
                  'For statements combining information from multiple sections, cite all relevant sections and pages. ' +
                  'If you are unsure about a section number, indicate this clearly.' +
                  'When analyzing the document titled "DECRETO 31 luglio 2012. Approvazione delle Appendici nazionali recanti i parametri tecnici per l applicazione degli Eurocodici," note that due to the poor resolution of the original document, there may be some errors in symbols or contents in the answers provided; IMPORTANT: at the end of each answer related to this particular document (dont do that for other documents!), always inform inform the user about this issue and advice them to consult the original document at the page(s) and section(s) provided.' +
                  'Use appropriate Markdown syntax for headers, tables, emphasis, and lists where applicable.'
          },
          {
            type: 'text',
            text: textContent,
            cache_control: {
              type: 'ephemeral'
            }
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

// Start the Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
