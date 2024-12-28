// netlify/functions/ask.js

const fetch = require('node-fetch');
const texts = require('../../src/texts');

exports.handler = async (event) => {
  try {
    // Parse and validate request body
    const { question, fileName } = JSON.parse(event.body);

    // Validate presence of fileName
    if (!fileName) {
      throw new Error('FILE_NAME_MISSING');
    }

    // Validate source of fileName
    if (!texts[fileName]) {
      throw new Error('FILE_NOT_FOUND');
    }

    // Validate required environment variables
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('Missing OPENROUTER_API_KEY environment variable');
    }

    // Get text content directly from the module
    const textContent = texts[fileName].trim();

    // Validate text content
    if (!textContent) {
      throw new Error('TEXT_CONTENT_EMPTY');
    }

    // Get the site URL for OpenRouter headers
    const siteUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';

    console.log('Text content validation passed, length:', textContent.length);

    // Build messages array for OpenRouter with prompt caching
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

    // Parse OpenRouter response with better error handling
    let data;
    try {
      const responseText = await openRouterResponse.text();
      console.log('Raw OpenRouter response:', responseText);
      
      if (!responseText) {
        throw new Error('Empty response from OpenRouter');
      }
      
      data = JSON.parse(responseText);
      
      if (!data) {
        throw new Error('API response is empty or invalid');
      }
    } catch (parseError) {
      console.error('Error parsing OpenRouter response:', parseError);
      throw new Error(`Failed to parse OpenRouter response: ${parseError.message}`);
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
      case error.message === 'FILE_NOT_FOUND':
        errorType = 'VALIDATION_ERROR';
        errorMessage = 'The specified text file does not exist.';
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
