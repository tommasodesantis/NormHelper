const fs = require('fs');
const path = require('path');

exports.handler = async () => {
  try {
    // In Netlify Functions, we should use the publish directory
    const publishDir = process.env.PUBLISH_DIR || 'public';
    const textsDir = path.join(publishDir, 'texts');
    
    console.log('Looking for text files in:', textsDir);
    console.log('Current working directory:', process.cwd());
    console.log('Directory contents:', fs.readdirSync(process.cwd()));
    
    let files = [];
    try {
      files = fs.readdirSync(textsDir).filter(file => file.endsWith('.txt'));
      console.log('Found text files:', files);
    } catch (error) {
      console.error('Error reading texts directory:', error);
      // Instead of throwing, return an empty array
      files = [];
    }

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
