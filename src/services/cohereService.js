const axios = require('axios');
require('dotenv').config();

const fetchCohereResponse = async (message) => {
  try {
    const response = await axios.post(
      'https://api.cohere.ai/generate',
      {
        prompt: message,
        max_tokens: 50,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.COHERE_API_KEY}`,
        },
      }
    );

    return response.data.text;
  } catch (error) {
    console.error('Error with Cohere API:', error);
    return null;
  }
};

module.exports = { fetchCohereResponse };
