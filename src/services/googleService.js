const axios = require('axios');

// Function to fetch results from Google Custom Search API
async function fetchGoogleResult(query) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CSE_ID; // Ensure you use the correct environment variable (GOOGLE_CSE_ID)

  // Log to ensure API Key and CSE ID are correctly set
  console.log(`[DEBUG] API Key: ${apiKey ? 'Set' : 'Missing'}, CX: ${cx ? 'Set' : 'Missing'}`);

  try {
    // Make request to Google Custom Search API
    const response = await axios.get(`https://www.googleapis.com/customsearch/v1`, {
      params: {
        q: query, // Directly pass the query without encoding, as Axios handles it
        key: apiKey,
        cx: cx
      }
    });

    // Log the full response for debugging purposes
    console.log('[DEBUG] Google API Response:', response.data);

    // Check if the response contains items (search results)
    if (!response.data.items || !Array.isArray(response.data.items) || response.data.items.length === 0) {
      return 'No results found on Google for your query.';
    }

    // Find the first relevant result (checking title and snippet for keywords like 'hotel')
    const topResult = response.data.items.find(item => 
      item.title.toLowerCase().includes('hotel') || item.snippet.toLowerCase().includes('hotel')
    ) || response.data.items[0]; // Fallback to the first item if no 'hotel' results are found

    // If a relevant result is found, return the title and link; otherwise, return a message indicating no results
    return topResult ? `${topResult.title}: ${topResult.link}` : 'No relevant hotel results found on Google for your query.';
    
  } catch (error) {
    // Check if the error has a response, and log that response for better error handling
    if (error.response) {
      console.error('[ERROR] Error fetching Google results:', error.response.data);
    } else {
      console.error('[ERROR] Error fetching Google results:', error.message);
    }

    // Return a user-friendly message in case of an error
    return 'There was an error fetching results from Google. Please try again later.';
  }
}

// Export the function to be used in other parts of the application
module.exports = { fetchGoogleResult };
