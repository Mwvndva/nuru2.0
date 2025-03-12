const i18next = require('i18next');
const middleware = require('i18next-http-middleware');
const LanguageDetector = require('i18next-http-middleware').LanguageDetector;

// Initialize i18next with the language detector
i18next
  .use(LanguageDetector)
  .init({
    fallbackLng: 'en', // Default language is English
    preload: ['en', 'fr'], // Preload English and French languages
    detection: {
      order: ['querystring', 'cookie', 'header', 'session'], // Detect from headers
      caches: ['cookie'], // Cache the detected language in cookies
    },
    resources: {
      en: {
        translation: {
          welcome: 'Welcome to Nuru!',
          error: 'Sorry, I could not find what you are looking for.',
          // More translations
        },
      },
      fr: {
        translation: {
          welcome: 'Bienvenue à Nuru!',
          error: 'Désolé, je n’ai pas trouvé ce que vous cherchiez.',
          // More translations
        },
      },
    },
  });
