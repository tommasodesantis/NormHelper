// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const questionInput = document.getElementById('questionInput');
const sendButton = document.getElementById('sendButton');
const fileSelect = document.getElementById('fileSelect');

// Event Listeners
sendButton.addEventListener('click', handleSendMessage);

// Add event listener for dynamic file list loading
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/.netlify/functions/listFiles');
        const data = await response.json();
        const files = data.files;

        files.forEach(file => {
            const option = document.createElement('option');
            option.value = file;
            option.textContent = file.replace('.txt', '').replace(/_/g, ' ');
            fileSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching file list:', error);
        appendMessage('bot', 'Unable to load document list. Please try again later.');
    }
});
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

        // Call serverless function
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
