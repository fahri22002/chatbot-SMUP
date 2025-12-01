// app/Admin/RAG-view.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import {
  DatabaseZap,
  Search,
  FileText,
  CornerDownLeft,
  Loader2,
  UploadCloud, // Ikon baru
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

interface ScrapedDoc {
  filename: string;
  url: string;
  content: string;
  snippet: string;
  size: string;
}

interface RagViewProps {
  onBack: () => void;
}

export default function RagView({ onBack }: RagViewProps) {
  const [documents, setDocuments] = useState<ScrapedDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch Dokumen (Sama seperti KnowledgeView, ambil list file)
  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('http://localhost:8080/get-documents');
      if (!res.ok) throw new Error('Gagal koneksi ke server Python.');
      const data = await res.json();
      setDocuments(data.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengambil data RAG.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  // 2. Handle Upload Manual
 const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    
    // Validasi: Izinkan TXT dan PDF
    const isTxt = file.name.endsWith('.txt');
    const isPdf = file.name.endsWith('.pdf');

    if (!isTxt && !isPdf) {
      toast.warning('Harap upload file format .txt atau .pdf');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:8080/upload-doc', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.Status === 'Success') {
        toast.success('Berhasil!', { description: data.Message });
        fetchDocuments(); 
      } else {
        throw new Error(data.Message);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Upload gagal: ${msg}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = ''; 
    }
  };


  // Filter Search
  const filteredDocs = documents.filter((doc) =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className='p-6 h-full flex flex-col bg-gray-50 dark:bg-gray-900'>
      {/* Header */}
      <header className='mb-6 flex justify-between items-center'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2'>
            <DatabaseZap className='w-8 h-8 text-blue-600' />
            Manajemen Data RAG
          </h1>
          <p className='text-gray-500 mt-1 text-sm'>
            Upload dokumen manual (.txt) untuk menambah pengetahuan Chatbot secara langsung.
          </p>
        </div>
        <button
          onClick={onBack}
          className='px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition text-sm font-medium'
        >
          <CornerDownLeft className='w-4 h-4 inline mr-2' />
          Kembali
        </button>
      </header>

      {/* --- AREA UPLOAD BARU --- */}
    <div className='mb-6 p-8 border-2 border-dashed border-blue-300 dark:border-blue-800 rounded-xl bg-blue-50 dark:bg-blue-900/10 flex flex-col items-center justify-center text-center hover:bg-blue-100 dark:hover:bg-blue-900/20 transition-colors cursor-pointer'
           onClick={() => fileInputRef.current?.click()}>
        
        <div className='p-4 bg-white dark:bg-blue-900 rounded-full mb-3 shadow-sm'>
          <UploadCloud className='w-8 h-8 text-blue-600 dark:text-blue-400' />
        </div>
        
        <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
          Klik untuk Upload Dokumen Tambahan
        </h3>
        <p className='text-sm text-gray-500 mt-1 mb-0 max-w-md'>
          {/* Update teks instruksi */}
          File bisa berupa <strong>.txt</strong> atau <strong>.pdf</strong>. 
          PDF akan otomatis dikonversi menjadi teks agar terbaca oleh Chatbot.
        </p>
        
        <input
          type='file'
          accept='.txt, .pdf' // Update accept attribute
          ref={fileInputRef}
          onChange={handleFileUpload}
          className='hidden'
        />
        
        {isUploading && (
          <div className="mt-4 flex items-center gap-2 text-blue-600 font-medium">
             <Loader2 className='w-4 h-4 animate-spin' /> Memproses upload & indexing...
          </div>
        )}
      </div>

      {/* List Dokumen (Read Only) */}
      <div className='bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm flex-1 flex flex-col overflow-hidden'>
        <div className='p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-4 bg-gray-50 dark:bg-gray-800/50'>
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
            <input
              type='text'
              placeholder='Cari dokumen yang tersimpan...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 outline-none transition'
            />
          </div>
          <button onClick={fetchDocuments} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg" title="Refresh List">
             <RefreshCw className="w-4 h-4 text-gray-500"/>
          </button>
        </div>

        <div className='flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar'>
          {isLoading ? (
            <div className='h-40 flex items-center justify-center'>
              <Loader2 className='w-8 h-8 animate-spin text-blue-500' />
            </div>
          ) : filteredDocs.length > 0 ? (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-2'>
                {filteredDocs.map((doc) => (
                    <div key={doc.filename} className='p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 hover:border-blue-500 transition-all group'>
                        <div className='flex items-start justify-between mb-2'>
                            <div className='flex items-center gap-2 overflow-hidden'>
                                <FileText className='w-4 h-4 text-blue-600 flex-shrink-0' />
                                <h4 className='font-semibold text-sm truncate' title={doc.filename}>{doc.filename}</h4>
                            </div>
                            <CheckCircle2 className='w-3 h-3 text-green-500' />
                        </div>
                        <p className='text-xs text-gray-500 mb-2 line-clamp-2'>
                            {doc.snippet}
                        </p>
                        <div className='text-[10px] text-gray-400 mt-auto pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between'>
                            <span>{doc.size}</span>
                            <span>Ready for RAG</span>
                        </div>
                    </div>
                ))}
            </div>
          ) : (
            <div className='text-center p-10 text-gray-500'>
              Tidak ada dokumen ditemukan. Silakan upload atau jalankan scraping.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}