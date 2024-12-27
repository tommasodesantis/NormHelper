Below is a comprehensive multi-step implementation plan tailored to seamlessly transition your chatbot from serving static .txt files to directly passing their content via a dedicated module. This plan ensures that the existing logic, prompt caching, and other features remain untouched while implementing the specified change.

Implementation Plan: Direct Text Content Integration for Chatbot
Overview
The objective is to eliminate the dependency on serving static .txt files and instead directly use the text content within a dedicated module. This approach simplifies data handling, reduces potential file-serving issues, and maintains all existing functionalities of your chatbot.

Directory Structure Adjustment

tommasodesantis-NormHelper/
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── texts/           # **Deprecated:** To be removed
├── src/
│   └── texts.js         # **New:** Dedicated module for text contents
├── netlify.toml
├── package.json
└── netlify/
    └── functions/
        ├── ask.js
        └── listFiles.js
Step 1: Create a Dedicated Texts Module
Objective: Centralize all text contents in a single module to be easily accessed by backend functions.

Actions:

Create a New Directory for Source Files:

Path: src/
Reason: Organizes source modules separately from public assets.
Create texts.js Module:

Path: src/texts.js

Content Structure:

javascript

// src/texts.js

const texts = {
  'Eurocode_2_Design_of_concrete_structures_Part_1-1_General.txt': `
  # Eurocode 2 - Design of Concrete Structures Part 1-1: General

  ## Introduction
  This document outlines the standards for designing concrete structures according to Eurocode 2. It ensures safety, durability, and efficiency in construction practices.

  ## Section 1: General Provisions
  ### 1.1 Scope
  Eurocode 2 applies to the design of concrete structures, including buildings, bridges, and other infrastructure projects.

  ### 1.2 Definitions
  - **Concrete:** A composite material composed of fine and coarse aggregates bonded together with a fluid cement, which hardens over time.
  - **Reinforcement:** Steel bars or mesh embedded within concrete to provide tensile strength.
  
  ## Section 2: Design Principles
  ### 2.1 Safety Factors
  Safety factors account for uncertainties in loads, material strengths, and construction methods.

  ### 2.2 Load Considerations
  Loads on structures are classified into permanent, variable, and accidental loads to ensure structural integrity.
  `,
  // Add more text files as needed
};

module.exports = texts;
Notes:

Use descriptive keys matching the file names.
Store the full content of each .txt document as a template string for ease of access.
Step 2: Modify Backend Serverless Functions
A. Update listFiles.js
Objective: Dynamically list available .txt documents based on the texts.js module.

Actions:

Import the texts.js Module:

javascript

// netlify/functions/listFiles.js

const texts = require('../../src/texts');

exports.handler = async (event) => {
  try {
    const files = Object.keys(texts);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ files })
    };
  } catch (error) {
    console.error('Error listing text files:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Unable to list text files.' })
    };
  }
};
Remove Dependency on File System:

Since texts are now within a module, there's no need to read from the file system.
B. Update ask.js
Objective: Use text content directly from the texts.js module instead of fetching from files.

Actions:

Import the texts.js Module:

javascript

// netlify/functions/ask.js

const texts = require('../../src/texts');
const fetch = require('node-fetch'); // Ensure node-fetch is installed
Modify the Handler to Use Text Content Directly:

javascript

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

    // Retrieve text content directly from the module
    const textContent = texts[fileName].trim();

    // Validate text content
    if (!textContent) {
      throw new Error('TEXT_CONTENT_EMPTY');
    }

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
              type: 'persistent' // Enables prompt caching
            }
          }
        ]
      },
      {
        role: 'user',
        content: question
      }
    ];

    // Call OpenRouter's chat completions endpoint
    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888',
        'X-Title': 'NormHelper' // Optional: Set your app's name as needed
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages,
        stream: false,
        temperature: 0.1
      })
    });

    // Handle HTTP errors
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

    // Validate response structure
    if (!data || !Array.isArray(data.choices) || data.choices.length === 0) {
      throw new Error('INVALID_RESPONSE_STRUCTURE');
    }

    const firstChoice = data.choices[0];
    if (!firstChoice.message || !firstChoice.message.content) {
      throw new Error('MESSAGE_CONTENT_MISSING');
    }

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
      stack: error.stack
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
      case error.message === 'INVALID_RESPONSE_STRUCTURE':
        errorType = 'INVALID_RESPONSE_STRUCTURE';
        errorMessage = 'The API response structure is invalid.';
        break;
      case error.message === 'MESSAGE_CONTENT_MISSING':
        errorType = 'MESSAGE_CONTENT_MISSING';
        errorMessage = 'The message content is missing in the API response.';
        break;
      default:
        if (error.message.startsWith('OpenRouter request failed')) {
          errorType = 'OPENROUTER_API_ERROR';
          errorMessage = 'An error occurred while communicating with the AI service. Please try again later.';
        } else {
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
Ensure Environment Variables are Set:

OPENROUTER_API_KEY: API Key for OpenRouter.
URL or DEPLOY_URL: Base URL of your deployed site.
Reason: Required for authentication and constructing proper URLs.
Remove Unnecessary Imports:

If any imports related to file fetching (like fs or reading from the file system) are present, remove them.
Step 3: Refactor Frontend to Utilize the Updated Backend
Objective: Ensure that the frontend correctly interacts with the updated backend functions without relying on static file serving.

Actions:

Update app.js for Dynamic File Selection:

javascript

// public/app.js

// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const questionInput = document.getElementById('questionInput');
const sendButton = document.getElementById('sendButton');
const fileSelect = document.getElementById('fileSelect');

// Event Listeners
sendButton.addEventListener('click', handleSendMessage);
questionInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
});

// Fetch and Populate File List on DOM Content Loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    console.log('Fetching file list...');
    const response = await fetch('/.netlify/functions/listFiles');

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('File list response:', data);

    if (!data.files) {
      if (data.error) {
        throw new Error(data.error);
      }
      throw new Error('No files array in response');
    }

    if (data.files.length === 0) {
      console.warn('No text files found');
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No documents available';
      option.disabled = true;
      fileSelect.appendChild(option);
      return;
    }

    data.files.forEach(file => {
      const option = document.createElement('option');
      option.value = file;
      option.textContent = file.replace('.txt', '').replace(/_/g, ' ');
      fileSelect.appendChild(option);
    });

    console.log('File list populated successfully');
  } catch (error) {
    console.error('Error fetching file list:', error);
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Error loading documents';
    option.disabled = true;
    fileSelect.appendChild(option);
    appendMessage('bot', `Unable to load document list: ${error.message}`);
  }
});

// Handle sending messages
async function handleSendMessage() {
  const question = questionInput.value.trim();
  if (!question) return;

  // Disable input while processing
  setInputState(false);
  
  // Add user message to UI
  appendMessage('user', question);
  questionInput.value = '';

  let response;
  try {
    // Validate file selection
    if (!fileSelect.value) {
      throw new Error('NO_FILE_SELECTED');
    }

    console.log('Sending request with:', {
      question,
      fileName: fileSelect.value
    });

    // Call updated serverless function
    response = await fetch('/.netlify/functions/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        fileName: fileSelect.value
      }),
    });

    // Handle HTTP errors
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Server response error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      throw new Error(`HTTP_ERROR_${response.status}`);
    }

    const data = await response.json();
    console.log('Received response:', data);

    // Validate response data
    if (!data || !data.answer) {
      throw new Error('INVALID_RESPONSE');
    }

    // Add bot response to UI
    appendMessage('bot', data.answer);

  } catch (error) {
    console.error('Error:', error);
    
    // Determine appropriate error message based on error type
    let errorMessage = 'Sorry, I encountered an error while processing your question. ';
    
    switch(error.message) {
      case 'NO_FILE_SELECTED':
        errorMessage += 'Please select a text document first.';
        break;
        
      case 'INVALID_RESPONSE':
        errorMessage += 'Received an invalid response from the server. Please try again.';
        break;
        
      case error.message.match(/^HTTP_ERROR_\d+/)?.input:
        const statusCode = error.message.split('_')[2];
        if (statusCode === '404') {
          errorMessage += 'The requested resource was not found.';
        } else if (statusCode === '429') {
          errorMessage += 'Too many requests. Please wait a moment and try again.';
        } else if (statusCode.startsWith('5')) {
          errorMessage += 'The server encountered an error. Please try again later.';
        } else {
          errorMessage += `Server returned error ${statusCode}.`;
        }
        break;
        
      default:
        errorMessage += 'An unexpected error occurred. Please try again later.';
    }
    
    appendMessage('bot', errorMessage);
  }

  // Re-enable input
  setInputState(true);
}

// Append a message to the chat UI
function appendMessage(sender, content) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;
  
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  
  // If it's an error message from the bot, add error styling
  if (sender === 'bot' && content.startsWith('Sorry, I encountered an error')) {
    messageContent.classList.add('error-message');
  }
  
  messageContent.innerHTML = marked.parse(content);
  messageDiv.appendChild(messageContent);
  
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Enable/disable input controls
function setInputState(enabled) {
  questionInput.disabled = !enabled;
  sendButton.disabled = !enabled;
  sendButton.textContent = enabled ? 'Send' : 'Sending...';
  
  // Also disable file selection while processing
  fileSelect.disabled = !enabled;
}

// Add CSS for error message styling
const style = document.createElement('style');
style.textContent = `
    .error-message {
        color: #dc2626;
        background-color: #fee2e2;
        border: 1px solid #fecaca;
        border-radius: 0.375rem;
        padding: 0.75rem;
        margin: 0.5rem 0;
    }
`;
document.head.appendChild(style);
Ensure Frontend No Longer Depends on Static Files:

Remove any code that fetches from /public/texts/ or similar paths.
Step 4: Update Configuration Files
A. Modify netlify.toml
Objective: Remove configurations related to serving static .txt files and ensure proper routing for serverless functions.

Actions:

Remove Redirects for /texts/*:

Since text content is now within a module, there's no need to serve static files from /texts/.
Ensure Proper Routing for Serverless Functions:

Maintain redirects to serverless functions as needed.
Final netlify.toml Configuration:

toml

[build]
  functions = "netlify/functions"
  publish = "public"

[dev]
  publish = "public"
  port = 8888
  autoLaunch = false

[[headers]]
  for = "/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  force = false
Notes:
Removed any existing redirects for /texts/* or similar paths.
Ensured that all other requests are properly routed to index.html without interference.
B. Remove _headers File
Objective: Clean up any redundant or obsolete header configurations related to static file serving.

Actions:

Delete or Update /public/_headers:

If _headers contains rules for /texts/*, remove those entries.
Ensure only necessary headers remain.
Final /public/_headers Content:

plaintext

# General Headers for API Routes if needed
/* 
  Access-Control-Allow-Origin: *
Notes:
Retain essential headers like Access-Control-Allow-Origin if required.
Remove any file-type specific headers that are no longer applicable.
Step 5: Remove Deprecated texts/ Directory
Objective: Clean up obsolete directories to prevent confusion and reduce clutter.

Actions:

Delete the public/texts/ Directory:

Command:
bash

rm -rf public/texts/
Reason: Since text contents are now managed within the texts.js module, serving static files from this directory is no longer needed.
Update .gitignore (Optional):

Ensure that any residual configurations or cached data related to public/texts/ are excluded if necessary.

Summary
By following this detailed implementation plan, you will successfully transition your chatbot from serving static .txt files to directly utilizing their content through a dedicated module. This change will streamline data handling, mitigate file-serving complications, and preserve all existing chatbot functionalities, including prompt caching and error handling. Additionally, the plan includes steps for testing, documentation, and rollbacks to ensure a smooth and reliable deployment.