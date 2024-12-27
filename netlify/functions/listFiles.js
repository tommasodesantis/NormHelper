const texts = require('../../src/texts');

exports.handler = async (event) => {
  try {
    const files = Object.keys(texts);
    
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
