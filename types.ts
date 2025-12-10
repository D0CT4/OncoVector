
export interface CaseStudy {
  id: string;
  title: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  symptoms: string[];
  diagnosis: string;
  outcome: string;
  summary: string;
  imageUrl: string; // Placeholder for case imagery
  visual_findings: string; // Detailed description of the "Ground Truth" image for AI comparison
  databaseSource: string; // The verified university/hospital database source
  verifiedBy: string; // NEW: Name of the verifying doctor/board
  relevanceScore?: number; // Added during retrieval
  sourceUrl?: string; // NEW: Link to the external registry/source
}

export interface WebSource {
  uri: string;
  title: string;
}

export interface ScanAnalysis {
  detected: boolean;
  roiBox: [number, number, number, number]; // [ymin, xmin, ymax, xmax] in percentages (0-100)
  tensorFeatures: { feature: string; probability: number }[]; // e.g. "Border Irregularity": 0.95
}

export interface AnalysisResult {
  riskScore: number; // 0-100 (Probability of Malignancy)
  confidenceScore: number; // 0-100 (Model's confidence in its own assessment)
  missingInformation: string[]; // Critical missing data points
  visualEvidence: string[]; // Specific visual features observed (e.g., "Irregular borders")
  reasoning: string;
  recommendedTests: string[];
  potentialDiagnoses: string[];
  matchedCases: CaseStudy[];
  webSources: WebSource[]; // Real-time sources from Google Search Grounding
  scanAnalysis?: ScanAnalysis; // NEW: Computer Vision metrics
}

export interface PatientData {
  age: string;
  gender: string;
  symptoms: string;
  history: string;
  images: File[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}