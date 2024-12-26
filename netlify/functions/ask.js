import fs from 'fs';
import path from 'path';

export const handler = async (event) => {
  try {
    // Parse request body
    const { question, pdfName } = JSON.parse(event.body);

    // Validate required environment variables
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY environment variable');
    }

    // Load PDF from disk
    const pdfPath = path.join(__dirname, '../../..', pdfName); 
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');

    // Build messages array for OpenRouter
    const messages = [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'You are a helpful assistant. You have been given a PDF file in base64 form. ' +
                  'Please read it and answer questions about it. ' +
                  'At the end of your answer, list any relevant page references in parentheses.'
          },
          {
            type: 'text',
            text: pdfBase64,
            cache_control: { type: 'ephemeral' }
          }
        ]
      },
      {
        role: 'user',
        content: question
      }
    ];

    // Call Claude 3.5 Sonnet via OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:8888',
        'X-Title': 'NormHelper'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter request failed: ${response.status}`);
    }

    const data = await response.json();
    const answer = data?.choices?.[0]?.message?.content || 'No answer found.';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ answer })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Server error',
        error: error.toString()
      })
    };
  }
};
