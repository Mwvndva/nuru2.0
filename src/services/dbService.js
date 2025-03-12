const { Pool } = require('pg');
const dotenv = require('dotenv');
const axios = require('axios');

// Load environment variables from the .env file
dotenv.config();

// Set up a connection pool using environment variables
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Stop words to ignore during keyword extraction
const stopWords = ['and', 'or', 'the', 'is', 'in', 'at', 'a', 'an', 'of', 'for', 'on', 'with', 'to', 'find', 'me'];

const detectLanguage = async (text) => {
  try {
    const response = await axios.post('https://libretranslate.com/detect', {
      q: text
    });
    
    const detectedLang = response.data[0]?.language;
    console.log(`[INFO] Detected language: ${detectedLang}`);
    return detectedLang || 'en'; // Fallback to 'en' if detection fails
  } catch (error) {
    console.error(`[ERROR] Language detection failed: ${error.message}`);
    return 'en'; // Fallback to English in case of failure
  }
};



// LibreTranslate function to translate text
const translateText = async (text, targetLang) => {
  try {
    const response = await axios.post('https://libretranslate.com/translate', {
      q: text,
      source: 'en', // You can set the source language dynamically if needed
      target: targetLang
    });
    return response.data.translatedText;
  } catch (error) {
    console.error(`[ERROR] Translation failed: ${error.message}`);
    return text;  // Fallback to original text in case of translation failure
  }
};

// Function to extract meaningful keywords and format them as %keyword%
function extractFormattedKeywords(query) {
  const words = query.toLowerCase().split(/\s+/);
  const filteredWords = words.filter(word => !stopWords.includes(word));
  const formattedKeywords = filteredWords.map(word => `%${word}%`);
  console.log(`[INFO] Extracted and formatted keywords: ${formattedKeywords}`);
  return formattedKeywords;
}

// Function to search destinations in the database using extracted keywords
const searchDestinationInDB = async (keywords) => {
  try {
    const query = `
      SELECT places.name, places.description, places.contact_number, places.rating, places.image_url
      FROM places
      WHERE (
        ${keywords.map((_, idx) => `(places.name ILIKE $${idx + 1} OR
                                     places.description ILIKE $${idx + 1})`).join(' OR ')}
      )
      GROUP BY places.name, places.description, places.contact_number, places.rating, places.image_url;
    `;

    console.log(`[INFO] Executing query: "${query}" with keywords: ${keywords}`);
    const { rows } = await pool.query(query, keywords);

    if (rows.length > 0) {
      console.log(`[INFO] Query returned ${rows.length} results`);
      return rows;
    } else {
      console.log(`[INFO] No results found for query: "${keywords.join(', ')}"`);
      return [];
    }
  } catch (error) {
    console.error(`[ERROR] Failed to search in the database: ${error.message}`);
    return [];
  }
};

// Function to translate the results back to the user's language
const translateResults = async (results, targetLang) => {
  const translatedResults = [];

  for (const result of results) {
    const translatedName = await translateText(result.name, targetLang);
    const translatedDescription = await translateText(result.description, targetLang);

    translatedResults.push({
      name: translatedName,
      description: translatedDescription,
      contact_number: result.contact_number,
      rating: result.rating,
      image_url: result.image_url,
    });
  }

  return translatedResults;
};

// Updated handleUserQuery function with translation of results to user's language
const handleUserQuery = async (userQuery) => {
  try {
    // Detect the user's language
    const userLang = await detectLanguage(userQuery);
    console.log(`[INFO] Detected language: ${userLang}`);

    // Translate the query to English if it's not in English
    const translatedQuery = userLang !== 'en' ? await translateText(userQuery, 'en') : userQuery;

    // Extract keywords from the translated query
    const formattedKeywords = extractFormattedKeywords(translatedQuery);

    // Search the database using the formatted keywords
    const searchResults = await searchDestinationInDB(formattedKeywords);

    // Format the search results in English
    const response = formatSearchResults(searchResults);

    // Translate the formatted results back to the user's language
    const finalResponse = userLang !== 'en' ? await translateText(response, userLang) : response;

    console.log(`[INFO] Sending message to +254111548797: "${finalResponse}"`);

    // Return the final translated response
    return finalResponse;

  } catch (error) {
    console.error(`[ERROR] Failed to handle user query: ${error.message}`);
    return "Oops! Something went wrong. Please try again later.";
  }
};


// Example usage
(async () => {
  const userQuery = 'Resort de lujo en Watamu'; // Example query in Spanish
  const results = await handleUserQuery(userQuery);

  console.log('[INFO] Final results:', results);
})();

// Export the functions for use in other modules
module.exports = { searchDestinationInDB, handleUserQuery };
