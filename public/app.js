// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const questionInput = document.getElementById('questionInput');
const sendButton = document.getElementById('sendButton');
const fileSelect = document.getElementById('fileSelect');
const llmSelect = document.getElementById('llmSelect');
const modeSelect = document.getElementById('modeSelect');
const ragOptions = document.getElementById('ragOptions');
const rerankToggle = document.getElementById('rerankToggle');
const topKInput = document.getElementById('topKInput');
const maxChunksInput = document.getElementById('maxChunksInput');

// Constants
const NORMATIVE_PDF_LINKS = {
  'Eurocode 2 Design of concrete structures Part 1-2': 'https://drive.google.com/file/d/1svMexZcZVurkKqgre0ICJPvyOgWPkIsc/view?usp=sharing',
  'Eurocode 2 Design of concrete structures Part 1-1': 'https://drive.google.com/file/d/1tnRhN-BkbAcXsgLqXj-XnXzPWoP-zs0e/view?usp=sharing',
  'Annesso Italiano EC': 'https://drive.google.com/file/d/1mAcs0e5G7LzWt1KNIxi8x-FZj49Fag9P/view?usp=sharing'
};

const RESTRICTED_MODELS = [
  'amazon/nova-pro-v1',
  'google/gemini-2.0-flash-exp:free',
  'google/gemini-exp-1206:free',
  'openrouter/auto'
];
const PASSWORD = 'bollettone';

// Event Listeners
llmSelect.addEventListener('change', handleModelChange);
sendButton.addEventListener('click', handleSendMessage);
questionInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
});

// Function to handle mode changes
function handleModeChange(isRagMode) {
  // Toggle visibility of sections
  ragOptions.classList.toggle('hidden', !isRagMode);
  
  const normativeSection = document.getElementById('normativeSection');
  const llmSection = document.getElementById('llmSection');
  
  normativeSection.classList.toggle('hidden', isRagMode);
  llmSection.classList.toggle('hidden', isRagMode);
}

// Mode selection event listener
modeSelect.addEventListener('change', (event) => {
  handleModeChange(event.target.value === 'Semantic search');
});

// Fetch and Populate File List on DOM Content Loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Set initial mode state
  handleModeChange(modeSelect.value === 'Semantic search');
  
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
  appendMessage('bot', '👷 Hello! I am Normio, your AI assistant. Select **"Deep thinking"** mode to ask questions about single documents or **"Semantic search"** mode to search for contents across multiple documents!', 'Deep thinking');

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
    appendMessage('bot', `Unable to load document list: ${error.message}`, 'Deep thinking');
  }
});

// Handle sending messages
async function handleSendMessage() {
  const question = questionInput.value.trim();
  if (!question) return;

  const selectedMode = modeSelect.value;

  // Disable input while processing
  setInputState(false);
  
  // Add user message to UI
  appendMessage('user', question, selectedMode);
  questionInput.value = '';

  try {
    // Validate AI model selection for Deep thinking mode
  if (selectedMode === 'Deep thinking') {
      if (!fileSelect.value) {
        throw new Error('NO_FILE_SELECTED');
      }
      if (!llmSelect.value) {
        throw new Error('NO_MODEL_SELECTED');
      }
    }

    // Show typing indicator before making the request
    showTypingIndicator();

    let response, data;

    if (selectedMode === 'Deep thinking') {
      console.log('Sending deep thinking chat request with:', {
        question,
        fileName: fileSelect.value,
        model: llmSelect.value
      });

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
    } else if (selectedMode === 'Semantic search') {
      // Validate RAG options
      const topK = parseInt(topKInput.value, 10);
      const maxChunks = parseInt(maxChunksInput.value, 10);

      if (topK < 1 || topK > 100) {
        throw new Error('INVALID_TOP_K');
      }

      console.log('Sending RAG request with:', {
        query: question,
        rerank: rerankToggle.checked,
        top_k: topK,
        max_chunks_per_document: maxChunks
      });

      response = await fetch('/api/rag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: question,
          rerank: rerankToggle.checked,
          top_k: topK,
          max_chunks_per_document: maxChunks
        }),
      });
    }

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

    data = await response.json();
    console.log('Received response:', data);

    // Validate response data
    if (selectedMode === 'Deep thinking' && (!data || !data.answer)) {
      throw new Error('INVALID_RESPONSE');
    }
    if (selectedMode === 'Semantic search' && (!data || !data.chunks)) {
      throw new Error('INVALID_RESPONSE');
    }

    // Remove typing indicator and add bot response to UI
    removeTypingIndicator();

  if (selectedMode === 'Deep thinking') {
      appendMessage('bot', data.answer, selectedMode);
    } else {
      // Format RAG response with improved metadata display
      let formattedResponse = '### Retrieved Information\n\n';
      data.chunks.forEach((chunk, index) => {
        formattedResponse += `#### Result ${index + 1} (Score: ${chunk.score.toFixed(4)})\n`;
        formattedResponse += `**Source:** ${chunk.metadata.name}\n`;
        formattedResponse += `**Type:** ${chunk.metadata.type}\n`;
        if (chunk.metadata.uploaded_at) {
          const date = new Date(chunk.metadata.uploaded_at * 1000);
          formattedResponse += `**Added:** ${date.toLocaleDateString()}\n`;
        }
        formattedResponse += `\n${chunk.text}\n\n---\n\n`;
      });
      
      if (data.chunks.length === 0) {
        formattedResponse = '### No Results Found\n\nNo relevant information was found in the knowledge base for your query. Try rephrasing your question or using different keywords.';
      }
      
      appendMessage('bot', formattedResponse, selectedMode);
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
    appendMessage('bot', errorMessage, 'Deep thinking');
  }

  // Re-enable input
  setInputState(true);
}

// Create and show typing indicator
function showTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message bot';
  typingDiv.id = 'typingIndicator';
  
  const typingContent = document.createElement('div');
  typingContent.className = 'typing-indicator';
  
  // Add three dots
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement('div');
    dot.className = 'typing-dot';
    typingContent.appendChild(dot);
  }
  
  typingDiv.appendChild(typingContent);
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Remove typing indicator
function removeTypingIndicator() {
  const typingIndicator = document.getElementById('typingIndicator');
  if (typingIndicator) {
    typingIndicator.remove();
  }
}

// Append a message to the chat UI
function appendMessage(sender, content, mode) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}`;
  
  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';
  
  // If it's an error message from the bot, add error styling
  if (sender === 'bot' && content.startsWith('Sorry, I encountered an error')) {
    messageContent.classList.add('error-message');
  }
  
  // Add the main content with markdown parsing
  messageContent.innerHTML = marked.parse(content);
  
  // If it's a bot message in Deep thinking mode and not an error, append the PDF link
  if (sender === 'bot' && mode === 'Deep thinking' && !content.startsWith('Sorry, I encountered an error')) {
    const selectedNormative = fileSelect.value.replace('.txt', '').replace(/_/g, ' ');
    const pdfLink = NORMATIVE_PDF_LINKS[selectedNormative];
    
    if (pdfLink) {
      const linkDiv = document.createElement('div');
      linkDiv.className = 'pdf-link';
      linkDiv.innerHTML = `<hr><small><a href="${pdfLink}" target="_blank">📄 View Normative PDF</a></small>`;
      messageContent.appendChild(linkDiv);
    }
  }
  
  messageDiv.appendChild(messageContent);
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Enable/disable input controls
function setInputState(enabled) {
  questionInput.disabled = !enabled;
  sendButton.disabled = !enabled;
  sendButton.textContent = enabled ? 'Send' : 'Sending...';
  
  // Also disable file selection and LLM selection while processing
  fileSelect.disabled = !enabled;
  llmSelect.disabled = !enabled;
  modeSelect.disabled = !enabled;
  rerankToggle.disabled = !enabled;
  topKInput.disabled = !enabled;
  maxChunksInput.disabled = !enabled;
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
    .pdf-link {
        margin-top: 10px;
        font-size: 0.9em;
    }
    .pdf-link hr {
        margin: 8px 0;
        border: 0;
        border-top: 1px solid #eee;
    }
    .pdf-link a {
        color: #2563eb;
        text-decoration: none;
    }
    .pdf-link a:hover {
        text-decoration: underline;
    }
`;
document.head.appendChild(style);

// Handle model selection change
function handleModelChange(event) {
  const selectedModel = event.target.value;
  
  if (RESTRICTED_MODELS.includes(selectedModel)) {
    const password = prompt('This model requires an admin password, enter it or select one of the following models: Claude 3.5 Sonnet (recommended) or Gemini Pro 1.5:');
    
    if (password !== PASSWORD) {
      alert('Incorrect password. Access denied.');
      // Reset to the first non-restricted model
      const firstNonRestrictedOption = Array.from(llmSelect.options)
        .find(option => !RESTRICTED_MODELS.includes(option.value));
      llmSelect.value = firstNonRestrictedOption.value;
    }
  }
}
