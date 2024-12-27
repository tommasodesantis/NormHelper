export const handler = async (event) => {
  try {
    // Parse request body
    const { question, pdfName } = JSON.parse(event.body);

    // Validate required environment variables
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY environment variable');
    }

    // Construct PDF URL
    const siteUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';
    const pdfUrl = `${siteUrl}/pdfs/${pdfName}`;

    // Fetch PDF
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'PDF file not found',
          error: `Failed to fetch PDF from ${pdfUrl}`
        })
      };
    }

    // Get PDF content and convert to base64
    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfBase64 = Buffer.from(pdfBuffer).toString('base64');

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
            type: 'text',
            text: `data:application/pdf;base64,${pdfBase64}`,
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
