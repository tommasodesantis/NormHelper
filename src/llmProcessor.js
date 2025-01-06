const fetch = require('node-fetch');
require('dotenv').config();

/**
 * Processes retrieved chunks using Gemini 1.5 Flash 8B via OpenRouter.
 * Formats the response with citations.
 * @param {Array} chunks - Array of retrieved chunk objects.
 * @returns {Array} - Formatted chunks with citations.
 */
async function processChunksWithLLM(chunks) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const siteUrl = process.env.SITE_URL;

  if (!apiKey) {
    throw new Error('OpenRouter API key is missing.');
  }

  // Prepare the content for the LLM
  const systemMessage = `
    You are an assistant that formats retrieved document chunks into a structured list.
    Each chunk should be concise and end with a citation linking to the source document.
    Use Markdown for formatting.

    Guidelines:
    - Start always with "**Here are the most relevant results for your query:**" followed by an empty line before the results
    - Present each chunk as a bullet point
    - Number the chunks like this "**Result 1:** ", "**Result 2:** ", etc...
    - Keep the original text intact but remove any unnecessary whitespace or line breaks
    - For each chunk, include:
      * The relevant text
      * A citation at the end in the format: [Source: "Document Name"](source_url)
      * Always use the document name in the citation, not "Unknown"
    - Organize chunks by relevance (they are already sorted by score)
    - Add a horizontal rule (---) between chunks for better readability
  `;

  const userMessage = `
    Here are the retrieved document chunks:
    ${chunks.map((chunk, index) => {
      const metadata = chunk.metadata || {};
      const docName = metadata.name || 'Unknown Document';
      const sourceUrl = metadata.source_url || '#';
      return `Chunk ${index + 1} (Score: ${chunk.score}):\n` +
             `Document: ${docName}\n` +
             `Source: ${sourceUrl}\n` +
             `Text: ${chunk.text}`;
    }).join('\n\n')}
    
    Please format these into a well-structured list with proper citations.
  `;

  const messages = [
    { role: 'system', content: systemMessage },
    { role: 'user', content: userMessage }
  ];

  // Send request to OpenRouter
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': siteUrl,
      'X-Title': 'NormHelper'
    },
    body: JSON.stringify({
      models: ['google/gemini-2.0-flash-exp:free','deepseek/deepseek-chat'],
      messages,
      stream: false,
      temperature: 0.2
    })
  });

  try {
    const responseText = await response.text(); // Get raw response text first
    console.log('OpenRouter raw response:', responseText); // Log raw response for debugging
    
    if (!response.ok) {
      console.error('OpenRouter error response:', responseText);
      // Return a basic formatted response in case of OpenRouter failure
      return chunks.map((chunk, index) => {
        const metadata = chunk.metadata || {};
        const docName = metadata.name || 'Unknown Document';
        return `- ${chunk.text}\n\n[Source: ${docName}](#)\n\n---\n\n`;
      }).join('');
    }

    try {
      const data = JSON.parse(responseText);
      console.log('OpenRouter parsed response:', data);

      if (!data || !Array.isArray(data.choices) || data.choices.length === 0 || !data.choices[0].message?.content) {
        console.error('Invalid OpenRouter response structure:', data);
        // Return a basic formatted response in case of invalid OpenRouter response
        return chunks.map((chunk, index) => {
          const metadata = chunk.metadata || {};
          const docName = metadata.name || 'Unknown Document';
          return `- ${chunk.text}\n\n[Source: ${docName}](#)\n\n---\n\n`;
        }).join('');
      }

      return data.choices[0].message.content;
    } catch (parseError) {
      console.error('Error parsing OpenRouter response:', parseError);
      // Return a basic formatted response in case of parsing error
      return chunks.map((chunk, index) => {
        const metadata = chunk.metadata || {};
        const docName = metadata.name || 'Unknown Document';
        return `- ${chunk.text}\n\n[Source: ${docName}](#)\n\n---\n\n`;
      }).join('');
    }
  } catch (error) {
    console.error('Error processing OpenRouter response:', error);
    // Return a basic formatted response in case of any other error
    return chunks.map((chunk, index) => {
      const metadata = chunk.metadata || {};
      const docName = metadata.name || 'Unknown Document';
      return `- ${chunk.text}\n\n[Source: ${docName}](#)\n\n---\n\n`;
    }).join('');
  }
}

module.exports = { processChunksWithLLM };
