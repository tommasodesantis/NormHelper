// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const questionInput = document.getElementById('questionInput');
const sendButton = document.getElementById('sendButton');
const fileSelect = document.getElementById('fileSelect');
const llmSelect = document.getElementById('llmSelect');

// Constants
const RESTRICTED_MODELS = [
  'amazon/nova-pro-v1',
  'google/gemini-2.0-flash-exp:free',
  'google/gemini-exp-1206:free'
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

// Fetch and Populate File List on DOM Content Loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Add welcome message
  appendMessage('bot', '👷 Hello! I am Normio, your AI assistant. To get started, please select a normative document and an AI model (Claude 3.5 Sonnet is recommended) in the side panel. Then, feel free to ask me any questions about the selected normative!');

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

    // Validate AI model selection
    if (!llmSelect.value) {
      throw new Error('NO_MODEL_SELECTED');
    }

    console.log('Sending request with:', {
      question,
      fileName: fileSelect.value,
      model: llmSelect.value
    });

    // Show typing indicator before making the request
    showTypingIndicator();

    // Call updated serverless function
    response = await fetch('/.netlify/functions/ask', {
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
  
  // Also disable file selection and LLM selection while processing
  fileSelect.disabled = !enabled;
  llmSelect.disabled = !enabled;
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
