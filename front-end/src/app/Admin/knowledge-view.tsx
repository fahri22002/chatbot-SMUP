// Admin/knowledge-view.tsx
'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DatabaseZap,
  Search,
  FileText,
  CornerDownLeft,
  Loader2,
  Globe,
  RefreshCw,
  File,
  AlertCircle
} from 'lucide-react';

import { toast } from 'sonner';

// ===== INTERFACES =====
interface ScrapedDoc {
  filename: string;
  url: string;
  content: string;
  snippet: string;
  size: string;
}

interface KnowledgeViewProps {
  onBack: () => void;
}

interface DocListResponse {
  data: ScrapedDoc[];
}

interface ScrappingResponse {
  Status: string;
  Message: string;
}

// ===== MAIN COMPONENT =====
export default function KnowledgeView({ onBack }: KnowledgeViewProps) {
  const [documents, setDocuments] = useState<ScrapedDoc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<ScrapedDoc | null>(null);
  const [isLoading, setIsLoading] = useState({ list: true, scrapping: false });
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ===== FETCH DATA DARI PYTHON =====
  const fetchDocuments = useCallback(async () => {
    try {
      setIsLoading((prev) => ({ ...prev, list: true }));
      setError(null);
      
      // Pastikan URL ini sesuai dengan port backend Python Anda (default 8080)
      const res = await fetch('http://localhost:8080/get-documents');
      
      if (!res.ok) {
        throw new Error(`Server Error: ${res.status}`);
      }
      
      const responseData: DocListResponse = await res.json();
      setDocuments(responseData.data || []);
      
      // Auto-select file pertama jika ada
      if (responseData.data.length > 0 && !selectedDoc) {
        // Optional: setSelectedDoc(responseData.data[0]);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Gagal terhubung ke server Python (localhost:8080).';
      console.error("Fetch Error:", err);
      setError(errMsg);
      toast.error('Gagal mengambil data dokumen.');
    } finally {
      setIsLoading((prev) => ({ ...prev, list: false }));
    }
  }, [selectedDoc]);

  // Load data saat komponen dimount
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // ===== HANDLE UPDATE SCRAPPING =====
  const handleUpdateScrapping = async () => {
    setIsLoading((prev) => ({ ...prev, scrapping: true }));
    try {
      const res = await fetch('http://localhost:8080/do-scrapping');
      
      if (!res.ok) throw new Error('Gagal melakukan scrapping.');
      
      const data: ScrappingResponse = await res.json();
      
      if (data.Status === "Error") {
         throw new Error(data.Message);
      }

      toast.success('Scrapping Selesai!', {
        description: data.Message || 'Data website terbaru telah diambil dan diindeks.',
      });

      // Refresh list setelah scrapping selesai
      await fetchDocuments();

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Terjadi kesalahan tidak diketahui.';
      toast.error('Gagal Scrapping', {
        description: errMsg + ' Pastikan server backend (app.py) berjalan.',
      });
    } finally {
      setIsLoading((prev) => ({ ...prev, scrapping: false }));
    }
  };

  // ===== FILTER SEARCH =====
  const filteredDocs = useMemo(() => {
    if (!searchQuery) return documents;
    const lowerQuery = searchQuery.toLowerCase();
    return documents.filter(
      (doc) =>
        doc.filename.toLowerCase().includes(lowerQuery) ||
        doc.content.toLowerCase().includes(lowerQuery) ||
        doc.url.toLowerCase().includes(lowerQuery)
    );
  }, [documents, searchQuery]);

  // ===== UI RENDER =====
  return (
    <div className="p-4 sm:p-6 lg:p-8 h-full flex flex-col bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* HEADER */}
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            <DatabaseZap className="w-8 h-8 text-blue-600" />
            Scraped Knowledge Base
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
            Menampilkan file hasil scrapping dari folder <code>doc/pages</code>.
          </p>
        </div>
        <div className="flex gap-3">
           <button
            onClick={handleUpdateScrapping}
            disabled={isLoading.scrapping}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading.scrapping ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Sedang Scrapping...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-5 h-5" />
                <span>Update Scrapping</span>
              </>
            )}
          </button>
          <button
            onClick={onBack}
            className="flex items-center gap-2 py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
          >
            <CornerDownLeft className="w-4 h-4" />
            <span>Kembali</span>
          </button>
        </div>
      </header>

      {/* MAIN CONTENT GRID */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        
        {/* LIST PANEL (Left) */}
        <div className="lg:col-span-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm flex flex-col overflow-hidden h-[calc(100vh-180px)]">
          {/* Search Bar */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Cari filename, URL, atau konten..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg border border-gray-300 dark:border-gray-600 pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex justify-between items-center">
                <span>Total File: {documents.length}</span>
                {error && (
                  <span className="flex items-center text-red-500 gap-1">
                    <AlertCircle className="w-3 h-3" /> Error Koneksi
                  </span>
                )}
            </div>
          </div>

          {/* Scrollable List */}
          <div className="overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar">
            {isLoading.list ? (
              <div className="flex flex-col justify-center items-center h-40 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mb-2 text-blue-500" />
                <span className="text-sm">Memuat data...</span>
              </div>
            ) : filteredDocs.length > 0 ? (
              filteredDocs.map((doc) => (
                <button
                  key={doc.filename}
                  onClick={() => setSelectedDoc(doc)}
                  className={`w-full text-left p-3 rounded-lg border transition-all group ${
                    selectedDoc?.filename === doc.filename
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-sm'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-md ${selectedDoc?.filename === doc.filename ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-200' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                        <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-semibold text-sm truncate ${selectedDoc?.filename === doc.filename ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>
                        {doc.filename}
                      </h4>
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400 truncate">
                        <Globe className="w-3 h-3" />
                        <span className="truncate">{doc.url}</span>
                      </div>
                      <div className="mt-2 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-700 pt-1 flex justify-between">
                         <span>Size: {doc.size}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center text-gray-500 p-8 flex flex-col items-center">
                <File className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm">
                  {error ? 'Gagal memuat data.' : 'Tidak ada dokumen ditemukan.'}
                </p>
                {error && (
                  <button 
                    onClick={() => fetchDocuments()} 
                    className="mt-2 text-blue-500 text-xs hover:underline"
                  >
                    Coba Lagi
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* DETAIL PANEL (Right) */}
        <div className="lg:col-span-8 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm flex flex-col overflow-hidden h-[calc(100vh-180px)]">
          {selectedDoc ? (
            <>
              <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-start">
                <div className="overflow-hidden pr-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <span className="truncate">{selectedDoc.filename}</span>
                    </h2>
                    <a 
                        href={selectedDoc.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1 mt-1 truncate"
                    >
                        <Globe className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{selectedDoc.url}</span>
                    </a>
                </div>
                <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-medium border border-green-200 dark:border-green-800 whitespace-nowrap">
                    Ready for RAG
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-900 custom-scrollbar">
                <div className="prose dark:prose-invert max-w-none">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Isi Konten Dokumen
                    </h3>
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-300 leading-relaxed">
                        {selectedDoc.content}
                    </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-full mb-4">
                <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-lg font-medium text-gray-500">Pilih dokumen untuk melihat isi.</p>
              <p className="text-sm">Dokumen diambil dari folder <code>doc/pages</code> hasil scrapping.</p>
            </div>
          )}
        </div>

      </section>
    </div>
  );
}