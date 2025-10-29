// geminiService.js — Prompt API (Gemini Nano On-Device)
// Requires Chrome 138+ with Prompt API enabled.
// No API keys or network calls needed.

// Debug logging helper
function log(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] PROMPT_API: ${message}`, data || '');
  }
  
  /**
   * Analyze text using the Prompt API (Gemini Nano) to extract event details.
   * @param {string} text
   * @returns {Promise<Object|null>} Parsed event JSON or null
   */
  async function analyzeTextWithPromptAPI(text) {
    log('Starting Prompt API analysis:', text.slice(0, 100));
  
    if (!text || !text.trim()) {
      throw new Error('No text provided for analysis');
    }
  
    // 1️⃣  Check availability of on-device model
    const availability = await window.ai.languageModel.availability();
    if (availability === 'unavailable') {
      throw new Error('Prompt API model unavailable on this device');
    }
  
    // 2️⃣  Create a session (download happens automatically if needed)
    const session = await window.ai.languageModel.create({
      initialPrompts: [
        {
          role: 'system',
          content:
            'You are an expert assistant that extracts structured calendar event data in strict JSON.',
        },
      ],
    });
  
    // 3️⃣  Create a schema constraint to force structured JSON
    const schema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        start_time: { type: 'string' },
        end_time: { type: 'string' },
        description: { type: 'string' },
        location: { type: 'string' },
      },
      required: ['title', 'start_time'],
    };
  
    // 4️⃣  Build the extraction prompt
    const prompt = createEventExtractionPrompt(text);
  
    // 5️⃣  Prompt the model
    const result = await session.prompt(prompt, {
      responseConstraint: schema,
    });
  
    session.destroy();
  
    // 6️⃣  Parse result
    try {
      const json = JSON.parse(result);
      log('Parsed event JSON:', json);
      return json;
    } catch (err) {
      log('Could not parse model output as JSON:', result);
      return null;
    }
  }
  
  /**
   * Build event-extraction prompt
   */
  function createEventExtractionPrompt(text) {
    const now = new Date().toISOString();
    const today = now.split('T')[0];
  
    return `Extract a calendar event from the following text and return ONLY valid JSON.
  Current date: ${today}
  Now: ${now}
  Timezone: UTC
  Rules:
  - Compute relative dates like "tomorrow" or "next Monday".
  - Default start time 09:00 AM if missing.
  - Duration 1 hour if end time missing.
  - Include title, start_time, optional end_time, description, and location.
  
  Text: """${text}"""`;
  }
  
  /**
   * Fallback parser if Prompt API unavailable
   */
  function fallbackParseEventFromText(text) {
    log('Using fallback regex parser');
    const title = text.split('\n')[0].trim();
    const now = new Date();
    return {
      title,
      start_time: now.toISOString(),
      end_time: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      description: text,
    };
  }
  
  // Export for Chrome Extension contexts
  if (typeof window !== 'undefined') {
    window.GeminiService = {
      analyzeTextWithPromptAPI,
      fallbackParseEventFromText,
    };
  }
  