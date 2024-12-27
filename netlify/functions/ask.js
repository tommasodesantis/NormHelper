import { Buffer } from 'buffer';

export const handler = async (event) => {
  try {
    // Parse and validate request body
    const { question, pdfName } = JSON.parse(event.body);
    
    if (!pdfName) {
      throw new Error('PDF_NAME_MISSING');
    }
    
    if (!pdfName.endsWith('.pdf')) {
      throw new Error('INVALID_PDF_FORMAT');
    }

    // Validate required environment variables
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY environment variable');
    }

    // Construct PDF URL
    const siteUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';
    const pdfUrl = `${siteUrl}/pdfs/${pdfName}`;

    // Log environment info
    console.log('Environment:', {
      URL: process.env.URL,
      DEPLOY_URL: process.env.DEPLOY_URL,
      NODE_ENV: process.env.NODE_ENV
    });

    // Fetch PDF
    console.log('Attempting to fetch PDF from:', pdfUrl);
    let pdfResponse;
    try {
      pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        console.error('PDF fetch failed:', {
          url: pdfUrl,
          status: pdfResponse.status,
          statusText: pdfResponse.statusText,
          siteUrl: process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888'
        });
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'PDF file not found',
            error: `Failed to fetch PDF from ${pdfUrl}`,
            status: pdfResponse.status,
            statusText: pdfResponse.statusText,
            debug: {
              siteUrl: process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888',
              pdfName,
              fullUrl: pdfUrl,
              env: process.env.NODE_ENV
            }
          })
        };
      }
    } catch (fetchError) {
      console.error('PDF fetch error:', {
        error: fetchError.toString(),
        stack: fetchError.stack,
        url: pdfUrl
      });
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Error fetching PDF',
          error: fetchError.toString(),
          debug: {
            siteUrl: process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888',
            pdfName,
            fullUrl: pdfUrl,
            env: process.env.NODE_ENV
          }
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
                  'For statements combining information from multiple pages, cite all relevant pages. ' +
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

    // Call Claude 3.5 Sonnet via OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888',
        'X-Title': 'NormHelper'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages,
        stream: false,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || response.statusText;
      throw new Error(`OpenRouter request failed: ${response.status} - ${errorMessage}`);
    }

    const data = await response.json();

    // Detailed validation of the API response
    if (!data) {
      throw new Error('API response is empty or invalid');
    }

    if (!Array.isArray(data.choices)) {
      throw new Error('API response missing choices array. Response structure: ' + 
        JSON.stringify(data, null, 2));
    }

    if (data.choices.length === 0) {
      throw new Error('API response contains empty choices array');
    }

    const firstChoice = data.choices[0];
    if (!firstChoice.message) {
      throw new Error('First choice missing message object. Choice structure: ' + 
        JSON.stringify(firstChoice, null, 2));
    }

    if (!firstChoice.message.content) {
      throw new Error('Message missing content. Message structure: ' + 
        JSON.stringify(firstChoice.message, null, 2));
    }

    // If we get here, we have a valid answer
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        answer: firstChoice.message.content,
        debug: {
          responseStructure: {
            hasChoices: !!data.choices,
            choicesLength: data.choices?.length,
            hasMessage: !!firstChoice.message,
            hasContent: !!firstChoice.message?.content
          }
        }
      })
    };

  } catch (error) {
    // Determine error type and provide specific error message
    let errorMessage = 'Server error';
    let errorType = 'INTERNAL_ERROR';

    console.error('Function error:', {
      error: error.toString(),
      stack: error.stack,
      url: error.url // For fetch errors
    });
    
    if (error.message === 'PDF_NAME_MISSING') {
      errorType = 'VALIDATION_ERROR';
      errorMessage = 'No PDF file was specified';
    } else if (error.message === 'INVALID_PDF_FORMAT') {
      errorType = 'VALIDATION_ERROR';
      errorMessage = 'Invalid PDF file format';
    } else if (error instanceof TypeError && error.message.includes('fetch')) {
      errorType = 'PDF_FETCH_ERROR';
      errorMessage = 'Failed to fetch the PDF document. Please check if the file exists and try again.';
    } else if (error.message.includes('API response is empty')) {
      errorType = 'EMPTY_RESPONSE';
      errorMessage = 'The API returned an empty response';
    } else if (error.message.includes('missing choices array')) {
      errorType = 'INVALID_RESPONSE_STRUCTURE';
      errorMessage = 'The API response is missing the expected structure';
    } else if (error.message.includes('empty choices array')) {
      errorType = 'NO_CHOICES';
      errorMessage = 'The API returned no choices in the response';
    } else if (error.message.includes('missing message object')) {
      errorType = 'MISSING_MESSAGE';
      errorMessage = 'The API response is missing the message object';
    } else if (error.message.includes('missing content')) {
      errorType = 'MISSING_CONTENT';
      errorMessage = 'The API response message has no content';
    }

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: errorMessage,
        error: error.toString(),
        errorType,
        timestamp: new Date().toISOString(),
        requestId: event.requestId || 'unknown'
      })
    };
  }
};
