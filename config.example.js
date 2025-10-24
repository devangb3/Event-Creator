// Configuration file for Gemini Event Creator
// Copy this file to config.js and add your API key

export const config = {
  // Get your Gemini API key from: https://makersuite.google.com/app/apikey
  GEMINI_API_KEY: 'your_gemini_api_key_here',
  
  // Optional: Configure fallback behavior
  USE_FALLBACK_ON_ERROR: true,
  
  // Optional: Configure Gemini model settings
  GEMINI_MODEL: 'gemini-2.5-flash',
  GEMINI_TEMPERATURE: 0.1,
  GEMINI_MAX_TOKENS: 1024
};
