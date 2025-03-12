const { fetchGoogleResult } = require('./googleSearchService');
const { searchDestinationInDB } = require('./dbService');

// In your route handler
app.post('/search', async (req, res) => {
    const query = req.body.query;

    try {
        // Extract relevant keywords from the query to improve DB search accuracy
        const keywords = extractRelevantKeywords(query);

        // First, try to fetch results from the database using the relevant keywords
        let dbResults = await searchDestinationInDB(keywords);

        let combinedResults = [];

        // If no results are found in the database, fetch from Google
        if (!dbResults || dbResults.length === 0) {
            console.log(`No results found in the database for "${query}", fetching from Google...`);
            const googleResults = await fetchGoogleResult(query);

            // Merge Google results into combinedResults
            combinedResults = [...googleResults];
        } else {
            console.log(`Found results in the database for "${query}"`);
            // Add database results to combinedResults
            combinedResults = [...dbResults];
        }

        // Send the combined results back to the user
        res.send(combinedResults);

    } catch (error) {
        console.error(`[ERROR] Failed to handle search query "${query}": ${error.message}`);
        res.status(500).send('Internal Server Error: Could not process the search');
    }
});
