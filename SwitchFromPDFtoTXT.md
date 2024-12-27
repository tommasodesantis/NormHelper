Certainly! Transitioning your chatbot from handling PDF files to plain text (`.txt`) files while retaining the same model and implementing prompt caching is a multi-faceted process. Below is a **detailed, multi-step plan** designed to guide your AI coding agent through this transition seamlessly. This plan ensures that the core logic of your chatbot remains intact while accommodating the new file format and maintaining prompt caching capabilities.

---

## **Step 1: Update the Directory Structure**

### **Current Structure:**
```
tommasodesantis-NormHelper/
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── pdfs/
│   └── app.js
├── package.json
├── OpenRouter_Docs_261224.txt
├── netlify.toml
└── netlify/
    └── functions/
        └── ask.js
```

### **Proposed Changes:**
- **Add a `texts/` Directory:**
  - Create a new directory named `texts/` within the `public/` folder to store your `.txt` files.

- **Maintain `pdfs/` Directory (Optional):**
  - If you plan to support both `.pdf` and `.txt` files in the future, retain the `pdfs/` directory. Otherwise, you can remove it.

### **Updated Structure:**
```
tommasodesantis-NormHelper/
├── public/
│   ├── index.html
│   ├── styles.css
│   ├── pdfs/          # Optional: Remove if only .txt files are needed
│   ├── texts/         # New directory for .txt files
│   └── app.js
├── package.json
├── OpenRouter_Docs_261224.txt
├── netlify.toml
└── netlify/
    └── functions/
        ├── ask.js
        └── listFiles.js  # New serverless function (Step 5)
```

---

## **Step 2: Frontend Modifications**

### **a. Update `index.html` to Include `.txt` Files**

#### **Current Code:**
```html
<div class="pdf-selector">
    <select id="pdfSelect">
        <option value="eurocode2.pdf">Eurocodice 2 - Concrete Structures</option>
    </select>
</div>
```

#### **Proposed Changes:**
- **Rename Elements for Clarity:**
  - Change identifiers from `pdf` to `file` to generalize for different file types.

- **Dynamic File Loading (Recommended - See Optional Enhancements):**
  - Instead of hardcoding `.txt` files, dynamically fetch the list of available `.txt` files.

#### **Updated Code (`index.html`):**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <!-- ... existing head elements ... -->
</head>
<body>
    <div class="container">
        <div class="chat-container">
            <div class="chat-header">
                <div class="header-content">
                    <img src="imageedit_2_7464007735.png" alt="Normio Logo" class="logo">
                    <h1>Normio</h1>
                </div>
                <p>The only normatives assistant you'll ever need</p>
                <div class="file-selector">
                    <select id="fileSelect">
                        <option value="" disabled selected>Select a text document</option>
                        <!-- Options will be populated dynamically -->
                    </select>
                </div>
            </div>
            <div class="chat-messages" id="chatMessages">
                <!-- Messages will be inserted here -->
            </div>
            <div class="input-container">
                <textarea 
                    id="questionInput" 
                    placeholder="Ask your question..."
                    rows="3"
                ></textarea>
                <button id="sendButton" class="send-button">
                    Send
                </button>
            </div>
        </div>
    </div>
    <script src="app.js"></script>
</body>
</html>
```

### **b. Update CSS if Necessary (`styles.css`)**

#### **Proposed Changes:**
- **Rename `.pdf-selector` to `.file-selector`**
- **Ensure Styles are Generic:**
  - Make sure the styles apply to any file type, not just PDFs.

#### **Updated CSS (`styles.css`):**
```css
/* Rename .pdf-selector to .file-selector */
.file-selector {
    margin-top: 1rem;
    padding: 0.5rem;
}

#fileSelect {
    width: 100%;
    max-width: 400px;
    padding: 0.75rem;
    border: 2px solid #eaeaea;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.9rem;
    background-color: #f8f9fa;
    color: #1a1a1a;
    cursor: pointer;
    transition: all 0.2s ease;
}

#fileSelect:focus {
    outline: none;
    border-color: #0070f3;
    background-color: #ffffff;
    box-shadow: 0 0 0 4px rgba(0, 112, 243, 0.1);
}
```

### **c. Update JavaScript (`app.js`)**

#### **Current Code Snippets:**
```javascript
const pdfSelect = document.getElementById('pdfSelect');

// Inside handleSendMessage function
if (!pdfSelect.value) {
    throw new Error('NO_PDF_SELECTED');
}

// When sending request
body: JSON.stringify({
    question,
    pdfName: pdfSelect.value
}),
```

#### **Proposed Changes:**
- **Rename Variables:**
  - Change `pdfSelect` to `fileSelect`.
  - Change `pdfName` to `fileName`.

- **Dynamic File Loading (See Optional Enhancements):**
  - Fetch the list of `.txt` files from a new serverless function.

#### **Updated Code (`app.js`):**
```javascript
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

        // Call serverless function with updated fileName
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

        // Handle HTTP errors (same as before)
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
                if (!navigator.onLine) {
                    errorMessage += 'Please check your internet connection and try again.';
                } else if (error instanceof SyntaxError) {
                    errorMessage += 'Received an invalid response format from the server.';
                } else if (!response) {
                    errorMessage += 'Failed to connect to the server. Please try again.';
                } else {
                    errorMessage += 'Please try again later.';
                }
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

// Optional: Fetch and populate file list dynamically (see Optional Enhancements)
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/.netlify/functions/listFiles');
        const data = await response.json();
        const files = data.files;
        const fileSelect = document.getElementById('fileSelect');

        files.forEach(file => {
            const option = document.createElement('option');
            option.value = file;
            option.textContent = file.replace('.txt', '').replace(/_/g, ' ');
            fileSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching file list:', error);
    }
});
```

---

## **Step 3: Backend (`ask.js`) Modifications**

### **Current Functionality:**
- Handles PDF files by converting them to base64-encoded image URLs.
- Sends image URLs as part of the system message to OpenRouter.
- Implements error handling specific to PDFs.

### **Proposed Changes:**
- **Handle `.txt` Files Instead of PDFs:**
  - Fetch and process `.txt` files as plain text.
  
- **Maintain the Same Model:**
  - Continue using `anthropic/claude-3.5-sonnet`.

- **Implement Prompt Caching:**
  - Utilize OpenRouter's prompt caching capabilities for text inputs.

### **Detailed Code Changes:**

#### **a. Rename Variables and Parameters:**
- Change `pdfName` to `fileName`.
- Update error messages accordingly.

#### **b. Fetch and Read `.txt` Files:**
- Fetch the `.txt` file content as plain text.
- Implement prompt caching using OpenRouter's `cache_control`.

#### **c. Update Message Construction:**
- Include the text content in the system message with appropriate cache control.

#### **d. Remove PDF-Specific Logic:**
- Eliminate base64 encoding and image URL generation.

#### **e. Ensure Prompt Caching is Enabled:**
- Use `cache_control` in the system message to leverage prompt caching.

#### **Updated `ask.js`:**
```javascript
// netlify/functions/ask.js

const { Buffer } = require('buffer');
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

    // Construct file URL
    const siteUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';
    const fileUrl = `${siteUrl}/texts/${encodeURIComponent(fileName)}`;

    // Log environment info and file URL
    console.log('Environment Variables:', {
      URL: process.env.URL,
      DEPLOY_URL: process.env.DEPLOY_URL,
      NODE_ENV: process.env.NODE_ENV,
      PWD: process.env.PWD
    });
    console.log('Constructed File URL:', fileUrl);

    // Fetch .txt file
    let fileResponse;
    try {
      console.log('Attempting to fetch text file from:', fileUrl);
      fileResponse = await fetch(fileUrl);

      console.log('File Fetch Response Status:', fileResponse.status);
      console.log('File Fetch Response Content-Type:', fileResponse.headers.get('Content-Type'));

      if (!fileResponse.ok) {
        console.error('File fetch failed:', {
          url: fileUrl,
          status: fileResponse.status,
          statusText: fileResponse.statusText,
          siteUrl: siteUrl
        });
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Text file not found',
            error: `Failed to fetch text from ${fileUrl}`,
            status: fileResponse.status,
            statusText: fileResponse.statusText,
            debug: {
              siteUrl: siteUrl,
              fileName,
              fullUrl: fileUrl,
              env: process.env.NODE_ENV
            }
          })
        };
      }

      // Validate Content-Type
      const contentType = fileResponse.headers.get('Content-Type');
      console.log('Content-Type:', contentType);
      
      // Allow text/plain and variants
      const validTypes = ['text/plain'];
      if (contentType && !validTypes.some(type => contentType.includes(type))) {
        console.warn('Unexpected Content-Type for text file:', {
          url: fileUrl,
          contentType: contentType
        });
        // Continue anyway, we'll validate the content itself
      }

    } catch (fetchError) {
      console.error('File fetch error:', {
        error: fetchError.toString(),
        stack: fetchError.stack,
        url: fileUrl
      });
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Error fetching text file',
          error: fetchError.toString(),
          debug: {
            siteUrl: siteUrl,
            fileName,
            fullUrl: fileUrl,
            env: process.env.NODE_ENV
          }
        })
      };
    }

    // Get text content
    const textContent = await fileResponse.text();
    console.log('Text Content Length (characters):', textContent.length);

    // Validate text content
    if (!textContent || textContent.length === 0) {
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
              type: 'persistent' // Use 'persistent' to enable prompt caching
            }
          }
        ]
      },
      {
        role: 'user',
        content: question
      }
    ];

    // Debug: Log the messages being sent to OpenRouter (limit size if necessary)
    console.log('Messages sent to OpenRouter:', JSON.stringify({
      model: 'anthropic/claude-3.5-sonnet', // Same model as before
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
        model: 'anthropic/claude-3.5-sonnet', // Same model as before
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
```

### **Explanation of Changes:**

1. **Parsing Request Body:**
   - Changed from `pdfName` to `fileName` to reflect the new file type.

2. **Validation:**
   - Ensured the selected file ends with `.txt` instead of `.pdf`.
   - Updated error messages to correspond to `.txt` files.

3. **Fetching the File:**
   - Constructed the URL to point to the `texts/` directory.
   - Fetched the file as plain text using `.text()` instead of converting it to a base64-encoded image.
   - Validated the `Content-Type` to be `text/plain`.

4. **Message Construction with Prompt Caching:**
   - Included the text content directly in the system message with `cache_control` set to `persistent` to enable prompt caching.
   - Removed the unconventional use of image URLs for text content.

5. **Maintaining the Same Model:**
   - Continued using `anthropic/claude-3.5-sonnet`.

6. **Error Handling:**
   - Updated error messages and types to reflect issues related to `.txt` files.

7. **Debugging Logs:**
   - Enhanced logging for better traceability, especially concerning the fetched text content.

8. **Prompt Caching:**
   - Utilized `cache_control` in the system message to leverage OpenRouter’s prompt caching capabilities. Setting `type: 'persistent'` ensures that the prompt is cached for future interactions, optimizing performance and reducing costs.

---

## **Step 4: Update `netlify.toml` for New File Paths**

### **Current Redirects:**
```toml
[[redirects]]
  from = "/pdfs/*"
  to = "/pdfs/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  force = false
```

### **Proposed Changes:**
- **Add Redirect for `/texts/*`:**
  - Ensure that requests to `/texts/*` are properly routed to the corresponding `.txt` files.

### **Updated `netlify.toml`:**
```toml
[build]
  functions = "netlify/functions"
  publish = "public"

[dev]
  publish = "public"
  port = 8888
  autoLaunch = false

[[redirects]]
  from = "/pdfs/*"
  to = "/pdfs/:splat"
  status = 200

[[redirects]]
  from = "/texts/*"
  to = "/texts/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  force = false
```

### **Explanation:**
- **Added Redirect for Text Files:**
  - This ensures that any requests to `/texts/*` are correctly routed to the corresponding files in the `texts/` directory.

---

## **Step 5: Implement Dynamic File Listing (Optional but Recommended)**

Instead of hardcoding the `.txt` files in `index.html`, dynamically fetch the list of available `.txt` files. This approach reduces manual updates when adding new files.

### **a. Create a New Serverless Function: `listFiles.js`**

#### **File Path:**
```
netlify/functions/listFiles.js
```

#### **`listFiles.js` Content:**
```javascript
// netlify/functions/listFiles.js

const fs = require('fs');
const path = require('path');

exports.handler = async () => {
  try {
    const textsDir = path.join(process.cwd(), 'public', 'texts');
    const files = fs.readdirSync(textsDir).filter(file => file.endsWith('.txt'));
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ files })
    };
  } catch (error) {
    console.error('Error listing files:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: 'Unable to list text files.' })
    };
  }
};
```

### **b. Update Frontend (`app.js`) to Fetch and Populate File List**

#### **Updated Code Snippet in `app.js`:**
```javascript
// Existing code...

// Dynamic File Loading
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/.netlify/functions/listFiles');
        const data = await response.json();
        const files = data.files;
        const fileSelect = document.getElementById('fileSelect');

        files.forEach(file => {
            const option = document.createElement('option');
            option.value = file;
            option.textContent = file.replace('.txt', '').replace(/_/g, ' ');
            fileSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching file list:', error);
        // Optionally, display a user-friendly message in the UI
        appendMessage('bot', 'Unable to load document list. Please try again later.');
    }
});
```

### **c. Update `index.html` to Remove Hardcoded Options**

#### **Updated `index.html` Snippet:**
```html
<div class="file-selector">
    <select id="fileSelect">
        <option value="" disabled selected>Select a text document</option>
        <!-- Options will be populated dynamically -->
    </select>
</div>
```

### **Explanation:**
- **`listFiles.js` Function:**
  - Reads the `public/texts/` directory.
  - Filters out only `.txt` files.
  - Returns the list of `.txt` files as a JSON response.

- **`app.js` Incident Handling:**
  - On DOMContentLoaded, fetches the list of `.txt` files from the `listFiles` serverless function.
  - Populates the `fileSelect` dropdown with the fetched files.
  - Enhances scalability by automating file listing.

---

## **Step 6: Populate the `texts/` Directory with `.txt` Files**

### **a. Create `.txt` Files:**
- Add your normative documents as `.txt` files in the `public/texts/` directory.
- **Naming Convention:**
  - Use descriptive names without spaces. Replace spaces with underscores (`_`) for better URL handling.
  - Example:
    - `public/texts/eurocode2_concrete_structures.txt`
    - `public/texts/standard_documentation.txt`

### **b. Example Content for `eurocode2_concrete_structures.txt`:**
```txt
# Eurocode 2 - Concrete Structures

## Introduction
This document outlines the standards for the design and construction of concrete structures in accordance with Eurocode 2. It provides guidelines to ensure safety, durability, and performance of concrete constructions.

## Section 1: General Provisions

### 1.1 Scope
Eurocode 2 applies to the design of concrete structures, including buildings, bridges, and other infrastructure projects.

### 1.2 Definitions
- **Concrete:** A composite material composed of fine and coarse aggregate bonded together with a fluid cement that hardens over time.
- **Reinforcement:** Steel bars or mesh embedded within concrete to provide tensile strength.

## Section 2: Design Principles

### 2.1 Safety Factors
Safety factors are applied to account for uncertainties in loads, material strengths, and construction methods.

### 2.2 Load Considerations
Loads on structures are classified into permanent, variable, and accidental loads. Proper load assessments ensure structural integrity.
```

### **Explanation:**
- **Structured Content:**
  - Use markdown-style headings (`#`, `##`, `###`) for better readability and potential parsing.
  
- **Clear Sections:**
  - Break down the document into logical sections and subsections to facilitate accurate referencing by the AI model.

---

## **Step 7: Testing and Validation**

### **a. Frontend Testing:**

1. **Verify Dropdown Options:**
   - Ensure that the `.txt` files are correctly listed in the `fileSelect` dropdown.
   
2. **Select a `.txt` File and Ask a Question:**
   - Choose a text file (e.g., `eurocode2_concrete_structures.txt`) and input a relevant question.
   - Example: "What are the safety factors mentioned in this document?"
   
3. **Check UI Responses:**
   - Confirm that user questions and bot responses appear correctly in the chat interface.
   - Ensure that bot responses include citations as per the system message instructions.

4. **Handle Edge Cases:**
   - **No File Selected:**
     - Attempt to send a question without selecting a file. Ensure that the appropriate error message is displayed.
   
   - **Non-Existent File:**
     - Manipulate the `fileSelect` value to an invalid file name and attempt to send a question. Verify the error handling.
   
   - **Empty `.txt` File:**
     - Add an empty `.txt` file and attempt to use it. Ensure that the bot responds with an appropriate error message.

### **b. Backend Testing:**

1. **Deploy the Updated Function:**
   - Use Netlify CLI (`netlify dev`) or your deployment pipeline to deploy the updated `ask.js` and `listFiles.js` functions.
   
2. **Monitor Logs:**
   - Check Netlify function logs to ensure that:
     - The `.txt` file is fetched successfully.
     - The content is correctly sent to OpenRouter.
     - Responses are handled without errors.
   
3. **Verify Prompt Caching:**
   - Ensure that prompt caching is functioning as intended by observing repeated queries on the same `.txt` file and verifying reduced processing times or costs.
   
4. **Simulate Failures:**
   - **API Failures:**
     - Mock OpenRouter API failures and ensure that error handling works gracefully.
   
   - **File Fetch Failures:**
     - Remove a `.txt` file and attempt to access it through the chatbot. Confirm that the correct error is returned.

### **c. OpenRouter Validation:**

1. **Ensure Proper Responses:**
   - Verify that OpenRouter returns accurate and contextually relevant answers based on the `.txt` files provided.
   - Example Question: "What load considerations are outlined in the document?"
   
2. **Performance Checks:**
   - Assess response times to ensure that text processing is efficient.
   - Monitor the usage of prompt caching to optimize costs.

---

## **Step 8: Optional Enhancements**

### **a. Implement Loading Indicators:**

Enhance user experience by displaying a loading spinner or progress bar while the AI processes the question.

#### **Implementation Steps:**

1. **Update `index.html`:**
   ```html
   <!-- Add a loading spinner element -->
   <div id="loadingSpinner" class="loading-spinner hidden"></div>
   ```
   
2. **Update CSS (`styles.css`):**
   ```css
   .loading-spinner {
       position: absolute;
       top: 50%;
       left: 50%;
       transform: translate(-50%, -50%);
       border: 4px solid rgba(0, 0, 0, 0.1);
       width: 36px;
       height: 36px;
       border-radius: 50%;
       border-left-color: #0070f3;
       animation: spin 1s linear infinite;
   }
   
   @keyframes spin {
       to { transform: rotate(360deg); }
   }
   
   .hidden {
       display: none;
   }
   ```
   
3. **Update `app.js`:**
   ```javascript
   // Add reference to loading spinner
   const loadingSpinner = document.getElementById('loadingSpinner');

   // Modify setInputState to handle spinner
   function setInputState(enabled) {
       questionInput.disabled = !enabled;
       sendButton.disabled = !enabled;
       sendButton.textContent = enabled ? 'Send' : 'Sending...';
       fileSelect.disabled = !enabled;

       // Show or hide loading spinner
       if (!enabled) {
           loadingSpinner.classList.remove('hidden');
       } else {
           loadingSpinner.classList.add('hidden');
       }
   }
   ```

### **b. File Previews:**

Allow users to preview the content of the selected `.txt` file before asking questions.

#### **Implementation Steps:**

1. **Update `index.html`:**
   ```html
   <!-- Add a preview section -->
   <div class="file-preview">
       <h3>Document Preview:</h3>
       <pre id="filePreviewContent">Select a document to preview its content.</pre>
   </div>
   ```
   
2. **Update CSS (`styles.css`):**
   ```css
   .file-preview {
       margin-top: 1rem;
       padding: 0.5rem;
       background-color: #f8f9fa;
       border: 1px solid #eaeaea;
       border-radius: 8px;
       max-height: 200px;
       overflow-y: auto;
   }

   #filePreviewContent {
       white-space: pre-wrap;
       word-wrap: break-word;
   }
   ```
   
3. **Update `app.js`:**
   ```javascript
   // Add reference to file preview content
   const filePreviewContent = document.getElementById('filePreviewContent');

   // Function to fetch and display preview
   async function populateFilePreview(fileName) {
       try {
           const response = await fetch(`/.netlify/functions/getFileContent?fileName=${encodeURIComponent(fileName)}`);
           const data = await response.json();
           if (data.content) {
               filePreviewContent.textContent = data.content.slice(0, 1000) + (data.content.length > 1000 ? '...' : '');
           } else {
               filePreviewContent.textContent = 'Unable to load preview.';
           }
       } catch (error) {
           console.error('Error fetching file preview:', error);
           filePreviewContent.textContent = 'Error loading preview.';
       }
   }

   // Event listener for file selection change
   fileSelect.addEventListener('change', (e) => {
       const selectedFile = e.target.value;
       if (selectedFile) {
           populateFilePreview(selectedFile);
       } else {
           filePreviewContent.textContent = 'Select a document to preview its content.';
       }
   });
   ```

4. **Create a New Serverless Function: `getFileContent.js`**
   
   **File Path:**
   ```
   netlify/functions/getFileContent.js
   ```

   **`getFileContent.js` Content:**
   ```javascript
   const fs = require('fs');
   const path = require('path');

   exports.handler = async (event) => {
       try {
           const { fileName } = event.queryStringParameters;

           if (!fileName) {
               throw new Error('FILE_NAME_MISSING');
           }

           if (!fileName.toLowerCase().endsWith('.txt')) {
               throw new Error('INVALID_FILE_FORMAT');
           }

           const textsDir = path.join(process.cwd(), 'public', 'texts');
           const filePath = path.join(textsDir, fileName);

           if (!fs.existsSync(filePath)) {
               return {
                   statusCode: 404,
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({ error: 'File not found.' })
               };
           }

           const content = fs.readFileSync(filePath, 'utf8');
           return {
               statusCode: 200,
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ content })
           };

       } catch (error) {
           console.error('Error fetching file content:', error);
           return {
               statusCode: 500,
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ error: 'Unable to fetch file content.' })
           };
       }
   };
   ```

### **Explanation:**
- **Loading Indicators:**
  - Provides visual feedback to users during processing.

- **File Previews:**
  - Enhances user experience by allowing users to understand the document context before querying.

- **Additional Serverless Function (`getFileContent.js`):**
  - Fetches the content of a selected `.txt` file for preview purposes.

---

## **Step 8: Final Code Review**

### **a. Frontend (`index.html` and `app.js`):**
- **File Selection Mechanism:**
  - The `fileSelect` dropdown is dynamically populated with `.txt` files.
  
- **Event Listeners:**
  - Properly handle sending messages and updating UI components like loading indicators and file previews.
  
- **Error Messages:**
  - Ensure that user-facing error messages are clear and helpful.

### **b. Backend (`ask.js` and `listFiles.js`):**
- **File Handling:**
  - Correctly fetch `.txt` files, validate content, and handle errors.
  
- **Prompt Caching:**
  - Utilized `cache_control` with `type: 'persistent'` to enable prompt caching.
  
- **Model Consistency:**
  - Continued using `anthropic/claude-3.5-sonnet` as the AI model.

- **Error Handling:**
  - Comprehensive error handling covering various scenarios related to file fetching and API interactions.

### **c. Deployment Configuration (`netlify.toml`):**
- **Redirects:**
  - Properly configured redirects for both `/pdfs/*` (if retained) and `/texts/*` directories.

### **d. Serverless Functions:**
- **`ask.js`:**
  - Handles the core functionality of processing user questions based on `.txt` files.
  
- **`listFiles.js`:**
  - Dynamically lists available `.txt` files for the frontend.

- **`getFileContent.js`:**
  - Provides content previews for selected `.txt` files.

### **e. Documentation:**
- **Code Comments:**
  - Ensure that all code changes are well-commented to aid future maintenance.

- **Internal Documentation:**
  - Update any internal docs or README files to reflect the switch from PDFs to `.txt` files and the new functionalities.

---

## **Step 9: Deploy and Monitor**

### **a. Deploy the Updated Application:**
- **Using Netlify CLI:**
  ```bash
  npm run dev
  ```
  
- **Using CI/CD Pipeline:**
  - Push changes to your repository connected to Netlify for automated deployments.

### **b. Monitor Performance and Logs:**
- **Netlify Function Logs:**
  - Use the Netlify dashboard or CLI to monitor logs for `ask.js`, `listFiles.js`, and `getFileContent.js`.
  
- **Error Tracking:**
  - Ensure that any unexpected errors are quickly identified and addressed.

### **c. Gather User Feedback:**
- **Feedback Mechanism:**
  - Implement a simple feedback form or reporting tool to gather user experiences and identify issues.

- **Iterative Improvements:**
  - Use the feedback to make continuous improvements to the chatbot's functionality and user interface.

---

## **Step 10: Rollback Plan**

In case any issues arise during the transition, have a rollback strategy in place to revert to the previous stable state.

### **a. Version Control:**
- **Commit Changes Incrementally:**
  - Ensure that each significant change is committed separately with clear commit messages.
  
- **Create a Release Tag:**
  - Tag the current stable version before making large changes.

### **b. Backup:**
- **Backup Existing Functions:**
  - Keep a backup of the original `ask.js`, `index.html`, and other related files.

### **c. Revert Changes if Necessary:**
- **Using Git:**
  ```bash
  git checkout <commit-id> path/to/file
  ```
  
- **Redeploy Previous Version:**
  - If using Netlify, redeploy the previous commit to restore functionality.

### **d. Notify Stakeholders:**
- **Communication:**
  - Inform relevant team members or stakeholders about the rollback and ensure transparency in operations.

---

## **Summary**

By following this comprehensive, multi-step plan, your chatbot will successfully transition from handling PDF files to plain text (`.txt`) files. The plan ensures that:

- **Core Functionality Remains Intact:**
  - Users can still select their desired documents and interact seamlessly with the AI assistant.

- **Same AI Model is Utilized:**
  - Continues leveraging `anthropic/claude-3.5-sonnet` without changes.

- **Prompt Caching is Retained and Enhanced:**
  - Utilizes OpenRouter's prompt caching capabilities to optimize performance and reduce costs.

- **User Experience is Improved:**
  - Through dynamic file loading, loading indicators, and file previews.

- **Scalability and Maintainability:**
  - Automated file listing and structured code changes facilitate easier future updates.

- **Robust Error Handling and Rollback Mechanisms:**
  - Ensures reliability and quick recovery in case of issues.

Implementing this plan will enhance your chatbot's versatility, making it more user-friendly and efficient while maintaining its foundational capabilities.

Feel free to reach out if you encounter any challenges during the implementation or need further assistance!