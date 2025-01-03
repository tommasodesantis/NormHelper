To effectively modify your application to maintain conversation history while optimizing text document handling using OpenRouter's prompt caching feature, follow this comprehensive multistep plan. This plan ensures that the normative text document is sent only once at the start of the conversation and leverages cached context for all subsequent interactions, thereby reducing token usage and improving response times.

## **Overview of the Plan**

1. **Session Management**
2. **Backend Enhancements**
3. **Frontend Enhancements**
4. **Integrate Prompt Caching with Conversation History**
5. **Optimize Token Usage**
6. **Testing and Validation**
7. **Deployment and Monitoring**

---

## **Step 1: Implement Session Management**

To maintain conversation history per user, you need a mechanism to identify and track individual user sessions.

### **1.1. Generate Unique Session IDs**

**Backend:**

- Install the `uuid` package to generate unique session identifiers.

  ```bash
  npm install uuid
  ```

- Update `/server.js` to include session ID generation.

  ```javascript
  const express = require('express');
  const fetch = require('node-fetch');
  const path = require('path');
  const { v4: uuidv4 } = require('uuid'); // Import UUID
  require('dotenv').config();

  const app = express();
  const PORT = process.env.PORT || 5000;
  const isProduction = process.env.NODE_ENV === 'production';

  // In-memory session store (for production, consider using a database or Redis)
  const sessions = {};

  // Middleware to parse JSON bodies
  app.use(express.json());

  // Serve static files from the 'public' directory with production optimizations
  if (isProduction) {
    app.use(express.static(path.join(__dirname, 'public'), {
      maxAge: '1y',
      etag: false
    }));
  } else {
    app.use(express.static(path.join(__dirname, 'public')));
  }

  // ... (rest of your server code)
  ```

### **1.2. Assign Session IDs to Users**

**Backend:**

- Create a route to initialize a session and return a unique session ID.

  ```javascript
  /**
   * Route: /api/initSession
   * Method: GET
   * Description: Initializes a new session and returns a session ID
   */
  app.get('/api/initSession', (req, res) => {
    const sessionId = uuidv4();
    sessions[sessionId] = {
      messages: [] // Initialize empty conversation history
    };
    res.status(200).json({ sessionId });
  });
  ```

**Frontend:**

- Modify `/public/app.js` to request a session ID upon initial load and store it in `localStorage`.

  ```javascript
  // Function to initialize session
  async function initializeSession() {
    let sessionId = localStorage.getItem('sessionId');
    if (!sessionId) {
      try {
        const response = await fetch('/api/initSession');
        const data = await response.json();
        sessionId = data.sessionId;
        localStorage.setItem('sessionId', sessionId);
      } catch (error) {
        console.error('Error initializing session:', error);
        appendMessage('bot', 'Unable to initialize session. Please try again later.');
      }
    }
    return sessionId;
  }

  // Modify DOMContentLoaded event to initialize session
  document.addEventListener('DOMContentLoaded', async () => {
    // Initialize session
    const sessionId = await initializeSession();
    // Store sessionId for later use
    window.sessionId = sessionId;

    // Existing code...
  });
  ```

---

## **Step 2: Enhance Backend to Manage Conversation History**

Modify your backend to handle and store conversation history per session.

### **2.1. Update the `/api/ask` Route**

**Backend:**

- Modify the `/api/ask` endpoint to accept a `sessionId` and manage conversation history accordingly.

  ```javascript
  /**
   * Route: /api/ask
   * Method: POST
   * Description: Handles AI questioning with conversation history and prompt caching
   */
  app.post('/api/ask', async (req, res) => {
    try {
      const { sessionId, question, fileName, model } = req.body;

      if (!sessionId || !sessions[sessionId]) {
        return res.status(400).json({ error: 'Invalid or missing session ID.' });
      }

      if (!question) {
        return res.status(400).json({ error: 'No question provided.' });
      }

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

      // Retrieve or initialize conversation history
      const session = sessions[sessionId];
      let messages = [];

      if (session.messages.length === 0) {
        // First message: include system prompt and normative text with prompt caching
        messages.push({
          role: 'system',
          content: [
            {
              type: 'text',
              text: 'You are a helpful assistant specialized in analyzing technical engineering documents. ' +
                    'You have been given a text document to analyze. Please read it carefully and provide detailed, accurate answers. ' +
                    'For every statement you make, cite the specific section or paragraph number(s) in parentheses and the page at the end of the relevant sentence. ' +
                    'For statements combining information from multiple sections, cite all relevant sections and pages. ' +
                    'If you are unsure about a section number, indicate this clearly.' +
                    'When analyzing the document titled "DECRETO 31 luglio 2012. Approvazione delle Appendici nazionali recanti i parametri tecnici per l applicazione degli Eurocodici," note that due to the poor resolution of the original document, there may be some errors in symbols or contents in the answers provided; IMPORTANT: at the end of each answer related to this particular document (dont do that for other documents!), always inform the user about this issue and advise them to consult the original document at the page(s) and section(s) provided.' +
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
        });
      } else {
        // Subsequent messages: retrieve conversation history
        messages = [...session.messages];
      }

      // Append user's question
      messages.push({
        role: 'user',
        content: question
      });

      // Prepare the payload for OpenRouter
      const openRouterPayload = {
        model,
        messages,
        stream: false,
        temperature: 0.1
      };

      const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': siteUrl,
          'X-Title': 'NormHelper'
        },
        body: JSON.stringify(openRouterPayload)
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

      const answer = data.choices[0].message.content;

      // Append the assistant's answer to conversation history
      session.messages.push({
        role: 'assistant',
        content: answer
      });

      res.status(200).json({ answer });
    } catch (error) {
      console.error('Error in /api/ask:', error);
      res.status(500).json({
        error: 'An unexpected error occurred. Please try again later.',
        details: error.toString()
      });
    }
  });
  ```

### **2.2. Manage Session Expiry and Cleanup**

**Backend:**

- To prevent memory leaks, implement a cleanup mechanism for inactive sessions. You can use `setInterval` to periodically purge sessions that haven't been active for a certain duration (e.g., 1 hour).

  ```javascript
  // Add a timestamp to each session
  app.get('/api/initSession', (req, res) => {
    const sessionId = uuidv4();
    sessions[sessionId] = {
      messages: [],
      lastActive: Date.now()
    };
    res.status(200).json({ sessionId });
  });

  // Update lastActive on each /api/ask request
  app.post('/api/ask', async (req, res) => {
    // ... existing code ...

    // Update lastActive timestamp
    sessions[sessionId].lastActive = Date.now();

    // ... existing code ...
  });

  // Cleanup inactive sessions every hour
  setInterval(() => {
    const now = Date.now();
    const expirationTime = 60 * 60 * 1000; // 1 hour

    for (const [sessionId, session] of Object.entries(sessions)) {
      if (now - session.lastActive > expirationTime) {
        delete sessions[sessionId];
        console.log(`Session ${sessionId} expired and was deleted.`);
      }
    }
  }, 60 * 60 * 1000); // Every hour
  ```

---

## **Step 3: Update Frontend to Handle Session IDs**

Ensure that the frontend sends the `sessionId` with each request to maintain conversation consistency.

### **3.1. Modify the Ask Function to Include Session ID**

**Frontend (`/public/app.js`):**

- Update the `handleSendMessage` function to include the `sessionId` in the POST request.

  ```javascript
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

      // Validate AI model selection
      if (!llmSelect.value) {
        throw new Error('NO_MODEL_SELECTED');
      }

      console.log('Sending request with:', {
        sessionId: window.sessionId, // Include sessionId
        question,
        fileName: fileSelect.value,
        model: llmSelect.value
      });

      // Show typing indicator before making the request
      showTypingIndicator();

      // Call updated serverless function
      response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: window.sessionId, // Include sessionId
          question,
          fileName: fileSelect.value,
          model: llmSelect.value
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

      // Remove typing indicator and add bot response to UI
      removeTypingIndicator();
      appendMessage('bot', data.answer);

    } catch (error) {
      console.error('Error:', error);
      
      // Determine appropriate error message based on error type
      let errorMessage = 'Sorry, I encountered an error while processing your question. ';
      
      switch(error.message) {
        case 'NO_FILE_SELECTED':
          errorMessage += 'Please select a text document first.';
          break;

        case 'NO_MODEL_SELECTED':
          errorMessage += 'Please select an AI model first.';
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
      
      // Remove typing indicator and show error message
      removeTypingIndicator();
      appendMessage('bot', errorMessage);
    }

    // Re-enable input
    setInputState(true);
  }
  ```

### **3.2. Ensure Session ID is Sent with Initial Load**

**Frontend (`/public/app.js`):**

- Ensure that the session ID is initialized and stored properly.

  ```javascript
  document.addEventListener('DOMContentLoaded', async () => {
    // Initialize session
    const sessionId = await initializeSession();
    window.sessionId = sessionId;

    // Existing code...

    // Add toggle button for mobile
    const container = document.querySelector('.container');
    const sidePanel = document.querySelector('.side-panel');

    const toggleButton = document.createElement('button');
    toggleButton.textContent = 'Settings';
    toggleButton.className = 'toggle-button';
    toggleButton.setAttribute('aria-label', 'Toggle Settings Panel');
    container.insertBefore(toggleButton, sidePanel);

    toggleButton.addEventListener('click', () => {
      sidePanel.classList.toggle('hidden');
    });

    // Add welcome message
    appendMessage('bot', '👷 Hello! I am Normio, your AI assistant. To get started, please select a normative document and an AI model (Claude 3.5 Sonnet is recommended) in the side panel. Then, feel free to ask me any questions about the selected normative!');

    try {
      console.log('Fetching file list...');
      const response = await fetch('/api/listFiles');

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
  ```

---

## **Step 4: Leverage Prompt Caching with Conversation History**

Ensure that the normative text is sent only once per session and utilize OpenRouter's prompt caching for all subsequent interactions.

### **4.1. Modify the Conversation Flow**

**Backend (`/server.js`):**

- **First Request:** When `session.messages` is empty, send the normative text with `cache_control`.
- **Subsequent Requests:** Omit the normative text and rely on cached context.

This is already handled in the `/api/ask` route from Step 2.1. Ensure that the system prompt is only sent once with the normative text.

### **4.2. Update OpenRouter Payload (If Necessary)**

If OpenRouter requires specific handling for cached prompts, ensure that your requests adhere to their specifications. Based on your current implementation, prompt caching is already leveraged via `cache_control`.

---

## **Step 5: Optimize Token Usage**

Minimize token usage by efficiently managing conversation history and utilizing prompt caching.

### **5.1. Limit Conversation History**

To prevent exceeding token limits, implement a mechanism to truncate or summarize older messages.

**Backend (`/server.js`):**

- Define a maximum number of messages or tokens per session.

  ```javascript
  const MAX_MESSAGES = 20; // Adjust as needed based on token limits
  ```

- Truncate conversation history if it exceeds the maximum.

  ```javascript
  // After appending the assistant's answer
  if (session.messages.length > MAX_MESSAGES) {
    // Remove the oldest messages, keeping the system prompt and recent messages
    session.messages = [
      session.messages[0], // system prompt with normative text
      ...session.messages.slice(- (MAX_MESSAGES - 1))
    ];
  }
  ```

### **5.2. Use Efficient Message Formatting**

Ensure that messages are formatted to use the least number of tokens necessary.

- **System Prompt:** Ensure that the instructions are concise yet comprehensive.
- **User and Assistant Messages:** Avoid unnecessary verbosity.

---

## **Step 6: Enhance Frontend for Improved User Experience**

Ensure the frontend effectively manages sessions and provides a seamless conversation flow.

### **6.1. Display Conversation History**

**Frontend (`/public/app.js`):**

- Modify the `appendMessage` function to handle markdown and maintain a clean UI.

  ```javascript
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
    
    // Add the main content using Markdown
    messageContent.innerHTML = marked.parse(content);
    
    // Optionally, add sources or additional information here
    
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  ```

### **6.2. Handle Session Persistence**

Ensure that the session ID persists across browser reloads by storing it in `localStorage`, as implemented in Steps 1.2 and 3.1.

---

## **Step 7: Testing and Validation**

Before deploying the changes, thoroughly test the application to ensure that all functionalities work as expected.

### **7.1. Test Session Initialization**

1. **Open the Application:** Ensure that a session ID is generated and stored.
2. **Check Network Requests:** Verify that `/api/initSession` is called only once per new session.

### **7.2. Test Conversation Flow**

1. **Start a New Conversation:** Select a normative document and AI model, then ask a question.
   - Ensure that the normative text is sent only once.
2. **Continue the Conversation:** Ask additional questions and verify that previous messages are maintained.
3. **Verify Token Usage and Performance:** Use logging or monitoring to check token counts and response times.
4. **Check Session Expiry:** After the defined inactivity period, ensure that sessions are cleaned up.

### **7.3. Handle Edge Cases**

1. **Invalid Session IDs:** Test how the application handles invalid or missing session IDs.
2. **Exceeded Token Limits:** Verify that older messages are truncated appropriately.
3. **Error Handling:** Ensure that error messages are displayed gracefully to the user.

---

## **Step 8: Deploy and Monitor**

After successful testing, deploy the updated application and set up monitoring to maintain performance and reliability.

### **8.1. Commit and Push Changes**

Ensure all changes are committed to the `migration-to-heroku` branch.

```bash
git add .
git commit -m "Implement conversation history with prompt caching"
git push origin migration-to-heroku
```

### **8.2. Deploy to Heroku**

Push the changes to Heroku for deployment.

```bash
git push heroku migration-to-heroku:main
```

### **8.3. Monitor Deployment Logs**

Keep an eye on Heroku logs to catch any deployment issues early.

```bash
heroku logs --tail
```

### **8.4. Set Up Monitoring Tools**

- **Heroku Metrics:** Utilize Heroku's built-in metrics to monitor performance.
- **External Monitoring:** Consider integrating services like New Relic or Papertrail for advanced monitoring and alerting.

---

## **Step 9: Optimize and Enhance Further**

After deployment, consider additional optimizations and enhancements for better performance and user experience.

### **9.1. Implement Caching Strategies**

- **Client-side Caching:** Cache frequently used data on the client to reduce server load.
- **Server-side Caching:** Utilize caching mechanisms like Redis for scalable session management.

### **9.2. Enhance Security**

- **Rate Limiting:** Implement rate limiting to prevent abuse.
- **Input Validation:** Ensure all inputs are validated to protect against injection attacks.

### **9.3. Improve UI/UX**

- **Loading Indicators:** Enhance the typing indicator for better user feedback.
- **Responsive Design:** Continuously test and optimize for various devices and screen sizes.

### **9.4. Handle Scalability**

- **Horizontal Scaling:** Prepare for scaling the application horizontally by ensuring statelessness or utilizing shared session storage.
- **Load Balancing:** Use Heroku's load balancing features or third-party services to distribute traffic effectively.

---

## **Summary of Changes**

### **Files to Create or Modify:**

- **Create:**
  - Modify `/server.js` to include session management and conversation history.
  
- **Modify:**
  - `/server.js`
  - `/public/app.js`
  
- **Install Dependencies:**
  - `uuid`

### **Key Points:**

- **Session Management:** Unique session IDs ensure personalized conversation histories.
- **Conversation History:** Stored per session to maintain context without resending the normative text.
- **Prompt Caching:** Leverages OpenRouter's prompt caching to optimize cost and performance.
- **Token Optimization:** Limits conversation history to manage token usage efficiently.
- **Frontend Adjustments:** Ensures the session ID is managed and sent correctly with each request.
- **Error Handling:** Provides robust error messages and handles edge cases gracefully.

---

## **Additional Recommendations**

1. **Use Persistent Storage for Sessions:**
   - Consider migrating from in-memory storage to a persistent solution like Redis for scalability and reliability.

2. **Implement Authentication:**
   - If applicable, add user authentication to associate sessions with specific users for enhanced security and personalization.

3. **Enhance Logging:**
   - Implement detailed logging for monitoring conversation flows and diagnosing issues effectively.

4. **Explore OpenRouter Features:**
   - Dive deeper into OpenRouter's documentation to leverage advanced features like custom routing, provider preferences, and structured outputs.

5. **Regularly Update Dependencies:**
   - Keep your dependencies up-to-date to benefit from security patches and performance improvements.

6. **Optimize Frontend Performance:**
   - Use techniques like lazy loading and code splitting to enhance frontend performance.

---

By meticulously following this multistep plan, your application will efficiently maintain conversation history, leverage OpenRouter's prompt caching to minimize token usage, and provide an optimized and responsive user experience. Ensure to adapt each step based on your specific requirements and scalability needs.