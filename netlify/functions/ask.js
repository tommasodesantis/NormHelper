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

    // Load and validate PDF
    const pdfPath = path.join(__dirname, '../../..', pdfName);
    
    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'PDF file not found',
          error: `File ${pdfName} does not exist`
        })
      };
    }

    // Check file size (max 25MB for Claude)
    const stats = fs.statSync(pdfPath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    if (fileSizeInMB > 25) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'PDF file too large',
          error: `File size ${fileSizeInMB.toFixed(2)}MB exceeds 25MB limit`
        })
      };
    }

    // Read and convert PDF
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');

    // Build messages array for OpenRouter
    const messages = [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'You are a helpful assistant specialized in analyzing technical documents. ' +
                  'You have been given a PDF document to analyze. Please read it carefully and provide detailed, accurate answers. ' +
                  'For every statement you make, cite the specific page number(s) in parentheses at the end of the relevant sentence. ' +
                  'If a statement combines information from multiple pages, cite all relevant pages. ' +
                  'If you are unsure about a page number, indicate this clearly.'
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:application/pdf;base64,${pdfBase64}`,
              detail: "high"
            }
          }
        ]
      },
      {
        role: 'user',
        content: question
      }
    ];

    // Call Claude 3 Sonnet via OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:8888',
        'X-Title': 'NormHelper'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-sonnet',
        messages,
        stream: false,
        temperature: 0.1 // Lower temperature for more focused, factual responses
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || response.statusText;
      throw new Error(`OpenRouter request failed: ${response.status} - ${errorMessage}`);
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
