"use client";

import React, { useState, useRef, useCallback } from 'react';
import { AlertOctagon, UploadCloud, X, Search, Lock, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

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

// --- API Configuration & Helper Functions ---
const apiKey = ""; // Provided by execution environment

// Exponential Backoff Fetch for Gemini API
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 5): Promise<any> {
  let delay = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
}

// Simulated Next.js Edge Function Route Handler Logic
async function analyzeJobPosting(text: string, base64Image: string | null): Promise<AnalysisResult> {
  const cleanText = (text || "").trim();
  
  // Step 1: Detect if input is strictly a URL
  const isUrlRegex = /^(https?:\/\/)?([\w\d-]+\.)+[\w\d]{2,}(\/.*)?$/i;
  const isJustUrl = isUrlRegex.test(cleanText) && !cleanText.includes(' ');

  // Step 2: Job Board Intercept (Prevent Hallucinations)
  const jobBoardRegex = /(linkedin\.com|indeed\.com|glassdoor\.com|ziprecruiter\.com|monster\.com|workday\.com|greenhouse\.io|lever\.co)/i;
  
  if (isJustUrl && jobBoardRegex.test(cleanText)) {
    return {
      scam_probability: null,
      confidence_level: "Low",
      derived_legitimacy: "UNKNOWN",
      summary: "i can't access external job boards directly to read the posting.",
      green_flags: [],
      exhibits: ["cannot scrape job board links."],
      fit_analysis: [
        "please copy and paste the full job description text or upload a screenshot of the listing.",
        "this helps me properly assess the forensic details."
      ]
    };
  }

  // Step 3: Local Regex Checks (Fast, Zero Cost)
  const scamKeywords = /(kindly|telegram interview|western union|crypto wallet|guaranteed income|no experience necessary.*\$[0-9]{3,}.*hour)/i;
  const isRegexFlagged = cleanText && scamKeywords.test(cleanText);

  // Step 4: Gemini API Analysis (Forensic Persona)
  const systemInstruction = `
    You are a Forensic Cyber-Fraud Analyst specializing in employment and recruitment scams. Your job is to analyze text or image OCR data uploaded by a user and determine the probability that the communication is a scam.
    
    Analysis Criteria (Red Flags):
    - Requests to move communication to encrypted apps (Telegram, WhatsApp, Signal).
    - Mentions of "refundable deposits," "equipment fees," or "crypto payments."
    - Unrealistic compensation for low-skill tasks (e.g., "Earn $500/day for optimizing data").
    - Suspicious syntax, particularly the use of the word "Kindly."
    - Generic greetings ("Dear Applicant") combined with urgent timelines.
    - Sender email domains that attempt to spoof legitimate companies.
    
    Tone Constraints for the Summary:
    Write your summary like a factual police blotter or forensic report. Be authoritative, calm, and clinical. Do not use emojis, exclamation points, or exaggerated alarmist language.
  `;

  const prompt = `
    Input Data: ${cleanText || "See attached image."}
    Is the input strictly a single URL?: ${isJustUrl}
    
    CRITICAL INSTRUCTION 1: If "Is the input strictly a single URL" is true, evaluate the domain's reputation. Do NOT hallucinate specific job details.
    
    CRITICAL INSTRUCTION 2: In the "fit_analysis" section, you MUST reference real, existing job scams out in the market (e.g., Fake Check/Equipment, Reshipping, Task/Click Farm, Identity Theft). Explicitly explain how this specific posting's patterns closely match (or completely deviate from) those known scam patterns, and how it impacts the user.

    Output format:
    You must respond ONLY with a valid JSON object. Do not include markdown formatting or conversational filler.
    {
      "scam_probability": [Integer between 0 and 100],
      "confidence_level": ["High", "Medium", or "Low"],
      "exhibits": [
        "A short, punchy sentence detailing a specific red flag found (e.g., 'Sender requested conversation move to Telegram.')",
        "Another specific red flag found."
      ],
      "green_flags": ["Positive forensic signs, e.g., verifiable domain, standard corporate tone."],
      "summary": "A 2-sentence clinical summary of the findings and a recommended action.",
      "fit_analysis": ["Point 1 detailing legitimacy and user fit", "Point 2 referencing real market scam patterns"]
    }
  `;

  const requestBody: any = {
    contents: [{
      role: "user",
      parts: [
        { text: prompt }
      ]
    }],
    generationConfig: {
      responseMimeType: "application/json",
    },
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    }
  };

  if (base64Image) {
      requestBody.contents[0].parts.push({
          inlineData: {
              mimeType: "image/png", 
              data: base64Image.split(',')[1] 
          }
      });
  }

  if (isRegexFlagged) {
       requestBody.contents[0].parts[0].text += "\n\nNote: Our initial local forensic filter flagged potential scam keywords in this text. Please investigate deeply.";
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  
  const result = await fetchWithRetry(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  try {
    const jsonText = result.candidates[0].content.parts[0].text;
    const parsedData = JSON.parse(jsonText);
    
    // Derive Legitimacy Label based on Scam Probability
    let derivedLabel = "UNKNOWN";
    if (parsedData.scam_probability !== null) {
        if (parsedData.scam_probability >= 70) derivedLabel = "SCAM";
        else if (parsedData.scam_probability >= 30) derivedLabel = "SUSPICIOUS";
        else derivedLabel = "LEGIT";
    }

    return {
        ...parsedData,
        derived_legitimacy: derivedLabel
    };

  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return {
       scam_probability: 0, 
       confidence_level: "Low",
       derived_legitimacy: "ERROR", 
       summary: "failed to analyze forensic data.", 
       green_flags: [], 
       exhibits: [], 
       fit_analysis: ["please try again."]
    };
  }
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
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string>('');
  const [expandedScamIndex, setExpandedScamIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Drag and Drop Handlers ---
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG).');
      return;
    }
    
    setError('');
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    processFile(file);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    processFile(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Analysis Trigger ---
  const handleAnalyze = async () => {
    if (!inputText.trim() && !imagePreview) {
      setError('Please provide text, a URL, or an image to analyze.');
      return;
    }
    
    setError('');
    setIsAnalyzing(true);
    setResult(null);

    try {
      const analysisResult = await analyzeJobPosting(inputText, imagePreview);
      setResult(analysisResult);
    } catch (err: unknown) {
      setError('An error occurred while analyzing the job posting. Please try again.');
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

  // Calculate Legitimacy Index (Inverting the scam probability)
  const legitimacyIndex = result && result.scam_probability !== null 
    ? 100 - result.scam_probability 
    : null;

  return (
    <div className="min-h-screen relative font-sans text-slate-800 p-4 sm:p-8 selection:bg-blue-200 selection:text-blue-900 flex flex-col items-center">
      
      {/* Header and Intro */}
      <div className="max-w-2xl w-full mb-8 mt-4 sm:mt-8 flex flex-col items-center justify-center text-center">
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
            <div className="flex items-center gap-2 mb-4 text-blue-700 font-bold tracking-widest uppercase text-sm">
              <Lock className="w-4 h-4" />
              <span>SCAN FOR LEGITIMACY</span>
            </div>

            <textarea
              className="w-full bg-transparent resize-none outline-none text-lg sm:text-xl placeholder-slate-400 min-h-[180px] sm:min-h-[140px] leading-relaxed"
              placeholder="Paste a URL, job description, or email message. Or upload a screenshot below..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isAnalyzing}
            />

            {/* Image Preview Area */}
            {imagePreview && (
              <div className="relative mt-4 inline-block">
                <img 
                  src={imagePreview} 
                  alt="Job posting snippet" 
                  className="h-32 object-cover rounded-xl border border-slate-200 shadow-sm"
                />
                <button 
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 bg-slate-800 text-white p-1.5 rounded-full hover:bg-pink-500 transition-colors shadow-md"
                  disabled={isAnalyzing}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {error && (
              <p className="mt-4 text-pink-600 text-sm font-medium flex items-center gap-2">
                 <AlertOctagon className="w-4 h-4" /> {error}
              </p>
            )}

            {/* Actions Footer */}
            <div className="flex flex-col sm:flex-row items-center justify-between mt-6 pt-6 border-t border-slate-200/50 gap-4">
              <div className="w-full sm:w-auto">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  disabled={isAnalyzing}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 text-slate-600 hover:text-blue-700 transition-colors px-4 py-3.5 rounded-xl hover:bg-white/60 font-bold tracking-wide uppercase text-sm disabled:opacity-50 border border-transparent hover:border-blue-200/50"
                  disabled={isAnalyzing}
                >
                  <UploadCloud className="w-5 h-5" />
                  <span>UPLOAD SCREENSHOT</span>
                </button>
              </div>
              
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || (!inputText.trim() && !imagePreview)}
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
          <div className={`rounded-[2rem] border p-6 sm:p-8 shadow-sm transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 ${getStatusBg(result.derived_legitimacy)}`}>
            
            {/* Header: Score & Legitimacy */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8 pb-8 border-b border-black/5">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white/60 rounded-2xl shadow-sm border border-white/50 text-5xl flex items-center justify-center min-w-[80px] min-h-[80px]">
                  {getScoreEmoji(legitimacyIndex)}
                </div>
                <div>
                  <h2 className="text-3xl sm:text-4xl font-bold text-slate-800 uppercase tracking-wide">{result.derived_legitimacy}</h2>
                  <p className="text-slate-700 mt-2 max-w-md leading-relaxed text-lg">{result.summary}</p>
                </div>
              </div>
              
              <div className="text-center bg-white/60 p-4 rounded-2xl shadow-sm border border-white/50 min-w-[140px] w-full sm:w-auto mt-4 sm:mt-0">
                <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">LEGITIMACY INDEX</div>
                <div className="flex items-center justify-center">
                  <div className={`text-4xl font-black ${getScoreColor(legitimacyIndex)}`}>
                    {legitimacyIndex !== null ? `${legitimacyIndex}/100` : '--/100'}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest">Confidence: {result.confidence_level}</div>
              </div>
            </div>

            {/* Pros & Cons Section */}
            <div className="grid sm:grid-cols-2 gap-6 mb-8">
              <div className="bg-white/60 rounded-2xl p-6 border border-lime-200/50">
                <h3 className="text-lime-700 font-bold mb-4 flex items-center gap-2 uppercase tracking-wide text-sm">
                   <div className="w-2 h-2 rounded-full bg-lime-400" /> GREEN FLAGS (PROS)
                </h3>
                <ul className="space-y-3">
                  {result.green_flags && result.green_flags.length > 0 ? result.green_flags.map((pro, i) => (
                    <li key={i} className="text-slate-800 leading-relaxed pl-5 relative before:content-['>'] before:absolute before:left-0 before:text-lime-500 before:font-bold">{pro}</li>
                  )) : <li className="text-slate-500 italic">None identified.</li>}
                </ul>
              </div>

              <div className="bg-white/60 rounded-2xl p-6 border border-pink-200/50">
                <h3 className="text-pink-600 font-bold mb-4 flex items-center gap-2 uppercase tracking-wide text-sm">
                   <div className="w-2 h-2 rounded-full bg-pink-400" /> RED FLAGS (CONS)
                </h3>
                <ul className="space-y-3">
                  {result.exhibits && result.exhibits.length > 0 ? result.exhibits.map((con, i) => (
                    <li key={i} className="text-slate-800 leading-relaxed pl-5 relative before:content-['!'] before:absolute before:left-0 before:text-pink-500 before:font-bold">{con}</li>
                  )) : <li className="text-slate-500 italic">None identified.</li>}
                </ul>
              </div>
            </div>

            {/* Personal Fit Analysis */}
            <div className="bg-white/60 rounded-2xl p-6 sm:p-8 shadow-sm border border-white/50">
              <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2 uppercase tracking-wide text-sm">
                LEGITIMACY BREAKDOWN & FIT
              </h3>
              <ul className="space-y-3">
                {Array.isArray(result.fit_analysis) ? result.fit_analysis.map((point, index) => (
                  <li key={index} className="text-slate-800 leading-relaxed text-lg pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-purple-500 before:text-xl">{point}</li>
                )) : (
                  <li className="text-slate-800 leading-relaxed text-lg pl-6 relative before:content-['•'] before:absolute before:left-0 before:text-purple-500 before:text-xl">{result.fit_analysis}</li>
                )}
              </ul>
            </div>

          </div>
        )}

        {/* Known Job Scams Accordion */}
        <div className="mt-12 pt-8 border-t border-slate-300/40 pb-12">
          <div className="text-center mb-8">
             <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-wide">COMMON JOB SCAMS TO WATCH OUT FOR</h2>
             <p className="text-slate-600 mt-2 text-lg">Familiarize yourself with these patterns to stay safe.</p>
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
                    <div className="flex-1 pr-2 break-words">
                      <h3 className="font-bold text-slate-800 uppercase tracking-wide text-sm mb-1">{scam.title}</h3>
                      <p className="text-slate-600 text-sm sm:text-base leading-snug whitespace-normal">{scam.brief}</p>
                    </div>
                    <div className="text-slate-500 flex-shrink-0 mt-1 sm:mt-0">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="px-5 sm:px-6 pb-6 pt-2 text-slate-700 leading-relaxed border-t border-white/40 bg-white/40 text-sm sm:text-base">
                      {scam.details}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </main>
      
      {/* Locked Pastel Background Decor */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-[#fbf9ff]">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-300/50 blur-[120px]" />
        <div className="absolute top-[10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-pink-300/50 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[10%] w-[50%] h-[50%] rounded-full bg-yellow-300/50 blur-[120px]" />
        <div className="absolute top-[30%] left-[30%] w-[40%] h-[40%] rounded-full bg-purple-300/50 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] rounded-full bg-lime-300/50 blur-[120px]" />
      </div>
    </div>
  );
}