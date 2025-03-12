const express = require('express');
const { fetchCohereResponse } = require('./services/cohereService'); // AI response handler
const { fetchGoogleResult } = require('./services/googleService'); // Google result handler
const { searchDestinationInDB } = require('./services/dbService'); // DB search function
const i18next = require('i18next');
const middleware = require('i18next-http-middleware');
const LanguageDetector = require('i18next-http-middleware').LanguageDetector;
const dotenv = require('dotenv');
const twilio = require('twilio');
const { Pool } = require('pg');

dotenv.config();

// Initialize i18next for multilingual support
i18next
  .use(LanguageDetector)
  .init({
    fallbackLng: 'en', 
    preload: ['en', 'fr'], 
    resources: {
      en: { translation: { welcome: 'Welcome to Nuru!' } },
      fr: { translation: { welcome: 'Bienvenue à Nuru!' } },
    },
  });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(middleware.handle(i18next));

// Initialize Twilio
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilio(accountSid, authToken);
const fromWhatsAppNumber = 'whatsapp:' + process.env.TWILIO_WHATSAPP_NUMBER;

// Initialize PostgreSQL connection pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Utility function to extract keywords from the message
const extractRelevantKeywords = (message) => {
  const stopWords = ["find", "me", "in", "the", "a", "an", "at"];
  const words = message.toLowerCase().split(" ");
  return words.filter(word => !stopWords.includes(word));
};

// Verify environment variables
const verifyEnvVariables = () => {
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
    console.error('[ERROR] Missing environment variables for the database connection.');
    process.exit(1); // Exit if missing variables
  }
  console.log('[INFO] All required environment variables are loaded.');
};

// Check PostgreSQL database connection
const checkDatabaseConnection = async () => {
  try {
    console.log('[INFO] Checking database connection...');
    await pool.query('SELECT NOW()');
    console.log('[SUCCESS] Successfully connected to the database.');
  } catch (error) {
    console.error(`[ERROR] Failed to connect to the database: ${error.message}`);
    process.exit(1); // Exit if DB connection fails
  }
};

// Add human-like emojis to responses
const addHumanLikeEmotions = (response) => {
  const mannerisms = ["😊", "🤔", "✨", "😄", "🙌", "😅", "👍", "💡", "🤷‍♂️"];
  return `${response} ${mannerisms[Math.floor(Math.random() * mannerisms.length)]}`;
};

// Send message via Twilio WhatsApp
const sendMessage = async (to, text) => {
  try {
    console.log(`[INFO] Sending message to ${to}: "${text}"`);
    await twilioClient.messages.create({
      from: fromWhatsAppNumber,
      to: `whatsapp:${to}`,
      body: text,
    });
  } catch (error) {
    console.error(`[ERROR] Failed to send message: ${error.message}`);
  }
};

// Send image via Twilio WhatsApp
const sendImage = async (to, imageUrl, caption = '') => {
  try {
    console.log(`[INFO] Sending image to ${to}, URL: ${imageUrl}`);
    await twilioClient.messages.create({
      from: fromWhatsAppNumber,
      to: `whatsapp:${to}`,
      mediaUrl: [imageUrl],
      body: caption,
    });
  } catch (error) {
    console.error(`[ERROR] Failed to send image: ${error.message}`);
  }
};

// Main handler to search in the database first, then fallback to Google if no results
const handleQuery = async (message, chatId) => {
  try {
    const keywords = extractRelevantKeywords(message);
    console.log(`[INFO] Extracted keywords: ${keywords}`);

    if (keywords.length === 0) {
      return "I didn't understand your query. Could you be more specific?";
    }

    // 1. Try to search in the database first
    const dbResults = await searchDestinationInDB(keywords);

    if (dbResults && dbResults.length > 0) {
      let responseText = `Here are some results for your search:\n\n`;
      for (const [index, place] of dbResults.entries()) {
        responseText += `${index + 1}. *${place.name}*\n` +
                        `   - Description: ${place.description}\n` +
                        `   - Contact: ${place.contact_number}\n` +
                        `   - Rating: ${place.rating}/5\n\n`;
        // Optional: Send images if available
        if (place.image_url) {
          await sendImage(chatId, place.image_url, `Here's a view of ${place.name}`);
        }
      }
      return responseText;
    } else {
      // 2. If no results found in DB, fallback to Google Search
      console.log('[INFO] No results found in DB, fetching from Google...');
      const googleResult = await fetchGoogleResult(keywords.join(' '));
      return googleResult;
    }
  } catch (error) {
    console.error(`[ERROR] Error during query handling: ${error.message}`);
    return "Oops! Something went wrong. Please try again later.";
  }
};

// Webhook to receive WhatsApp messages
app.post('/whatsapp', async (req, res) => {
  try {
    const message = req.body.Body;
    const chatId = req.body.From ? req.body.From.replace('whatsapp:', '') : null;
    const detectedLang = req.language; // Detect language from middleware

    if (!chatId) {
      console.error(`[ERROR] No chat ID found in the request`);
      return res.status(400).send('Bad Request: No chat ID found');
    }

    console.log(`[INFO] Received message from ${chatId} (Language: ${detectedLang}): "${message}"`);

    let response;

    // Define greeting keywords
    const greetings = ['hi', 'hello', 'hey', 'salut'];

    // Check if the message is a greeting
    if (greetings.includes(message.toLowerCase())) {
      response = i18next.t('welcome', { lng: detectedLang });
    } else {
      // Handle the query logic for other messages
      response = await handleQuery(message, chatId);
    }

    // Send the response with human-like emotions
    await sendMessage(chatId, addHumanLikeEmotions(response));
    res.status(200).send('<Response></Response>');
  } catch (error) {
    console.error(`[ERROR] Error handling WhatsApp message: ${error.stack}`);
    res.status(500).send('Internal Server Error: Could not process the message');
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`[INFO] Server running on port ${PORT}`);
  verifyEnvVariables();
  await checkDatabaseConnection();
});
