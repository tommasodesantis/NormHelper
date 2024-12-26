// DOM Elements
const chatMessages = document.getElementById('chatMessages');
const questionInput = document.getElementById('questionInput');
const sendButton = document.getElementById('sendButton');
const pdfSelect = document.getElementById('pdfSelect');

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

    try {
        // Call OpenRouter API through our serverless function
        const response = await fetch('/.netlify/functions/ask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question,
                pdfName: pdfSelect.value
            }),
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const data = await response.json();
        
        // Add bot response to UI
        appendMessage('bot', data.answer);

    } catch (error) {
        console.error('Error:', error);
        appendMessage('bot', 'Sorry, I encountered an error while processing your question. Please try again.');
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
}
