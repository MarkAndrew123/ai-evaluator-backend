import React, { useState, useCallback } from 'react';

// --- Helper Components (SVG Icons) ---
const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const AnalyzeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
);

// --- Main App Component ---
export default function App() {
    const [correctPrompt, setCorrectPrompt] = useState('');
    const [fileA, setFileA] = useState(null);
    const [fileB, setFileB] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [logs, setLogs] = useState([]);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    // --- Backend Configuration ---
    const backendUrl = 'https://ai-evaluator-backend-h1wi.onrender.com/evaluate-files/';

    const handleFileChange = (setter) => (e) => {
        setter(e.target.files[0] || null);
    };

    const addLog = useCallback((message, delay) => {
        return new Promise(resolve => {
            setTimeout(() => {
                setLogs(prev => [...prev, message]);
                resolve();
            }, delay);
        });
    }, []);

    const handleSubmit = async () => {
        if (!correctPrompt || !fileA || !fileB) {
            setError('Please provide a prompt and select both submission files.');
            setResult(null);
            return;
        }

        setIsLoading(true);
        setLogs([]);
        setResult(null);
        setError('');

        try {
            await addLog('▶ Initializing analysis...', 0);

            const formData = new FormData();
            formData.append('correct_prompt', correctPrompt);
            formData.append('submission_a_file', fileA);
            formData.append('submission_b_file', fileB);

            await addLog('▶ Uploading submission files to server...', 500);
            await addLog('▶ Sending request to AI model (this may take a moment)...', 1000);

            const response = await fetch(backendUrl, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'An unknown error occurred during analysis.');
            }

            await addLog('▶ Analysis complete. Formatting results...', 500);
            setResult(data);

        } catch (err) {
            setError(`An error occurred: ${err.message}`);
        } finally {
            setTimeout(() => {
                setIsLoading(false);
            }, 1000);
        }
    };

    const FileInput = ({ file, onChange, labelText }) => (
        <div>
            <h2 className="text-lg font-semibold text-gray-200 mb-3">{labelText}</h2>
            <label htmlFor={labelText} className="w-full flex items-center px-4 py-3 bg-gray-900 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:bg-gray-800 hover:border-blue-500 transition-colors">
                <UploadIcon />
                <span className={`ml-4 ${file ? 'text-gray-200' : 'text-gray-500'}`}>
                    {file ? file.name : 'No file selected...'}
                </span>
                <input id={labelText} type="file" className="hidden" onChange={onChange} accept=".html,.htm,.js,.css,.py,.java,.txt" />
            </label>
        </div>
    );

    return (
        <div className="bg-gray-900 text-gray-300 min-h-screen font-sans p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
                <header className="text-center mb-12">
                    <h1 className="text-4xl sm:text-5xl font-bold text-white mb-2">AI Code Evaluator</h1>
                    <p className="text-lg text-gray-400">A Proof of Concept for automated code submission analysis.</p>
                </header>

                <main className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Input Area */}
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-6 shadow-2xl">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-200 mb-3">1. Provide the Correct Prompt</h2>
                            <textarea
                                value={correctPrompt}
                                onChange={(e) => setCorrectPrompt(e.target.value)}
                                className="w-full h-32 bg-gray-900 border border-gray-600 rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
                                placeholder="Paste the complete, correct prompt here..."
                            />
                        </div>

                        <FileInput file={fileA} onChange={handleFileChange(setFileA)} labelText="2. Upload Submission A" />
                        <FileInput file={fileB} onChange={handleFileChange(setFileB)} labelText="3. Upload Submission B" />

                        <button
                            onClick={handleSubmit}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
                        >
                            <AnalyzeIcon />
                            <span>{isLoading ? 'Analyzing...' : 'Analyze Submissions'}</span>
                        </button>
                    </div>

                    {/* Output Area */}
                    <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-2xl min-h-[500px] flex flex-col">
                        <h2 className="text-lg font-semibold text-gray-200 mb-4">Evaluation Results</h2>
                        <div className="flex-grow bg-gray-900 rounded-lg p-4 overflow-auto">
                            {isLoading && (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                    <div className="w-10 h-10 border-4 border-t-blue-500 border-gray-600 rounded-full animate-spin mb-6"></div>
                                    <ul className="space-y-2">
                                        {logs.map((log, i) => (
                                            <li key={i} className="animate-fade-in text-sm">{log}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {error && !isLoading && (
                                <div className="text-red-400 font-mono whitespace-pre-wrap">{error}</div>
                            )}
                            {result && !isLoading && (
                                <pre className="text-sm whitespace-pre-wrap font-mono">{JSON.stringify(result, null, 2)}</pre>
                            )}
                            {!isLoading && !result && !error && (
                                <div className="flex items-center justify-center h-full text-gray-500">Awaiting analysis...</div>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
