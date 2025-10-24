
import React from 'react';
import EventCreator from './features/EventCreator';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 font-sans">
      <div className="w-full max-w-2xl mx-auto flex flex-col h-[95vh]">
        <header className="flex items-center justify-center mb-4 text-center">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Event Creator
          </h1>
        </header>
        
        <main className="flex-grow flex flex-col bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="flex-grow p-4 overflow-y-auto">
            <EventCreator />
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;