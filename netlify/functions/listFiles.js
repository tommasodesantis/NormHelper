const fs = require('fs');
const path = require('path');

exports.handler = async () => {
  try {
    const textsDir = path.join(process.cwd(), 'public', 'texts');
    const files = fs.readdirSync(textsDir).filter(file => file.endsWith('.txt'));
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
