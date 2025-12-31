'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    file_name: string;
    file_path: string;
    file_web_url: string;
    chunk_id: string;
    score?: number;
  }>;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestAvailable, setIngestAvailable] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Check if ingestion is available
    fetch('/api/ingest/available')
      .then((res) => res.json())
      .then((data) => setIngestAvailable(data.available))
      .catch(() => setIngestAvailable(false));
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMessage.content }),
      });

      if (!response.ok) {
        throw new Error('Chat request failed');
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Entschuldigung, es ist ein Fehler aufgetreten. Bitte versuche es erneut.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleIngest = async () => {
    if (isIngesting) return;

    setIsIngesting(true);
    try {
      const response = await fetch('/api/ingest', {
        method: 'POST',
        // Add timeout signal (10 minutes)
        signal: AbortSignal.timeout(10 * 60 * 1000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        alert(`Ingestion erfolgreich abgeschlossen!\n\n${data.output || ''}`);
      } else {
        // Check if it's a Vercel-specific error
        if (response.status === 400 && data.message?.includes('not supported on Vercel')) {
          alert(`⚠️ Ingestion auf Vercel nicht verfügbar\n\n${data.error || data.message}\n\nBitte führe die Ingestion lokal aus mit: npm run ingest`);
        } else {
          const errorMsg = data.error 
            ? `Fehler: ${data.message}\n\nDetails:\n${data.error}`
            : data.message;
          alert(`Ingestion fehlgeschlagen: ${errorMsg}`);
        }
        console.error('Ingest error:', data);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        alert('Ingestion-Timeout: Der Prozess dauert zu lange. Bitte prüfe die Server-Logs.');
      } else {
        alert(`Fehler beim Starten der Ingestion: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      console.error('Ingest request error:', error);
    } finally {
      setIsIngesting(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Knowledge Chat
          </h1>
          {/* Only show ingest button when ingestion is available (not on Vercel) */}
          {ingestAvailable === true && (
            <button
              onClick={handleIngest}
              disabled={isIngesting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isIngesting ? 'Lädt...' : 'Daten aktualisieren'}
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-6">
          {messages.length === 0 && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <h2 className="mb-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  Willkommen bei Knowledge Chat
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Stelle eine Frage zu deinen Dokumenten.
                </p>
              </div>
            </div>
          )}

          {messages.map((message, idx) => (
            <div
              key={idx}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
                    <p className="mb-2 text-xs font-semibold text-gray-600 dark:text-gray-400">
                      Quellen:
                    </p>
                    <div className="space-y-1">
                      {message.sources.map((source, sourceIdx) => (
                        <a
                          key={sourceIdx}
                          href={source.file_web_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {source.file_name} (Chunk: {source.chunk_id})
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-white px-4 py-3 dark:bg-gray-800">
                <div className="flex space-x-2">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400"></div>
                  <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0.2s]"></div>
                  <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0.4s]"></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950 px-4 py-4">
        <div className="mx-auto max-w-4xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Stelle eine Frage..."
              disabled={isLoading}
              className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Senden
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
