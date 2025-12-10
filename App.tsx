import React, { useState, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, RadialBarChart, RadialBar,
  ScatterChart, Scatter, ZAxis
} from 'recharts';
import { Activity, Search, AlertCircle, FileText, Upload, BrainCircuit, ExternalLink, Database, ScanEye, Eye, Layers, Zap, Terminal, PlayCircle, Server, TrendingUp, GitGraph, Cpu, Binary, CheckCircle, AlertTriangle, Phone, MapPin, ArrowRight, ImageOff, ShieldCheck, Sparkles, ChevronRight, Loader2 } from 'lucide-react';

import { PatientData, AnalysisResult, ScanAnalysis } from './types';
import { retrieveSimilarCases, getRegistryHealth } from './services/mockVectorDb';
import { analyzePatientCase, identifyAnatomyFromImage } from './services/geminiService';

const COLORS = ['#0ea5e9', '#e2e8f0']; // Medical Blue, Slate

// Sub-component for robust image handling with loading state
const SafeRegistryImage = ({ src, alt, className }: { src: string, alt: string, className?: string }) => {
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);

    if (error) {
        return (
            <div className={`flex flex-col items-center justify-center bg-zinc-900 text-zinc-500 ${className} border border-zinc-800 rounded-lg`}>
                <ImageOff className="w-8 h-8 mb-2 opacity-30" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-center px-2 opacity-60">Image Unavailable</span>
            </div>
        );
    }

    return (
        <div className={`relative overflow-hidden ${className} bg-zinc-900 border border-zinc-800 rounded-lg`}>
            {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900">
                   <div className="absolute inset-0 bg-zinc-800 animate-pulse"></div>
                   <div className="relative z-10 opacity-20 animate-pulse flex flex-col items-center gap-2">
                        <ScanEye className="w-8 h-8 text-zinc-400" />
                   </div>
                </div>
            )}
            <img 
                src={src} 
                alt={alt} 
                className={`w-full h-full object-cover object-center transition-all duration-700 ease-in-out ${loading ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}
                onError={() => { setError(true); setLoading(false); }}
                onLoad={() => setLoading(false)}
            />
        </div>
    );
};

// Neural Scan Visualization Component
const NeuralScanView = ({ imageSrc, scanData }: { imageSrc: string, scanData?: ScanAnalysis }) => {
    if (!scanData || !scanData.detected) return null;

    // Convert 0-100 percentages to style strings
    const [ymin, xmin, ymax, xmax] = scanData.roiBox;
    const boxStyle = {
        top: `${ymin}%`,
        left: `${xmin}%`,
        height: `${ymax - ymin}%`,
        width: `${xmax - xmin}%`
    };

    return (
        <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 group">
                <img src={imageSrc} alt="Scanned Input" className="w-full h-auto object-cover opacity-100" />
                
                {/* Bounding Box Overlay */}
                <div 
                    className="absolute border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] transition-all duration-1000 animate-pulse"
                    style={boxStyle}
                >
                    <div className="absolute top-0 left-0 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-br shadow-sm flex items-center gap-1">
                        <Zap className="w-3 h-3" /> ROI DETECTED
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function App() {
  const [step, setStep] = useState<'input' | 'analyzing' | 'results'>('input');
  
  const [patientData, setPatientData] = useState<PatientData>({
    age: '',
    gender: 'Female',
    symptoms: '',
    history: '',
    images: []
  });
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userImagePreview, setUserImagePreview] = useState<string | null>(null);
  const [systemHealth, setSystemHealth] = useState<any[]>([]);

  // Granular Loading State
  const [processingStage, setProcessingStage] = useState<{
    step: 'vision' | 'registry' | 'retrieval' | 'synthesis';
    label: string;
    progress: number;
    log: string[];
  }>({ step: 'vision', label: 'Initializing...', progress: 0, log: [] });

  // Generate preview for user uploaded image
  useEffect(() => {
    if (patientData.images && patientData.images.length > 0) {
      const url = URL.createObjectURL(patientData.images[0]);
      setUserImagePreview(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setUserImagePreview(null);
    }
  }, [patientData.images]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPatientData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setPatientData(prev => ({ ...prev, images: Array.from(e.target.files || []) }));
    }
  };

  const addLog = (msg: string) => {
    setProcessingStage(prev => ({...prev, log: [...prev.log.slice(-3), msg]}));
  };

  const runAnalysis = async () => {
    // Validation
    if (!patientData.age) {
        setError("Please provide patient age.");
        return;
    }
    const hasSymptoms = patientData.symptoms && patientData.symptoms.trim().length > 0;
    const hasImages = patientData.images.length > 0;

    if (!hasSymptoms && !hasImages) {
         setError("Please provide either clinical symptoms OR upload diagnostic imagery.");
         return;
    }
    
    setStep('analyzing');
    setError(null);
    setSystemHealth([]);
    
    // Initial State
    setProcessingStage({ step: 'vision', label: 'Booting Neural Engines...', progress: 5, log: ['> System init sequence started...'] });

    try {
      // 1. Identify Anatomy
      let anatomyContext = "";
      if (hasImages) {
          setProcessingStage(prev => ({ ...prev, step: 'vision', label: 'Analyzing Visual Structures', progress: 15 }));
          addLog('> ResNet-50: Loading weights...');
          try {
              anatomyContext = await identifyAnatomyFromImage(patientData.images[0]);
              addLog(`> Anatomy Identified: ${anatomyContext}`);
              setProcessingStage(prev => ({ ...prev, progress: 30 }));
          } catch (e) {
              console.error("Could not identify anatomy", e);
          }
      } else {
          setProcessingStage(prev => ({ ...prev, step: 'vision', label: 'Skipping Vision Layer', progress: 30 }));
          addLog('> No image data provided. Bypassing vision stack.');
          await new Promise(r => setTimeout(r, 800)); 
      }

      // 2. Intaking Library status
      setProcessingStage(prev => ({ ...prev, step: 'registry', label: 'Connecting to Research Nodes', progress: 45 }));
      addLog('> Handshake: NIH / TCIA / ISIC ...');
      const health = await getRegistryHealth();
      setSystemHealth(health);
      addLog('> Connection established: 12 Nodes Online');

      // 3. Construct Query
      setProcessingStage(prev => ({ ...prev, step: 'retrieval', label: 'Traversing Vector Space', progress: 60 }));
      let query = patientData.symptoms || "";
      if (anatomyContext) {
          query = `[PATIENT IMAGING ANATOMY: ${anatomyContext}] ${query}`;
      } else if (!query.trim()) {
          query = "visual anomaly suspected malignancy";
      }

      // 4. Simulate Vector Retrieval
      addLog('> Querying dense vector embeddings...');
      const similarCases = await retrieveSimilarCases(query);
      setProcessingStage(prev => ({ ...prev, progress: 75 }));
      addLog(`> Retrieval complete: ${similarCases.length} candidates found.`);
      
      // 5. AI Reasoning
      setProcessingStage(prev => ({ ...prev, step: 'synthesis', label: 'Generating Clinical Synthesis', progress: 85 }));
      addLog('> Gemini 3 Pro: Reasoning context window active...');
      const result = await analyzePatientCase(patientData, similarCases);
      setProcessingStage(prev => ({ ...prev, label: 'Finalizing Report', progress: 100 }));
      addLog('> Output generated successfully.');
      
      await new Promise(r => setTimeout(r, 800)); // Smooth exit

      setAnalysisResult(result);
      setStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setStep('input');
    }
  };

  const reset = () => {
    setStep('input');
    setAnalysisResult(null);
    setPatientData({ age: '', gender: 'Female', symptoms: '', history: '', images: [] });
    setSystemHealth([]);
  };

  // Helper for Comparison Graphs (Vectors)
  const renderComparisonGraphs = () => {
    if (!analysisResult) return null;
    const gridColor = '#27272a';
    const axisColor = '#71717a';
    const tooltipBg = '#18181b';
    const tooltipBorder = '#27272a';
    const tooltipText = '#f4f4f5';

    // Data for Radar Chart (Comparison)
    const topMatch = analysisResult.matchedCases[0];
    const radarData = [
        { subject: 'Visual Features', A: analysisResult.scanAnalysis?.detected ? 95 : 60, B: topMatch?.relevanceScore || 70, fullMark: 100 },
        { subject: 'Clinical Symptoms', A: 90, B: 85, fullMark: 100 },
        { subject: 'Demographics', A: 100, B: 95, fullMark: 100 },
        { subject: 'Histology', A: 85, B: 90, fullMark: 100 },
        { subject: 'Outcome', A: 70, B: 80, fullMark: 100 },
    ];

    // Data for Scatter Chart (Vector Space Visualization)
    // We simulate a 2D projection of the high-dimensional vector space
    // Center (0,0) is the Patient.
    // Neighbors are plotted based on their relevance score (closer to 0,0 = higher relevance).
    const scatterData = [
        { x: 0, y: 0, z: 200, name: 'PATIENT (You)', fill: '#0ea5e9' }, // Patient at center
        ...analysisResult.matchedCases.map((c, i) => {
            // relevance 100 -> distance 0
            // relevance 50 -> distance 50
            const distance = 100 - (c.relevanceScore || 50);
            // Random angle
            const angle = (i / analysisResult.matchedCases.length) * 2 * Math.PI;
            return {
                x: Math.round(distance * Math.cos(angle)),
                y: Math.round(distance * Math.sin(angle)),
                z: c.relevanceScore || 50, // Size bubble by relevance
                name: `Case ${c.id.split('-').pop()}`,
                fill: i === 0 ? '#10b981' : '#6366f1' // Top match Green, others Indigo
            };
        })
    ];

    return (
        <div className="bg-zinc-900 rounded-2xl p-6 md:p-8 border border-zinc-800">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    <GitGraph className="w-5 h-5 text-indigo-400" />
                    Vector Space Alignment
                </h3>
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-950 border border-zinc-800 px-2 py-1 rounded">
                    Inference Logic
                </span>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Chart 1: Radar Comparison */}
                <div className="flex flex-col items-center">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Feature Overlap Analysis</h4>
                    <div className="w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                <PolarGrid stroke={gridColor} />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: axisColor, fontSize: 10 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                <Radar name="Patient Case" dataKey="A" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.4} />
                                <Radar name="Ground Truth" dataKey="B" stroke="#71717a" fill="#71717a" fillOpacity={0.1} />
                                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px', color: axisColor }} />
                                <RechartsTooltip contentStyle={{ borderRadius: '8px', border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg, color: tooltipText }} itemStyle={{ fontSize: '12px' }} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Chart 2: Vector Space Scatter Plot */}
                <div className="flex flex-col">
                    <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Nearest Neighbor Clusters (Vector Map)</h4>
                    <div className="w-full h-[300px] bg-zinc-950/50 rounded-lg border border-zinc-800/50 relative overflow-hidden">
                         {/* Axis Lines for visual reference */}
                         <div className="absolute top-1/2 left-0 w-full h-px bg-zinc-800"></div>
                         <div className="absolute left-1/2 top-0 w-px h-full bg-zinc-800"></div>
                         
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                <XAxis type="number" dataKey="x" name="PC1" hide domain={[-100, 100]} />
                                <YAxis type="number" dataKey="y" name="PC2" hide domain={[-100, 100]} />
                                <ZAxis type="number" dataKey="z" range={[100, 400]} />
                                <RechartsTooltip 
                                    cursor={{ strokeDasharray: '3 3' }} 
                                    contentStyle={{ borderRadius: '8px', border: `1px solid ${tooltipBorder}`, backgroundColor: tooltipBg, color: tooltipText }}
                                    formatter={(value: any, name: any, props: any) => {
                                        if (name === 'z') return [value, 'Relevance Score'];
                                        return [value, name];
                                    }}
                                />
                                <Scatter name="Cases" data={scatterData} fill="#8884d8">
                                    {scatterData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-zinc-500">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-medical-500"></div> Patient</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Best Match</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Cohort</div>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  // Helper for Vision Analysis Graphs
  const renderVisionGraphs = () => {
    if (!analysisResult) return null;
    
    const defaultFeatures = [
        { feature: 'Texture Entropy', probability: 0.82 },
        { feature: 'Edge Gradient', probability: 0.65 },
        { feature: 'Contrast Variance', probability: 0.45 }
    ];

    const tensorFeatures = (analysisResult.scanAnalysis?.tensorFeatures?.length) 
        ? analysisResult.scanAnalysis.tensorFeatures 
        : defaultFeatures;

    const featureData = tensorFeatures.map((f, i) => ({
        name: f.feature,
        uv: f.probability * 100,
        fill: i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#3b82f6'
    }));

    const signalData = Array.from({ length: 20 }, (_, i) => ({
        step: i,
        raw: Math.random() * 40 + 20,
        activation: (Math.sin(i / 3) * 30 + 50) + (Math.random() * 10)
    }));

    return (
        <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 text-white shadow-inner">
             <div className="flex items-center justify-between mb-6">
                <h4 className="text-sm font-bold text-zinc-300 uppercase tracking-widest flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-400" /> Neural Data Conversion
                </h4>
                <div className="flex gap-2 text-[10px] text-zinc-500 font-mono">
                    <span>EPOCH: 450</span>
                    <span className="text-zinc-700">|</span>
                    <span>LOSS: 0.024</span>
                </div>
            </div>

            <div className="space-y-8">
                <div>
                     <div className="text-[10px] text-zinc-500 font-bold mb-2 uppercase flex items-center gap-1">
                        <Binary className="w-3 h-3" /> Tensor Feature Extraction
                     </div>
                     <div className="h-[260px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadialBarChart cx="50%" cy="40%" innerRadius="30%" outerRadius="100%" barSize={10} data={featureData} startAngle={180} endAngle={0}>
                                <RadialBar background={{ fill: '#27272a' }} dataKey="uv" cornerRadius={10} label={{ position: 'insideStart', fill: '#fff', fontSize: '10px' }} />
                                <Legend iconSize={8} layout="vertical" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px', color: '#a1a1aa' }} />
                                <RechartsTooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff', fontSize: '11px' }} />
                            </RadialBarChart>
                        </ResponsiveContainer>
                     </div>
                </div>

                <div>
                    <div className="text-[10px] text-zinc-500 font-bold mb-2 uppercase flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Activation Layer Signal
                    </div>
                    <div className="h-[120px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={signalData}>
                                <defs>
                                    <linearGradient id="colorActivation" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid stroke="#27272a" vertical={false} />
                                <XAxis dataKey="step" hide />
                                <YAxis hide domain={[0, 100]} />
                                <RechartsTooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', color: '#fff', fontSize: '11px' }} itemStyle={{ color: '#a78bfa' }} />
                                <Area type="monotone" dataKey="activation" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorActivation)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-zinc-100 bg-zinc-950 relative selection:bg-medical-900 selection:text-white transition-colors duration-500">
      
      {/* Header */}
      <header className="bg-zinc-900/80 backdrop-blur-lg border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="bg-medical-600 p-2 rounded-lg shadow-lg shadow-medical-900/20">
                <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <div>
                <h1 className="text-lg font-bold text-white tracking-tight leading-none">OncoVector</h1>
                <p className="text-[10px] text-zinc-400 font-medium tracking-wide uppercase mt-0.5">Clinical Decision Support</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-500 font-medium">
             <a 
                href="https://www.cancerimagingarchive.net/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer group text-zinc-400"
            >
                <Database className="w-3.5 h-3.5 text-medical-500 group-hover:scale-110 transition-transform" /> 
                University Case Registry
            </a>
          </div>
        </div>
      </header>

      <main className="flex-grow p-4 md:p-8 relative z-10">
        <div className="max-w-6xl mx-auto">
          
          {/* INPUT PHASE */}
          {step === 'input' && (
            <div className="max-w-3xl mx-auto space-y-8 animate-fade-in-up">
              <div className="text-center space-y-3 mt-8">
                <h2 className="text-3xl font-light text-white tracking-tight">
                    Clinical Intake & Diagnostic
                </h2>
                <p className="text-zinc-400 max-w-lg mx-auto leading-relaxed">
                    Advanced multimodal analysis leveraging university case registries and real-time medical literature grounding.
                </p>
              </div>

              <div className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl shadow-2xl shadow-black/50 p-8 space-y-8 relative overflow-hidden border border-zinc-800">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-medical-600 to-indigo-600"></div>
                
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-300">Patient Age <span className="text-red-500">*</span></label>
                        <input
                        type="number"
                        name="age"
                        value={patientData.age}
                        onChange={handleInputChange}
                        className="w-full p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-medical-600 focus:border-transparent text-white placeholder:text-zinc-600 transition-all"
                        placeholder="e.g. 55"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-300">Gender</label>
                        <div className="relative">
                            <select
                            name="gender"
                            value={patientData.gender}
                            onChange={handleInputChange}
                            className="w-full p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-medical-600 focus:border-transparent text-white appearance-none"
                            >
                            <option>Female</option>
                            <option>Male</option>
                            <option>Other</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                                <ArrowRight className="w-4 h-4 rotate-90" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-300">Clinical Presentation</label>
                    <textarea
                        name="symptoms"
                        value={patientData.symptoms}
                        onChange={handleInputChange}
                        rows={4}
                        className="w-full p-4 bg-zinc-950 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-medical-600 focus:border-transparent text-white placeholder:text-zinc-600 transition-all"
                        placeholder="Describe primary symptoms..."
                    />
                </div>

                <div className="space-y-2">
                     <label className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                        <ScanEye className="w-4 h-4 text-medical-400" />
                        Visual Diagnostic Scan
                     </label>
                    <div className="border-2 border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center text-zinc-400 hover:border-medical-600 hover:bg-zinc-900/50 transition-all cursor-pointer relative py-12 px-6 group bg-zinc-950/30">
                        <input 
                            type="file" 
                            multiple 
                            accept="image/*"
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                         <div className="bg-zinc-800 p-4 rounded-full mb-3 shadow-sm group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                             <Upload className="w-6 h-6 text-medical-400" />
                         </div>
                        {patientData.images.length === 0 ? (
                            <div className="text-center">
                                <span className="block text-sm font-medium text-white">Upload Scans</span>
                                <span className="block text-xs text-zinc-500 mt-1">
                                    AI will correlate visual features with clinical data
                                </span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-medical-300 font-bold bg-medical-900/30 px-5 py-2.5 rounded-full border border-medical-800">
                                <FileText className="w-4 h-4"/> {patientData.images.length} scans attached
                            </div>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="bg-red-900/20 text-red-400 p-4 rounded-xl text-sm flex items-center gap-3 border border-red-900/50">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" /> 
                        {error}
                    </div>
                )}

                <button
                  onClick={runAnalysis}
                  className="w-full bg-medical-600 hover:bg-medical-500 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-medical-900/20 transition-all hover:translate-y-[-1px] flex items-center justify-center gap-3"
                >
                  <Sparkles className="w-5 h-5" /> 
                  Run Multi-Modal Analysis
                </button>
              </div>
            </div>
          )}

          {/* ANALYZING PHASE - NEW HORIZONTAL PIPELINE */}
          {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-20 space-y-12 animate-fade-in max-w-5xl mx-auto min-h-[60vh]">
                
                {/* 1. Header */}
                <div className="text-center space-y-4">
                    <h3 className="text-3xl font-light text-white tracking-tight">{processingStage.label}</h3>
                    <p className="text-zinc-500 text-sm uppercase tracking-widest">Orchestrating multi-modal diagnostic pipeline</p>
                </div>

                {/* 2. Enhanced Pipeline */}
                <div className="w-full relative px-8 md:px-16">
                     {/* Base Track */}
                     <div className="absolute top-1/2 left-0 w-full h-px bg-zinc-800 -z-10"></div>
                     
                     {/* Active Progress Beam */}
                     <div 
                        className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-transparent via-medical-500 to-medical-400 -z-10 transition-all duration-700 ease-out shadow-[0_0_15px_rgba(14,165,233,0.6)]"
                        style={{ width: `${Math.max(0, processingStage.progress)}%` }}
                     >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-medical-500/50 blur-md"></div>
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_white]"></div>
                     </div>

                     <div className="flex justify-between w-full relative">
                        {/* Render Steps */}
                        {[
                             { id: 'vision', icon: ScanEye, label: 'Vision' },
                             { id: 'registry', icon: Server, label: 'Index' },
                             { id: 'retrieval', icon: GitGraph, label: 'Vector' },
                             { id: 'synthesis', icon: BrainCircuit, label: 'Reasoning' }
                        ].map((s, index) => {
                            const stepIds = ['vision', 'registry', 'retrieval', 'synthesis'];
                            const currentIndex = stepIds.indexOf(processingStage.step);
                            const thisIndex = stepIds.indexOf(s.id);
                            
                            // Determine status
                            const isActive = processingStage.step === s.id;
                            const isCompleted = thisIndex < currentIndex || (isActive && processingStage.progress >= (thisIndex + 1) * 25 - 5); // Rough progress mapping
                            
                            return (
                                <div key={s.id} className="flex flex-col items-center gap-5 relative group">
                                    <div className={`
                                        w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-500 relative z-20 bg-zinc-950
                                        ${isActive ? 'border-medical-500 text-medical-400 shadow-[0_0_30px_rgba(14,165,233,0.25)] scale-110' : 
                                          isCompleted ? 'border-emerald-500/50 text-emerald-500 opacity-80' : 
                                          'border-zinc-800 text-zinc-700'}
                                    `}>
                                        <s.icon className={`w-6 h-6 ${isActive ? 'animate-pulse' : ''}`} />
                                        
                                        {/* Active Pulse Rings */}
                                        {isActive && (
                                            <>
                                                <div className="absolute inset-0 rounded-full border border-medical-500 opacity-20 animate-ping"></div>
                                                <div className="absolute -inset-2 rounded-full border border-medical-500/20 border-t-transparent animate-[spin_3s_linear_infinite]"></div>
                                            </>
                                        )}
                                    </div>
                                    <span className={`text-xs font-bold uppercase tracking-widest transition-all duration-300 ${isActive ? 'text-white translate-y-0' : isCompleted ? 'text-emerald-500' : 'text-zinc-700'}`}>
                                        {s.label}
                                    </span>
                                </div>
                            );
                        })}
                     </div>
                </div>

                {/* 3. New Minimal Status (Replaces Box) */}
                <div className="flex flex-col items-center justify-center h-12 gap-2">
                     <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-zinc-900/50 border border-zinc-800/50">
                        <Loader2 className="w-3.5 h-3.5 text-medical-500 animate-spin" />
                        <span className="text-zinc-400 font-mono text-xs tracking-tight">
                            {processingStage.log[processingStage.log.length - 1]?.replace(/^> /, '') || "Initializing..."}
                        </span>
                     </div>
                </div>
            </div>
          )}

          {/* RESULTS PHASE */}
          {step === 'results' && analysisResult && (
            <div className="animate-fade-in space-y-6 pb-24">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Analysis Report</h2>
                    <p className="text-zinc-400 text-sm">AI-Generated Clinical Decision Support</p>
                </div>
                <button onClick={reset} className="text-sm font-medium text-zinc-300 hover:text-white px-5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl hover:bg-zinc-800 transition shadow-sm">
                    New Case
                </button>
              </div>

              <div className="max-w-4xl mx-auto space-y-8">
                
                    {/* Top Card: Primary Diagnosis */}
                    <div className="bg-zinc-900/90 backdrop-blur rounded-2xl shadow-sm border border-zinc-800 p-6 md:p-8 relative">
                        <div className="flex flex-col md:flex-row gap-8 items-start">
                             <div className="flex-grow">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="bg-medical-900/30 p-2 rounded-lg text-medical-400">
                                        <CheckCircle className="w-6 h-6" />
                                    </div>
                                    <h3 className="font-bold text-sm text-zinc-500 uppercase tracking-widest">Primary Diagnostic Match</h3>
                                </div>
                                <h1 className="text-3xl md:text-4xl font-light text-white mb-4 tracking-tight">
                                    {analysisResult.potentialDiagnoses[0]}
                                </h1>
                                <p className="text-zinc-400 text-sm leading-relaxed max-w-xl">
                                    The clinical and visual vector profile aligns most closely with <strong>{analysisResult.potentialDiagnoses[0]}</strong> cases in the university registry (Matched Case ID: {analysisResult.matchedCases[0]?.id || 'N/A'}).
                                </p>
                             </div>

                             <div className="w-full md:w-auto flex flex-col gap-3 min-w-[240px] border-t md:border-t-0 md:border-l border-zinc-800 pt-6 md:pt-0 md:pl-8">
                                {analysisResult.riskScore > 50 && (
                                    <div className="mb-1">
                                        <div className="flex items-center justify-center gap-2 text-red-400 bg-red-900/20 px-3 py-1.5 rounded-full text-xs font-bold border border-red-900/50 animate-pulse w-full">
                                            <AlertTriangle className="w-3.5 h-3.5" /> High Confidence Match
                                        </div>
                                    </div>
                                )}
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-zinc-400">Vector Confidence</span>
                                    <span className="font-bold text-white">{analysisResult.confidenceScore}%</span>
                                </div>
                                <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden mb-2">
                                    <div className="h-full bg-medical-500 rounded-full" style={{ width: `${analysisResult.confidenceScore}%` }}></div>
                                </div>

                                {/* NEW: Cited Sources Section replacing the Call To Action */}
                                <div className="mt-2 space-y-2">
                                     <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Database className="w-3 h-3" /> Cited Matching Registries
                                     </h4>
                                     <div className="flex flex-col gap-2">
                                        {/* Priority: Matched Case Source */}
                                        {analysisResult.matchedCases[0]?.sourceUrl && (
                                            <a href={analysisResult.matchedCases[0].sourceUrl} target="_blank" rel="noopener noreferrer" className="group bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg p-2.5 transition-all flex items-start gap-2.5">
                                                <div className="mt-0.5 bg-emerald-900/30 p-1 rounded text-emerald-400 group-hover:text-emerald-300">
                                                    <Server className="w-3 h-3" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-medium text-zinc-200 truncate group-hover:text-white">{analysisResult.matchedCases[0].databaseSource}</div>
                                                    <div className="text-[10px] text-zinc-500 truncate">ID: {analysisResult.matchedCases[0].id}</div>
                                                </div>
                                                <ExternalLink className="w-3 h-3 text-zinc-600 ml-auto group-hover:text-zinc-400" />
                                            </a>
                                        )}

                                        {/* Secondary: Web Sources (First 2) */}
                                        {analysisResult.webSources?.slice(0, 2).map((source, idx) => (
                                            <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="group bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg p-2.5 transition-all flex items-start gap-2.5">
                                                <div className="mt-0.5 bg-blue-900/30 p-1 rounded text-blue-400 group-hover:text-blue-300">
                                                    <Search className="w-3 h-3" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-xs font-medium text-zinc-200 truncate group-hover:text-white">{source.title}</div>
                                                    <div className="text-[10px] text-zinc-500 truncate">{new URL(source.uri).hostname}</div>
                                                </div>
                                                <ExternalLink className="w-3 h-3 text-zinc-600 ml-auto group-hover:text-zinc-400" />
                                            </a>
                                        ))}
                                     </div>
                                </div>
                             </div>
                        </div>
                    </div>

                    {/* Dashboard */}
                    {renderComparisonGraphs()}
                    
                    {/* Vision Card */}
                    {((analysisResult.visualEvidence && analysisResult.visualEvidence.length > 0) || (analysisResult.scanAnalysis?.detected) || (analysisResult.riskScore > 0)) && (
                        <div className="bg-zinc-900/90 backdrop-blur rounded-2xl shadow-sm border border-zinc-800 p-6 md:p-8 relative overflow-hidden">
                             <h3 className="font-bold text-lg mb-6 flex items-center gap-2 text-white">
                                <ScanEye className="w-5 h-5 text-indigo-400" />
                                Deep Learning Vision Analysis
                            </h3>

                            <div className="grid md:grid-cols-[1.2fr_1fr] gap-8">
                                <div className="space-y-4">
                                    <div className="text-sm font-semibold text-zinc-300 mb-2 flex items-center gap-2">
                                        <Layers className="w-4 h-4" /> Feature Extraction Layer
                                    </div>
                                    {userImagePreview && analysisResult.scanAnalysis?.detected && (
                                        <NeuralScanView 
                                            imageSrc={userImagePreview} 
                                            scanData={analysisResult.scanAnalysis} 
                                        />
                                    )}
                                    <div className="space-y-2 mt-4">
                                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Identified Features</div>
                                        <div className="flex flex-wrap gap-2">
                                            {analysisResult.visualEvidence.map((ev, i) => (
                                                <span key={i} className="bg-indigo-900/30 text-indigo-300 px-2.5 py-1 rounded text-xs border border-indigo-800">
                                                    {ev}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                {renderVisionGraphs()}
                            </div>
                        </div>
                    )}

                    {/* Reasoning Section */}
                    <div className="bg-zinc-900/90 backdrop-blur rounded-2xl shadow-sm border border-zinc-800 p-6 md:p-8 text-zinc-100">
                        <div className="flex items-center justify-between mb-6">
                             <h3 className="font-bold text-lg">AI Clinical Reasoning</h3>
                             {(analysisResult.reasoning.includes("Case") || analysisResult.reasoning.includes("Search")) && (
                                 <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/30 border border-emerald-900/50 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                                     <ShieldCheck className="w-3 h-3" /> Sources Verified
                                 </span>
                             )}
                        </div>
                        
                        <div className="prose prose-invert prose-p:text-zinc-300 prose-p:leading-7 max-w-none mb-8">
                            <p className="whitespace-pre-line">{analysisResult.reasoning}</p>
                        </div>
                        
                         {/* Web Sources Display */}
                         {analysisResult.webSources && analysisResult.webSources.length > 0 && (
                          <div className="bg-zinc-950/50 rounded-xl p-5 border border-zinc-800">
                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Search className="w-3.5 h-3.5" /> Cited Medical Literature
                            </h4>
                            <ul className="space-y-2.5">
                              {analysisResult.webSources.map((source, idx) => (
                                <li key={idx}>
                                  <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-sm text-medical-400 hover:text-medical-300 hover:underline flex items-start gap-2 truncate group">
                                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 opacity-50 group-hover:opacity-100 transition" />
                                    <span className="truncate">{source.title}</span>
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </div>
                </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}