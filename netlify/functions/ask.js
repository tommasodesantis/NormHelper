// netlify/functions/ask.js

const fetch = require('node-fetch');

exports.handler = async (event) => {
  try {
    // Parse and validate request body
    const { question, fileName } = JSON.parse(event.body);

    // Validate presence of fileName
    if (!fileName) {
      throw new Error('FILE_NAME_MISSING');
    }

    // Validate .txt format
    if (!fileName.toLowerCase().endsWith('.txt')) {
      throw new Error('INVALID_FILE_FORMAT');
    }

    // Validate required environment variables
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY environment variable');
    }

    // Get base URL from environment variables
    const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';
    const fileUrl = `${baseUrl}/texts/${encodeURIComponent(fileName)}`;
    
    console.log('Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      URL: process.env.URL,
      DEPLOY_URL: process.env.DEPLOY_URL
    });
    
    console.log('Attempting to fetch file from:', fileUrl);

    // Fetch the text file
    let textContent;
    try {
      console.log('Starting file fetch from URL:', fileUrl);
      const response = await fetch(fileUrl);
      
      // Log response headers
      const headers = {};
      response.headers.forEach((value, name) => {
        headers[name] = value;
      });
      console.log('Response headers:', headers);
      
      if (!response.ok) {
        console.error('File fetch failed:', {
          status: response.status,
          statusText: response.statusText
        });
        return {
          statusCode: response.status,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Text file not found',
            error: `Failed to fetch text from ${fileUrl}`,
            status: response.status,
            statusText: response.statusText
          })
        };
      }

      textContent = await response.text();
      console.log('Successfully fetched file, content length:', textContent.length);
      console.log('First 500 characters of content:', textContent.substring(0, 500));
      console.log('Content type from response:', response.headers.get('content-type'));
      
      // Validate content type
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        console.error('Received HTML content instead of text file');
        throw new Error('INVALID_CONTENT_TYPE');
      }
    } catch (fetchError) {
      console.error('Error fetching file:', fetchError);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Error fetching text file',
          error: fetchError.toString()
        })
      };
    }

    // Get the site URL for OpenRouter headers
    const siteUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';

    // Validate text content
    if (!textContent || textContent.length === 0) {
      throw new Error('TEXT_CONTENT_EMPTY');
    }

    console.log('Text content validation passed, length:', textContent.length);

    // Build messages array for OpenRouter with prompt caching
    const messages = [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'You are a helpful assistant specialized in analyzing technical documents. ' +
                  'You have been given a text document to analyze. Please read it carefully and provide detailed, accurate answers. ' +
                  'For every statement you make, cite the specific section or paragraph number(s) in parentheses at the end of the relevant sentence. ' +
                  'For statements combining information from multiple sections, cite all relevant sections. ' +
                  'If you are unsure about a section number, indicate this clearly.'
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
      case error.message === 'FILE_NAME_MISSING':
        errorType = 'VALIDATION_ERROR';
        errorMessage = 'No text file was specified.';
        break;
      case error.message === 'INVALID_FILE_FORMAT':
        errorType = 'VALIDATION_ERROR';
        errorMessage = 'Invalid file format. Please provide a valid .txt file.';
        break;
      case error.message === 'TEXT_CONTENT_EMPTY':
        errorType = 'VALIDATION_ERROR';
        errorMessage = 'The provided text file is empty.';
        break;
      case error.message.includes('API response is empty'):
        errorType = 'EMPTY_RESPONSE';
        errorMessage = 'The API returned an empty response.';
        break;
      case error.message.includes('missing choices array'):
        errorType = 'INVALID_RESPONSE_STRUCTURE';
        errorMessage = 'The API response is missing the choices array.';
        break;
      case error.message.includes('empty choices array'):
        errorType = 'NO_CHOICES';
        errorMessage = 'The API returned no choices in the response.';
        break;
      case error.message.includes('missing message object'):
        errorType = 'MISSING_MESSAGE';
        errorMessage = 'The API response is missing the message object.';
        break;
      case error.message.includes('Failed to fetch text'):
        errorType = 'TEXT_FETCH_FAILED';
        errorMessage = 'Failed to fetch the text document. Please ensure the file exists and try again.';
        break;
      case error.message.includes('INVALID_FILE_FORMAT'):
        errorType = 'INVALID_FILE_FORMAT';
        errorMessage = 'The fetched file is not a valid .txt file.';
        break;
      default:
        if (error.message.startsWith('OpenRouter request failed')) {
          errorType = 'OPENROUTER_API_ERROR';
          errorMessage = 'An error occurred while communicating with the AI service. Please try again later.';
        } else {
          // Remove browser-specific check since we're in Node.js environment
          errorMessage = 'An unexpected error occurred. Please try again.';
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
