import React, { useState, useCallback } from 'react';
import { parseOCRText } from './services/parserService';
import { extractTextFromPDF } from './services/pdfService';
import { StudentReport } from './types';
import Dashboard from './components/Dashboard';
import { CloudArrowUpIcon, DocumentTextIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const App: React.FC = () => {
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setPdfBuffer(null);

    try {
      let textContent = '';
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        // Store buffer for slicing later
        const buffer = await file.arrayBuffer();
        setPdfBuffer(buffer);
        // Create a new File object from buffer for extraction to avoid stream locked issues if reused
        const pdfFile = new File([buffer], file.name, { type: "application/pdf" });
        textContent = await extractTextFromPDF(pdfFile);
      } else {
        textContent = await file.text();
      }
      
      const data = parseOCRText(textContent);
      if (data.length === 0) {
        setError("No valid student reports found in the document. Please ensure it follows the ZüriGrade format.");
      } else {
        setReports(data);
      }
    } catch (e) {
      console.error(e);
      setError("Failed to process file. If it is a PDF, ensure it contains readable text.");
    } finally {
      setIsProcessing(false);
    }
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, []);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  if (reports.length > 0) {
    return (
      <Dashboard 
        reports={reports} 
        pdfBuffer={pdfBuffer} 
        isProcessing={isProcessing}
        onNewFile={processFile}
        onReset={() => { setReports([]); setPdfBuffer(null); }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-xl w-full">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-2">Zeugnis-Validator Mediamatiker Informatiker</h1>
          <p className="text-gray-500 text-lg">
            Upload Bildungszentrum Zürichsee report cards (PDF) to validate grades.
          </p>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`
            relative group rounded-2xl border-2 border-dashed transition-all duration-300 ease-in-out
            flex flex-col items-center justify-center p-12 text-center cursor-pointer bg-white
            ${isDragging 
              ? 'border-indigo-500 bg-indigo-50 scale-[1.02] shadow-xl' 
              : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50 shadow-sm hover:shadow-md'
            }
            ${isProcessing ? 'opacity-75 pointer-events-none' : ''}
          `}
        >
          <input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            onChange={onFileSelect}
            accept=".pdf,.txt"
            disabled={isProcessing}
          />

          <div className={`transition-transform duration-300 ${isDragging ? 'scale-110' : 'scale-100'}`}>
            {isProcessing ? (
               <div className="p-4 bg-indigo-50 rounded-full mb-4">
                 <ArrowPathIcon className="w-12 h-12 text-indigo-600 animate-spin" />
               </div>
            ) : (
               <div className="p-4 bg-indigo-50 rounded-full mb-4 group-hover:bg-indigo-100 transition-colors">
                 <CloudArrowUpIcon className="w-12 h-12 text-indigo-600" />
               </div>
            )}
          </div>

          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {isProcessing ? 'Scanning Document...' : 'Drag & drop your PDF here'}
          </h3>
          
          <p className="text-gray-500 mb-6 max-w-xs mx-auto">
            {isProcessing 
              ? 'Analyzing grades and structure...' 
              : 'or click to browse from your computer'
            }
          </p>

          {!isProcessing && (
            <div className="flex items-center space-x-2 text-xs text-gray-400 font-medium uppercase tracking-wide">
              <span className="bg-gray-100 px-2 py-1 rounded">PDF</span>
              <span className="bg-gray-100 px-2 py-1 rounded">TXT</span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-center justify-center text-red-700 animate-fade-in">
             <span className="font-medium mr-1">Error:</span> {error}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
            <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
              <DocumentTextIcon className="w-3 h-3" />
              Secure Client-Side Processing
            </p>
        </div>
      </div>
    </div>
  );
};

export default App;