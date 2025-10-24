// Fix: Add type declaration for the chrome extension API to resolve TypeScript errors.
declare const chrome: any;

import React, { useState, useCallback, useEffect } from 'react';
import { analyzeTextForEvent } from '../services/geminiService';
import type { CalendarEvent } from '../types';
import Spinner from '../components/Spinner';

const EventCreator: React.FC = () => {
  const [text, setText] = useState('');
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if running in a Chrome extension context and look for selected text
    if (window.chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('selectedText', (data: { [key: string]: any; }) => {
        if (data.selectedText) {
          setText(data.selectedText);
          // Clear the storage so it's not used again on subsequent opens
          chrome.storage.local.remove('selectedText');
        }
      });
    }
  }, []);


  const handleAnalyze = useCallback(async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setEvent(null);
    try {
      const result = await analyzeTextForEvent(text);
      if (result) {
        setEvent(result);
      } else {
        setError("No event details could be extracted from the text. Please try rephrasing or adding more details.");
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(`An error occurred: ${err.message}\n\nStack Trace:\n${err.stack || 'Not available'}`);
      } else {
        setError('An unknown error occurred. Please check the console for details.');
      }
    } finally {
      setLoading(false);
    }
  }, [text]);

  const generateCalendarLink = () => {
    if (!event) return '#';
    const G_CAL_URL = 'https://www.google.com/calendar/render?action=TEMPLATE';
    const params = new URLSearchParams();
    params.append('text', event.title);

    const formatISODateForGoogle = (isoDate: string) => isoDate.replace(/-|:|\.\d{3}/g, '');
    
    if(event.start_time){
        params.append('dates', `${formatISODateForGoogle(event.start_time)}/${event.end_time ? formatISODateForGoogle(event.end_time) : formatISODateForGoogle(event.start_time)}`);
    }

    if (event.description) {
        params.append('details', event.description);
    }
    if (event.location) {
        params.append('location', event.location);
    }
    return `${G_CAL_URL}&${params.toString()}`;
  };

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-semibold text-white mb-4 text-center">Create Event from Text</h2>
      
      <div className="flex-grow flex flex-col gap-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter event details..."
          className="w-full flex-grow p-4 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
          rows={8}
          disabled={loading}
        />

        <button
          onClick={handleAnalyze}
          disabled={loading || !text.trim()}
          className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        >
          {loading ? <Spinner /> : 'Create Event'}
        </button>
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-lg">
          <h4 className="font-bold mb-2">Error Details</h4>
          <pre className="text-xs whitespace-pre-wrap font-mono">{error}</pre>
        </div>
      )}

      {event && (
        <div className="mt-6 p-6 bg-gray-700/50 border border-gray-600 rounded-lg animate-fade-in">
          <h3 className="text-lg font-semibold text-purple-300 mb-4">Extracted Event Details</h3>
          <div className="space-y-3 text-sm">
            <p><strong>Title:</strong> {event.title}</p>
            <p><strong>Start:</strong> {new Date(event.start_time).toLocaleString()}</p>
            {event.end_time && <p><strong>End:</strong> {new Date(event.end_time).toLocaleString()}</p>}
            {event.location && <p><strong>Location:</strong> {event.location}</p>}
            {event.description && <p><strong>Description:</strong> {event.description}</p>}
          </div>
          <a
            href={generateCalendarLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center justify-center w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-colors"
          >
            Add to Google Calendar
          </a>
        </div>
      )}
    </div>
  );
};

export default EventCreator;