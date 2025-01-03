To integrate a **Retrieval-Augmented Generation (RAG) mode** into your existing chatbot using the **Ragie API**, while preserving the current functionalities, follow the detailed multi-step plan outlined below. This plan covers both backend and frontend modifications, ensuring a seamless addition of the RAG mode as an optional feature for users.

---

## **Overview of the Integration Plan**

1. **Environment Setup**
2. **Backend Modifications**
   - a. Configure Environment Variables
   - b. Create RAG API Route
   - c. Implement Ragie API Integration
3. **Frontend Enhancements**
   - a. Update UI to Select RAG Mode
   - b. Add Configuration Options for RAG Mode
   - c. Modify Message Handling to Support RAG Responses
4. **Testing and Validation**
5. **Deployment Considerations**
6. **Documentation and User Guidance**

---

## **1. Environment Setup**

Before diving into code modifications, ensure your development environment is prepared:

- **Ensure Node.js and npm are Updated:** Verify that you have the latest versions of Node.js and npm installed.
  
  ```bash
  node -v
  npm -v
  ```

- **Install Necessary Dependencies:** While `node-fetch` is already present, consider adding any other dependencies if required in future steps.

- **Secure API Keys:** You'll need to securely store your Ragie API key. Use environment variables to manage sensitive information.

---

## **2. Backend Modifications**

### **a. Configure Environment Variables**

1. **Add Ragie API Key to `.env`**

   Ensure that your `.env` file includes the Ragie API key. If it doesn't exist, create it in the root directory.

   ```env
   RAGIE_API_KEY=your_ragie_api_key_here
   ```

2. **Update `.gitignore`**

   Ensure `.env` is listed in your `.gitignore` to prevent accidental commits of sensitive data.

   ```gitignore
   # .gitignore
   .env
   ```

### **b. Create RAG API Route**

1. **Add a New Route in `server.js`**

   Create a new API endpoint, `/api/rag`, to handle RAG mode requests.

   ```javascript
   // server.js

   // ... existing imports
   const Ragie = require('ragie'); // Assuming Ragie has an npm package

   // ... existing middleware and routes

   /**
    * Route: /api/rag
    * Method: POST
    * Description: Handles RAG search requests
    */
   app.post('/api/rag', async (req, res) => {
     try {
       const { query, fileName, rerank, top_k, max_chunks_per_document } = req.body;

       if (!query) {
         return res.status(400).json({ error: 'No query provided.' });
       }

       if (!fileName) {
         return res.status(400).json({ error: 'No text file specified.' });
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

       const ragieApiKey = process.env.RAGIE_API_KEY;
       if (!ragieApiKey) {
         return res.status(500).json({ error: 'Server configuration error: Ragie API key missing.' });
       }

       // Prepare Ragie Retrieval Request
       const retrievalPayload = {
         query,
         top_k: top_k || 30, // Default to 30 if not provided
         rerank: rerank || false,
         max_chunks_per_document: max_chunks_per_document || 3, // Default value
       };

       // Make Request to Ragie Retrieval API
       const ragieResponse = await fetch('https://api.ragie.ai/retrievals', {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${ragieApiKey}`,
           'Content-Type': 'application/json',
         },
         body: JSON.stringify(retrievalPayload),
       });

       if (!ragieResponse.ok) {
         const errorData = await ragieResponse.json().catch(() => ({}));
         const errorMessage = errorData?.error?.message || ragieResponse.statusText;
         console.error('Ragie request failed:', {
           status: ragieResponse.status,
           statusText: ragieResponse.statusText,
           errorMessage
         });
         return res.status(ragieResponse.status).json({ error: `Ragie request failed: ${errorMessage}` });
       }

       const ragieData = await ragieResponse.json().catch(() => null);
       if (!ragieData || !Array.isArray(ragieData.scored_chunks)) {
         return res.status(500).json({ error: 'Invalid response from Ragie.' });
       }

       // Format Retrieved Chunks
       const formattedChunks = ragieData.scored_chunks.slice(0, 30).map(chunk => ({
         text: chunk.text,
         score: chunk.score,
         source: chunk.document_metadata?.source || 'Unknown Source',
         document_name: chunk.document_metadata?.name || 'Unnamed Document',
       }));

       res.status(200).json({ chunks: formattedChunks });
     } catch (error) {
       console.error('Error in /api/rag:', error);
       res.status(500).json({
         error: 'An unexpected error occurred. Please try again later.',
         details: error.toString()
       });
     }
   });
   ```

   **Notes:**

   - **Input Validation:** Ensures that required fields (`query` and `fileName`) are present.
   - **Default Values:** Sets default values for `top_k` and `max_chunks_per_document` if not provided.
   - **Error Handling:** Catches and logs errors from the Ragie API and any unexpected server errors.
   - **Response Formatting:** Structures the retrieved chunks with relevant source information.

### **c. Implement Ragie API Integration**

1. **Optional: Create a Helper Module for Ragie Integration**

   To keep `server.js` clean, consider creating a helper module that handles Ragie API interactions.

   ```javascript
   // src/ragie.js

   const fetch = require('node-fetch');

   const RAGIE_API_URL = 'https://api.ragie.ai/retrievals';

   /**
    * Perform a retrieval using Ragie API
    * @param {string} apiKey - Ragie API Key
    * @param {object} payload - Retrieval parameters
    * @returns {Promise<object>} - Retrieved chunks
    */
   async function performRetrieval(apiKey, payload) {
     const response = await fetch(RAGIE_API_URL, {
       method: 'POST',
       headers: {
         'Authorization': `Bearer ${apiKey}`,
         'Content-Type': 'application/json',
       },
       body: JSON.stringify(payload),
     });

     if (!response.ok) {
       const errorData = await response.json().catch(() => ({}));
       const errorMessage = errorData?.error?.message || response.statusText;
       throw new Error(`Ragie API Error: ${errorMessage}`);
     }

     const data = await response.json().catch(() => null);
     if (!data || !Array.isArray(data.scored_chunks)) {
       throw new Error('Invalid response from Ragie API.');
     }

     return data.scored_chunks;
   }

   module.exports = { performRetrieval };
   ```

2. **Refactor `/api/rag` to Use Helper Module**

   ```javascript
   // server.js

   const { performRetrieval } = require('./src/ragie');

   // ... existing code

   app.post('/api/rag', async (req, res) => {
     try {
       const { query, fileName, rerank, top_k, max_chunks_per_document } = req.body;

       // ... existing validation

       const ragieApiKey = process.env.RAGIE_API_KEY;
       if (!ragieApiKey) {
         return res.status(500).json({ error: 'Server configuration error: Ragie API key missing.' });
       }

       const retrievalPayload = {
         query,
         top_k: top_k || 30,
         rerank: rerank || false,
         max_chunks_per_document: max_chunks_per_document || 3,
       };

       const scoredChunks = await performRetrieval(ragieApiKey, retrievalPayload);

       const formattedChunks = scoredChunks.slice(0, 30).map(chunk => ({
         text: chunk.text,
         score: chunk.score,
         source: chunk.document_metadata?.source || 'Unknown Source',
         document_name: chunk.document_metadata?.name || 'Unnamed Document',
       }));

       res.status(200).json({ chunks: formattedChunks });
     } catch (error) {
       console.error('Error in /api/rag:', error);
       res.status(500).json({
         error: 'An unexpected error occurred. Please try again later.',
         details: error.toString()
       });
     }
   });
   ```

---

## **3. Frontend Enhancements**

### **a. Update UI to Select RAG Mode**

1. **Add a Mode Selector**

   Modify `index.html` to include a new mode selector, allowing users to switch between "Standard Chat" and "RAG Search".

   ```html
   <!-- /public/index.html -->

   <!-- Add this within the side-panel div, perhaps after the existing selectors -->
   <div class="mode-selector">
     <label for="modeSelect">Mode:</label>
     <select id="modeSelect">
       <option value="standard" selected>Standard Chat</option>
       <option value="rag">RAG Search</option>
     </select>
   </div>
   ```

2. **Style the Mode Selector**

   Update `styles.css` to style the new mode selector appropriately.

   ```css
   /* /public/styles.css */

   .mode-selector {
     padding: 1rem;
   }

   .mode-selector label {
     display: block;
     margin-bottom: 0.5rem;
     font-weight: 600;
     color: #1a1a1a;
   }

   .mode-selector select {
     width: 100%;
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

   .mode-selector select:focus {
     outline: none;
     border-color: #0070f3;
     background-color: #ffffff;
     box-shadow: 0 0 0 4px rgba(0, 112, 243, 0.1);
   }
   ```

3. **Update `app.js` to Handle Mode Selection**

   ```javascript
   // /public/app.js

   // ... existing code

   // DOM Elements
   const modeSelect = document.getElementById('modeSelect'); // New element

   // ... existing event listeners and functions

   // Modify handleSendMessage to accommodate modes
   async function handleSendMessage() {
     const question = questionInput.value.trim();
     if (!question) return;

     // Get selected mode
     const selectedMode = modeSelect.value;

     // Disable input while processing
     setInputState(false);
     
     // Add user message to UI
     appendMessage('user', question, selectedMode);
     questionInput.value = '';

     try {
       if (!fileSelect.value) {
         throw new Error('NO_FILE_SELECTED');
       }

       if (!llmSelect.value) {
         throw new Error('NO_MODEL_SELECTED');
       }

       // Show typing indicator before making the request
       showTypingIndicator();

       let response, data;

       if (selectedMode === 'standard') {
         // Existing /api/ask functionality
         response = await fetch('/api/ask', {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
           },
           body: JSON.stringify({
             question,
             fileName: fileSelect.value,
             model: llmSelect.value
           }),
         });

         if (!response.ok) {
           const errorData = await response.json().catch(() => ({}));
           console.error('Server response error:', {
             status: response.status,
             statusText: response.statusText,
             error: errorData
           });
           throw new Error(`HTTP_ERROR_${response.status}`);
         }

         data = await response.json();
         if (!data || !data.answer) {
           throw new Error('INVALID_RESPONSE');
         }

         // Remove typing indicator and add bot response to UI
         removeTypingIndicator();
         appendMessage('bot', data.answer, selectedMode);

       } else if (selectedMode === 'rag') {
         // New /api/rag functionality
         const ragOptions = {
           rerank: false, // You can later add UI elements to toggle this
           top_k: 30,
           max_chunks_per_document: 3
         };

         // Optionally, you can expose these options via the UI for user customization

         response = await fetch('/api/rag', {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
           },
           body: JSON.stringify({
             query: question,
             fileName: fileSelect.value,
             ...ragOptions
           }),
         });

         if (!response.ok) {
           const errorData = await response.json().catch(() => ({}));
           console.error('RAG Server response error:', {
             status: response.status,
             statusText: response.statusText,
             error: errorData
           });
           throw new Error(`HTTP_ERROR_${response.status}`);
         }

         data = await response.json();
         if (!data || !data.chunks) {
           throw new Error('INVALID_RESPONSE');
         }

         // Format chunks for display
         let formattedChunks = '';
         data.chunks.forEach((chunk, index) => {
           formattedChunks += `**Chunk ${index + 1}: ${chunk.document_name}**\n`;
           formattedChunks += `${chunk.text}\n\n`;
         });

         // Remove typing indicator and add bot response to UI
         removeTypingIndicator();
         appendMessage('bot', formattedChunks, selectedMode);
       }

     } catch (error) {
       console.error('Error:', error);
       
       let errorMessage = 'Sorry, I encountered an error while processing your request. ';
       
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
       appendMessage('bot', errorMessage, 'standard');
     }

     // Re-enable input
     setInputState(true);
   }

   // Modify appendMessage to handle different modes
   function appendMessage(sender, content, mode) {
     const messageDiv = document.createElement('div');
     messageDiv.className = `message ${sender}`;
     
     const messageContent = document.createElement('div');
     messageContent.className = 'message-content';
     
     if (sender === 'bot' && content.startsWith('Sorry')) {
       messageContent.classList.add('error-message');
     }

     if (mode === 'standard') {
       messageContent.innerHTML = marked.parse(content);
       
       // Add PDF link as before
       const selectedNormative = fileSelect.value.replace('.txt', '').replace(/_/g, ' ');
       const pdfLink = NORMATIVE_PDF_LINKS[selectedNormative];
       
       if (pdfLink) {
         const linkDiv = document.createElement('div');
         linkDiv.className = 'pdf-link';
         linkDiv.innerHTML = `<hr><small><a href="${pdfLink}" target="_blank">📄 View Normative PDF</a></small>`;
         messageContent.appendChild(linkDiv);
       }

     } else if (mode === 'rag') {
       // For RAG mode, content is already formatted with markdown
       messageContent.innerHTML = marked.parse(content);
     }
     
     messageDiv.appendChild(messageContent);
     chatMessages.appendChild(messageDiv);
     chatMessages.scrollTop = chatMessages.scrollHeight;
   }
   ```

   **Notes:**

   - **Mode Handling:** Differentiates between "Standard Chat" and "RAG Search" modes.
   - **RAG Options:** Currently hardcoded; see subsection **3.b** for making these configurable.
   - **Message Formatting:** RAG responses are formatted as markdown with chunk numbers and sources.

### **b. Add Configuration Options for RAG Mode**

To allow users to customize `rerank`, `top_k`, and `max_chunks_per_document`, enhance the frontend with additional UI elements in RAG mode.

1. **Update `index.html` to Include RAG Configuration Panel**

   ```html
   <!-- /public/index.html -->

   <!-- Add this within the side-panel div, after mode selector -->
   <div class="rag-options hidden" id="ragOptions">
     <div class="option">
       <label for="rerankToggle">Enable Reranking:</label>
       <input type="checkbox" id="rerankToggle" checked>
     </div>
     <div class="option">
       <label for="topKInput">Top K Chunks:</label>
       <input type="number" id="topKInput" value="30" min="1" max="100">
     </div>
     <div class="option">
       <label for="maxChunksInput">Max Chunks per Document:</label>
       <input type="number" id="maxChunksInput" value="3" min="1" max="10">
     </div>
   </div>
   ```

2. **Style the RAG Options Panel**

   ```css
   /* /public/styles.css */

   .rag-options {
     padding: 1rem;
     background-color: #f9f9f9;
     border-top: 1px solid #eaeaea;
     display: flex;
     flex-direction: column;
     gap: 1rem;
     animation: fadeIn 0.3s ease-out;
   }

   .rag-options.hidden {
     display: none;
   }

   .rag-options .option {
     display: flex;
     flex-direction: column;
   }

   .rag-options label {
     margin-bottom: 0.25rem;
     font-weight: 500;
     color: #1a1a1a;
   }

   .rag-options input[type="number"] {
     padding: 0.5rem;
     border: 2px solid #eaeaea;
     border-radius: 8px;
     font-size: 0.9rem;
     background-color: #ffffff;
     color: #1a1a1a;
     transition: border-color 0.2s ease;
   }

   .rag-options input[type="number"]:focus {
     outline: none;
     border-color: #0070f3;
     box-shadow: 0 0 0 2px rgba(0, 112, 243, 0.2);
   }
   ```

3. **Toggle RAG Options Visibility Based on Mode Selection**

   Update `app.js` to show or hide RAG configuration options when the mode changes.

   ```javascript
   // /public/app.js

   // ... existing code

   const ragOptionsDiv = document.getElementById('ragOptions');
   const rerankToggle = document.getElementById('rerankToggle');
   const topKInput = document.getElementById('topKInput');
   const maxChunksInput = document.getElementById('maxChunksInput');

   // Event Listener for Mode Selection
   modeSelect.addEventListener('change', (event) => {
     if (event.target.value === 'rag') {
       ragOptionsDiv.classList.remove('hidden');
     } else {
       ragOptionsDiv.classList.add('hidden');
     }
   });

   // Modify handleSendMessage to fetch RAG options from UI
   async function handleSendMessage() {
     const question = questionInput.value.trim();
     if (!question) return;

     const selectedMode = modeSelect.value;

     setInputState(false);
     
     appendMessage('user', question, selectedMode);
     questionInput.value = '';

     try {
       if (!fileSelect.value) {
         throw new Error('NO_FILE_SELECTED');
       }

       if (!llmSelect.value) {
         throw new Error('NO_MODEL_SELECTED');
       }

       showTypingIndicator();

       let response, data;

       if (selectedMode === 'standard') {
         // Existing /api/ask functionality
         // ... unchanged
       } else if (selectedMode === 'rag') {
         // Fetch RAG options from UI
         const ragOptions = {
           rerank: rerankToggle.checked,
           top_k: parseInt(topKInput.value, 10) || 30,
           max_chunks_per_document: parseInt(maxChunksInput.value, 10) || 3
         };

         // Validate inputs
         if (ragOptions.top_k < 1 || ragOptions.top_k > 100) {
           throw new Error('INVALID_TOP_K');
         }

         if (ragOptions.max_chunks_per_document < 1 || ragOptions.max_chunks_per_document > 10) {
           throw new Error('INVALID_MAX_CHUNKS');
         }

         response = await fetch('/api/rag', {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
           },
           body: JSON.stringify({
             query: question,
             fileName: fileSelect.value,
             rerank: ragOptions.rerank,
             top_k: ragOptions.top_k,
             max_chunks_per_document: ragOptions.max_chunks_per_document
           }),
         });

         // ... existing RAG response handling
       }

     } catch (error) {
       console.error('Error:', error);

       let errorMessage = 'Sorry, I encountered an error while processing your request. ';
       
       switch(error.message) {
         case 'NO_FILE_SELECTED':
           errorMessage += 'Please select a text document first.';
           break;

         case 'NO_MODEL_SELECTED':
           errorMessage += 'Please select an AI model first.';
           break;

         case 'INVALID_TOP_K':
           errorMessage += 'Top K must be between 1 and 100.';
           break;

         case 'INVALID_MAX_CHUNKS':
           errorMessage += 'Max chunks per document must be between 1 and 10.';
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
       
       removeTypingIndicator();
       appendMessage('bot', errorMessage, 'standard');
     }

     setInputState(true);
   }
   ```

   **Notes:**

   - **Input Validation:** Ensures that `top_k` and `max_chunks_per_document` are within acceptable ranges.
   - **Dynamic RAG Options:** Fetches user-specified options from the UI instead of hardcoding.

### **c. Modify Message Handling to Support RAG Responses**

1. **Adjust `appendMessage` Function**

   Update the `appendMessage` function to differentiate between standard chat messages and RAG responses.

   ```javascript
   // /public/app.js

   function appendMessage(sender, content, mode) {
     const messageDiv = document.createElement('div');
     messageDiv.className = `message ${sender}`;
     
     const messageContent = document.createElement('div');
     messageContent.className = 'message-content';
     
     if (sender === 'bot' && content.startsWith('Sorry')) {
       messageContent.classList.add('error-message');
     }

     if (mode === 'standard') {
       messageContent.innerHTML = marked.parse(content);
       
       // Add PDF link as before
       const selectedNormative = fileSelect.value.replace('.txt', '').replace(/_/g, ' ');
       const pdfLink = NORMATIVE_PDF_LINKS[selectedNormative];
       
       if (pdfLink) {
         const linkDiv = document.createElement('div');
         linkDiv.className = 'pdf-link';
         linkDiv.innerHTML = `<hr><small><a href="${pdfLink}" target="_blank">📄 View Normative PDF</a></small>`;
         messageContent.appendChild(linkDiv);
       }

     } else if (mode === 'rag') {
       // For RAG mode, content is already formatted with markdown
       messageContent.innerHTML = marked.parse(content);
     }
     
     messageDiv.appendChild(messageContent);
     chatMessages.appendChild(messageDiv);
     chatMessages.scrollTop = chatMessages.scrollHeight;
   }
   ```

2. **Enhance Error Handling for New Errors**

   Update the error handling section to provide clear messages for invalid RAG options.

   ```javascript
   // /public/app.js

   // Inside handleSendMessage's catch block

   catch (error) {
     // ... existing error handling

     switch(error.message) {
       // ... existing cases
       case 'INVALID_TOP_K':
         errorMessage += 'Top K must be between 1 and 100.';
         break;

       case 'INVALID_MAX_CHUNKS':
         errorMessage += 'Max chunks per document must be between 1 and 10.';
         break;
       // ... other cases
     }

     // ... rest of the error handling
   }
   ```

---

## **4. Testing and Validation**

After implementing the backend and frontend changes, perform thorough testing to ensure the RAG mode functions correctly without disrupting existing features.

### **a. Unit Testing**

- **Test RAG API Endpoint (`/api/rag`):**
  - **Valid Requests:** Ensure that valid queries return the correct number of chunks with appropriate source information.
  - **Invalid Requests:** Test requests missing `query` or `fileName` to verify error handling.
  - **Edge Cases:** Test with maximum and minimum values for `top_k` and `max_chunks_per_document`.

- **Test Frontend Interactions:**
  - **Mode Switching:** Verify that selecting RAG mode displays the configuration options and hides them when switching back.
  - **Option Inputs:** Ensure that input validations trigger appropriate error messages.

### **b. Integration Testing**

- **End-to-End Flow:**
  - Select RAG mode in the UI.
  - Configure options (rerank, top_k, max_chunks_per_document).
  - Submit a query and verify that the retrieved chunks are displayed correctly, ordered by cosine similarity, and include source document information.

- **Concurrent Operations:**
  - Ensure that performing RAG searches does not interfere with standard chat functionalities.

### **c. User Acceptance Testing (UAT)**

- **Real-World Scenarios:** Simulate typical user interactions to ensure usability and functionality.
- **Feedback Collection:** Gather feedback to refine UI elements and response formatting.

---

## **5. Deployment Considerations**

When deploying the updated chatbot, ensure the following:

- **Environment Variables:** Securely set the `RAGIE_API_KEY` in the production environment.
- **Rate Limits:** Be aware of Ragie API rate limits and handle potential throttling gracefully in the application.
- **Logging:** Monitor server logs for any unexpected errors related to the new RAG mode.
- **Performance:** Assess the impact of RAG searches on server performance and optimize if necessary.

---

## **6. Documentation and User Guidance**

Provide clear documentation and guidance to users on how to utilize the new RAG mode.

### **a. Update User Interface Instructions**

- **Welcome Message:** Modify the initial bot greeting to inform users about the new RAG mode.

  ```javascript
  // In /public/app.js, within DOMContentLoaded

  appendMessage('bot', '👷 Hello! I am Normio, your AI assistant. You can now perform advanced RAG searches by selecting "RAG Search" mode in the settings. When using RAG mode, you can customize search options like reranking, top K results, and maximum chunks per document. Feel free to ask me any questions about the selected normative!', 'standard');
  ```

### **b. Provide Tooltips or Help Icons**

- Add tooltips or help icons next to the RAG configuration options to explain their purpose.

  ```html
  <!-- /public/index.html -->

  <div class="option">
    <label for="rerankToggle">Enable Reranking:
      <span class="tooltip" title="Reranking improves the quality of retrieved chunks by using an additional LLM step. This may add extra processing time.">?</span>
    </label>
    <input type="checkbox" id="rerankToggle" checked>
  </div>
  ```

  ```css
  /* /public/styles.css */

  .tooltip {
    border-bottom: 1px dotted #000;
    cursor: help;
    margin-left: 0.25rem;
  }
  ```

### **c. Update Documentation**

- **Internal Documentation:** Update any internal README or documentation to include the new RAG mode integration details.
- **User Guides:** If available, update user guides or FAQs to help users understand and utilize the RAG mode effectively.

---

## **Final Notes**

By following this comprehensive multi-step plan, you can successfully integrate a RAG mode into your existing chatbot. This addition will enhance the chatbot's capabilities, allowing users to perform sophisticated searches and retrieve relevant information from selected documents using the Ragie API. Ensure continuous monitoring and iterative improvements based on user feedback to maintain and enhance the chatbot's functionality.

---