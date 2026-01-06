import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Folder, FileText, Sparkles, CheckCircle, Upload, Settings, RefreshCw, Edit2, X, Eye, ChevronLeft, ChevronRight, Moon, Sun, Trash2, ArrowRightLeft, CheckSquare, Square, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Tesseract from 'tesseract.js';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const SUBJ_DATA = [
  { code: "CIT 417", name: "CIT 417: Data Driven Websites" },
  { code: "CIR 405", name: "CIR 405: Distributed Systems" },
  { code: "CIT 423", name: "CIT 423: IT Project Management" },
  { code: "BBE 401", name: "BBE 401: Entrepreneurship and Small Business Management" },
  { code: "CIR 401", name: "CIR 401: Management Information Systems" },
  { code: "CIT 421", name: "CIT 421: Information Technology and Development" }
];

const DEMO_FILES = [
  '/demo/paper1.jpg', '/demo/paper2.jpg', '/demo/paper3.jpg', '/demo/paper4.jpg', '/demo/paper5.jpg'
];

export default function App() {
  const [status, setStatus] = useState('idle'); // idle, scanning, sorting, complete
  const [files, setFiles] = useState([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [currentPaper, setCurrentPaper] = useState(null);
  const [results, setResults] = useState(SUBJ_DATA.map(s => ({ ...s, count: 0, papers: [] })));
  const [currentAction, setCurrentAction] = useState('');
  const [activeFolderIdx, setActiveFolderIdx] = useState(null);

  // Theme
  const [darkMode, setDarkMode] = useState(false);

  // Viewing/Editing/Moving
  const [viewingFolderIdx, setViewingFolderIdx] = useState(null);
  const [editingFolderIdx, setEditingFolderIdx] = useState(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [selectedPapers, setSelectedPapers] = useState(new Set()); // Set of indices for current viewing folder
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [moveTargetFolder, setMoveTargetFolder] = useState("");

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentPaperIndex, setCurrentPaperIndex] = useState(0);

  const fileInputRef = useRef(null);

  // Theme Config
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles.map(f => ({
        file: f,
        url: URL.createObjectURL(f),
        status: 'pending'
      })));
    }
  };

  const loadDemoData = async () => {
    const demoFiles = await Promise.all(DEMO_FILES.map(async (path, i) => {
      const response = await fetch(path);
      const blob = await response.blob();
      return {
        file: new File([blob], `demo_paper_${i + 1}.jpg`, { type: 'image/jpeg' }),
        url: path,
        status: 'pending'
      };
    }));
    setFiles(demoFiles);
  };

  const processFiles = async () => {
    if (files.length === 0) return;
    setStatus('sorting');

    const worker = await Tesseract.createWorker('eng', 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          setCurrentAction(`Reading text: ${Math.round(m.progress * 100)}%`);
        } else {
          setCurrentAction(m.status);
        }
      }
    });

    let activeFolders = [...results];
    let lastMatchedIndex = -1;

    for (let i = 0; i < files.length; i++) {
      const paper = files[i];
      setProcessedCount(i + 1);
      setCurrentPaper(paper);

      try {
        const { data: { text } } = await worker.recognize(paper.url);
        const cleanText = text.toUpperCase();
        const yearMatch = text.match(/\b20[12]\d\b/);
        const detectedYear = yearMatch ? parseInt(yearMatch[0]) : 0;

        // 1. Existing Folders
        let matchIndex = activeFolders.findIndex(folder => {
          if (cleanText.includes(folder.code)) return true;
          if (cleanText.includes(folder.code.replace(' ', ''))) return true;

          const namePart = folder.name.split(':')[1]?.trim().toUpperCase() || folder.name.toUpperCase();
          const nameWords = namePart.split(' ');
          const significantWords = nameWords.filter(w => w.length > 3);
          const foundWords = significantWords.filter(w => cleanText.includes(w));
          return foundWords.length >= 2;
        });

        // 2. New Folder
        if (matchIndex === -1) {
          const codeMatch = cleanText.match(/\b[A-Z]{3}[\s-]?:?\s?\d{3,4}\b/);
          if (codeMatch) {
            const newCode = codeMatch[0].replace(':', '').replace('-', ' ').trim();
            matchIndex = activeFolders.findIndex(f => f.code === newCode);
            if (matchIndex === -1) {
              const lines = text.split('\n');
              const codeLineIdx = lines.findIndex(l => l.toUpperCase().includes(newCode));
              let detectedName = `${newCode}: Detected Subject`;
              if (codeLineIdx !== -1) {
                const potentialTitle = lines[codeLineIdx].replace(codeMatch[0], '').trim();
                if (potentialTitle.length > 5) detectedName = `${newCode}: ${potentialTitle}`;
              }

              setCurrentAction(`New Subject Detected: ${newCode}`);
              activeFolders.push({ code: newCode, name: detectedName, count: 0, papers: [] });
              matchIndex = activeFolders.length - 1;
              await new Promise(r => setTimeout(r, 800));
            }
          }
        }

        // 3. Sticky
        if (matchIndex === -1 && lastMatchedIndex !== -1) {
          const isBodyPage = /PAGE\s+\d+|QUESTION|MARKS|SECTION/i.test(cleanText);
          if (isBodyPage || i > 0) {
            matchIndex = lastMatchedIndex;
            setCurrentAction(`Matching context to: ${activeFolders[matchIndex].code}...`);
          }
        }

        if (matchIndex !== -1) {
          activeFolders[matchIndex].count++;
          activeFolders[matchIndex].papers.push({
            url: paper.url,
            name: paper.file.name,
            year: detectedYear || 2024
          });
          activeFolders[matchIndex].papers.sort((a, b) => b.year - a.year);
          setActiveFolderIdx(matchIndex);
          lastMatchedIndex = matchIndex;
        } else {
          setCurrentAction('Unclassified');
          lastMatchedIndex = -1;
        }
        setResults([...activeFolders]);
      } catch (err) {
        console.error("OCR Error", err);
        setCurrentAction('Error processing file');
      }
      await new Promise(r => setTimeout(r, 600));
      setActiveFolderIdx(null);
    }
    await worker.terminate();
    setStatus('complete');
    setCurrentPaper(null);
  };

  // Folder Editing
  const startEditing = (idx, currentName) => { setEditingFolderIdx(idx); setEditNameValue(currentName); };
  const saveFolderName = (idx) => {
    const newResults = [...results]; newResults[idx].name = editNameValue;
    setResults(newResults); setEditingFolderIdx(null);
  };

  // Create Manual Folder
  const createNewFolder = () => {
    const newResults = [...results];
    const newCode = `NEW ${newResults.length + 1}`;
    newResults.push({
      code: newCode,
      name: `${newCode} - Click pencil to rename`,
      count: 0,
      papers: []
    });
    setResults(newResults);
    // Scroll to bottom or highlight new folder could be added here
  };

  // Selection Logic
  const togglePaperSelection = (idx) => {
    const newSet = new Set(selectedPapers);
    if (newSet.has(idx)) newSet.delete(idx);
    else newSet.add(idx);
    setSelectedPapers(newSet);
  };

  const deleteSelectedPapers = () => {
    if (viewingFolderIdx === null) return;
    const newResults = [...results];
    const folder = newResults[viewingFolderIdx];
    // Filter out selected papers
    folder.papers = folder.papers.filter((_, idx) => !selectedPapers.has(idx));
    folder.count = folder.papers.length;

    setResults(newResults);
    setSelectedPapers(new Set());
    setIsSelectionMode(false);
  };

  const moveSelectedPapers = () => {
    if (viewingFolderIdx === null || moveTargetFolder === "") return;
    const targetIdx = results.findIndex(r => r.code === moveTargetFolder);
    if (targetIdx === -1) return;

    const newResults = [...results];
    const sourceFolder = newResults[viewingFolderIdx];
    const targetFolder = newResults[targetIdx];

    // Identify papers to move
    const papersToMove = sourceFolder.papers.filter((_, idx) => selectedPapers.has(idx));

    // Remove from source
    sourceFolder.papers = sourceFolder.papers.filter((_, idx) => !selectedPapers.has(idx));
    sourceFolder.count = sourceFolder.papers.length;

    // Add to target
    targetFolder.papers = [...targetFolder.papers, ...papersToMove];
    targetFolder.papers.sort((a, b) => b.year - a.year);
    targetFolder.count = targetFolder.papers.length;

    setResults(newResults);
    setSelectedPapers(new Set());
    setIsSelectionMode(false);
  };

  // Navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!lightboxOpen) return;
      if (e.key === 'ArrowRight') nextPaper();
      if (e.key === 'ArrowLeft') prevPaper();
      if (e.key === 'Escape') setLightboxOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, currentPaperIndex, viewingFolderIdx]);

  const openLightbox = (index) => { setCurrentPaperIndex(index); setLightboxOpen(true); };
  const nextPaper = (e) => { e?.stopPropagation(); if (viewingFolderIdx !== null && currentPaperIndex < results[viewingFolderIdx].papers.length - 1) setCurrentPaperIndex(p => p + 1); };
  const prevPaper = (e) => { e?.stopPropagation(); if (currentPaperIndex > 0) setCurrentPaperIndex(p => p - 1); };


  return (
    <div className={`min-h-screen p-8 font-sans transition-colors duration-500 relative overflow-hidden ${darkMode ? 'bg-slate-900 text-white' : 'text-slate-800'}`}>
      {/* Dynamic Background */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none -z-10">
        <div className={cn("absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] opacity-50 animate-pulse-slow transition-colors duration-500", darkMode ? "bg-purple-900" : "bg-mint-200")} />
        <div className={cn("absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[100px] opacity-50 animate-pulse-slow transition-colors duration-500", darkMode ? "bg-blue-900" : "bg-lavender-200")} style={{ animationDelay: '2s' }} />
      </div>

      <header className="flex items-center justify-between mb-12 relative z-50">
        <div className="flex items-center gap-3">
          <div className={cn("p-3 backdrop-blur-md rounded-2xl shadow-sm transition-colors", darkMode ? "bg-white/10" : "bg-white/50")}>
            <Sparkles className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <h1 className={cn("text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r", darkMode ? "from-white to-slate-400" : "from-slate-800 to-slate-600")}>
              Baddie's Pastpaper Sorter
            </h1>
            <div className="flex items-center gap-2">
              <p className={cn("text-sm transition-colors", darkMode ? "text-slate-400" : "text-slate-500")}>Year 4 Sem 1 Exams</p>
            </div>
          </div>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className={cn("p-3 rounded-full transition-all", darkMode ? "bg-white/10 hover:bg-white/20 text-yellow-300" : "bg-white/50 hover:bg-white/80 text-slate-600")}
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 h-[75vh]">
        {/* Left Side: Input & Status */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          <motion.div
            className={cn(
              "flex-1 backdrop-blur-xl rounded-3xl border p-8 flex flex-col items-center justify-center text-center transition-all duration-500",
              darkMode ? "bg-white/5 border-white/10" : "bg-white/40 border-white/50",
              status === 'idle' ? "hover:scale-[1.02] shadow-xl hover:shadow-2xl" : "opacity-90"
            )}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          >
            {status === 'idle' ? (
              <>
                {files.length === 0 ? (
                  <>
                    <input type="file" multiple webkitdirectory="" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                    <div onClick={() => fileInputRef.current?.click()} className="w-24 h-24 rounded-full bg-mint-100 flex items-center justify-center mb-6 animate-float cursor-pointer hover:bg-mint-200 transition-colors">
                      <Upload className="w-10 h-10 text-mint-900" />
                    </div>
                    <h2 className={cn("text-xl font-semibold mb-2", darkMode ? "text-white" : "text-slate-700")}>Select Exam Folder</h2>
                    <p className={cn("text-sm mb-6 max-w-[200px]", darkMode ? "text-slate-400" : "text-slate-500")}>
                      Sort any exams securely.
                    </p>
                    <button onClick={() => fileInputRef.current?.click()} className={cn("w-full py-3 rounded-xl shadow-sm hover:shadow-md font-medium transition-all mb-3", darkMode ? "bg-white/10 hover:bg-white/20 text-white" : "bg-white text-slate-600")}>Browse Files</button>
                    <button onClick={loadDemoData} className="w-full py-3 text-sm text-pink-500 hover:text-pink-400 font-medium transition-colors">Load Papers Here🌸</button>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <div className="relative mb-6">
                      <div className="absolute top-[-10px] right-[-10px] bg-red-500 text-white w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold animate-bounce">{files.length}</div>
                      <Folder className="w-20 h-20 text-purple-400 fill-purple-100" />
                    </div>
                    <h3 className={cn("text-lg font-semibold mb-1", darkMode ? "text-white" : "text-slate-700")}>Ready to Sort</h3>
                    <p className={cn("text-sm mb-6", darkMode ? "text-slate-400" : "text-slate-500")}>{files.length} papers loaded</p>
                    <button onClick={processFiles} className="w-full py-4 bg-gradient-to-r from-lavender-200 to-purple-300 rounded-2xl shadow-lg hover:shadow-purple-300/50 transition-all font-bold text-purple-900 flex items-center justify-center gap-2">
                      <Sparkles className="w-5 h-5" /> Start Sorting
                    </button>
                  </div>
                )}
              </>
            ) : status === 'complete' ? (
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center">
                <CheckCircle className="w-20 h-20 text-green-500 mb-6" />
                <h2 className="text-2xl font-bold text-green-500 mb-2">Sorted!</h2>
                <p className="text-slate-500 mb-6">{files.length} papers organized</p>
                <button onClick={() => { setStatus('idle'); setFiles([]); setProcessedCount(0); setResults(SUBJ_DATA.map(s => ({ ...s, count: 0, papers: [] }))); }} className="flex items-center gap-2 text-slate-400 hover:text-white">
                  <RefreshCw className="w-4 h-4" /> Start Over
                </button>
              </motion.div>
            ) : (
              <div className="w-full flex flex-col items-center">
                {currentPaper && <img src={currentPaper.url} className="w-32 h-44 object-cover rounded-lg shadow-lg opacity-80 mb-6" />}
                <p className={cn("font-medium mb-2", darkMode ? "text-slate-300" : "text-slate-700")}>{currentAction}</p>
                <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-seafoam" initial={{ width: 0 }} animate={{ width: `${(processedCount / files.length) * 100}%` }} />
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Right Side: Grid */}
        <div className={cn("lg:col-span-9 backdrop-blur-xl rounded-3xl border p-8 relative overflow-hidden overflow-y-auto", darkMode ? "bg-black/20 border-white/10" : "bg-white/20 border-white/40")}>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
            {/* Create New Folder Button */}
            <motion.div
              onClick={createNewFolder}
              className={cn(
                "relative p-4 rounded-xl border border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all min-h-[160px] group",
                darkMode ? "border-slate-700 hover:bg-white/5 hover:border-slate-500" : "border-slate-300 hover:bg-white/40 hover:border-slate-400"
              )}
              layout
            >
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-slate-400" />
              </div>
              <span className={cn("text-sm font-medium", darkMode ? "text-slate-400" : "text-slate-500")}>Create Folder</span>
            </motion.div>

            {results.map((subject, idx) => (
              <motion.div
                key={subject.code} layout
                className={cn(
                  "relative p-4 rounded-xl border transition-all duration-300 min-h-[160px] flex flex-col justify-between group overflow-hidden",
                  subject.count > 0 ? (darkMode ? "bg-white/10 border-purple-500/30" : "bg-white/70 border-purple-200") : (darkMode ? "bg-white/5 border-white/5 border-dashed" : "bg-white/30 border-slate-200 border-dashed")
                )}
              >
                <div className="flex items-start justify-between z-10 relative">
                  <Folder className={cn("w-8 h-8", subject.count > 0 ? "text-purple-500" : "text-slate-400")} />
                  <div className="flex gap-1">
                    <button onClick={() => startEditing(idx, subject.name)} className="p-1 hover:bg-black/10 rounded text-slate-400"><Edit2 className="w-3 h-3" /></button>
                    <span className="text-xs font-mono text-slate-400 px-2 py-1 bg-black/5 rounded-full">{subject.code}</span>
                  </div>
                </div>
                <div className="mt-4 z-10 relative">
                  {editingFolderIdx === idx ? (
                    <input autoFocus value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onBlur={() => saveFolderName(idx)} onKeyDown={(e) => e.key === 'Enter' && saveFolderName(idx)} className="w-full text-sm p-1 rounded text-black" />
                  ) : (
                    <h3 className={cn("font-medium leading-tight text-sm mb-1 line-clamp-2", darkMode ? "text-slate-200" : "text-slate-700")} title={subject.name}>{subject.name.includes(':') ? subject.name.split(':')[1] : subject.name}</h3>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-xs text-slate-500 font-medium">{subject.count}</div>
                    <button onClick={() => setViewingFolderIdx(idx)} className="text-xs px-2 py-1 bg-purple-500/20 text-purple-600 dark:text-purple-300 rounded-md hover:bg-purple-500/30 transition-colors flex items-center gap-1">
                      <Eye className="w-3 h-3" /> View
                    </button>
                  </div>
                </div>
                {/* Stack Vis */}
                <div className="absolute bottom-0 right-0 w-full h-full p-4 opacity-30 pointer-events-none">
                  {subject.papers.slice(0, 5).map((p, pIdx) => (
                    <div key={p.url} className="absolute bottom-[-10px] right-[-10px] w-24 h-32 bg-white border border-slate-200 rounded-sm shadow-sm" style={{ right: `${pIdx * 5 - 10}px`, bottom: `${pIdx * 2 - 10}px`, zIndex: pIdx, transform: `rotate(${pIdx * 2 - 4}deg)` }} />
                  ))}
                </div>
                {activeFolderIdx === idx && status === 'sorting' && <div className="absolute inset-0 border-2 border-purple-500 rounded-xl animate-pulse" />}
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      {/* VIEWING MODAL WITH SELECTION/MOVE */}
      <AnimatePresence>
        {viewingFolderIdx !== null && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className={cn("fixed inset-0 z-[100] p-8 overflow-y-auto scrollbar-hide backdrop-blur-3xl", darkMode ? "bg-slate-900/95" : "bg-white/95")}>
            <div className="max-w-7xl mx-auto h-full flex flex-col">
              {/* Modal Header */}
              <div className={cn("flex items-center justify-between mb-8 p-4 rounded-xl shadow-sm z-10 sticky top-0 backdrop-blur-md", darkMode ? "bg-slate-800/80" : "bg-white/80")}>
                <div className="flex items-center gap-4">
                  <button onClick={() => setViewingFolderIdx(null)} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full"><ChevronLeft className={cn("w-6 h-6", darkMode ? "text-white" : "text-slate-800")} /></button>
                  <div>
                    <h2 className={cn("text-2xl font-bold", darkMode ? "text-white" : "text-slate-800")}>{results[viewingFolderIdx].name}</h2>
                    <p className="text-slate-500">{results[viewingFolderIdx].count} Papers</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedPapers(new Set()); }}
                    className={cn("px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors", isSelectionMode ? "bg-purple-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300")}
                  >
                    {isSelectionMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    {isSelectionMode ? "Done Selecting" : "Select Papers"}
                  </button>
                  <button onClick={() => setViewingFolderIdx(null)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-slate-200">
                    <X className="w-6 h-6 text-slate-500 dark:text-slate-300" />
                  </button>
                </div>
              </div>

              {/* Move/Delete Action Bar */}
              <AnimatePresence>
                {isSelectionMode && selectedPapers.size > 0 && (
                  <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={cn("fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 p-4 rounded-2xl shadow-2xl border", darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200")}>
                    <span className={cn("text-sm font-medium pr-4 border-r", darkMode ? "text-slate-300 border-slate-600" : "text-slate-600 border-slate-200")}>{selectedPapers.size} Selected</span>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Move To:</span>
                      <select
                        value={moveTargetFolder}
                        onChange={(e) => setMoveTargetFolder(e.target.value)}
                        className={cn("p-2 rounded-lg text-sm outline-none border", darkMode ? "bg-slate-900 border-slate-700 text-white" : "bg-slate-50 border-slate-300 text-slate-800")}
                      >
                        <option value="">Select Folder...</option>
                        {results.map((r, i) => i !== viewingFolderIdx && <option key={r.code} value={r.code}>{r.code}</option>)}
                      </select>
                      <button
                        onClick={moveSelectedPapers}
                        disabled={!moveTargetFolder}
                        className="p-2 bg-purple-600 disabled:opacity-50 text-white rounded-lg hover:bg-purple-700"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      onClick={deleteSelectedPapers}
                      className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 ml-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 pb-24">
                {results[viewingFolderIdx].papers.map((p, i) => (
                  <motion.div
                    key={i} layout
                    className={cn(
                      "group relative aspect-[3/4] shadow-md rounded-lg overflow-hidden cursor-pointer border transition-all",
                      darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-slate-200",
                      isSelectionMode && selectedPapers.has(i) ? "ring-2 ring-purple-500 transform scale-95" : "hover:shadow-xl"
                    )}
                    onClick={() => {
                      if (isSelectionMode) togglePaperSelection(i);
                      else openLightbox(i);
                    }}
                  >
                    <img src={p.url} className={cn("w-full h-full object-cover transition-transform", !isSelectionMode && "group-hover:scale-105")} />

                    {/* Selection Overlay */}
                    {isSelectionMode && (
                      <div className={cn("absolute inset-0 transition-colors flex items-start justify-end p-2", selectedPapers.has(i) ? "bg-purple-500/20" : "bg-black/10 hover:bg-black/20")}>
                        <div className={cn("w-6 h-6 rounded border flex items-center justify-center transition-all", selectedPapers.has(i) ? "bg-purple-600 border-purple-600" : "bg-white/50 border-white")}>
                          {selectedPapers.has(i) && <CheckSquare className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                    )}

                    {!isSelectionMode && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transform scale-75 group-hover:scale-100 transition-all" />
                      </div>
                    )}

                    <div className={cn("absolute bottom-0 left-0 w-full p-2 text-xs font-mono truncate flex justify-between", darkMode ? "bg-black/80 text-slate-300" : "bg-white/90 text-slate-700")}>
                      <span className="truncate max-w-[70%]">{p.name || `Paper ${i + 1}`}</span>
                      {p.year > 0 && <span className="bg-purple-500 text-white px-1 rounded text-[10px]">{p.year}</span>}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LIGHTBOX */}
      <AnimatePresence>
        {lightboxOpen && viewingFolderIdx !== null && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center"
            onClick={() => setLightboxOpen(false)}
          >
            <button className="absolute top-4 right-4 text-white/50 hover:text-white z-50 p-2"> <X className="w-8 h-8" /> </button>
            <div className="relative w-full h-full flex items-center justify-center p-4">
              {currentPaperIndex > 0 && <button onClick={prevPaper} className="absolute left-4 p-4 text-white/70 hover:text-white bg-black/20 hover:bg-white/10 rounded-full transition-all"><ChevronLeft className="w-10 h-10" /></button>}
              <img src={results[viewingFolderIdx].papers[currentPaperIndex].url} className="max-w-full max-h-full rounded shadow-2xl object-contain" onClick={(e) => e.stopPropagation()} />
              {currentPaperIndex < results[viewingFolderIdx].papers.length - 1 && <button onClick={nextPaper} className="absolute right-4 p-4 text-white/70 hover:text-white bg-black/20 hover:bg-white/10 rounded-full transition-all"><ChevronRight className="w-10 h-10" /></button>}
              <div className="absolute bottom-8 text-white/80 font-mono text-sm bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm">
                {currentPaperIndex + 1} / {results[viewingFolderIdx].papers.length}
                {results[viewingFolderIdx].papers[currentPaperIndex].year > 0 && <span className="ml-2 text-purple-300">({results[viewingFolderIdx].papers[currentPaperIndex].year})</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="absolute bottom-4 w-full text-center pointer-events-none">
        <span className={cn("px-4 py-2 rounded-full text-sm font-medium backdrop-blur-md shadow-sm pointer-events-auto inline-block", darkMode ? "bg-white/10 text-pink-400" : "bg-white/60 text-pink-600")}>
          Thank you Ndimzyy for the Papers 💖 <br /> Built by a Baddie <br /> for Baddies
        </span>
      </footer>
    </div>
  );
}
