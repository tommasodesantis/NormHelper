Below is a detailed, high-level development plan for switching from DocsBot to OpenRouter (using Claude 3.5 Sonnet), supporting local PDF files, ensuring that each answer includes page references. Feel free to adapt the exact implementation details to your tech stack or preferences.

1. Updated Architecture (No Parsing / Chunking)
PDF Storage

Store PDFs in your repo’s file structure or on a private CDN.
The user picks which PDF they want to query in the UI.
Single-Pass to Claude

Because your PDFs are small enough to fit within Claude’s context window, you can directly feed the raw PDF data.
Claude 3.5 Sonnet is capable of reading the unstructured data, but you must actually provide that data in the request.
You’ll instruct Claude to reference specific pages in its final answer.
Prompt Caching

Use OpenRouter’s caching features to reduce future usage costs if the same PDF is re-sent multiple times.
Answer with Page References

At the end of its answer, Claude should list which pages it used.
You’ll embed instructions in your system message so Claude 3.5 Sonnet includes page references.
2. Directory & File Structure
You can mostly keep your existing layout. The main updates:

Remove DocsBot references from:
/netlify/functions/ask.js
Front-end code that references DocBots
(Optional) Add a new endpoint if you like, e.g. /netlify/functions/pdfAsk.js, or simply repurpose ask.js.
Your structure could look like:

bash
Copy code
tommasodesantis-NormHelper/
├── index.html
├── app.js
├── netlify/functions/ask.js  <-- Updated for OpenRouter
├── ...
└── [PDFs go here or in subfolder]
3. Passing the PDF to Claude
3.1 Base64 or Direct Upload Approach
Base64 Approach

Read the PDF file from the server side. Convert it to base64.
In your request body to OpenRouter’s /chat/completions, include a messages array. One of the messages (usually system or user role) can contain the entire PDF data as a “file attachment.”
json
Copy code
{
  "role": "system",
  "content": [
    {
      "type": "text",
      "text": "Below is the entire PDF you need to read."
    },
    {
      "type": "image_url", 
      "image_url": {
        "url": "data:application/pdf;base64,JVBERi0xLjUK...", 
        "detail": "auto"
      }
    }
  ]
}
Claude 3.5 Sonnet will see the PDF data unstructured and do its best to read it.
Then, in another user or system message, instruct it: “Answer user questions about this PDF. Please reference page numbers whenever you use them.”
Direct File Upload

If you have the PDF publicly accessible, you might pass a URL to Claude.
This method often requires prompting Claude to fetch or read from that URL, but not all providers can handle arbitrary file download. The base64 approach is safer.
3.2 Prompt Format
Your final prompt might look like:

vbnet
Copy code
System: 
   You are a helpful AI. The user has provided a PDF to read. 
   The PDF is attached below. 
   Whenever you answer, be sure to reference the PDF page number in parentheses.

User:
   Here's my question about the PDF: "..."
OpenRouter merges these messages and sends them to Claude 3.5 Sonnet.

4. Prompt Caching Setup
Include Large Data in Ephemeral Blocks (Optional)
For Anthropic-based models, you can add cache_control: { type: 'ephemeral' } around the large PDF base64 data to help reduce repeated token costs if the same PDF is used frequently.
Implementation
In the JSON message content, wrap the big chunk of base64 PDF data with ephemeral cache blocks.
The next time the same PDF is used, you might see reduced cost.
Example snippet:

json
Copy code
{
  "role": "system",
  "content": [
    { 
      "type": "text",
      "text": "Here is the entire PDF. Use ephemeral caching to reduce cost." 
    },
    { 
      "type": "text",
      "text": "JVBERi0xLjUK... (base64 PDF data)", 
      "cache_control": { "type": "ephemeral" }
    }
  ]
}
5. Netlify Function to Call OpenRouter
Below is a simplified example of how ask.js might look after removing DocsBot:

js
Copy code
// netlify/functions/ask.js
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

export const handler = async (event) => {
  try {
    const { question, pdfName } = JSON.parse(event.body);

    // 1) Load PDF from disk (assuming small, e.g. < 2MB)
    const pdfPath = path.join(__dirname, '../../..', pdfName); 
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfBase64 = pdfBuffer.toString('base64');

    // 2) Build messages array
    const messages = [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: 'You are a helpful assistant. ' + 
                  'You have been given a PDF file in base64 form. Please read it.'
          },
          {
            type: 'text',
            text: pdfBase64,
            cache_control: { type: 'ephemeral' }
          }
        ]
      },
      {
        role: 'user',
        content: `User question: ${question}. At the end of your answer, list any relevant page references.`
      }
    ];

    // 3) Call Claude 3.5 Sonnet via OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter request failed: ${response.status}`);
    }

    const data = await response.json();
    const answer = data?.choices?.[0]?.message?.content || 'No answer found.';

    return {
      statusCode: 200,
      body: JSON.stringify({ answer })
    };

  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server error', error: error.toString() })
    };
  }
};
Important: This is a rough example. Adjust file paths, error handling, etc. to suit your environment.

6. Front-End Changes
PDF Selector

Provide a dropdown or file chooser so the user picks pdfName from your stored PDFs.
E.g., selectedPdf = "path/to/MySmallDoc.pdf".
Send Query + PDF Name

js
Copy code
const response = await fetch('/.netlify/functions/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: userQuestion,
    pdfName: selectedPdf
  })
});
Display Bot’s Answer

Update chat UI similarly to how you did with DocBots, but now from the new JSON payload.
7. Testing and Validation
Test with Various Small PDFs

Ensure you don’t exceed Claude’s max token limit (roughly 100k tokens).
Verify that page references appear in the answers.
Performance

If you see performance or cost concerns, consider ephemeral caching blocks.
If the PDF is extremely large (close to the token limit), you might see partial or truncated answers.
Edge Cases

If user picks no PDF.
If the PDF path is invalid.
If the question is completely unrelated.
If you have multiple queries for the same PDF, confirm caching is working (check your OpenRouter usage logs).
8. Deployment
Netlify Config

Add OPENROUTER_API_KEY to Netlify environment variables.
Build & deploy the updated code.
Monitoring

Check function logs for any errors.
Monitor usage/cost via OpenRouter’s analytics.
9. Future Enhancements
Multi-turn conversation

Keep user’s previous Q&A in the messages array for context.
But watch context-length usage if you re-attach the PDF each turn.
Selective PDF

If you want to handle multiple PDFs at once, you could store them in separate system messages or compile them into one.
For large sets, partial or minimal referencing might be needed.
UI Enhancements

Optionally highlight the PDF text or show a link that jumps to the referenced page.
Fine-Tuned Page-Reference

If you ever need more accurate page references, you could do minimal text extraction (without chunking) so that the page boundaries are clearly indicated. For now, rely on Claude to interpret page references in the raw PDF.
Conclusion
By simply reading the entire (small) PDF through Claude 3.5 Sonnet—passing the PDF as base64 or a direct file reference—you can achieve Q&A functionality without custom parsing or chunking. This plan leverages OpenRouter prompt caching to optimize costs, ensures page references in the answer, and integrates seamlessly with your existing Netlify deployment and front-end code.