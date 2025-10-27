// Gemini AI service for intelligent event parsing
// This service integrates with Google's Gemini API to extract event details from text

// Debug logging function
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] GEMINI: ${message}`, data || '');
}

// Configuration - will be loaded from environment variables
let GEMINI_API_KEY = 'YOUR_GEMINI_API_KEY_HERE';
let GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Try to load configuration from environment variables
try {
  // Check if we're in a build environment with process.env available
  if (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) {
    GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    log('Loaded API key from environment variable');
  } else if (typeof importScripts !== 'undefined') {
    // Service worker context - configuration should be passed via message
    log('Running in service worker context - API key will be set via setApiKey function');
  } else if (typeof window !== 'undefined') {
    // Browser context - try to load config if available
    if (window.config) {
      GEMINI_API_KEY = window.config.GEMINI_API_KEY || GEMINI_API_KEY;
      log('Loaded config from window.config');
    }
  }
} catch (error) {
  log('Could not load configuration:', error.message);
}

/**
 * Analyzes text using Gemini AI to extract event details
 * @param {string} text - The text to analyze
 * @returns {Promise<Object|null>} - Event object with title, start_time, end_time, description, location
 */
async function analyzeTextWithGemini(text) {
  log('Starting Gemini analysis for text:', text.substring(0, 100));
  
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    log('ERROR: Gemini API key not configured');
    throw new Error('Gemini API key not configured. Please set GEMINI_API_KEY environment variable.');
  }

  if (!text || text.trim().length === 0) {
    log('ERROR: Empty text provided');
    throw new Error('No text provided for analysis');
  }

  try {
    const prompt = createEventExtractionPrompt(text);
    log('Sending request to Gemini API');
    
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.0,  // More deterministic responses
          topK: 1,           // More focused responses
          topP: 0.8,         // Slightly more focused
          maxOutputTokens: 512,  // Shorter, more focused responses
          candidateCount: 1,     // Single response
          stopSequences: []      // No stop sequences
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH", 
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      log('ERROR: Gemini API request failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      throw new Error(`Gemini API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    log('Received response from Gemini API');

    if (!data.candidates || data.candidates.length === 0) {
      log('ERROR: No candidates in Gemini response');
      throw new Error('No response from Gemini API');
    }

    const candidate = data.candidates[0];
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      log('ERROR: No content in Gemini response');
      throw new Error('Empty response from Gemini API');
    }

    const responseText = candidate.content.parts[0].text;
    log('Gemini response text:', responseText);

    const eventData = parseGeminiResponse(responseText);
    log('Parsed event data:', eventData);
    
    return eventData;

  } catch (error) {
    log('ERROR in analyzeTextWithGemini:', error);
    throw error;
  }
}

/**
 * Creates a structured prompt for Gemini to extract event information
 * @param {string} text - The input text
 * @returns {string} - The formatted prompt
 */
function createEventExtractionPrompt(text) {
  const currentTime = new Date().toISOString();
  const currentDate = new Date().toISOString().split('T')[0];
  
  return `You are an expert event extraction AI. Extract calendar event information from the given text and return ONLY a valid JSON object.

CURRENT CONTEXT:
- Current date/time: ${currentTime}
- Today's date: ${currentDate}
- Timezone: UTC

REQUIRED JSON FORMAT:
{
  "title": "Event title (required)",
  "start_time": "YYYY-MM-DDTHH:MM:SS.000Z (required, ISO format)",
  "end_time": "YYYY-MM-DDTHH:MM:SS.000Z (optional, ISO format)",
  "description": "Event description (optional)",
  "location": "Event location (optional)"
}

EXTRACTION RULES:
1. If NO clear event is found, return: null
2. For relative dates, calculate actual dates:
   - "tomorrow" = next day at specified time
   - "next Monday/Tuesday/etc" = next occurrence of that day
   - "this Friday" = this week's Friday
   - "next week" = 7 days from now
3. For times without AM/PM, assume 24-hour format
4. Default time: 9:00 AM if no time specified
5. Default duration: 1 hour if no end time specified
6. Extract location from text or infer from context
7. Make title descriptive and clear

EXAMPLES:
Input: "Team meeting tomorrow at 2 PM"
Output: {"title": "Team meeting", "start_time": "2024-01-16T14:00:00.000Z", "end_time": "2024-01-16T15:00:00.000Z"}

Input: "Doctor appointment next Friday 10 AM at City Hospital"
Output: {"title": "Doctor appointment", "start_time": "2024-01-19T10:00:00.000Z", "end_time": "2024-01-19T11:00:00.000Z", "location": "City Hospital"}

Input: "Lunch with John"
Output: {"title": "Lunch with John", "start_time": "2024-01-15T09:00:00.000Z", "end_time": "2024-01-15T10:00:00.000Z"}

TEXT TO ANALYZE: "${text}"

Return ONLY the JSON object (no markdown, no explanations):`;
}

/**
 * Parses the JSON response from Gemini
 * @param {string} responseText - The raw response text from Gemini
 * @returns {Object|null} - Parsed event object or null
 */
function parseGeminiResponse(responseText) {
  try {
    log('Raw Gemini response:', responseText);
    
    // Clean the response text (remove markdown formatting if present)
    let cleanText = responseText.trim();
    
    // Remove common prefixes that Gemini might add
    const prefixesToRemove = [
      /^Here's the extracted event information:\s*/i,
      /^Here is the extracted event information:\s*/i,
      /^Event extracted:\s*/i,
      /^Extracted event:\s*/i,
      /^JSON:\s*/i,
      /^Response:\s*/i
    ];
    
    for (const prefix of prefixesToRemove) {
      cleanText = cleanText.replace(prefix, '');
    }
    
    // Remove markdown code blocks if present
    if (cleanText.includes('```json')) {
      const jsonMatch = cleanText.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        cleanText = jsonMatch[1].trim();
      }
    } else if (cleanText.includes('```')) {
      const codeMatch = cleanText.match(/```\s*([\s\S]*?)\s*```/);
      if (codeMatch) {
        cleanText = codeMatch[1].trim();
      }
    }

    // Try to extract JSON from the response using multiple patterns
    let jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Try to find JSON-like structure even if not properly formatted
      jsonMatch = cleanText.match(/\{[^}]*"title"[^}]*\}/);
    }
    
    if (jsonMatch) {
      cleanText = jsonMatch[0];
    }

    log('Cleaned response text for parsing:', cleanText);

    // Handle case where Gemini returns null
    if (cleanText.toLowerCase().includes('null') || cleanText.trim() === 'null') {
      log('Gemini determined no event was found');
      return null;
    }

    const eventData = JSON.parse(cleanText);
    
    // Validate the response
    if (eventData === null || eventData === undefined) {
      log('Gemini determined no event was found');
      return null;
    }

    if (!eventData.title || typeof eventData.title !== 'string' || eventData.title.trim() === '') {
      log('ERROR: No valid title in Gemini response');
      return null;
    }

    // Validate and format the event data
    const validatedEvent = {
      title: eventData.title.trim(),
      start_time: eventData.start_time || null,
      end_time: eventData.end_time || null,
      description: eventData.description || eventData.title,
      location: eventData.location || null
    };

    // Validate start_time format
    if (validatedEvent.start_time) {
      try {
        const startDate = new Date(validatedEvent.start_time);
        if (isNaN(startDate.getTime())) {
          log('ERROR: Invalid start_time format:', validatedEvent.start_time);
          return null;
        }
        // Ensure it's in ISO format
        validatedEvent.start_time = startDate.toISOString();
      } catch (e) {
        log('ERROR: Invalid start_time format:', validatedEvent.start_time);
        return null;
      }
    }

    // Validate end_time format if present
    if (validatedEvent.end_time) {
      try {
        const endDate = new Date(validatedEvent.end_time);
        if (isNaN(endDate.getTime())) {
          log('WARNING: Invalid end_time format, removing:', validatedEvent.end_time);
          validatedEvent.end_time = null;
        } else {
          validatedEvent.end_time = endDate.toISOString();
        }
      } catch (e) {
        log('WARNING: Invalid end_time format, removing:', validatedEvent.end_time);
        validatedEvent.end_time = null;
      }
    }

    log('Successfully parsed and validated event data:', validatedEvent);
    return validatedEvent;

  } catch (error) {
    log('ERROR parsing Gemini response:', error);
    log('Raw response was:', responseText);
    
    // Try to extract any useful information even if JSON parsing fails
    const titleMatch = responseText.match(/"title"\s*:\s*"([^"]+)"/);
    if (titleMatch) {
      log('Attempting to extract partial event data');
      return {
        title: titleMatch[1],
        start_time: null,
        end_time: null,
        description: titleMatch[1],
        location: null
      };
    }
    
    throw new Error(`Failed to parse Gemini response: ${error.message}`);
  }
}

/**
 * Fallback function for when Gemini is not available
 * Uses simple regex parsing as backup
 * @param {string} text - The text to parse
 * @returns {Object|null} - Event object or null
 */
function fallbackParseEventFromText(text) {
  log('Using fallback parsing (no Gemini)');
  
  // Simple regex patterns for common event formats
  const titleMatch = text.match(/^([^\n\r]+)/);
  const timeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))/);
  const dateMatch = text.match(/(tomorrow|today|next\s+\w+|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);

  if (!titleMatch) return null;

  const title = titleMatch[1].trim();
  const now = new Date();

  // Simple date calculation
  let eventDate = new Date(now);
  if (dateMatch) {
    const dateStr = dateMatch[1].toLowerCase();
    if (dateStr === 'tomorrow') {
      eventDate.setDate(now.getDate() + 1);
    } else if (dateStr.includes('next')) {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDay = days.indexOf(dateStr.split(' ')[1]);
      if (targetDay !== -1) {
        const currentDay = now.getDay();
        const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
        eventDate.setDate(now.getDate() + daysUntil);
      }
    }
  }

  // Simple time parsing
  let startTime = '09:00';
  if (timeMatch) {
    startTime = timeMatch[1].toUpperCase();
  }

  const startDateTime = `${eventDate.toISOString().split('T')[0]}T${startTime}:00`;

  return {
    title: title,
    start_time: startDateTime,
    description: text
  };
}

/**
 * Sets the API key for Gemini service
 * @param {string} apiKey - The Gemini API key
 */
function setApiKey(apiKey) {
  GEMINI_API_KEY = apiKey;
  log('API key updated');
}

/**
 * Gets the current API key status
 * @returns {Object} - Status information
 */
function getApiKeyStatus() {
  return {
    hasApiKey: GEMINI_API_KEY && GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE',
    isConfigured: GEMINI_API_KEY && GEMINI_API_KEY.length > 10
  };
}

// Export functions for use in background script
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = {
    analyzeTextWithGemini,
    fallbackParseEventFromText,
    setApiKey,
    getApiKeyStatus
  };
} else if (typeof importScripts !== 'undefined') {
  // Service worker environment - functions are available globally
  // No need to assign to window object
} else if (typeof window !== 'undefined') {
  // Browser/Chrome extension environment
  window.GeminiService = {
    analyzeTextWithGemini,
    fallbackParseEventFromText,
    setApiKey,
    getApiKeyStatus
  };
}
