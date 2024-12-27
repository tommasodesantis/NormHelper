const fetch = require('node-fetch');

exports.handler = async (event) => {
  try {
    // Get the base URL from environment variables or construct it
    const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'http://localhost:8888';
    
    // Hard-code the known text file for now
    // In a production environment, you might want to implement a proper directory listing
    const files = ['Eurocode_2_Design_of_concrete_structures_Part_1-1_General.txt'];
    
    console.log('Returning files list:', files);

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
