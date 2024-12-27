// netlify/functions/ask.js

const { Buffer } = require('buffer');
const fetch = require('node-fetch');

exports.handler = async (event) => {
  try {
    // Parse and validate request body
    const { question, pdfName } = JSON.parse(event.body);

    // Validate presence of pdfName
    if (!pdfName) {
      throw new Error('PDF_NAME_MISSING');
    }

    // Validate PDF format
    if (!pdfName.toLowerCase().endsWith('.pdf')) {
      throw new Error('INVALID_PDF_FORMAT');
    }

    // Validate required environment variables
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY environment variable');
    }

    // Construct PDF URL
    const siteUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';
    const pdfUrl = `${siteUrl}/pdfs/${encodeURIComponent(pdfName)}`;

    // Log environment info and PDF URL
    console.log('Environment Variables:', {
      URL: process.env.URL,
      DEPLOY_URL: process.env.DEPLOY_URL,
      NODE_ENV: process.env.NODE_ENV,
      PWD: process.env.PWD
    });
    console.log('Constructed PDF URL:', pdfUrl);

    // Fetch PDF
    let pdfResponse;
    try {
      console.log('Attempting to fetch PDF from:', pdfUrl);
      pdfResponse = await fetch(pdfUrl);

      console.log('PDF Fetch Response Status:', pdfResponse.status);
      console.log('PDF Fetch Response Content-Type:', pdfResponse.headers.get('Content-Type'));

      if (!pdfResponse.ok) {
        console.error('PDF fetch failed:', {
          url: pdfUrl,
          status: pdfResponse.status,
          statusText: pdfResponse.statusText,
          siteUrl: siteUrl
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
              siteUrl: siteUrl,
              pdfName,
              fullUrl: pdfUrl,
              env: process.env.NODE_ENV
            }
          })
        };
      }

      // Log detailed response information
      console.log('PDF Response Details:', {
        status: pdfResponse.status,
        statusText: pdfResponse.statusText,
        headers: Object.fromEntries(pdfResponse.headers.entries()),
        url: pdfUrl
      });

      // More lenient Content-Type validation
      const contentType = pdfResponse.headers.get('Content-Type');
      console.log('Content-Type:', contentType);
      
      // Allow common PDF content types and octet-stream
      const validTypes = ['application/pdf', 'application/x-pdf', 'application/octet-stream'];
      if (contentType && !validTypes.some(type => contentType.includes(type))) {
        console.warn('Unexpected Content-Type for PDF:', {
          url: pdfUrl,
          contentType: contentType
        });
        // Continue anyway, we'll validate the content itself
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
            siteUrl: siteUrl,
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
    console.log('PDF Content Length (bytes):', pdfBuffer.byteLength);
    console.log('Base64 PDF Length (characters):', pdfBase64.length);

    // Build messages array for OpenRouter with correct message types
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
            type: 'image_url',
            image_url: {
              url: `data:application/pdf;base64,${pdfBase64}`,
              detail: 'auto' // Optional: Adjust based on OpenRouter's requirements
            },
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

    // Debug: Log the messages being sent to OpenRouter
    console.log('Messages sent to OpenRouter:', JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet',
      messages,
      stream: false,
      temperature: 0.1
    }, null, 2));

    // Call OpenRouter's chat completions endpoint
    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': siteUrl,
        'X-Title': 'NormHelper' // Optional: Set your app's name as needed
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages,
        stream: false,
        temperature: 0.1
      })
    });

    // Check if OpenRouter request was successful
    if (!openRouterResponse.ok) {
      const errorData = await openRouterResponse.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || openRouterResponse.statusText;
      console.error('OpenRouter request failed:', {
        status: openRouterResponse.status,
        statusText: openRouterResponse.statusText,
        errorMessage
      });
      throw new Error(`OpenRouter request failed: ${openRouterResponse.status} - ${errorMessage}`);
    }

    // Parse OpenRouter response
    const data = await openRouterResponse.json();

    // Detailed validation of the API response structure
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

    // Log the assistant's answer
    console.log('Assistant Answer:', firstChoice.message.content);

    // Return the assistant's answer
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        answer: firstChoice.message.content,
        debug: {
          responseStructure: {
            hasChoices: Array.isArray(data.choices),
            choicesLength: data.choices.length,
            hasMessage: Boolean(firstChoice.message),
            hasContent: Boolean(firstChoice.message.content)
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
      url: error.url || 'N/A'
    });
    
    // Map specific error messages
    switch (true) {
      case error.message === 'PDF_NAME_MISSING':
        errorType = 'VALIDATION_ERROR';
        errorMessage = 'No PDF file was specified.';
        break;
      case error.message === 'INVALID_PDF_FORMAT':
        errorType = 'VALIDATION_ERROR';
        errorMessage = 'Invalid PDF file format. Please provide a valid PDF.';
        break;
      case error.message.includes('API response is empty'):
        errorType = 'EMPTY_RESPONSE';
        errorMessage = 'The API returned an empty response.';
        break;
      case error.message.includes('missing choices array'):
        errorType = 'INVALID_RESPONSE_STRUCTURE';
        errorMessage = 'The API response is missing the expected choices array.';
        break;
      case error.message.includes('empty choices array'):
        errorType = 'NO_CHOICES';
        errorMessage = 'The API returned no choices in the response.';
        break;
      case error.message.includes('missing message object'):
        errorType = 'MISSING_MESSAGE';
        errorMessage = 'The API response is missing the message object.';
        break;
      case error.message.includes('missing content'):
        errorType = 'MISSING_CONTENT';
        errorMessage = 'The API response message has no content.';
        break;
      case error.message.includes('Failed to fetch PDF'):
        errorType = 'PDF_FETCH_FAILED';
        errorMessage = 'Failed to fetch the PDF document. Please ensure the file exists and try again.';
        break;
      case error.message.includes('INVALID_PDF_FORMAT'):
        errorType = 'INVALID_PDF_FORMAT';
        errorMessage = 'The fetched file is not a valid PDF.';
        break;
      default:
        if (error.message.startsWith('OpenRouter request failed')) {
          errorType = 'OPENROUTER_API_ERROR';
          errorMessage = 'An error occurred while communicating with the AI service. Please try again later.';
        } else {
          if (!navigator.onLine) {
            errorMessage = 'Please check your internet connection and try again.';
          }
        }
    }

    // Return error response
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
