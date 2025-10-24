
import React, { useState, useCallback } from 'react';
import { analyzeImage } from '../services/geminiService';
import Spinner from '../components/Spinner';
import { ImageIcon, SparklesIcon } from '../components/Icon';

const ImageAnalyzer: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setResponse('');
      setError(null);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const handleAnalyze = useCallback(async () => {
    if (!imageFile || !prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResponse('');
    try {
      const imageBase64 = await fileToBase64(imageFile);
      const result = await analyzeImage(prompt, imageBase64, imageFile.type);
      setResponse(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  }, [imageFile, prompt]);

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-semibold text-white mb-4 text-center">Analyze Image</h2>
      <p className="text-center text-gray-400 mb-6">Upload an image and ask a question about it.</p>
      
      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-1/2 flex flex-col items-center p-4 border-2 border-dashed border-gray-600 rounded-lg">
          <input type="file" id="imageUpload" accept="image/*" onChange={handleImageChange} className="hidden" disabled={loading} />
          <label htmlFor="imageUpload" className={`w-full h-full flex flex-col items-center justify-center cursor-pointer ${loading ? 'cursor-not-allowed' : ''}`}>
            {imagePreview ? (
              <img src={imagePreview} alt="Preview" className="max-h-64 rounded-lg object-contain" />
            ) : (
              <div className="text-center text-gray-400">
                <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                <p>Click to upload an image</p>
                <p className="text-xs">PNG, JPG, GIF up to 10MB</p>
              </div>
            )}
          </label>
        </div>
        <div className="md:w-1/2 flex flex-col gap-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What's in this image? Describe it in detail..."
            className="w-full flex-grow p-4 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
            rows={5}
            disabled={loading || !imageFile}
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !imageFile || !prompt.trim()}
            className="w-full bg-purple-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            {loading ? <Spinner /> : <><SparklesIcon className="w-5 h-5 mr-2" /> Analyze Image</>}
          </button>
        </div>
      </div>
      
      {error && <div className="mt-6 p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-lg">{error}</div>}

      {response && (
        <div className="mt-6 p-6 bg-gray-700/50 border border-gray-600 rounded-lg animate-fade-in">
          <h3 className="text-lg font-semibold text-purple-300 mb-4">Analysis Result</h3>
          <p className="text-gray-300 whitespace-pre-wrap">{response}</p>
        </div>
      )}
    </div>
  );
};

export default ImageAnalyzer;
