# AskMyDocs 🤖📚

**AskMyDocs** is a full-stack AI-powered document workspace that lets you upload documents, organize them into notebooks, and chat with them using a self-correcting AI assistant. It supports PDFs, Word documents, plain text, raw images, and live web page URLs — all in a single clean interface.

---

## ✨ Features

### 📂 Document Ingestion
- Upload **PDF, DOCX, TXT, PNG, JPG, JPEG** files into isolated notebook collections
- Scrape and index any **web page URL** by simply pasting a link
- View uploaded files inline through a built-in document viewer

### 🧠 Multimodal AI Processing
- Extracts and indexes text from all document types using **HuggingFace sentence embeddings**
- Automatically runs **vision-based OCR** on scanned PDF pages using PyMuPDF and Groq's `llama-4-scout` model
- Analyzes and describes **raw image uploads** (diagrams, charts, screenshots) using the Vision LLM

### 🔍 Intelligent Retrieval
- Semantic search via a local **FAISS vector store**
- **Cross-Encoder re-ranking** using `ms-marco-MiniLM-L-6-v2` to improve result quality
- **Hybrid Search** mode: combines document retrieval with live web search when documents don't have the answer

### ✅ Self-Critique Loop
- The AI generates an initial answer, then **critiques and scores it**, identifies potential hallucinations, and refines it before showing you the final response

### 🗂️ Notebook Workspaces
- Organize documents into separate **notebooks** with isolated vector indexes
- Run scoped chat sessions per notebook for focused document Q&A
- Manage and delete documents with automatic index rebuilding

### 🎨 Premium UI
- Glassmorphic dark/light theme with smooth animations
- Built-in microphone voice input for chat queries
- Real-time document viewer with inline image previews

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React.js (Vite), Vanilla CSS |
| **Backend** | FastAPI (Python) |
| **Database & Storage** | Supabase (PostgreSQL + Object Storage) |
| **Vector Store** | FAISS (local) |
| **Embeddings** | HuggingFace `sentence-transformers/all-MiniLM-L6-v2` |
| **LLMs** | Groq API — `llama-3.3-70b-versatile`, `llama-4-scout-17b` (vision) |
| **RAG Framework** | LangChain |
| **PDF Parsing** | PyMuPDF (`fitz`) |
| **Re-ranking** | `cross-encoder/ms-marco-MiniLM-L-6-v2` |
| **Auth** | Custom session tokens with `bcrypt` password hashing |

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Groq](https://console.groq.com) API key

---

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/AskMyDocs.git
cd AskMyDocs
```

---

### 2. Backend Setup

```bash
# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt
```

Create your `.env` file by copying the example:

```bash
cp .env.example .env
```

Fill in your credentials inside `.env`:

```env
SUPABASE_URL=your_supabase_project_url_here
SUPABASE_KEY=your_supabase_service_role_key_here
GROQ_API_KEY=your_groq_api_key_here
```

Start the backend server:

```bash
python backend.py
```

The API will be available at `http://localhost:8000`.

---

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

---

### 4. Supabase Database Setup

Create the following tables in your Supabase project:

| Table | Purpose |
|---|---|
| `users` | Stores user accounts and stats |
| `sessions` | Manages login session tokens |
| `notebooks` | Stores notebook collections |
| `documents` | Tracks uploaded document metadata |
| `faiss_indexes` | Stores FAISS vector index files |
| `query_logs` | Logs query analytics |

Also create two **Storage Buckets** in Supabase:
- `rag-documents` — stores uploaded files
- `faiss-indexes` — stores FAISS index binary files

---

## 📁 Project Structure

```
AskMyDocs/
├── backend.py          # FastAPI REST API endpoints
├── rag.py              # RAG engine — processing, indexing, retrieval, vision
├── database.py         # Supabase database and storage adapter
├── utils.py            # Web scraping helper
├── requirements.txt    # Python dependencies
├── .env.example        # Environment variable template
└── frontend/
    ├── src/
    │   ├── App.jsx     # Main React application
    │   └── index.css   # Global styles
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## 📸 Screenshots

> Add screenshots here after deployment.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
