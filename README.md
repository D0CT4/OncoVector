# OncoVector AI

**Clinical Decision Support with Grounded Reasoning & Vector Retrieval**

OncoVector is a next-generation healthcare application designed to reduce diagnostic errors by grounding AI reasoning in real-world university case registries. It utilizes a "Sequential Neural Pipeline" to analyze patient data, compare it against high-fidelity medical datasets (like NIH DeepLesion), and provide evidence-based risk assessments.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-Prototype-orange.svg)

## 🚀 Key Features

*   **Multimodal Analysis**: Ingests clinical notes and patient imagery (CT, MRI, Dermoscopy).
*   **Vector Space Retrieval**: Simulates semantic search against federated datasets (NIH, TCIA, ISIC).
*   **Explainable AI**: Provides a "Reasoning" view explaining *why* a specific diagnosis was suggested.
*   **Demo Mode**: Fully functional UI simulation without requiring live API credentials.

## 🛠️ Tech Stack

*   **Frontend**: React 19, TypeScript, Tailwind CSS
*   **Visualization**: Recharts, D3.js
*   **AI/Backend**: Google GenAI SDK (`gemini-3-pro-preview`, `gemini-2.5-flash`)
*   **Icons**: Lucide React

---

## 🏁 Getting Started

You can run this application in two modes: **Live Mode** (connected to Gemini API) or **Demo Mode** (simulated data).

### Prerequisites

*   Node.js (v18 or higher)
*   npm or yarn

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/oncovector-ai.git
    cd oncovector-ai
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

### 🟢 Running in Demo Mode (No API Key Required)

The application is architected to detect missing credentials and automatically switch to **Demo Mode**. This allows you to explore the UI, animations, and data visualization flow without a Google Cloud account.

1.  Simply start the development server:
    ```bash
    npm start
    ```
2.  Open [http://localhost:3000](http://localhost:3000) in your browser.
3.  Fill in the patient intake form (or leave defaults) and click **"Run Multi-Modal Analysis"**.
4.  The system will simulate the pipeline steps and generate a pre-calculated, high-fidelity report.

### 🔴 Running in Live Mode (With Gemini API)

To enable real AI reasoning and live web grounding:

1.  Obtain an API Key from [Google AI Studio](https://aistudiocdn.com).
2.  Create a `.env` file in the root directory (or set the variable in your environment):
    ```env
    API_KEY=your_actual_api_key_here
    ```
3.  Start the application:
    ```bash
    npm start
    ```

---

## 📂 Project Structure

```
/
├── components/          # UI Components (Graphs, Modals, Network Viz)
├── services/
│   ├── geminiService.ts # AI Logic (Handles Live & Mock Fallbacks)
│   └── mockVectorDb.ts  # Simulated Vector Database Registry
├── types.ts             # TypeScript Interfaces
├── App.tsx              # Main Application Controller
└── index.tsx            # Entry Point
```

## 🧠 How It Works (Architecture)

1.  **Input**: User inputs patient age, symptoms, and uploads a scan.
2.  **Vision Layer**: The app (simulates or performs) feature extraction to identify the anatomy (e.g., Skin vs. Lung).
3.  **Vector Retrieval**: It queries a mock index of 12 real-world datasets (like TCIA-GBM or ISIC Melanoma) to find "Nearest Neighbors".
4.  **Reasoning Synthesis**: 
    *   *Live Mode*: Gemini 3 Pro synthesizes the patient data + retrieved cases to form a diagnosis.
    *   *Demo Mode*: Returns a structured "Melanoma" or "Carcinoma" example case to demonstrate UI capabilities.
5.  **Output**: Displays risk scores, comparison graphs (Radar/Scatter), and a clinical action plan.

---

## 📄 License

This project is open-source and available under the MIT License.
