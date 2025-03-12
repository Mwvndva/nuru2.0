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
const stopWords = ['and', 'or', 'the', 'is', 'in', 'at', 'a', 'an', 'of', 'for', 'on', 'with', 'to', 'find', 'me'];

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
    // Construct the query for multiple keyword conditions using `OR` for separate searches
    const query = `
      SELECT places.name, places.description, places.contact_number, places.rating, places.image_url
      FROM places
      JOIN subcategories ON places.subcategory_id = subcategories.id
      JOIN categories ON subcategories.category_id = categories.id
      JOIN locations ON categories.location_id = locations.id
      WHERE
      ${keywords.map((_, idx) => `(places.name ILIKE $${idx + 1} OR
                                   places.description ILIKE $${idx + 1} OR
                                   locations.name ILIKE $${idx + 1})`).join(' OR ')};
    `;

    console.log(`[INFO] Executing query: "${query}" with keywords: ${keywords}`);
    
    // Execute the query with the formatted keywords as parameters
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

// Export the search function for use in other modules
module.exports = { searchDestinationInDB };
