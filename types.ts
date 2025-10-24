export type TabId = 'event' | 'image';

export interface CalendarEvent {
  title: string;
  start_time: string; // ISO 8601 format
  end_time?: string; // ISO 8601 format
  location?: string;
  description?: string;
}

// Fix: Add ChatMessage type definition to resolve compilation errors.
export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}
