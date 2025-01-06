const { performRetrieval } = require('./ragie');
const { processChunksWithLLM } = require('./llmProcessor');
require('dotenv').config();

async function testMetadataPassing() {
  try {
    // 0. Check API keys
    const ragieApiKey = process.env.RAGIE_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    
    console.log('Checking API keys...');
    console.log('RAGIE_API_KEY present:', !!ragieApiKey);
    console.log('OPENROUTER_API_KEY present:', !!openrouterKey);
    
    if (!ragieApiKey || !openrouterKey) {
      throw new Error('Missing required API keys. Please check your .env file.');
    }

    // 1. Perform retrieval

    let rawChunks = [];
    
    // Test different query configurations
    const testConfigs = [
      {
        name: "Technical query",
        payload: {
          query: "concrete requirements",
          rerank: true,
          top_k: 8,
          max_chunks_per_document: 2
        }
      },
      {
        name: "Alternative query",
        payload: {
          query: "steel reinforcement",
          rerank: false,
          top_k: 5,
          max_chunks_per_document: 1
        }
      }
    ];

    // Run tests for each configuration
    for (const config of testConfigs) {
      console.log(`\nTesting ${config.name}:`);
      try {
        console.log('Payload:', JSON.stringify(config.payload, null, 2));
        const chunks = await performRetrieval(ragieApiKey, config.payload);
        rawChunks = rawChunks.concat(chunks);
        
        console.log(`\nRetrieved ${chunks.length} chunks`);
        
        // Test chunk structure
        chunks.forEach((chunk, i) => {
          console.log(`\nChunk ${i + 1}:`);
          
          // Verify required fields
          const requiredFields = new Set(['text', 'score', 'document_id', 'document_metadata']);
          const actualFields = new Set(Object.keys(chunk));
          
          const missingFields = [...requiredFields].filter(field => !actualFields.has(field));
          const extraFields = [...actualFields].filter(field => !requiredFields.has(field));
          
          if (missingFields.length === 0 && extraFields.length === 0) {
            console.log('✅ Correct chunk structure');
          } else {
            console.log('❌ Invalid chunk structure');
            if (missingFields.length > 0) console.log('Missing fields:', missingFields);
            if (extraFields.length > 0) console.log('Extra fields:', extraFields);
          }
          
          // Print chunk details
          console.log('Document ID:', chunk.document_id);
          console.log('Score:', chunk.score);
          console.log('Metadata:', JSON.stringify(chunk.document_metadata, null, 2));
          console.log('Text preview:', chunk.text.slice(0, 100), '...');
        });
      } catch (error) {
        console.error(`Error testing ${config.name}:`, error.message);
        if (error.response) {
          try {
            const errorText = await error.response.text();
            console.error('Ragie API Response:', errorText);
          } catch (e) {
            console.error('Could not read error response:', e.message);
          }
        }
      }
    }

    if (rawChunks.length === 0) {
      console.log('\nNo chunks were retrieved from any test configuration');
      return;
    }

    // 2. Transform chunks (simulating server.js transformation)
    console.log('\n2. Transforming chunks...');
    const transformedChunks = rawChunks.map(chunk => ({
      text: chunk.text,
      score: chunk.score,
      document_id: chunk.document_id,
      metadata: {
        name: chunk.document_name || chunk.document_metadata?.document_name || 'Unknown',
        type: chunk.document_metadata?.document_type || 'Unknown',
        source_url: chunk.document_metadata?.source_url || chunk.document_metadata?.document_source || 'Unknown',
        uploaded_at: chunk.document_metadata?.created_at || chunk.document_metadata?.document_uploaded_at || null
      }
    }));

    console.log('\n2. Transformed chunks:');
    console.log(JSON.stringify(transformedChunks, null, 2));

    // 3. Process with LLM
    console.log('\n3. Processing with LLM...');
    const formattedResponse = await processChunksWithLLM(transformedChunks);
    console.log('\nFormatted response from LLM:');
    console.log(formattedResponse);

  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testMetadataPassing();
