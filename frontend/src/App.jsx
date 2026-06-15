import React, { useState, useEffect, useRef } from 'react';
import robotImg from './assets/robot.png';

const API_BASE = 'http://localhost:8000/api';

// Browser speech recognition support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
  recognition.continuous = false;
  recognition.lang = 'en-US';
  recognition.interimResults = false;
}

const MarkdownRenderer = ({ content }) => {
  if (!content) return null;
  
  const lines = content.split('\n');
  const elements = [];
  let currentList = [];
  let inCodeBlock = false;
  let codeBlockLines = [];
  
  const parseInline = (text) => {
    if (!text) return '';
    const boldRegex = /\*\*([^*]+)\*\*/g;
    const parts = text.split(boldRegex);
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index}>{part}</strong>;
      }
      
      const codeRegex = /`([^`]+)`/g;
      const codeParts = part.split(codeRegex);
      return codeParts.map((subPart, subIndex) => {
        if (subIndex % 2 === 1) {
          return <code key={subIndex} style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 4px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: '0.85em' }}>{subPart}</code>;
        }
        return subPart;
      });
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Check for fenced code blocks (```code)
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        const codeText = codeBlockLines.join('\n');
        elements.push(
          <pre 
            key={`code-${i}`} 
            style={{ 
              background: 'var(--bg-code, rgba(0,0,0,0.04))', 
              color: 'var(--text-primary)',
              padding: '14px', 
              borderRadius: '8px', 
              fontFamily: 'var(--font-mono, monospace)', 
              fontSize: '0.9em',
              overflowX: 'auto',
              whiteSpace: 'pre',
              margin: '12px 0',
              border: '1px solid var(--border-color)',
              lineHeight: '1.45'
            }}
          >
            <code>{codeText}</code>
          </pre>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        // Start of code block
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      // Keep exact line content (with leading indentation)
      codeBlockLines.push(line);
      continue;
    }
    
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const bulletContent = line.trim().substring(2);
      currentList.push(<li key={`li-${i}`} style={{ marginLeft: 20, marginBottom: 4 }}>{parseInline(bulletContent)}</li>);
      continue;
    }
    
    if (currentList.length > 0) {
      elements.push(<ul key={`ul-${i}`} style={{ margin: '8px 0', paddingLeft: 20 }}>{currentList}</ul>);
      currentList = [];
    }
    
    if (!trimmed) {
      elements.push(<div key={`spacer-${i}`} style={{ height: '8px' }} />);
      continue;
    }
    
    if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={i} style={{ fontSize: '1.1rem', fontWeight: '800', marginTop: 14, marginBottom: 6, color: 'var(--text-primary)' }}>
          {parseInline(trimmed.substring(4))}
        </h3>
      );
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={i} style={{ fontSize: '1.25rem', fontWeight: '800', marginTop: 18, marginBottom: 8, color: 'var(--text-primary)' }}>
          {parseInline(trimmed.substring(3))}
        </h2>
      );
    } else if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={i} style={{ fontSize: '1.4rem', fontWeight: '800', marginTop: 22, marginBottom: 10, color: 'var(--text-primary)' }}>
          {parseInline(trimmed.substring(2))}
        </h1>
      );
    } else {
      elements.push(
        <p key={i} style={{ margin: '4px 0', lineHeight: '1.6' }}>
          {parseInline(line)}
        </p>
      );
    }
  }
  
  if (inCodeBlock && codeBlockLines.length > 0) {
    elements.push(
      <pre 
        key="code-final" 
        style={{ 
          background: 'var(--bg-code, rgba(0,0,0,0.04))', 
          color: 'var(--text-primary)',
          padding: '14px', 
          borderRadius: '8px', 
          fontFamily: 'var(--font-mono, monospace)', 
          fontSize: '0.9em',
          overflowX: 'auto',
          whiteSpace: 'pre',
          margin: '12px 0',
          border: '1px solid var(--border-color)',
          lineHeight: '1.45'
        }}
      >
        <code>{codeBlockLines.join('\n')}</code>
      </pre>
    );
  }

  if (currentList.length > 0) {
    elements.push(<ul key="ul-final" style={{ margin: '8px 0', paddingLeft: 20 }}>{currentList}</ul>);
  }
  
  return <div className="markdown-body" style={{ width: '100%' }}>{elements}</div>;
};

export default function App() {
  // Authentication & Session
  const [user, setUser] = useState(null);
  const [authPage, setAuthPage] = useState('login'); // login | signup
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({ strength: '', feedback: '' });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirm, setShowSignupConfirm] = useState(false);

  // Navigation
  const [page, setPage] = useState('chat'); // chat | notebooks | settings
  const [theme, setTheme] = useState('light');
  const [showAllChats, setShowAllChats] = useState(false);

  // Notebooks
  const [notebooks, setNotebooks] = useState([]);
  const [currentNotebook, setCurrentNotebook] = useState(null);
  
  // Change Password Form States
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notebookTab, setNotebookTab] = useState('documents'); // documents | chat | analytics
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNbName, setNewNbName] = useState('');
  const [newNbDesc, setNewNbDesc] = useState('');
  const [newNbColor, setNewNbColor] = useState('#1E88E5');
  const [newNbDomains, setNewNbDomains] = useState(['General']);
  const [searchSort, setSearchSort] = useState('Last accessed');
  const [searchFilter, setSearchFilter] = useState('All notebooks');

  // Documents
  const [documents, setDocuments] = useState([]);
  const [viewingDocument, setViewingDocument] = useState(null); // Full document object from backend
  const [viewingDocData, setViewingDocData] = useState(null); // Parsed doc structure (paragraphs/tables/text)
  const [customDocName, setCustomDocName] = useState('');
  const [uploadUrl, setUploadUrl] = useState('');
  const [useRag, setUseRag] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const chatFileInputRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [showChatUpload, setShowChatUpload] = useState(false);
  const [chatUploadNotebookId, setChatUploadNotebookId] = useState('global');

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const [chatMode, setChatMode] = useState('deep_search'); // deep_search | hybrid
  const [chatQuery, setChatQuery] = useState('');
  const [conversations, setConversations] = useState([]);

  // Track active conversation ID per scope (notebook ID or 'global')
  const [activeChatByScope, setActiveChatByScope] = useState({});
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [activeSources, setActiveSources] = useState(null); // Selected chat sources to view in drawer
  
  // Settings & Analytics
  const [analytics, setAnalytics] = useState(null);
  const [diagnostics, setDiagnostics] = useState([]);
  const [prefDefaultPage, setPrefDefaultPage] = useState('Chat');

  // UI state
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadMetrics, setUploadMetrics] = useState(null);
  const [isChatLoaded, setIsChatLoaded] = useState(false);
  const [showIndexer, setShowIndexer] = useState(false);
  const chatBottomRef = useRef(null);

  // Setup theme and auto-login
  useEffect(() => {
    // Theme setup
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Auto-login
    const savedSession = sessionStorage.getItem('session_token');
    if (savedSession) {
      validateSession(savedSession);
    }
  }, []);

  // Load documents when page changes to chat
  useEffect(() => {
    if (page === 'chat' && user) {
      loadDocuments('global');
    }
  }, [page, user]);

  // Load user-specific chat history when user changes
  useEffect(() => {
    if (user?.user_id) {
      const savedConvs = localStorage.getItem(`rag_conversations_${user.user_id}`);
      const savedScope = localStorage.getItem(`rag_active_chat_by_scope_${user.user_id}`);
      
      const loadedConvs = savedConvs ? JSON.parse(savedConvs) : [];
      const loadedScope = savedScope ? JSON.parse(savedScope) : {};
      
      setConversations(loadedConvs);
      setActiveChatByScope(loadedScope);
      
      const activeId = loadedScope['global'] || null;
      setActiveConversationId(activeId);
      if (activeId) {
        const conv = loadedConvs.find(c => c.id === activeId);
        setChatHistory(conv ? conv.messages : []);
      } else {
        setChatHistory([]);
      }
      setIsChatLoaded(true);
    } else {
      setIsChatLoaded(false);
      setConversations([]);
      setActiveChatByScope({});
      setActiveConversationId(null);
      setChatHistory([]);
    }
  }, [user]);

  // Sync conversations to localStorage
  useEffect(() => {
    if (user?.user_id && isChatLoaded) {
      localStorage.setItem(`rag_conversations_${user.user_id}`, JSON.stringify(conversations));
    }
  }, [conversations, user, isChatLoaded]);

  // Sync activeChatByScope to localStorage
  useEffect(() => {
    if (user?.user_id && isChatLoaded) {
      localStorage.setItem(`rag_active_chat_by_scope_${user.user_id}`, JSON.stringify(activeChatByScope));
    }
  }, [activeChatByScope, user, isChatLoaded]);

  // Sync scroll on chat updates
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatLoading]);

  // Toast Helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Helper fetch wrapper
  const fetchAPI = async (endpoint, options = {}) => {
    const token = sessionStorage.getItem('session_token');
    const headers = {
      ...options.headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (!(options.body instanceof FormData) && options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.detail || 'API error encountered');
    }

    return res.json();
  };

  // Session Validation
  const validateSession = async (token) => {
    try {
      const data = await fetchAPI('/auth/session', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUser({
        user_id: data.user_id,
        name: data.name,
        email: data.email,
        token
      });
      showToast(`Welcome back, ${data.name}!`);
      // Load initial data
      loadNotebooks();
    } catch (err) {
      sessionStorage.removeItem('session_token');
      setUser(null);
    }
  };

  // Check password strength locally
  const checkPassword = (pwd) => {
    if (!pwd) {
      setPasswordStrength({ strength: '', feedback: '' });
      return;
    }
    let score = 0;
    let feedback = '';
    
    if (pwd.length < 8) {
      setPasswordStrength({ strength: 'weak', feedback: 'Password too short (min 8 chars).' });
      return;
    } else if (pwd.length >= 12) score += 2;
    else score += 1;

    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    else feedback += 'Mix upper & lower case. ';
    
    if (/\d/.test(pwd)) score += 1;
    else feedback += 'Include a number. ';

    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score += 1;
    else feedback += 'Include a symbol. ';

    if (score >= 4) {
      setPasswordStrength({ strength: 'strong', feedback: 'Strong password' });
    } else if (score >= 2) {
      setPasswordStrength({ strength: 'medium', feedback: 'Medium strength. ' + feedback });
    } else {
      setPasswordStrength({ strength: 'weak', feedback: 'Weak password. ' + feedback });
    }
  };

  // Auth Operations
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      showToast('Please enter both email and password', 'error');
      return;
    }
    setLoading(true);
    try {
      const data = await fetchAPI('/auth/login', {
        method: 'POST',
        body: { email: loginEmail, password: loginPassword }
      });
      sessionStorage.setItem('session_token', data.session_id);
      setUser({
        user_id: data.user_id,
        name: data.name,
        email: data.email,
        token: data.session_id
      });
      showToast(`Welcome, ${data.name}!`);
      loadNotebooks();
      setLoginPassword('');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!signupName || !signupEmail || !signupPassword) {
      showToast('Please fill in all fields', 'error');
      return;
    }
    if (signupPassword !== signupConfirm) {
      showToast('Passwords do not match', 'error');
      return;
    }
    if (signupPassword.length < 8) {
      showToast('Password must be at least 8 characters long', 'error');
      return;
    }
    setLoading(true);
    try {
      await fetchAPI('/auth/signup', {
        method: 'POST',
        body: { email: signupEmail, password: signupPassword, name: signupName }
      });
      showToast('Account created successfully! Please login.');
      setAuthPage('login');
      setSignupName('');
      setSignupEmail('');
      setSignupPassword('');
      setSignupConfirm('');
      setPasswordStrength({ strength: '', feedback: '' });
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      showToast('All password fields are required.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('New passwords do not match.', 'error');
      return;
    }
    if (newPassword.length < 8) {
      showToast('New password must be at least 8 characters long.', 'error');
      return;
    }
    setLoading(true);
    try {
      await fetchAPI('/auth/change-password', {
        method: 'POST',
        body: {
          old_password: oldPassword,
          new_password: newPassword
        }
      });
      showToast('Password updated successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      showToast(err.message || 'Failed to update password.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm("Are you sure you want to permanently delete your account? This will erase all your notebooks, uploaded documents, chat history, and index data. This action cannot be undone.");
    if (!confirmDelete) return;

    const finalConfirm = window.prompt("To proceed, type DELETE in all capitals:");
    if (finalConfirm !== "DELETE") {
      showToast("Verification failed. Account deletion canceled.", "error");
      return;
    }

    setLoading(true);
    try {
      await fetchAPI('/auth/delete-account', {
        method: 'DELETE'
      });
      showToast('Your account was permanently deleted.', 'success');
      sessionStorage.removeItem('session_token');
      setUser(null);
      setChatHistory([]);
      setNotebooks([]);
      setCurrentNotebook(null);
    } catch (err) {
      showToast(err.message || 'Failed to delete account.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetchAPI('/auth/logout', { method: 'POST' });
    } catch (err) {}
    sessionStorage.removeItem('session_token');
    setUser(null);
    setChatHistory([]);
    setNotebooks([]);
    setCurrentNotebook(null);
    showToast('Logged out successfully');
  };

  // Toggle UI Theme
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Notebook Operations
  const loadNotebooks = async () => {
    try {
      const data = await fetchAPI('/notebooks');
      setNotebooks(data);
    } catch (err) {
      showToast('Failed to fetch notebooks', 'error');
    }
  };

  const handleCreateNotebook = async (e) => {
    e.preventDefault();
    if (!newNbName.trim()) {
      showToast('Notebook name is required', 'error');
      return;
    }
    try {
      await fetchAPI('/notebooks', {
        method: 'POST',
        body: {
          name: newNbName,
          description: newNbDesc,
          color: newNbColor,
          domains: newNbDomains
        }
      });
      showToast(`Notebook '${newNbName}' created!`);
      setShowCreateModal(false);
      setNewNbName('');
      setNewNbDesc('');
      setNewNbColor('#1E88E5');
      loadNotebooks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleFavoriteNotebook = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await fetchAPI(`/notebooks/${id}/favorite`, { method: 'POST' });
      setNotebooks(notebooks.map(nb => nb.id === id ? { ...nb, is_favorite: res.is_favorite } : nb));
      if (currentNotebook && currentNotebook.id === id) {
        setCurrentNotebook({ ...currentNotebook, is_favorite: res.is_favorite });
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDeleteNotebook = async (id, name, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete '${name}'? This cannot be undone.`)) {
      return;
    }
    try {
      await fetchAPI(`/notebooks/${id}`, { method: 'DELETE' });
      showToast('Notebook deleted successfully');
      loadNotebooks();
      if (currentNotebook && currentNotebook.id === id) {
        setCurrentNotebook(null);
        setPage('notebooks');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const openNotebook = async (notebook) => {
    setCurrentNotebook(notebook);
    setNotebookTab('documents');
    setPage('notebook_detail');
    loadDocuments(notebook.id);
  };

  // Documents Operations
  const loadDocuments = async (notebookId) => {
    try {
      const data = await fetchAPI(`/notebooks/${notebookId}/documents`);
      setDocuments(data);
    } catch (err) {
      showToast('Failed to fetch documents', 'error');
    }
  };

  const handleFileUpload = async (files, targetNotebookId = null) => {
    const notebookId = targetNotebookId || currentNotebook?.id;
    if (!notebookId) {
      showToast('Please select a target notebook first', 'error');
      return;
    }
    if (!files || files.length === 0) return;
    setLoading(true);
    setUploadMetrics(null);
    showToast('Uploading files and building RAG index...', 'info');
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      formData.append('use_rag', useRag);
      if (customDocName && files.length === 1) {
        formData.append('custom_name', customDocName);
      }

      const res = await fetchAPI(`/notebooks/${notebookId}/documents`, {
        method: 'POST',
        body: formData
      });
      
      showToast('Upload and indexing completed successfully!');
      setCustomDocName('');
      setSelectedFiles([]);
      if (res.metrics) {
        setUploadMetrics(res.metrics);
      }
      if ((currentNotebook && currentNotebook.id === notebookId) || notebookId === 'global') {
        loadDocuments(notebookId);
      }
      loadNotebooks();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUrlUpload = async (targetNotebookId = null) => {
    const notebookId = targetNotebookId || currentNotebook?.id;
    if (!notebookId) {
      showToast('Please select a target notebook first', 'error');
      return;
    }
    if (!uploadUrl.trim()) {
      showToast('Please enter a valid URL', 'error');
      return;
    }
    setLoading(true);
    setUploadMetrics(null);
    showToast('Fetching and indexing URL with RAG...', 'info');
    try {
      const res = await fetchAPI(`/notebooks/${notebookId}/urls`, {
        method: 'POST',
        body: {
          url: uploadUrl,
          use_rag: useRag
        }
      });
      showToast('URL successfully scraped and indexed!');
      setUploadUrl('');
      if (res.metrics) {
        setUploadMetrics(res.metrics);
      }
      if ((currentNotebook && currentNotebook.id === notebookId) || notebookId === 'global') {
        loadDocuments(notebookId);
      }
      loadNotebooks();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (docId, name) => {
    if (!window.confirm(`Are you sure you want to delete document '${name}'?`)) return;
    try {
      await fetchAPI(`/documents/${docId}`, { method: 'DELETE' });
      showToast('Document deleted');
      if (currentNotebook) {
        loadDocuments(currentNotebook.id);
      } else {
        loadDocuments('global');
      }
      loadNotebooks();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleViewDocument = async (doc) => {
    if (doc.file_type === 'pdf') {
      setViewingDocument(doc);
      setViewingDocData({ is_pdf: true });
      return;
    }
    if (['png', 'jpg', 'jpeg'].includes(doc.file_type.toLowerCase())) {
      setViewingDocument(doc);
      setViewingDocData({ is_image: true });
      return;
    }

    setLoading(true);
    try {
      const data = await fetchAPI(`/documents/${doc.id}/view`);
      setViewingDocument(doc);
      setViewingDocData(data);
    } catch (err) {
      showToast('Failed to load document content', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectConversation = (id) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      const scope = conv.notebookId || 'global';
      setActiveConversationId(id);
      setChatHistory(conv.messages);
      setChatMode(conv.mode || 'deep_search');
      setActiveChatByScope(prev => ({ ...prev, [scope]: id }));
      if (scope === 'global') {
        setPage('chat');
      } else {
        const nb = notebooks.find(n => n.id === scope);
        if (nb) {
          setCurrentNotebook(nb);
          setNotebookTab('chat');
          setPage('notebook_detail');
        }
      }
    }
  };

  const startNewChat = () => {
    const scope = 'global';
    setActiveConversationId(null);
    setChatHistory([]);
    setChatMode('deep_search');
    setPage('chat');
    setActiveChatByScope(prev => ({ ...prev, [scope]: null }));
  };

  const deleteConversation = (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this chat history?')) return;
    
    const conv = conversations.find(c => c.id === id);
    const scope = conv?.notebookId || 'global';
    
    setConversations(prev => prev.filter(c => c.id !== id));
    
    if (activeConversationId === id) {
      setActiveConversationId(null);
      setChatHistory([]);
      setActiveChatByScope(prev => ({ ...prev, [scope]: null }));
    } else if (activeChatByScope[scope] === id) {
      setActiveChatByScope(prev => ({ ...prev, [scope]: null }));
    }
  };

  // RAG Chat QA
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatQuery.trim()) return;

    const query = chatQuery;
    setChatQuery('');
    setChatLoading(true);

    const userMessage = { role: 'user', content: query };
    const updatedHistory = [...chatHistory, userMessage];
    setChatHistory(updatedHistory);

    const activeNotebookId = page === 'notebook_detail' ? currentNotebook.id : 'global';
    let convId = activeConversationId;
    if (!convId) {
      convId = Date.now().toString();
      const newConv = {
        id: convId,
        title: query.slice(0, 30) + (query.length > 30 ? '...' : ''),
        messages: [userMessage],
        mode: chatMode,
        notebookId: activeNotebookId,
        created_at: new Date().toISOString()
      };
      setConversations(prev => [newConv, ...prev]);
      setActiveConversationId(convId);
      setActiveChatByScope(prev => ({ ...prev, [activeNotebookId]: convId }));
    } else {
      setConversations(prev => prev.map(c => {
        if (c.id === convId) {
          return { ...c, messages: [...c.messages, userMessage] };
        }
        return c;
      }));
    }

    try {
      const activeNotebookId = page === 'notebook_detail' ? currentNotebook.id : 'global';
      const response = await fetchAPI('/chat', {
        method: 'POST',
        body: {
          query,
          mode: chatMode,
          notebook_id: activeNotebookId,
          history: chatHistory
        }
      });
      // Append bot response
      const botMessage = { role: 'assistant', content: response };
      setChatHistory(prev => [...prev, botMessage]);
      setConversations(prev => prev.map(c => {
        if (c.id === convId) {
          return { ...c, messages: [...c.messages, botMessage] };
        }
        return c;
      }));
    } catch (err) {
      const errorMessage = { role: 'assistant', content: `Error: ${err.message}` };
      setChatHistory(prev => [...prev, errorMessage]);
      setConversations(prev => prev.map(c => {
        if (c.id === convId) {
          return { ...c, messages: [...c.messages, errorMessage] };
        }
        return c;
      }));
    } finally {
      setChatLoading(false);
    }
  };

  // Browser Mic Dictation
  const handleVoiceInput = () => {
    if (!recognition) {
      showToast('Speech Recognition not supported in this browser.', 'error');
      return;
    }
    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      recognition.start();
      showToast('Listening... Speak now.');
      
      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setChatQuery(text);
        showToast('Speech recognized.');
        setIsRecording(false);
      };

      recognition.onerror = () => {
        showToast('Error recognizing voice input.', 'error');
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };
    }
  };

  // Load Settings Panels
  const loadAnalytics = async () => {
    try {
      const data = await fetchAPI('/settings/analytics');
      setAnalytics(data);
    } catch (err) {
      showToast('Failed to fetch analytics', 'error');
    }
  };

  const loadDiagnostics = async () => {
    try {
      const data = await fetchAPI('/settings/diagnostics');
      setDiagnostics(data);
    } catch (err) {
      showToast('Failed to fetch diagnostics', 'error');
    }
  };

  // Handle views updates
  useEffect(() => {
    if (page === 'settings') {
      loadAnalytics();
    }
  }, [page]);

  // Sorting & Filtering
  const getSortedNotebooks = () => {
    let list = [...notebooks];
    if (searchFilter === 'Favorites only') {
      list = list.filter(nb => nb.is_favorite);
    } else if (searchFilter === 'Recently used') {
      list.sort((a, b) => new Date(b.last_accessed) - new Date(a.last_accessed));
    }
    
    if (searchSort === 'Name') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (searchSort === 'Created date') {
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (searchSort === 'Document count') {
      list.sort((a, b) => b.document_count - a.document_count);
    }
    return list;
  };

  // Check if notebook has FAISS index
  const checkHasIndex = (notebookId) => {
    const diag = diagnostics.find(d => d.notebook_id === notebookId);
    return diag ? diag.status === 'Vectors stored' : false;
  };

  // Render Auth Pages
  if (!user) {
    return (
      <div className="auth-wrapper">
        <div className="auth-visual-side">
          <img src={robotImg} alt="AskMyDocs Mascot" className="auth-robot-image" />
          
          <div className="auth-visual-text-block">
            <span className="auth-badge">AI-Powered</span>
            <h1 className="auth-visual-title-main">AskMyDocs</h1>
            <p className="auth-visual-desc-main">
              Organize documents into notebooks, generate smart embeddings instantly, and get accurate answers from your documents.
            </p>
          </div>
        </div>

        <div className="auth-form-side">
          {authPage === 'login' ? (
            <form onSubmit={handleLogin} className="auth-card fade-in">
              <div className="auth-header">
                <h2 className="auth-title">Welcome Back 👋</h2>
                <p className="auth-subtitle">Login to retrieve your notebooks and indexes</p>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="input-with-icon">
                  <span className="auth-input-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="john.doe@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-with-icon">
                  <span className="auth-input-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </span>
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    className="form-input"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    tabIndex="-1"
                  >
                    {showLoginPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <div className="spinner" style={{ width: 16, height: 16 }}></div> : (
                  <>
                    Login 
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: 16, height: 16 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </button>

              <div className="auth-divider">New User?</div>

              <button type="button" className="btn btn-secondary" onClick={() => setAuthPage('signup')}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 18, height: 18 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
                </svg>
                Create Account
              </button>

              <div className="auth-footer-note">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="shield-icon">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
                Your data is secure and encrypted
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignup} className="auth-card fade-in">
              <div className="auth-header">
                <h2 className="auth-title">Welcome 👋</h2>
                <p className="auth-subtitle">Set up a credentials token to access storage</p>
              </div>

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <div className="input-with-icon">
                  <span className="auth-input-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="John Doe"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div className="input-with-icon">
                  <span className="auth-input-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="john.doe@example.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="input-with-icon">
                  <span className="auth-input-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </span>
                  <input
                    type={showSignupPassword ? "text" : "password"}
                    className="form-input"
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => {
                      setSignupPassword(e.target.value);
                      checkPassword(e.target.value);
                    }}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    tabIndex="-1"
                  >
                    {showSignupPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
                {signupPassword && (
                  <div className="strength-bar-wrapper">
                    <div className={`strength-meter-slots ${passwordStrength.strength}`}>
                      <div className="strength-meter-slot"></div>
                      <div className="strength-meter-slot"></div>
                      <div className="strength-meter-slot"></div>
                    </div>
                    <span className={`password-strength-text ${passwordStrength.strength}`}>
                      {passwordStrength.feedback}
                    </span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Confirm Password</label>
                <div className="input-with-icon">
                  <span className="auth-input-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </span>
                  <input
                    type={showSignupConfirm ? "text" : "password"}
                    className="form-input"
                    placeholder="••••••••"
                    value={signupConfirm}
                    onChange={(e) => setSignupConfirm(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowSignupConfirm(!showSignupConfirm)}
                    tabIndex="-1"
                  >
                    {showSignupConfirm ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? <div className="spinner" style={{ width: 16, height: 16 }}></div> : (
                  <>
                    Create Account 
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" style={{ width: 16, height: 16 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                    </svg>
                  </>
                )}
              </button>

              <div className="auth-divider">Already a Member?</div>

              <button type="button" className="btn btn-secondary" onClick={() => setAuthPage('login')}>
                Log In
              </button>

              <div className="auth-footer-note">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="shield-icon">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
                Your data is secure and encrypted
              </div>
            </form>
          )}
        </div>

        {/* Global Alert Notification */}
        {toast && (
          <div className={`toast-box ${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    );
  }

  // Render Dashboard
  return (
    <div className="dashboard-layout">
      {/* Left Sidebar */}
      <aside className="sidebar">

        {/* Logo */}
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" width="28" height="28" style={{borderRadius:8,display:'block'}}>
              <rect width="64" height="64" rx="14" fill="url(#cd-bg)"/>
              <path d="M16 7 H48 Q58 7 58 16 V37 Q58 46 48 46 H24 L8 58 L14 46 Q6 46 6 37 V16 Q6 7 16 7Z"
                fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="2.2" strokeLinejoin="round"/>
              <rect x="11" y="13" width="21" height="26" rx="3" fill="white" opacity="0.95"/>
              <path d="M26 13 L32 13 L32 19Z" fill="#a5b4fc" opacity="0.9"/>
              <line x1="14" y1="22" x2="28" y2="22" stroke="#6366f1" strokeWidth="1.4" strokeLinecap="round"/>
              <line x1="14" y1="27" x2="26" y2="27" stroke="#6366f1" strokeWidth="1.4" strokeLinecap="round"/>
              <line x1="14" y1="32" x2="24" y2="32" stroke="#6366f1" strokeWidth="1.4" strokeLinecap="round"/>
              <line x1="36" y1="18" x2="52" y2="18" stroke="white" strokeWidth="1.7" strokeLinecap="round" opacity="0.8"/>
              <line x1="36" y1="24" x2="50" y2="24" stroke="white" strokeWidth="1.7" strokeLinecap="round" opacity="0.8"/>
              <line x1="36" y1="30" x2="52" y2="30" stroke="white" strokeWidth="1.7" strokeLinecap="round" opacity="0.8"/>
              <line x1="36" y1="36" x2="46" y2="36" stroke="white" strokeWidth="1.7" strokeLinecap="round" opacity="0.8"/>
              <defs>
                <linearGradient id="cd-bg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#6366f1"/>
                  <stop offset="100%" stopColor="#06b6d4"/>
                </linearGradient>
              </defs>
            </svg>
          </span>
          <span className="sidebar-logo-text">AskMyDocs</span>
        </div>

        {/* New Chat Button */}
        <button className="sidebar-new-chat-btn" onClick={startNewChat}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Chat
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="sidebar-new-chat-sparkle">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
          </svg>
        </button>

        {/* Main Nav */}
        <nav className="sidebar-menu">
          <button
            className={`sidebar-item ${page === 'chat' ? 'active' : ''}`}
            onClick={startNewChat}
          >
            <span className="sidebar-item-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </span>
            Home
          </button>

          <button
            className={`sidebar-item ${page === 'notebooks' ? 'active' : ''}`}
            onClick={() => { setPage('notebooks'); loadNotebooks(); }}
          >
            <span className="sidebar-item-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
              </svg>
            </span>
            My Notebooks
          </button>

          <button
            className={`sidebar-item ${page === 'settings' ? 'active' : ''}`}
            onClick={() => { setPage('settings'); loadAnalytics(); }}
          >
            <span className="sidebar-item-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43 1 .004.22.004.441 0 .662-.008.387.137.759.43 1l1.002.828a1.125 1.125 0 0 1 .26 1.43l-1.297 2.247a1.125 1.125 0 0 1-1.37.49l-1.216-.456a1.125 1.125 0 0 0-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.02-.397-1.11-.94l-.213-1.281a1.125 1.125 0 0 0-.645-.87c-.074-.04-.147-.083-.22-.127a1.125 1.125 0 0 0-1.075-.124l-1.217.456a1.125 1.125 0 0 1-1.37-.49l-1.296-2.247a1.125 1.125 0 0 1 .26-1.43l1.003-.827c.293-.24.438-.614.43-1a6.97 6.97 0 0 1 0-.662c.008-.387-.137-.759-.43-1l-1.002-.828a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.49l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128c.332-.183.582-.495.645-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </span>
            Settings
          </button>
        </nav>

        {/* Recent Chats Section */}
        {conversations.length > 0 && (() => {
          const activeNotebookId = page === 'notebook_detail' ? currentNotebook?.id : 'global';
          const allFiltered = conversations.filter(c => c.notebookId === activeNotebookId);
          const filteredConvs = showAllChats ? allFiltered : allFiltered.slice(0, 5);
          if (filteredConvs.length === 0) return null;

          const getTimeAgo = (isoDate) => {
            const diff = Date.now() - new Date(isoDate).getTime();
            const mins = Math.floor(diff / 60000);
            const hrs = Math.floor(diff / 3600000);
            const days = Math.floor(diff / 86400000);
            if (mins < 60) return `${mins}m ago`;
            if (hrs < 24) return `${hrs}h ago`;
            if (days === 1) return 'Yesterday';
            return `${days}d ago`;
          };

          return (
            <div className="sidebar-recents">
              <div className="sidebar-recents-label">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                Recent Chats
              </div>
              {filteredConvs.map(conv => (
                <div
                  key={conv.id}
                  className={`sidebar-recent-item ${activeConversationId === conv.id ? 'active' : ''}`}
                  onClick={() => selectConversation(conv.id)}
                >
                  <span className="sidebar-recent-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                    </svg>
                  </span>
                  <span className="sidebar-recent-title">{conv.title}</span>
                  <span className="sidebar-recent-time">{getTimeAgo(conv.created_at)}</span>
                  <button
                    className="sidebar-chat-delete-btn"
                    onClick={(e) => deleteConversation(conv.id, e)}
                    title="Delete"
                  >×</button>
                </div>
              ))}
              {allFiltered.length > 5 && (
                <button className="sidebar-view-all-btn" onClick={() => setShowAllChats(prev => !prev)}>
                  {showAllChats ? 'Show less' : `View all chats (${allFiltered.length})`}
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"
                    style={{ transform: showAllChats ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              )}
            </div>
          );
        })()}

        {/* Bottom User Panel */}
        <div className="sidebar-user">

          {/* User Profile Card */}
          <div className="user-profile-card">
            <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-email">{user.email}</span>
            </div>
          </div>

          {/* Dark Mode Toggle Row */}
          <div className="sidebar-toggle-row">
            <span className="sidebar-toggle-label">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
              </svg>
              Dark mode
            </span>
            <button
              className={`sidebar-toggle-switch ${theme === 'dark' ? 'on' : ''}`}
              onClick={toggleTheme}
              aria-label="Toggle dark mode"
            >
              <span className="sidebar-toggle-knob" />
            </button>
          </div>

          {/* Logout */}
          <button onClick={handleLogout} className="sidebar-logout-btn">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
            </svg>
            Logout
          </button>

        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="workspace fade-in">
        
        {/* VIEW 1: GLOBAL RAG CHAT */}
        {page === 'chat' && (
          <div className="chat-page-container">
            {/* Elegant Chat Header */}
            <div className="chat-header-bar">
              <div className="chat-header-left">
                <span className="chat-header-icon">💬</span>
                <div>
                  <h1 className="chat-header-title">Document Chat Sandbox</h1>
                  <p className="chat-header-subtitle">Ask questions across all your documents</p>
                </div>
              </div>
              
              <div className="chat-header-center">
                <div className="rag-mode-picker">
                  <button
                    type="button"
                    onClick={() => setChatMode('deep_search')}
                    className={`rag-mode-btn ${chatMode === 'deep_search' ? 'active' : ''}`}
                  >
                    <span className="rag-mode-btn-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 1-6.23-.693L4 14.5m15.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L4 14.5" />
                      </svg>
                    </span>
                    <span className="rag-mode-btn-text">
                      <span className="rag-mode-btn-title">Deep Search</span>
                      <span className="rag-mode-btn-sub">Document search with self-critique</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatMode('hybrid')}
                    className={`rag-mode-btn ${chatMode === 'hybrid' ? 'active' : ''}`}
                  >
                    <span className="rag-mode-btn-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                      </svg>
                    </span>
                    <span className="rag-mode-btn-text">
                      <span className="rag-mode-btn-title">Hybrid Search</span>
                      <span className="rag-mode-btn-sub">Search documents and the web</span>
                    </span>
                  </button>
                </div>
              </div>

              <div className="chat-header-right">
                <button
                  type="button"
                  onClick={() => setShowIndexer(true)}
                  className={`btn-toggle-indexer ${documents.length === 0 ? 'pulse-attention' : ''}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{width:16,height:16}}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                  <span>{documents.length === 0 ? 'Upload Documents' : `Documents (${documents.length})`}</span>
                  {documents.length === 0 && <span className="indexer-new-dot" />}
                </button>
              </div>
            </div>

            {/* Document Index Modal */}
            {showIndexer && (
              <div className="doc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowIndexer(false); setSelectedFiles([]); } }}>
                <div className="doc-modal">
                  {/* Modal Header */}
                  <div className="doc-modal-header">
                    <div className="doc-modal-title">
                      <span className="doc-modal-folder-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 10.146V6a3 3 0 0 1 3-3h5.379a2.25 2.25 0 0 1 1.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 0 1 3 3v1.146A4.483 4.483 0 0 0 19.5 9h-15a4.483 4.483 0 0 0-3 1.146Z" />
                        </svg>
                      </span>
                      <h2>Document Index</h2>
                    </div>
                    <button className="doc-modal-close" onClick={() => { setShowIndexer(false); setSelectedFiles([]); }}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Drop Zone */}
                  <div
                    className={`doc-modal-dropzone ${dragOver ? 'drag-active' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      if (e.dataTransfer.files.length > 0) setSelectedFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
                    }}
                    onClick={() => chatFileInputRef.current?.click()}
                  >
                    <input type="file" ref={chatFileInputRef} style={{ display: 'none' }} multiple accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
                      onChange={(e) => { if (e.target.files?.length > 0) setSelectedFiles(prev => [...prev, ...Array.from(e.target.files)]); }} />
                    <div className="doc-modal-dropzone-icon">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                      </svg>
                    </div>
                    <p className="doc-modal-dropzone-text">Drop files here or click to upload</p>
                  </div>

                  {/* Web Page URL Upload in Modal */}
                  <div className="doc-modal-url-section" style={{ borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <h4 style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)', margin: 0 }}>
                      🔗 Add Web Page URL
                    </h4>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input 
                        type="url" 
                        placeholder="https://example.com/article" 
                        value={uploadUrl} 
                        onChange={(e) => setUploadUrl(e.target.value)}
                        className="form-input" 
                        style={{ flex: 1, height: 38, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)', fontSize: '0.88rem' }}
                      />
                      <button 
                        type="button" 
                        className="btn btn-primary" 
                        onClick={() => handleUrlUpload(chatUploadNotebookId)}
                        disabled={loading}
                        style={{ padding: '0 16px', height: 38, fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {loading ? <div className="spinner" style={{ width: 14, height: 14 }}></div> : 'Add URL'}
                      </button>
                    </div>
                  </div>

                  {/* File Grid — staged + indexed */}
                  {(selectedFiles.length > 0 || documents.length > 0) && (
                    <div className="doc-modal-file-grid">
                      {/* Staged (new) files */}
                      {selectedFiles.map((file, i) => {
                        const ext = file.name.split('.').pop().toUpperCase();
                        const size = file.size < 1024 * 1024
                          ? `${(file.size / 1024).toFixed(0)} KB`
                          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
                        return (
                          <div key={`staged-${i}`} className="doc-modal-file-card new">
                            <span className={`doc-modal-file-icon ext-${ext.toLowerCase()}`}>{ext}</span>
                            <div className="doc-modal-file-info">
                              <span className="doc-modal-file-name" title={file.name}>{file.name}</span>
                              <span className="doc-modal-file-size">{size}</span>
                            </div>
                            <button className="doc-modal-file-delete" onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))} title="Remove">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                      {/* Already indexed documents */}
                      {documents.map(doc => {
                        const ext = (doc.display_name || doc.filename || '').split('.').pop().toUpperCase();
                        return (
                          <div key={doc.id} className="doc-modal-file-card indexed">
                            <span className={`doc-modal-file-icon ext-${ext.toLowerCase()}`}>{ext}</span>
                            <div className="doc-modal-file-info">
                              <span className="doc-modal-file-name" title={doc.display_name}>{doc.display_name}</span>
                              <span className="doc-modal-file-size doc-modal-indexed-tag">Indexed ✓</span>
                            </div>
                            <button className="doc-modal-file-delete" onClick={() => handleDeleteDocument(doc.id, doc.filename)} title="Remove">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Upload success metrics */}
                  {uploadMetrics && (
                    <div className="doc-modal-metrics fade-in">
                      ✅ Indexed {uploadMetrics.documents_processed} chunks in {uploadMetrics.index_building_time.toFixed(1)}s
                      <button className="badge-close" onClick={() => setUploadMetrics(null)}>×</button>
                    </div>
                  )}

                  {/* Process Button */}
                  {selectedFiles.length > 0 && (
                    <button
                      className="doc-modal-process-btn"
                      onClick={() => { handleFileUpload(selectedFiles, chatUploadNotebookId); }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                      </svg>
                      Process {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Row: Chat Area */}
            <div className="chat-area">
              {/* Chat Thread */}
              <div className="chat-history glass-card">
                {chatHistory.length === 0 ? (
                  <div className="chat-empty-state">
                    {/* Decorative sparkles */}
                    <div className="chat-empty-sparkles">
                      <span className="sparkle sparkle-1">✦</span>
                      <span className="sparkle sparkle-2">✦</span>
                      <span className="sparkle sparkle-3">✦</span>
                      <span className="sparkle sparkle-4">✦</span>
                    </div>

                    {/* Main icon with halo */}
                    <div className="chat-empty-icon-wrapper">
                      <div className="chat-empty-halo" />
                      <div className="chat-empty-icon-bubble">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24">
                          <path fillRule="evenodd" d="M4.804 21.644A6.707 6.707 0 0 0 6 21.75a6.721 6.721 0 0 0 3.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 0 1-.814 1.686.75.75 0 0 0 .44 1.223ZM8.25 10.875a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25ZM10.875 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875-1.125a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>

                    <h2 className="chat-empty-heading">How can I help you today?</h2>
                    <p className="chat-empty-hint">
                      Search across your documents with AI reasoning<br/>or go beyond with live web results.
                    </p>
                  </div>
                ) : (
                  chatHistory.map((msg, idx) => (
                    <div key={idx} className={`chat-message-bubble ${msg.role}`} style={{ maxWidth: '85%' }}>
                      <div>
                        {typeof msg.content === 'object' ? (
                          <div>
                            <MarkdownRenderer content={msg.content.answer} />

                            {msg.content.critique_logs && msg.content.critique_logs.length > 0 && (
                              <div className="self-refined-badge">
                                <span className="self-refined-badge-icon">✨</span>
                                Self-Refined · {msg.content.critique_logs.length} iteration{msg.content.critique_logs.length > 1 ? 's' : ''}
                              </div>
                            )}
                            
                            {msg.content.mode && (
                              <div className="chat-message-meta" style={{ marginTop: 8 }}>
                                <span>⚡ Mode: {msg.content.mode}</span>
                                {msg.content.query_time && <span>⏱ Time: {msg.content.query_time.toFixed(2)}s</span>}
                              </div>
                            )}

                            {msg.content.critique_logs && msg.content.critique_logs.length > 0 && (
                              <details style={{ marginTop: 10, fontSize: '0.82rem', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 12px', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                                <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                  🔄 View Self-Critique Loop ({msg.content.critique_logs.length} Iterations)
                                </summary>
                                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  {msg.content.critique_logs.map((log, lIdx) => (
                                    <div key={lIdx} style={{ borderBottom: lIdx < msg.content.critique_logs.length - 1 ? '1px solid var(--border-color)' : 'none', paddingBottom: 8 }}>
                                      <div style={{ fontWeight: 800, color: log.status === 'PASS' ? '#10b981' : '#f59e0b', display: 'flex', gap: 8 }}>
                                        <span>Iteration {log.iteration}: {log.status}</span>
                                        <span>•</span>
                                        <span>Score: {log.score}/5</span>
                                      </div>
                                      <div style={{ margin: '4px 0', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                        <strong>Critique:</strong> {log.critique}
                                      </div>
                                      <details style={{ marginTop: 4 }}>
                                        <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>Show Draft Answer</summary>
                                        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.75rem', marginTop: 4, padding: 8, backgroundColor: 'rgba(0,0,0,0.03)', border: '1px solid var(--border-color)', borderRadius: 4, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                          {log.draft}
                                        </pre>
                                      </details>
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}

                            {msg.content.sources && msg.content.sources.length > 0 && (
                              <div className="chat-sources-expander">
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: '4px 8px', fontSize: '0.75rem', marginTop: 4 }}
                                  onClick={() => setActiveSources(msg.content.sources)}
                                >
                                  📄 View {msg.content.sources.length} Retrieved References
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <MarkdownRenderer content={msg.content} />
                        )}
                      </div>
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="chat-message-bubble assistant">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="spinner" style={{ width: 18, height: 18 }}></div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Analyzing embeddings context...</span>
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef}></div>
              </div>

              {/* Chat Input */}
              <form onSubmit={handleChatSubmit} className="chat-input-bar">
                <input
                  type="text"
                  className="chat-text-input"
                  placeholder="Ask a question about document chunks..."
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  disabled={chatLoading}
                />
                <button 
                  type="button" 
                  onClick={handleVoiceInput}
                  className={`chat-icon-btn ${isRecording ? 'active' : ''}`}
                  title="Voice dictation input"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 22, height: 22 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                  </svg>
                </button>
                <button type="submit" className="chat-icon-btn" style={{ color: 'var(--primary)' }} disabled={chatLoading}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 22, height: 22 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                  </svg>
                </button>
              </form>
            </div>

            {/* Citations Overlay Drawer */}
            {activeSources && (
              <aside className="sources-sidebar glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                  <h3 style={{ fontWeight: 800 }}>Sources Citations</h3>
                  <button className="btn btn-secondary" style={{ padding: '2px 8px' }} onClick={() => setActiveSources(null)}>Close</button>
                </div>
                {activeSources.map((src, i) => (
                  <div key={i} className="glass-card" style={{ padding: 14, fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>
                      {src.file_type === 'web' ? '🌐 ' : '📄 '} Source {i + 1}: {src.source}
                    </div>
                    <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }}>
                      "{src.content}"
                    </div>
                  </div>
                ))}
              </aside>
            )}
          </div>
        )}

        {/* VIEW 2: NOTEBOOKS LIST GRID */}
        {page === 'notebooks' && (
          <div className="scrollable-page fade-in">
            <div className="page-header">
              <div>
                <h1 className="page-title"><span className="page-title-gradient">Notebook Collections</span></h1>
                <p className="page-subtitle">Group documents into notebooks and run isolated AI search configurations</p>
              </div>
              <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
                ➕ Create Notebook
              </button>
            </div>

            {/* Filtering options */}
            <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 28, marginBottom: 28, padding: '12px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label className="form-label" style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Sort Directory:</label>
                <select className="form-input" style={{ width: 180 }} value={searchSort} onChange={(e) => setSearchSort(e.target.value)}>
                  <option>Last accessed</option>
                  <option>Name</option>
                  <option>Created date</option>
                  <option>Document count</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label className="form-label" style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>View Filter:</label>
                <select className="form-input" style={{ width: 180 }} value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)}>
                  <option>All notebooks</option>
                  <option>Favorites only</option>
                  <option>Recently used</option>
                </select>
              </div>
            </div>

            {getSortedNotebooks().length === 0 ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '4rem', marginBottom: 16 }}>📚</div>
                <h2>No Notebooks Found</h2>
                <p style={{ marginTop: 8 }}>Create your first collection to upload files and start building document intelligence indices.</p>
              </div>
            ) : (
              <div className="notebook-grid">
                {getSortedNotebooks().map(nb => (
                  <div 
                    key={nb.id} 
                    className="glass-card glass-card-hover notebook-card-border" 
                    style={{ borderLeftColor: nb.color || '#1E88E5', cursor: 'pointer' }}
                    onClick={() => openNotebook(nb)}
                  >
                    <div className="notebook-header">
                      <h3 className="notebook-title">{nb.name}</h3>
                      <button 
                        className={`notebook-fav-btn ${nb.is_favorite ? 'active' : ''}`}
                        onClick={(e) => handleFavoriteNotebook(nb.id, e)}
                      >
                        ★
                      </button>
                    </div>

                    <p className="notebook-desc">{nb.description || 'No notebook description added yet.'}</p>
                    
                    <div className="notebook-meta">
                      <span>📂 Files: {nb.document_count || 0} uploaded</span>
                      <span>⏱ Chunks: {nb.rag_document_count || 0} vectorized</span>
                    </div>

                    <div className="notebook-footer">
                      <button className="btn btn-secondary" style={{ flex: 1, padding: '6px 12px', fontSize: '0.82rem' }}>
                        View Folders
                      </button>
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                        onClick={(e) => handleDeleteNotebook(nb.id, nb.name, e)}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: NOTEBOOK DETAIL PAGE */}
        {page === 'notebook_detail' && currentNotebook && (
          <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, padding: '24px 32px' }}>
            {/* Header toolbar */}
            <div className="page-header" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button className="btn btn-secondary" style={{ padding: '8px 14px' }} onClick={() => setPage('notebooks')}>
                  ← Back
                </button>
                <div>
                  <h1 className="page-title" style={{ fontSize: '1.85rem' }}>
                    📓 {currentNotebook.name}
                  </h1>
                  {currentNotebook.description && <p className="page-subtitle">{currentNotebook.description}</p>}
                </div>
              </div>
              <button 
                className={`notebook-fav-btn ${currentNotebook.is_favorite ? 'active' : ''}`} 
                style={{ fontSize: '2rem' }}
                onClick={(e) => handleFavoriteNotebook(currentNotebook.id, e)}
              >
                ★
              </button>
            </div>

            {/* Inner navigation tabs */}
            <div className="tabs-header">
              <button 
                className={`tab-button ${notebookTab === 'documents' ? 'active' : ''}`}
                onClick={() => setNotebookTab('documents')}
              >
                📚 Document Storage ({documents.length})
              </button>
              <button 
                className={`tab-button ${notebookTab === 'chat' ? 'active' : ''}`}
                onClick={() => {
                  setNotebookTab('chat');
                  const scope = currentNotebook.id;
                  const savedActive = activeChatByScope[scope];
                  const conv = savedActive ? conversations.find(c => c.id === savedActive) : null;
                  if (conv) {
                    setActiveConversationId(savedActive);
                    setChatHistory(conv.messages);
                    setChatMode(conv.mode || 'deep_search');
                  } else {
                    setActiveConversationId(null);
                    setChatHistory([]);
                    setChatMode('deep_search');
                  }
                }}
              >
                💬 Sandbox Chat QA
              </button>
              <button 
                className={`tab-button ${notebookTab === 'analytics' ? 'active' : ''}`}
                onClick={() => {
                  setNotebookTab('analytics');
                  loadAnalytics();
                }}
              >
                📊 Analytics Dashboard
              </button>
            </div>

            {/* Tab panel: DOCUMENTS UPLOAD & DIRECTORY */}
            {notebookTab === 'documents' && (
              <div className="fade-in" style={{ flex: 1, overflowY: 'auto', paddingRight: 4, marginTop: 12 }}>
                {/* File Dropzone */}
                <div 
                  className={`dropzone ${dragOver ? 'active' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      setSelectedFiles(Array.from(e.dataTransfer.files));
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="dropzone-icon">📤</div>
                  <h3>Drag & Drop Files here</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 4 }}>
                    Supports PDF, DOCX, TXT, and Images (PNG, JPG, JPEG). Custom embedding vectors build on local CPU.
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    multiple
                    accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setSelectedFiles(Array.from(e.target.files));
                      }
                    }}
                  />
                </div>

                <div className="glass-card" style={{ padding: 20, marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: selectedFiles.length > 0 ? 20 : 0 }}>
                    <input 
                      type="checkbox" 
                      id="checkRag" 
                      checked={useRag} 
                      onChange={(e) => setUseRag(e.target.checked)} 
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <label htmlFor="checkRag" style={{ fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', userSelect: 'none' }}>
                      Process embedding chunking with RAG
                    </label>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 16 }} className="fade-in">
                      <h4 style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.95rem' }}>Selected Files ({selectedFiles.length}):</h4>
                      <ul style={{ listStyle: 'none', margin: '0 0 16px 0', padding: 0 }}>
                        {selectedFiles.map((f, i) => (
                          <li key={i} style={{ fontSize: '0.85rem', marginBottom: 4, display: 'flex', gap: 8, color: 'var(--text-secondary)' }}>
                            <span>📄</span>
                            <span style={{ fontWeight: 600 }}>{f.name}</span>
                            <span style={{ opacity: 0.7 }}>({formatSize(f.size)})</span>
                          </li>
                        ))}
                      </ul>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button 
                          type="button" 
                          className="btn btn-primary"
                          onClick={() => handleFileUpload(selectedFiles, currentNotebook.id)}
                        >
                          Upload & Process Files
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-secondary"
                          onClick={() => setSelectedFiles([])}
                        >
                          Clear Selection
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="glass-card" style={{ padding: 20, marginBottom: 28 }}>
                  <h4 style={{ fontWeight: 700, marginBottom: 12, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' }}>
                    🔗 Add Web Page URL
                  </h4>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input 
                      type="url" 
                      placeholder="https://example.com/article" 
                      value={uploadUrl} 
                      onChange={(e) => setUploadUrl(e.target.value)}
                      className="form-input" 
                      style={{ flex: 1, height: 42, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-primary)' }}
                    />
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={() => handleUrlUpload(currentNotebook.id)}
                      disabled={loading}
                      style={{ padding: '0 20px', height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {loading ? <div className="spinner" style={{ width: 16, height: 16 }}></div> : 'Add URL'}
                    </button>
                  </div>
                </div>

                {/* Directory List */}
                <h3 style={{ marginBottom: 16 }}>Uploaded Documents</h3>
                <div className="glass-card" style={{ padding: 0 }}>
                  {documents.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                      No documents stored. Drop a file above to add it.
                    </div>
                  ) : (
                    documents.map(doc => (
                      <div key={doc.id} className="document-item">
                        <div className="document-info">
                          <span className="document-icon">
                            {doc.file_type === 'pdf' ? '📕' : doc.file_type === 'txt' ? '📄' : ['png', 'jpg', 'jpeg'].includes(doc.file_type.toLowerCase()) ? '🖼️' : '📘'}
                          </span>
                          <div>
                            <span className="document-name">{doc.display_name}</span>
                            <div className="document-date">Uploaded: {new Date(doc.upload_date).toLocaleDateString()}</div>
                          </div>
                        </div>
                        <div className="document-actions">
                          <button onClick={() => handleViewDocument(doc)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
                            📄 View File
                          </button>
                          <button onClick={() => handleDeleteDocument(doc.id, doc.filename)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem', color: '#ef4444' }}>
                            🗑 Remove
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab panel: LOCAL QA CHAT */}
            {notebookTab === 'chat' && (
              <div className="chat-page-container fade-in" style={{ height: 'auto', flex: 1, minHeight: 0, padding: 0 }}>
                <div className="chat-area">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                    <h3 style={{ margin: 0, fontWeight: 800 }}>Notebook Sandbox</h3>

                    {/* Compact Mode Picker in the header */}
                    <div className="rag-mode-picker rag-mode-picker-compact">
                      <button
                        type="button"
                        onClick={() => setChatMode('deep_search')}
                        className={`rag-mode-btn ${chatMode === 'deep_search' ? 'active' : ''}`}
                      >
                        <span className="rag-mode-btn-icon">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 1-6.23-.693L4 14.5m15.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L4 14.5" />
                          </svg>
                        </span>
                        <span className="rag-mode-btn-text">
                          <span className="rag-mode-btn-title">Deep Search</span>
                          <span className="rag-mode-btn-sub">Document search with self-critique</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setChatMode('hybrid')}
                        className={`rag-mode-btn ${chatMode === 'hybrid' ? 'active' : ''}`}
                      >
                        <span className="rag-mode-btn-icon">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                          </svg>
                        </span>
                        <span className="rag-mode-btn-text">
                          <span className="rag-mode-btn-title">Hybrid Search</span>
                          <span className="rag-mode-btn-sub">Search documents and the web</span>
                        </span>
                      </button>
                    </div>

                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}
                      onClick={() => {
                        setActiveConversationId(null);
                        setChatHistory([]);
                        setActiveChatByScope(prev => ({ ...prev, [currentNotebook.id]: null }));
                      }}
                    >
                      <span>➕</span> New Sandbox Chat
                    </button>
                  </div>

                  {/* Chat logs */}
                  <div className="chat-history glass-card">
                    {chatHistory.length === 0 ? (
                      <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '2.5rem' }}>💬</div>
                        <h3 style={{ marginTop: 8 }}>Notebook Sandbox</h3>
                        <p style={{ fontSize: '0.85rem' }}>Queries submitted here retrieve answers scoped exclusively to this collection.</p>
                      </div>
                    ) : (
                      chatHistory.map((msg, i) => (
                        <div key={i} className={`chat-message-bubble ${msg.role}`}>
                          <div>
                            {typeof msg.content === 'object' ? (
                              <div>
                                <MarkdownRenderer content={msg.content.answer} />

                                {msg.content.critique_logs && msg.content.critique_logs.length > 0 && (
                                  <div className="self-refined-badge">
                                    <span className="self-refined-badge-icon">✨</span>
                                    Self-Refined · {msg.content.critique_logs.length} iteration{msg.content.critique_logs.length > 1 ? 's' : ''}
                                  </div>
                                )}
                                
                                {msg.content.mode && (
                                  <div className="chat-message-meta" style={{ marginTop: 8 }}>
                                    <span>⚡ Mode: {msg.content.mode}</span>
                                    {msg.content.query_time && <span>⏱ Response time: {msg.content.query_time.toFixed(2)}s</span>}
                                  </div>
                                )}

                                {msg.content.critique_logs && msg.content.critique_logs.length > 0 && (
                                  <details style={{ marginTop: 10, fontSize: '0.82rem', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 12px', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
                                    <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                      🔄 View Self-Critique Loop ({msg.content.critique_logs.length} Iterations)
                                    </summary>
                                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                      {msg.content.critique_logs.map((log, lIdx) => (
                                        <div key={lIdx} style={{ borderBottom: lIdx < msg.content.critique_logs.length - 1 ? '1px solid var(--border-color)' : 'none', paddingBottom: 8 }}>
                                          <div style={{ fontWeight: 800, color: log.status === 'PASS' ? '#10b981' : '#f59e0b', display: 'flex', gap: 8 }}>
                                            <span>Iteration {log.iteration}: {log.status}</span>
                                            <span>•</span>
                                            <span>Score: {log.score}/5</span>
                                          </div>
                                          <div style={{ margin: '4px 0', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                            <strong>Critique:</strong> {log.critique}
                                          </div>
                                          <details style={{ marginTop: 4 }}>
                                            <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>Show Draft Answer</summary>
                                            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.75rem', marginTop: 4, padding: 8, backgroundColor: 'rgba(0,0,0,0.03)', border: '1px solid var(--border-color)', borderRadius: 4, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                              {log.draft}
                                            </pre>
                                          </details>
                                        </div>
                                      ))}
                                    </div>
                                  </details>
                                )}

                                {msg.content.sources && msg.content.sources.length > 0 && (
                                  <div className="chat-sources-expander">
                                    <button 
                                      className="btn btn-secondary" 
                                      style={{ padding: '4px 8px', fontSize: '0.75rem', marginTop: 4 }}
                                      onClick={() => setActiveSources(msg.content.sources)}
                                    >
                                      📄 View Citations
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <MarkdownRenderer content={msg.content} />
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    {chatLoading && (
                      <div className="chat-message-bubble assistant">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div className="spinner" style={{ width: 18, height: 18 }}></div>
                          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Retrieving scoped chunks context...</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatBottomRef}></div>
                  </div>

                  {/* Chat input */}
                  <form onSubmit={handleChatSubmit} className="chat-input-bar">
                    <input
                      type="text"
                      className="chat-text-input"
                      placeholder={`Ask a question about ${currentNotebook.name}...`}
                      value={chatQuery}
                      onChange={(e) => setChatQuery(e.target.value)}
                      disabled={chatLoading}
                    />
                    <button 
                      type="button" 
                      onClick={handleVoiceInput}
                      className={`chat-icon-btn ${isRecording ? 'active' : ''}`}
                      title="Voice dictation input"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 22, height: 22 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                      </svg>
                    </button>
                    <button type="submit" className="chat-icon-btn" style={{ color: 'var(--primary)' }} disabled={chatLoading}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 22, height: 22 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                      </svg>
                    </button>
                  </form>
                </div>

                {/* Scoped Chat Citations drawer */}
                {activeSources && (
                  <aside className="sources-sidebar glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
                      <h3 style={{ fontWeight: 800 }}>References</h3>
                      <button className="btn btn-secondary" style={{ padding: '2px 8px' }} onClick={() => setActiveSources(null)}>Close</button>
                    </div>
                    {activeSources.map((src, i) => (
                      <div key={i} className="glass-card" style={{ padding: 14, fontSize: '0.85rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 6 }}>
                          Source {i + 1}: {src.source}
                        </div>
                        <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }}>
                          "{src.content}"
                        </div>
                      </div>
                    ))}
                  </aside>
                )}
              </div>
            )}

            {/* Tab panel: NOTEBOOK ANALYTICS */}
            {notebookTab === 'analytics' && analytics && (
              <div className="fade-in" style={{ flex: 1, overflowY: 'auto', paddingRight: 4, marginTop: 12 }}>
                {/* Metric grid */}
                <div className="stats-row">
                  {(() => {
                    const nbStat = analytics.notebook_stats?.find(s => s.id === currentNotebook.id) || {};
                    const queriesCount = analytics.recent_queries?.filter(q => q.notebook_id === currentNotebook.id).length || 0;
                    const queryTimes = analytics.recent_queries?.filter(q => q.notebook_id === currentNotebook.id).map(q => q.response_time) || [];
                    const avgTime = queryTimes.length > 0 ? (queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length).toFixed(2) : '0';
                    return (
                      <>
                        <div className="glass-card">
                          <span className="stat-label">Total Documents</span>
                          <div className="stat-value">{nbStat.document_count || 0}</div>
                        </div>
                        <div className="glass-card">
                          <span className="stat-label">Vectorized RAG Chunks</span>
                          <div className="stat-value">{nbStat.rag_document_count || 0}</div>
                        </div>
                        <div className="glass-card">
                          <span className="stat-label">Total Sandbox Queries</span>
                          <div className="stat-value">{queriesCount}</div>
                        </div>
                        <div className="glass-card">
                          <span className="stat-label">Avg. Response Time</span>
                          <div className="stat-value">{avgTime}s</div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* SVG Visual dashboard logs */}
                <div className="glass-card" style={{ marginBottom: 28 }}>
                  <h3 style={{ marginBottom: 16 }}>Recent Sandbox Queries</h3>
                  {(() => {
                    const localQueries = analytics.recent_queries?.filter(q => q.notebook_id === currentNotebook.id) || [];
                    if (localQueries.length === 0) {
                      return <p style={{ color: 'var(--text-muted)' }}>No query activity logged inside this sandbox.</p>;
                    }
                    return (
                      <div>
                        {localQueries.map((q, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <div>
                              <strong style={{ display: 'block', fontSize: '0.95rem' }}>{q.query}</strong>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {new Date(q.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <div style={{ fontWeight: 600, color: 'var(--primary)' }}>
                              {q.response_time.toFixed(2)}s
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: SYSTEM SETTINGS & ACCOUNT SECURITY */}
        {page === 'settings' && (
          <div className="scrollable-page fade-in">
            <div className="page-header" style={{ marginBottom: 24 }}>
              <div>
                <h1 className="page-title"><span className="page-title-gradient">Account Settings</span></h1>
                <p className="page-subtitle">Manage system preferences, account profile details, and update security credentials</p>
              </div>
            </div>

            {/* Sub-panels inside layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* User Profile Card */}
                {user && (
                  <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: 24 }}>
                    <div style={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--primary), var(--primary-dark, #4F46E5))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: '#fff',
                      boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                    }}>
                      {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{user.name}</h3>
                      <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{user.email}</p>
                    </div>
                  </div>
                )}

                {/* Preferences Settings */}
                <div className="glass-card">
                  <h3 style={{ marginBottom: 20, fontSize: '1.1rem', fontWeight: 700 }}>System Preferences</h3>
                  <div className="form-group">
                    <label className="form-label">Theme Color State</label>
                    <select className="form-input" value={theme} onChange={(e) => {
                      setTheme(e.target.value);
                      localStorage.setItem('theme', e.target.value);
                      document.documentElement.setAttribute('data-theme', e.target.value);
                    }}>
                      <option value="light">Light Mode Theme</option>
                      <option value="dark">Dark Slate Theme</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Default Landing View</label>
                    <select className="form-input" value={prefDefaultPage} onChange={(e) => setPrefDefaultPage(e.target.value)}>
                      <option>Chat</option>
                      <option>Notebooks</option>
                      <option>Settings</option>
                    </select>
                  </div>
                  <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => showToast('Preferences updated successfully!')}>
                    Save Preferences
                  </button>
                </div>

                {/* Danger Zone: Delete Account */}
                <div className="glass-card" style={{ border: '1px solid rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.02)' }}>
                  <h3 style={{ marginBottom: 12, fontSize: '1.1rem', fontWeight: 700, color: '#ef4444' }}>Danger Zone</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16, lineHeight: '1.45' }}>
                    Permanently delete your account and all associated notebooks, document files, and indices. This action is irreversible.
                  </p>
                  <button className="btn" style={{ width: '100%', backgroundColor: '#ef4444', color: '#fff', border: 'none', fontWeight: 600 }} onClick={handleDeleteAccount}>
                    Delete Account
                  </button>
                </div>
              </div>

              {/* Account Security Change Password */}
              <div>
                <div className="glass-card">
                  <h3 style={{ marginBottom: 20, fontSize: '1.1rem', fontWeight: 700 }}>Account Security</h3>
                  <form onSubmit={handleChangePassword}>
                    <div className="form-group">
                      <label className="form-label">Old Password</label>
                      <input 
                        type="password" 
                        className="form-input" 
                        placeholder="Enter your current password"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">New Password</label>
                      <input 
                        type="password" 
                        className="form-input" 
                        placeholder="Min 8 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Confirm New Password</label>
                      <input 
                        type="password" 
                        className="form-input" 
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}>
                      Update Password
                    </button>
                  </form>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* CREATE NOTEBOOK MODAL OVERLAY */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content fade-in">
            <h2 className="modal-title">Create New Notebook</h2>
            <form onSubmit={handleCreateNotebook}>
              <div className="form-group">
                <label className="form-label">Notebook Folder Title</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="E.g., Deep Learning Papers, Code Snippets..."
                  value={newNbName}
                  onChange={(e) => setNewNbName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Short Description</label>
                <textarea 
                  className="form-input" 
                  placeholder="What is this collection of documents for?"
                  value={newNbDesc}
                  onChange={(e) => setNewNbDesc(e.target.value)}
                  rows="3"
                ></textarea>
              </div>

              {/* Color selectors */}
              <div className="form-group">
                <label className="form-label">Tab Color Accent</label>
                <div style={{ display: 'flex', gap: 12 }}>
                  {['#1E88E5', '#4CAF50', '#9C27B0', '#FF9800', '#F44336', '#009688', '#E91E63'].map(color => (
                    <div 
                      key={color}
                      className={`color-option ${newNbColor === color ? 'selected' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setNewNbColor(color)}
                    ></div>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GLOBAL FULLSCREEN DOCUMENT VIEWER POPUP */}
      {viewingDocument && viewingDocData && (
        <div className="document-viewer-overlay">
          <header className="doc-viewer-header">
            <div className="doc-viewer-title-row">
              <span style={{ fontSize: '2rem' }}>
                {viewingDocument.file_type === 'pdf' ? '📕' : viewingDocument.file_type === 'txt' ? '📄' : ['png', 'jpg', 'jpeg'].includes(viewingDocument.file_type.toLowerCase()) ? '🖼️' : '📘'}
              </span>
              <div>
                <h2 className="doc-viewer-title">{viewingDocument.display_name}</h2>
                <div className="doc-viewer-meta">Format: {viewingDocument.file_type.toUpperCase()} • Added {new Date(viewingDocument.upload_date).toLocaleDateString()}</div>
              </div>
            </div>
            <button className="btn btn-secondary" onClick={() => { setViewingDocument(null); setViewingDocData(null); }}>
              Close Viewer
            </button>
          </header>

          <div className="doc-viewer-content">
            {/* Conditional viewer based on file-type */}
            {['png', 'jpg', 'jpeg'].includes(viewingDocument.file_type.toLowerCase()) ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', width: '100%', overflow: 'auto', padding: 20 }}>
                <img 
                  src={`${API_BASE}/documents/${viewingDocument.id}/view?token=${sessionStorage.getItem('session_token')}`} 
                  alt={viewingDocument.display_name} 
                  style={{ maxHeight: '80vh', maxWidth: '100%', objectFit: 'contain', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} 
                />
              </div>
            ) : viewingDocument.file_type === 'pdf' ? (
              // PDF embed stream (calls viewing download endpoint directly)
              <iframe 
                className="pdf-iframe" 
                src={`${API_BASE}/documents/${viewingDocument.id}/view?token=${sessionStorage.getItem('session_token')}`}
                title={viewingDocument.display_name}
              ></iframe>
            ) : viewingDocument.file_type === 'txt' ? (
              // Monaco-style text container
              <pre className="text-viewer-pre">{viewingDocData.text}</pre>
            ) : (
              // Word (docx) parsed rendering
              <article className="doc-viewer-paper">
                {viewingDocData.paragraphs && viewingDocData.paragraphs.map((p, idx) => {
                  if (p.is_heading) {
                    const Tag = `h${Math.min(p.heading_level, 4)}`;
                    return <Tag key={idx} style={{ marginTop: 24, marginBottom: 8, color: 'var(--primary)' }}>{p.text}</Tag>;
                  }
                  return <p key={idx}>{p.text}</p>;
                })}
                
                {viewingDocData.tables && viewingDocData.tables.map((table, tIdx) => (
                  <div key={tIdx} style={{ overflowX: 'auto' }}>
                    <table className="doc-table">
                      <tbody>
                        {table.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {row.map((cell, cIdx) => {
                              if (rIdx === 0) {
                                return <th key={cIdx} style={{ backgroundColor: '#f1f5f9', fontWeight: 600 }}>{cell}</th>;
                              }
                              return <td key={cIdx}>{cell}</td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </article>
            )}
          </div>
        </div>
      )}

      {/* Global Alert Notification */}
      {toast && (
        <div className={`toast-box ${toast.type}`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Full layout Spinner */}
      {loading && (
        <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.3)', zIndex: 4000 }}>
          <div className="spinner" style={{ width: 44, height: 44 }}></div>
        </div>
      )}
    </div>
  );
}
