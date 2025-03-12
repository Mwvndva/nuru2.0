const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load environment variables from the .env file
dotenv.config();

// Set up a connection pool using environment variables
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432, // Default PostgreSQL port is 5432
});

// Define a list of common stop words to ignore during keyword extraction
const stopWords = ['and', 'or', 'the', 'is', 'in', 'at', 'a', 'an', 'of', 'for', 'on', 'with', 'to', 'find', 'me', 'near', 'by', 'from'];

// Function to extract meaningful keywords and format them as %keyword%
function extractFormattedKeywords(query) {
  if (typeof query !== 'string') {
    console.error('[ERROR] Query is not a string:', query);
    query = String(query); // Convert non-string input to string
  }

  // Split the query into words
  const words = query.toLowerCase().split(/\s+/);
  
  // Filter out stop words and format keywords
  const filteredWords = words.filter(word => !stopWords.includes(word));
  
  // Format the filtered keywords (map each keyword to %keyword%)
  const formattedKeywords = filteredWords.map(word => `%${word}%`);

  console.log(`[INFO] Extracted and formatted keywords: ${formattedKeywords}`);
  
  return formattedKeywords; // Return the formatted keywords as an array
}



// Function to search destinations in the database using extracted keywords
const searchDestinationInDB = async (keywords) => {
  try {
    // Construct the query for both full-text search and trigram similarity
    const query = `
      SELECT places.name, places.description, places.contact_number, places.rating, places.image_url,
      ts_rank_cd(places.search_vector, query) AS rank
      FROM places, to_tsquery('english', $1) query
      WHERE places.search_vector @@ query  -- Full-text search match
      OR places.name ILIKE ANY($2)         -- Trigram fuzzy matching for name
      OR places.description ILIKE ANY($2)  -- Trigram fuzzy matching for description
      ORDER BY rank DESC, similarity(places.name, $3) DESC  -- Order by relevance and fuzzy match
      LIMIT 10;  -- Limit the number of results for efficiency
    `;

    const formattedKeywords = keywords.map(word => `%${word}%`);
    const queryString = keywords.join(' & ');  // Full-text search format

    console.log(`[INFO] Executing query: "${query}" with full-text search query: "${queryString}" and keywords: ${formattedKeywords}`);

    // Execute the query with the formatted keywords
    const { rows } = await pool.query(query, [queryString, formattedKeywords, keywords.join(' ')]);

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

// Enhanced fallback to Google search if no results found in the database
const fetchGoogleResult = async (query) => {
  try {
    // Add more context to the Google search query
    const searchQuery = `${query} travel destination`;
    console.log(`[INFO] Fallback to Google search with query: "${searchQuery}"`);

    // Call the Google search function (this function needs to be implemented separately)
    const googleResult = await googleSearch(searchQuery);
    
    return googleResult;
  } catch (error) {
    console.error(`[ERROR] Failed to fetch Google result: ${error.message}`);
    return "Sorry, I couldn't find any results for your search. Please try again with different keywords.";
  }
};

// Export the search function for use in other modules
module.exports = { searchDestinationInDB, fetchGoogleResult };
