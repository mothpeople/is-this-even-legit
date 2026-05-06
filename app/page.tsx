"use client";

import React, { useState, useRef, useCallback } from 'react';
import { AlertOctagon, UploadCloud, X, Search, Lock, Loader2, ChevronDown, ChevronUp, FileText, Heart, Coffee, Wallet } from 'lucide-react';

// --- Types & Interfaces ---
interface AnalysisResult {
  scam_probability: number | null;
  confidence_level: string;
  derived_legitimacy: string;
  summary: string;
  green_flags: string[];
  exhibits: string[];
  fit_analysis: string[] | string;
}

// --- Backend API Connection ---
// This safely calls your Next.js backend (route.ts), completely hiding your API keys
// and leveraging your URL scraper and Claude Fallback logic that already works.
async function analyzeJobPosting(text: string, base64Images: string[]): Promise<AnalysisResult> {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text,
      imageBase64: base64Images.length > 0 ? base64Images[0] : null, // Matches the exact extraction in your route.ts
      imagesBase64: base64Images // Forwarding the full array for when your backend supports multiple
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Backend Error: ${response.status}`);
  }

  const data = await response.json();
  
  // Ensure the frontend derives the exact label based on the backend's score
  let derivedLabel = "UNKNOWN";
  if (data.scam_probability !== null && data.scam_probability !== undefined) {
      if (data.scam_probability >= 70) derivedLabel = "SCAM";
      else if (data.scam_probability >= 30) derivedLabel = "SUSPICIOUS";
      else derivedLabel = "LEGIT";
  }

  return {
      ...data,
      derived_legitimacy: derivedLabel
  };
}

// --- Known Scams Data ---
const KNOWN_SCAMS = [
  {
    title: "THE FAKE CHECK / EQUIPMENT SCAM",
    brief: "They send a large check to buy 'home office equipment' from their 'approved vendor'.",
    details: "The check eventually bounces after a few days, but the real money you sent to their 'vendor' (who is actually the scammer) is gone forever. Your bank will hold you responsible for the negative balance."
  },
  {
    title: "TELEGRAM / SIGNAL INTERVIEWS",
    brief: "Interviews are conducted entirely over text-based chat apps without video or voice.",
    details: "Legitimate companies rarely, if ever, hire without a voice or video call. Scammers use encrypted text apps to hide their true identity, voice, and location. They often impersonate real executives from legit companies."
  },
  {
    title: "THE TASK / CLICK FARM SCAM",
    brief: "You are hired to 'optimize apps' or 'click links' but have to pay crypto to unlock tasks.",
    details: "This operates like a digital ponzi scheme. They might pay you a small amount initially to build trust, then demand larger crypto deposits to 'upgrade your account' which you will never get back."
  },
  {
    title: "RESHIPPING / PACKAGE MULE",
    brief: "You receive packages at home, inspect them, and mail them to another address.",
    details: "The goods are being bought with stolen credit cards. You are unwittingly acting as a fence for stolen property, making you legally liable when the police track the packages to your doorstep."
  },
  {
    title: "PAY-TO-TRAIN / ONBOARDING FEES",
    brief: "They guarantee a job but require you to pay upfront for mandatory training or software.",
    details: "Once you pay the fee, the 'job' disappears. Legitimate employers absorb the costs of onboarding, background checks, and necessary training software. You should never pay to work."
  },
  {
    title: "PHISHING / FAKE PORTALS",
    brief: "You are rushed to provide your SSN and bank details on a generic-looking website.",
    details: "The job doesn't actually exist; the sole goal is identity theft. Always verify the domain name matches the real company exactly (e.g., watch out for 'google-careers-portal.com' instead of 'google.com/careers')."
  }
];

// --- Main Application Component ---
export default function App() {
  const [inputText, setInputText] = useState<string>('');
  const [previews, setPreviews] = useState<string[]>([]); // Handles multiple files (max 3)
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string>('');
  const [expandedScamIndex, setExpandedScamIndex] = useState<number | null>(null);
  
  const [isDonateOpen, setIsDonateOpen] = useState<boolean>(false); // Donate modal state

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  // Client-side image compression & multi-file handler
  const processFiles = async (files: FileList | File[] | undefined | null) => {
    if (!files || files.length === 0) return;
    
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/') || f.type === 'application/pdf');
    if (validFiles.length === 0) {
      setError('Please upload valid image or PDF files.');
      return;
    }

    if (previews.length + validFiles.length > 3) {
      setError('You can only upload a maximum of 3 files per scan.');
      return;
    }
    
    setError('');
    
    const newPreviews = await Promise.all(validFiles.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const rawDataUrl = event.target?.result as string;
          
          // If it is a PDF, bypass the image canvas compression completely
          if (file.type === 'application/pdf') {
            resolve(rawDataUrl);
            return;
          }
          
          // Otherwise, compress the image for mobile network efficiency
          const img = new Image();
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              const MAX_DIMENSION = 1000; 
              
              let width = img.width;
              let height = img.height;

              if (width > height && width > MAX_DIMENSION) {
                height = Math.round(height * (MAX_DIMENSION / width));
                width = MAX_DIMENSION;
              } else if (height > MAX_DIMENSION) {
                width = Math.round(width * (MAX_DIMENSION / height));
                height = MAX_DIMENSION;
              }

              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                 ctx.fillStyle = '#FFFFFF';
                 ctx.fillRect(0, 0, width, height);
                 ctx.drawImage(img, 0, 0, width, height);
                 const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                 
                 if (compressedBase64 && compressedBase64.length > 50) {
                     resolve(compressedBase64);
                 } else {
                     resolve(rawDataUrl); 
                 }
              } else {
                 resolve(rawDataUrl); 
              }
            } catch (e) {
              resolve(rawDataUrl);
            }
          };
          
          img.onerror = () => {
            resolve(rawDataUrl);
          };
          
          img.src = rawDataUrl;
        };
        reader.readAsDataURL(file);
      });
    }));

    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, [previews]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };

  const removeImage = (indexToRemove: number) => {
    setPreviews(prev => prev.filter((_, idx) => idx !== indexToRemove));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAnalyze = async () => {
    if (!inputText.trim() && previews.length === 0) {
      setError('Please provide text, a URL, or a file to analyze.');
      return;
    }
    
    setError('');
    setIsAnalyzing(true);
    setResult(null);

    try {
      const analysisResult = await analyzeJobPosting(inputText, previews);
      setResult(analysisResult);
    } catch (err: any) {
      setError(err.message || 'A network error occurred while reaching your backend server.');
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- UI Helpers ---
  const getScoreColor = (score: number | null): string => {
    if (score === null) return 'text-slate-400';
    if (score >= 80) return 'text-lime-600';
    if (score >= 50) return 'text-yellow-600';
    return 'text-pink-600'; 
  };

  const getScoreEmoji = (score: number | null): string => {
    if (score === null) return '🤔';
    if (score <= 10) return '🤥';
    if (score <= 20) return '🫣';
    if (score <= 30) return '😳';
    if (score <= 40) return '😩';
    if (score <= 50) return '🧐';
    if (score <= 60) return '🤔';
    if (score <= 70) return '🙂‍↔️';
    if (score <= 80) return '😅';
    if (score <= 90) return '🙂';
    return '😍';
  };

  const getStatusBg = (legitimacy: string | undefined): string => {
    const leg = legitimacy?.toLowerCase();
    switch(leg) {
      case 'legit': return 'bg-lime-100/50 border-lime-200/80 backdrop-blur-xl';
      case 'suspicious': return 'bg-yellow-100/50 border-yellow-200/80 backdrop-blur-xl';
      case 'scam': return 'bg-pink-100/50 border-pink-200/80 backdrop-blur-xl';
      default: return 'bg-white/50 border-white/80 backdrop-blur-xl';
    }
  };

  const legitimacyIndex = result && result.scam_probability !== null 
    ? 100 - result.scam_probability 
    : null;

  return (
    <div className="min-h-screen relative font-sans text-slate-800 p-4 sm:p-8 selection:bg-blue-200 selection:text-blue-900 flex flex-col items-center overflow-x-hidden">
      
      {/* Top Nav / Support Button */}
      <div className="w-full max-w-2xl flex justify-end mb-2 sm:mb-0">
        <button 
          onClick={() => setIsDonateOpen(true)}
          className="flex items-center gap-2 bg-white/60 hover:bg-white/90 backdrop-blur-md border border-pink-200/50 text-pink-600 px-4 py-2 rounded-full font-bold text-sm uppercase tracking-wide transition-all shadow-sm active:scale-95"
        >
          <Heart className="w-4 h-4" />
          <span>Support Tool</span>
        </button>
      </div>

      {/* Header and Intro */}
      <div className="max-w-2xl w-full mb-8 mt-2 sm:mt-4 flex flex-col items-center justify-center text-center">
        <div className="flex flex-row items-center justify-center gap-3 sm:gap-4 mb-4">
          <div className="text-5xl sm:text-6xl filter drop-shadow-sm flex-shrink-0">
            🤔
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-wider text-slate-800 uppercase leading-tight">
            IS THIS EVEN<br className="sm:hidden" /> LEGIT?
          </h1>
        </div>
        <p className="text-slate-600 text-lg sm:text-xl leading-relaxed max-w-lg text-center">
          Use this tool to find out if that job you're applying for, or that message you just received from a recruiter, is legit or a scam.
        </p>
      </div>

      <main className="max-w-2xl w-full space-y-8">
        
        {/* Omnibox */}
        <div 
          className={`relative bg-white/60 backdrop-blur-2xl border-[1.5px] rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 overflow-hidden
            ${isDragging ? 'border-blue-400 bg-blue-100/50 scale-[1.02]' : 'border-white/80'}
            ${error ? 'border-pink-300' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none rounded-[2rem]" />

          <div className="relative p-6 sm:p-8">
            <div className="flex items-center gap-2 mb-4 text-blue-700 font-bold tracking-widest uppercase text-sm flex-wrap">
              <Lock className="w-4 h-4 flex-shrink-0" />
              <span>SCAN FOR LEGITIMACY</span>
              <span className="text-blue-400 ml-auto text-xs font-medium lowercase">(max 3 files)</span>
            </div>

            <textarea
              className="w-full bg-transparent resize-none outline-none text-lg sm:text-xl placeholder-slate-400 min-h-[120px] sm:min-h-[100px] leading-relaxed"
              placeholder="Paste a URL, job description, or email message. Or upload up to 3 files (screenshots or PDFs) below..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isAnalyzing}
            />

            {/* Preview Area (Handles Multi-Image AND PDF) */}
            {previews.length > 0 && (
              <div className="flex flex-wrap gap-4 mt-4">
                {previews.map((preview, idx) => (
                  <div key={idx} className="relative inline-block animate-in fade-in zoom-in-95 duration-300">
                    {preview.startsWith('data:application/pdf') ? (
                      <div className="h-28 w-28 bg-slate-100 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center text-slate-500 gap-2">
                        <FileText className="w-8 h-8 text-blue-500" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 text-center px-2">PDF Attached</span>
                      </div>
                    ) : (
                      <img 
                        src={preview} 
                        alt={`Upload ${idx + 1}`} 
                        className="h-28 w-28 object-cover rounded-xl border border-slate-200 shadow-sm"
                      />
                    )}
                    <button 
                      onClick={() => removeImage(idx)}
                      className="absolute -top-2 -right-2 bg-slate-800 text-white p-1.5 rounded-full hover:bg-pink-500 transition-colors shadow-md z-10"
                      disabled={isAnalyzing}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p className="mt-4 text-pink-600 text-sm font-medium flex items-start sm:items-center gap-2">
                 <AlertOctagon className="w-4 h-4 flex-shrink-0 mt-0.5 sm:mt-0" /> <span className="break-words">{error}</span>
              </p>
            )}

            {/* Actions Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-6 border-t border-slate-200/50 gap-4">
              <div className="w-full sm:w-auto">
                <input 
                  type="file" 
                  accept="image/*,application/pdf" 
                  multiple
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  disabled={isAnalyzing || previews.length >= 3}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 text-slate-600 hover:text-blue-700 transition-colors px-4 py-3.5 rounded-xl hover:bg-white/60 font-bold tracking-wide uppercase text-sm disabled:opacity-50 border border-transparent hover:border-blue-200/50"
                  disabled={isAnalyzing || previews.length >= 3}
                >
                  <UploadCloud className="w-5 h-5" />
                  <span>UPLOAD FILES / PDFS</span>
                </button>
              </div>
              
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || (!inputText.trim() && previews.length === 0)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-300/80 hover:bg-blue-400 disabled:bg-slate-200/50 disabled:text-slate-400 text-blue-900 px-8 py-3.5 rounded-xl font-bold tracking-wide uppercase text-sm shadow-sm transition-all active:scale-95"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>ANALYZING...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    <span>VERIFY THIS!</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results Card */}
        {result && (
          <div className={`rounded-[2rem] border p-6 sm:p-8 shadow-sm transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 overflow-hidden ${getStatusBg(result.derived_legitimacy)}`}>
            
            {/* Header: Score & Legitimacy */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8 pb-8 border-b border-black/5">
              <div className="flex items-center gap-4 w-full sm:w-auto min-w-0">
                <div className="p-4 bg-white/60 rounded-2xl shadow-sm border border-white/50 text-5xl flex items-center justify-center min-w-[80px] min-h-[80px] flex-shrink-0">
                  {getScoreEmoji(legitimacyIndex)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 uppercase tracking-wide break-words">{result.derived_legitimacy}</h2>
                  <p className="text-slate-700 mt-2 max-w-md leading-relaxed text-lg break-words">{result.summary}</p>
                </div>
              </div>
              
              <div className="text-center bg-white/60 p-4 rounded-2xl shadow-sm border border-white/50 min-w-[140px] w-full sm:w-auto mt-4 sm:mt-0 flex-shrink-0">
                <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest break-words">LEGITIMACY INDEX</div>
                <div className="flex items-center justify-center">
                  <div className={`text-4xl font-black ${getScoreColor(legitimacyIndex)}`}>
                    {legitimacyIndex !== null ? `${legitimacyIndex}/100` : '--/100'}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest break-words">Confidence: {result.confidence_level}</div>
              </div>
            </div>

            {/* Pros & Cons Section */}
            <div className="grid sm:grid-cols-2 gap-6 mb-8">
              <div className="bg-white/60 rounded-2xl p-6 border border-lime-200/50 min-w-0">
                <h3 className="text-lime-700 font-bold mb-4 flex items-center gap-2 uppercase tracking-wide text-sm break-words">
                   <div className="w-2 h-2 rounded-full bg-lime-400 flex-shrink-0" /> GREEN FLAGS (PROS)
                </h3>
                <ul className="space-y-3">
                  {result.green_flags && result.green_flags.length > 0 ? result.green_flags.map((pro, i) => (
                    <li key={i} className="text-slate-800 leading-relaxed pl-5 relative before:content-['>'] before:absolute before:left-0 before:text-lime-500 before:font-bold break-words">{pro}</li>
                  )) : <li className="text-slate-500 italic break-words">None identified.</li>}
                </ul>
              </div>

              <div className="bg-white/60 rounded-2xl p-6 border border-pink-200/50 min-w-0">
                <h3 className="text-pink-600 font-bold mb-4 flex items-center gap-2 uppercase tracking-wide text-sm break-words">
                   <div className="w-2 h-2 rounded-full bg-pink-400 flex-shrink-0" /> RED FLAGS (CONS)
                </h3>
                <ul className="space-y-3">
                  {result.exhibits && result.exhibits.length > 0 ? result.exhibits.map((con, i) => (
                    <li key={i} className="text-slate-800 leading-relaxed pl-5 relative before:content-['!'] before:absolute before:left-0 before:text-pink-500 before:font-bold break-words">{con}</li>
                  )) : <li className="text-slate-500 italic break-words">None identified.</li>}
                </ul>
              </div>
            </div>

            {/* Personal Fit Analysis */}
            <div className="bg-white/60 rounded-2xl p-6 sm:p-8 shadow-sm border border-white/50 min-w-0">
              <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2 uppercase tracking-wide text-sm break-words">
                LEGITIMACY BREAKDOWN & FIT
              </h3>
              <ul className="space-y-3">
                {Array.isArray(result.fit_analysis) ? result.fit_analysis.map((point, index) => (
                  <li key={index} className="text-slate-800 leading-relaxed text-lg pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-purple-500 before:text-xl break-words">{point}</li>
                )) : (
                  <li className="text-slate-800 leading-relaxed text-lg pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-purple-500 before:text-xl break-words">{result.fit_analysis}</li>
                )}
              </ul>
            </div>

          </div>
        )}

        {/* Known Job Scams Accordion */}
        <div className="mt-12 pt-8 border-t border-slate-300/40 pb-12">
          <div className="text-center mb-8">
             <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-wide break-words">COMMON JOB SCAMS TO WATCH OUT FOR</h2>
             <p className="text-slate-600 mt-2 text-lg break-words">Familiarize yourself with these patterns to stay safe.</p>
          </div>

          <div className="space-y-4">
            {KNOWN_SCAMS.map((scam, index) => {
              const isExpanded = expandedScamIndex === index;
              return (
                <div 
                  key={index} 
                  className={`bg-white/50 backdrop-blur-xl border rounded-2xl overflow-hidden transition-all duration-300 shadow-sm ${isExpanded ? 'border-blue-300/80 bg-white/80' : 'border-white/60 hover:border-blue-200/60'}`}
                >
                  <button 
                    onClick={() => setExpandedScamIndex(isExpanded ? null : index)}
                    className="w-full flex items-start sm:items-center justify-between p-5 sm:p-6 text-left gap-4"
                  >
                    <div className="flex-1 pr-2 min-w-0">
                      <h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm mb-1 break-words">{scam.title}</h3>
                      <p className="text-slate-600 text-sm sm:text-base leading-snug whitespace-normal break-words">{scam.brief}</p>
                    </div>
                    <div className="text-slate-500 flex-shrink-0 mt-1 sm:mt-0">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="px-5 sm:px-6 pb-6 pt-2 text-slate-700 leading-relaxed border-t border-white/40 bg-white/40 text-sm sm:text-base break-words">
                      {scam.details}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </main>

      {/* --- DONATE MODAL --- */}
      {isDonateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setIsDonateOpen(false)}
          />
          
          {/* Modal Content */}
          <div className="relative bg-white/80 backdrop-blur-2xl border border-white/80 rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setIsDonateOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6 mt-2">
              <div className="w-16 h-16 bg-pink-100 text-pink-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                <Heart className="w-8 h-8 fill-pink-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-wide mb-2">Keep This Free</h2>
              <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                "Is This Even Legit?" is completely free to use. If it saved you from a scam, consider chipping in to help cover the heavy backend API and AI hosting costs.
              </p>
            </div>

            <div className="space-y-4">
              {/* Fiat Option */}
              <a 
                href="https://paypal.me/sivarajpragasm" 
                target="_blank" 
                rel="noreferrer"
                className="w-full flex items-center p-4 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-2xl transition-all group"
              >
                <div className="bg-blue-100 p-3 rounded-xl text-blue-600 mr-4 group-hover:scale-110 transition-transform flex-shrink-0">
                  <Coffee className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-slate-800 uppercase text-sm tracking-wide">PayPal</div>
                  <div className="text-slate-500 text-sm">Support via PayPal.me</div>
                </div>
              </a>

              {/* Stablecoin/Crypto Option */}
              <div className="w-full p-4 bg-white border border-slate-200 rounded-2xl space-y-4">
                <div className="flex items-center mb-2">
                  <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600 mr-3 flex-shrink-0">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div className="font-bold text-slate-800 uppercase text-sm tracking-wide">USDC / USDT / Crypto</div>
                </div>
                
                {/* EVM Address */}
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-slate-700 uppercase">ETH / Base / Arb / BSC</div>
                    <div className="text-slate-500 text-[10px] sm:text-xs truncate">0xa4c64896d499570dc122a05fa12d9362baec3a66</div>
                  </div>
                  <button 
                    onClick={() => navigator.clipboard.writeText("0xa4c64896d499570dc122a05fa12d9362baec3a66")}
                    className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors flex-shrink-0"
                  >
                    Copy
                  </button>
                </div>

                {/* Solana Address */}
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-slate-700 uppercase">Solana</div>
                    <div className="text-slate-500 text-[10px] sm:text-xs truncate">B6hf4f1Y7vX4SbBT9enVPvVdRmiH3Ht2CKQPyq3jx7LH</div>
                  </div>
                  <button 
                    onClick={() => navigator.clipboard.writeText("B6hf4f1Y7vX4SbBT9enVPvVdRmiH3Ht2CKQPyq3jx7LH")}
                    className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors flex-shrink-0"
                  >
                    Copy
                  </button>
                </div>

                {/* TRON Address */}
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl">
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-slate-700 uppercase">TRON</div>
                    <div className="text-slate-500 text-[10px] sm:text-xs truncate">TKW86MoaVT8b6NAcUa6GF7xePhkzWcttBt</div>
                  </div>
                  <button 
                    onClick={() => navigator.clipboard.writeText("TKW86MoaVT8b6NAcUa6GF7xePhkzWcttBt")}
                    className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors flex-shrink-0"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
            
            <p className="text-center text-xs text-slate-400 mt-6 font-medium">
              Thank you for supporting independent tools. 🚀
            </p>
          </div>
        </div>
      )}
      
      {/* Locked Pastel Background Decor */}
      <div className="fixed inset-0 -z-20 pointer-events-none overflow-hidden bg-[#fbf9ff]">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-300/50 blur-[120px]" />
        <div className="absolute top-[10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-300/50 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[10%] w-[50%] h-[50%] rounded-full bg-yellow-300/50 blur-[120px]" />
        <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] rounded-full bg-purple-300/50 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] rounded-full bg-lime-300/50 blur-[120px]" />
      </div>
    </div>
  );
}