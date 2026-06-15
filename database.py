import os
import streamlit as st
from streamlit.runtime import exists as _st_exists

class SafeStreamlitMock:
    def __init__(self, original_st):
        self._st = original_st
    def __getattr__(self, name):
        if _st_exists():
            return getattr(self._st, name)
        if name in ['info', 'success', 'warning', 'error', 'write', 'markdown', 'title', 'header', 'subheader', 'caption']:
            return lambda msg, *args, **kwargs: print(f"[{name.upper()}] {msg}")
        elif name == 'toast':
            return lambda msg, *args, **kwargs: print(f"[TOAST] {msg}")
        elif name == 'sidebar':
            return SafeStreamlitMock(getattr(self._st, 'sidebar') if self._st else None)
        return lambda *args, **kwargs: None

st = SafeStreamlitMock(st)
import bcrypt
from datetime import datetime, timedelta
import uuid
from dotenv import load_dotenv

load_dotenv()

class SupabaseDB:
    def __init__(self, url=None, key=None):
        """Initialize Supabase connection."""
        self.url = url or os.environ.get("SUPABASE_URL")
        self.key = key or os.environ.get("SUPABASE_KEY")
        
        # Safe fallback if connection_string is passed legacy-style
        if url and not url.startswith("http"):
            self.url = os.environ.get("SUPABASE_URL")
            
        self.client = None
        self.connect()
    
    def connect(self):
        """Establish connection to Supabase."""
        try:
            from supabase import create_client, Client
            if not self.url or not self.key:
                st.sidebar.error("Supabase URL or Key not set in environment.")
                self.client = None
                return
            
            self.client: Client = create_client(self.url, self.key)
            st.sidebar.success("Connected to Supabase")
        except Exception as e:
            st.sidebar.error(f"Supabase Connection Error: {str(e)}")
            self.client = None
    
    def create_user(self, email, password, name):
        """Create a new user with hashed password in PostgreSQL."""
        if self.client is None:
            return False, "Database connection not established"
        
        try:
            # Check if user already exists
            res = self.client.table("users").select("*").eq("email", email).execute()
            if res.data:
                return False, "User with this email already exists"
            
            # Hash password
            salt = bcrypt.gensalt()
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
            
            user = {
                "email": email,
                "password": hashed_password,
                "name": name,
                "total_docs": 0,
                "total_pdfs": 0,
                "total_queries": 0,
                "rag_documents": 0
            }
            
            insert_res = self.client.table("users").insert(user).execute()
            if not insert_res.data:
                return False, "Failed to create user record"
                
            user_id = insert_res.data[0]["id"]
            return True, user_id
        except Exception as e:
            return False, str(e)
    
    def authenticate_user(self, email, password):
        """Authenticate user with email and password."""
        if self.client is None:
            return False, "Database connection not established"
        
        try:
            res = self.client.table("users").select("*").eq("email", email).execute()
            if not res.data:
                return False, "Invalid email or password"
            
            user = res.data[0]
            stored_password = user["password"].encode('utf-8')
            
            if bcrypt.checkpw(password.encode('utf-8'), stored_password):
                # Update last login
                self.client.table("users").update({"last_login": datetime.now().isoformat()}).eq("id", user["id"]).execute()
                
                session_id = str(uuid.uuid4())
                expiry = (datetime.now() + timedelta(days=1)).isoformat()
                
                self.client.table("sessions").insert({
                    "session_id": session_id,
                    "user_id": user["id"],
                    "expiry": expiry
                }).execute()
                
                return True, {
                    "user_id": str(user["id"]),
                    "name": user["name"],
                    "email": user["email"],
                    "session_id": session_id
                }
            else:
                return False, "Invalid email or password"
        except Exception as e:
            return False, str(e)
    
    def validate_session(self, session_id):
        """Validate an existing session."""
        if self.client is None:
            return False, "Database connection not established"
        
        try:
            # Query sessions joined with users
            res = self.client.table("sessions").select("*, users(*)").eq("session_id", session_id).execute()
            if not res.data:
                return False, "Session expired or invalid"
            
            session = res.data[0]
            expiry = datetime.fromisoformat(session["expiry"].replace("Z", "+00:00"))
            
            # Simple timezone-aware comparison
            if expiry < datetime.now(expiry.tzinfo):
                return False, "Session expired"
            
            user = session.get("users")
            if not user:
                return False, "User not found"
            
            return True, {
                "user_id": str(user["id"]),
                "name": user["name"],
                "email": user["email"]
            }
        except Exception as e:
            return False, str(e)
    
    def logout_user(self, session_id):
        """Invalidate a user session for logout."""
        if self.client is None:
            return False, "Database connection not established"
        
        try:
            self.client.table("sessions").delete().eq("session_id", session_id).execute()
            return True, "Logged out successfully"
        except Exception as e:
            return False, str(e)
            
    def change_password(self, user_id, old_password, new_password):
        """Change the user's password after validating the old password."""
        if self.client is None:
            return False, "Database connection not established"
        
        try:
            # Fetch user
            res = self.client.table("users").select("*").eq("id", user_id).execute()
            if not res.data:
                return False, "User not found"
            
            user = res.data[0]
            stored_password = user["password"].encode('utf-8')
            
            # Check old password
            if not bcrypt.checkpw(old_password.encode('utf-8'), stored_password):
                return False, "Incorrect old password"
            
            # Hash and update to new password
            salt = bcrypt.gensalt()
            hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), salt).decode('utf-8')
            
            update_res = self.client.table("users").update({"password": hashed_password}).eq("id", user_id).execute()
            if not update_res.data:
                return False, "Failed to update password"
                
            return True, "Password changed successfully"
        except Exception as e:
            return False, str(e)
            
    def delete_user_account(self, user_id):
        """Delete user account and all associated data, files, and indexes."""
        if self.client is None:
            return False, "Database connection not established"
            
        try:
            # 1. Fetch user notebooks
            nb_res = self.client.table("notebooks").select("id").eq("user_id", user_id).execute()
            if nb_res.data:
                for nb in nb_res.data:
                    self.delete_notebook(nb["id"], user_id)
            
            # 2. Delete any loose files in storage (in case any exist)
            # Fetch user documents
            docs_res = self.client.table("documents").select("storage_path").eq("user_id", user_id).execute()
            for doc in docs_res.data:
                try:
                    self.client.storage.from_("rag-documents").remove([doc["storage_path"]])
                except:
                    pass
            
            # 3. Clean up DB records (sessions, query logs, documents, faiss indexes, notebooks, users)
            self.client.table("sessions").delete().eq("user_id", user_id).execute()
            self.client.table("query_logs").delete().eq("user_id", user_id).execute()
            self.client.table("documents").delete().eq("user_id", user_id).execute()
            self.client.table("faiss_indexes").delete().eq("user_id", user_id).execute()
            self.client.table("notebooks").delete().eq("user_id", user_id).execute()
            
            # Finally delete the user record
            self.client.table("users").delete().eq("id", user_id).execute()
            
            return True, "Account deleted successfully"
        except Exception as e:
            return False, str(e)
    
    def save_document_file(self, file_data, filename, file_type, user_id, notebook_id=None, custom_name=None):
        """Save a document file to Supabase Storage and track metadata."""
        if self.client is None:
            st.error("Database connection not established")
            return False, "Database connection not established"
        
        try:
            display_name = custom_name if custom_name else filename
            nb_folder = str(notebook_id) if notebook_id else "unassigned"
            storage_path = f"{user_id}/{nb_folder}/{filename}"
            
            if not isinstance(file_data, bytes):
                if hasattr(file_data, 'read'):
                    file_data = file_data.read()
                else:
                    file_data = bytes(file_data)
            
            st.sidebar.info(f"Saving file to Storage: {storage_path} ({len(file_data)} bytes)")
            
            # Upload file bytes to Supabase Storage (use upsert to overwrite)
            self.client.storage.from_("rag-documents").upload(
                path=storage_path,
                file=file_data,
                file_options={"content-type": "application/octet-stream", "x-upsert": "true"}
            )
            
            # Check if document metadata already exists
            doc_check = self.client.table("documents").select("id").eq("user_id", user_id).eq("notebook_id", notebook_id).eq("filename", filename).execute()
            
            if doc_check.data:
                doc_id = doc_check.data[0]["id"]
            else:
                doc_data = {
                    "user_id": user_id,
                    "notebook_id": notebook_id,
                    "filename": filename,
                    "display_name": display_name,
                    "file_type": file_type,
                    "storage_path": storage_path
                }
                res = self.client.table("documents").insert(doc_data).execute()
                doc_id = res.data[0]["id"]
            
            # Update user docs stats
            user_res = self.client.table("users").select("total_docs, total_pdfs").eq("id", user_id).execute()
            if user_res.data:
                user_data = user_res.data[0]
                new_docs = (user_data.get("total_docs") or 0) + 1
                update_dict = {"total_docs": new_docs}
                if file_type == "pdf":
                    update_dict["total_pdfs"] = (user_data.get("total_pdfs") or 0) + 1
                self.client.table("users").update(update_dict).eq("id", user_id).execute()
            
            # Update notebook doc count
            if notebook_id:
                nb_res = self.client.table("notebooks").select("document_count").eq("id", notebook_id).execute()
                if nb_res.data:
                    new_count = (nb_res.data[0].get("document_count") or 0) + 1
                    self.client.table("notebooks").update({"document_count": new_count}).eq("id", notebook_id).execute()
            
            return True, str(doc_id)
        except Exception as e:
            st.error(f"Error saving file: {str(e)}")
            return False, str(e)
    
    def get_document_file(self, file_id):
        """Retrieve a document file from Supabase Storage."""
        if self.client is None:
            return False, "Database connection not established"
        
        try:
            res = self.client.table("documents").select("*").eq("id", file_id).execute()
            if not res.data:
                return False, "Document not found"
            
            doc = res.data[0]
            storage_path = doc["storage_path"]
            
            file_bytes = self.client.storage.from_("rag-documents").download(storage_path)
            
            return True, {
                "data": file_bytes,
                "filename": doc["filename"],
                "display_name": doc["display_name"],
                "file_type": doc["file_type"],
                "upload_date": datetime.fromisoformat(doc["upload_date"].replace("Z", "+00:00"))
            }
        except Exception as e:
            return False, str(e)
    
    def list_user_documents(self, user_id, notebook_id=None):
        """List all documents for a user from Postgres metadata."""
        if self.client is None:
            return False, "Database connection not established"
        
        try:
            query = self.client.table("documents").select("*").eq("user_id", user_id)
            if notebook_id:
                query = query.eq("notebook_id", notebook_id)
            
            res = query.order("upload_date", desc=True).execute()
            
            result = []
            for doc in res.data:
                result.append({
                    "file_id": str(doc["id"]),
                    "filename": doc["filename"],
                    "display_name": doc["display_name"],
                    "file_type": doc["file_type"],
                    "upload_date": datetime.fromisoformat(doc["upload_date"].replace("Z", "+00:00")),
                    "notebook_id": str(doc["notebook_id"]) if doc.get("notebook_id") else None
                })
            
            return True, result
        except Exception as e:
            st.error(f"Error listing documents: {str(e)}")
            return False, str(e)
    
    def delete_document(self, file_id, user_id):
        """Delete a document from storage and metadata."""
        if self.client is None:
            return False, "Database connection not established"
        
        try:
            res = self.client.table("documents").select("*").eq("id", file_id).execute()
            if not res.data:
                return False, "Document not found"
            
            doc = res.data[0]
            if str(doc["user_id"]) != str(user_id):
                return False, "You don't have permission to delete this document"
            
            storage_path = doc["storage_path"]
            notebook_id = doc.get("notebook_id")
            file_type = doc.get("file_type")
            
            # Delete from Supabase Storage
            try:
                self.client.storage.from_("rag-documents").remove([storage_path])
            except:
                pass
            
            # Delete from Table
            self.client.table("documents").delete().eq("id", file_id).execute()
            
            # Decrement user stats
            user_res = self.client.table("users").select("total_docs, total_pdfs").eq("id", user_id).execute()
            if user_res.data:
                user_data = user_res.data[0]
                new_docs = max(0, (user_data.get("total_docs") or 0) - 1)
                update_dict = {"total_docs": new_docs}
                if file_type == "pdf":
                    update_dict["total_pdfs"] = max(0, (user_data.get("total_pdfs") or 0) - 1)
                self.client.table("users").update(update_dict).eq("id", user_id).execute()
            
            # Decrement notebook document count
            if notebook_id:
                nb_res = self.client.table("notebooks").select("document_count").eq("id", notebook_id).execute()
                if nb_res.data:
                    new_count = max(0, (nb_res.data[0].get("document_count") or 0) - 1)
                    self.client.table("notebooks").update({"document_count": new_count}).eq("id", notebook_id).execute()
            
            return True, "Document deleted successfully"
        except Exception as e:
            st.error(f"Error deleting document: {str(e)}")
            return False, str(e)
            
    def create_notebook(self, user_id, name, description="", color="#1E88E5", metadata=None):
        """Create a new notebook in PostgreSQL."""
        if self.client is None:
            return False, "Database connection not established"
            
        try:
            notebook = {
                "user_id": user_id,
                "name": name,
                "description": description,
                "color": color,
                "domains": metadata.get("domains", ["General"]) if metadata else ["General"],
                "metadata": metadata or {}
            }
            
            res = self.client.table("notebooks").insert(notebook).execute()
            if not res.data:
                return False, "Failed to create notebook record"
                
            notebook_id = res.data[0]["id"]
            return True, notebook_id
        except Exception as e:
            return False, f"Error creating notebook: {str(e)}"
            
    def get_notebooks(self, user_id):
        """Get all notebooks for a user."""
        if self.client is None:
            return False, "Database connection not established"
            
        try:
            res = self.client.table("notebooks").select("*").eq("user_id", user_id).order("last_accessed", desc=True).execute()
            
            notebooks = []
            for nb in res.data:
                nb["_id"] = str(nb["id"])
                nb["user_id"] = str(nb["user_id"])
                nb["created_at"] = datetime.fromisoformat(nb["created_at"].replace("Z", "+00:00"))
                nb["last_accessed"] = datetime.fromisoformat(nb["last_accessed"].replace("Z", "+00:00"))
                notebooks.append(nb)
                
            return True, notebooks
        except Exception as e:
            return False, str(e)
            
    def get_notebook(self, notebook_id):
        """Get a specific notebook by ID."""
        if self.client is None:
            return False, "Database connection not established"
            
        try:
            res = self.client.table("notebooks").select("*").eq("id", notebook_id).execute()
            if not res.data:
                return False, "Notebook not found"
                
            notebook = res.data[0]
            # Update last accessed time
            self.client.table("notebooks").update({"last_accessed": datetime.now().isoformat()}).eq("id", notebook_id).execute()
            
            notebook["_id"] = str(notebook["id"])
            notebook["user_id"] = str(notebook["user_id"])
            notebook["created_at"] = datetime.fromisoformat(notebook["created_at"].replace("Z", "+00:00"))
            notebook["last_accessed"] = datetime.now()
            return True, notebook
        except Exception as e:
            return False, str(e)
            
    def update_notebook(self, notebook_id, data):
        """Update notebook properties."""
        if self.client is None:
            return False, "Database connection not established"
            
        try:
            update_data = {}
            for k, v in data.items():
                if k not in ["_id", "id", "user_id"]:
                    update_data[k] = v
                    
            res = self.client.table("notebooks").update(update_data).eq("id", notebook_id).execute()
            if not res.data:
                return False, "Notebook not found"
            return True, "Notebook updated successfully"
        except Exception as e:
            return False, str(e)
            
    def toggle_favorite_notebook(self, notebook_id):
        """Toggle favorite status for a notebook."""
        if self.client is None:
            return False, "Database connection not established"
            
        try:
            res = self.client.table("notebooks").select("is_favorite").eq("id", notebook_id).execute()
            if not res.data:
                return False, "Notebook not found"
                
            new_status = not res.data[0].get("is_favorite", False)
            self.client.table("notebooks").update({"is_favorite": new_status}).eq("id", notebook_id).execute()
            return True, new_status
        except Exception as e:
            return False, str(e)
            
    def delete_notebook(self, notebook_id, user_id):
        """Delete a notebook and clean up storage assets."""
        if self.client is None:
            return False, "Database connection not established"
            
        try:
            # Delete files inside the notebook in storage
            docs_res = self.client.table("documents").select("storage_path").eq("notebook_id", notebook_id).execute()
            for doc in docs_res.data:
                try:
                    self.client.storage.from_("rag-documents").remove([doc["storage_path"]])
                except:
                    pass
            
            # Delete FAISS indexes in storage
            idx_res = self.client.table("faiss_indexes").select("faiss_index_path, documents_path").eq("notebook_id", notebook_id).execute()
            for idx in idx_res.data:
                try:
                    self.client.storage.from_("faiss-indexes").remove([idx["faiss_index_path"]])
                    if idx.get("documents_path"):
                        self.client.storage.from_("faiss-indexes").remove([idx["documents_path"]])
                except:
                    pass
                    
            # Delete notebook metadata (Cascades deletes in PG db)
            res = self.client.table("notebooks").delete().eq("id", notebook_id).eq("user_id", user_id).execute()
            if not res.data:
                return False, "Notebook not found or not owned by user"
                
            return True, "Notebook deleted successfully"
        except Exception as e:
            return False, str(e)
            
    def save_document_metadata(self, user_id, document_info, notebook_id=None):
        """Save metadata about processed RAG documents."""
        if self.client is None:
            return False, "Database connection not established"
            
        try:
            info = {}
            for k, v in document_info.items():
                if isinstance(v, datetime):
                    info[k] = v.isoformat()
                else:
                    info[k] = v
                    
            self.client.table("rag_documents").insert({
                "user_id": user_id,
                "notebook_id": notebook_id,
                "metadata": info
            }).execute()
            
            doc_count = len(document_info.get("documents", []))
            
            # Update user stats
            user_res = self.client.table("users").select("rag_documents").eq("id", user_id).execute()
            if user_res.data:
                new_rag = (user_res.data[0].get("rag_documents") or 0) + doc_count
                self.client.table("users").update({"rag_documents": new_rag}).eq("id", user_id).execute()
                
            # Update notebook stats
            if notebook_id:
                nb_res = self.client.table("notebooks").select("rag_document_count").eq("id", notebook_id).execute()
                if nb_res.data:
                    new_count = (nb_res.data[0].get("rag_document_count") or 0) + doc_count
                    self.client.table("notebooks").update({"rag_document_count": new_count}).eq("id", notebook_id).execute()
                    
            return True, "Document metadata saved"
        except Exception as e:
            return False, str(e)
            
    def get_rag_document_history(self, user_id, notebook_id=None):
        """Get RAG document processing history."""
        if self.client is None:
            return False, "Database connection not established"
            
        try:
            query = self.client.table("rag_documents").select("*").eq("user_id", user_id)
            if notebook_id:
                query = query.eq("notebook_id", notebook_id)
                
            res = query.order("created_at", desc=True).execute()
            
            documents = []
            for doc in res.data:
                doc["_id"] = str(doc["id"])
                doc["user_id"] = str(doc["user_id"])
                if doc.get("notebook_id"):
                    doc["notebook_id"] = str(doc["notebook_id"])
                doc["created_at"] = datetime.fromisoformat(doc["created_at"].replace("Z", "+00:00"))
                documents.append(doc)
            return True, documents
        except Exception as e:
            return False, str(e)
            
    def log_query(self, user_id, query, response_time, notebook_id=None):
        """Log query analytics."""
        if self.client is None:
            return False, "Database connection not established"
            
        try:
            query_log = {
                "user_id": user_id,
                "notebook_id": notebook_id,
                "query": query,
                "response_time": float(response_time)
            }
            
            self.client.table("query_logs").insert(query_log).execute()
            
            # Increment user queries count
            user_res = self.client.table("users").select("total_queries").eq("id", user_id).execute()
            if user_res.data:
                new_q = (user_res.data[0].get("total_queries") or 0) + 1
                self.client.table("users").update({"total_queries": new_q}).eq("id", user_id).execute()
                
            return True, "Query logged"
        except Exception as e:
            return False, str(e)
            
    def get_user_analytics(self, user_id):
        """Get user account and query analytics."""
        if self.client is None:
            return False, "Database connection not established"
            
        try:
            user_res = self.client.table("users").select("*").eq("id", user_id).execute()
            if not user_res.data:
                return False, "User not found"
            user = user_res.data[0]
            
            logs_res = self.client.table("query_logs").select("*").eq("user_id", user_id).order("timestamp", desc=True).limit(100).execute()
            logs = logs_res.data
            
            avg_response_time = sum(log.get("response_time", 0) for log in logs) / len(logs) if logs else 0
            
            nbs_res = self.client.table("notebooks").select("*").eq("user_id", user_id).execute()
            
            notebook_stats = [
                {
                    "id": str(nb["id"]),
                    "name": nb["name"],
                    "document_count": nb.get("document_count", 0),
                    "rag_document_count": nb.get("rag_document_count", 0),
                    "created_at": datetime.fromisoformat(nb["created_at"].replace("Z", "+00:00")),
                    "last_accessed": datetime.fromisoformat(nb["last_accessed"].replace("Z", "+00:00"))
                }
                for nb in nbs_res.data
            ]
            
            recent_queries = []
            for log in logs[:10]:
                recent_queries.append({
                    "query": log["query"],
                    "timestamp": datetime.fromisoformat(log["timestamp"].replace("Z", "+00:00")),
                    "response_time": log.get("response_time", 0),
                    "notebook_id": str(log["notebook_id"]) if log.get("notebook_id") else None
                })
                
            analytics = {
                "user_id": str(user["id"]),
                "name": user["name"],
                "email": user["email"],
                "created_at": datetime.fromisoformat(user["created_at"].replace("Z", "+00:00")),
                "last_login": datetime.fromisoformat(user["last_login"].replace("Z", "+00:00")) if user.get("last_login") else None,
                "total_documents": user.get("total_docs", 0),
                "total_pdfs": user.get("total_pdfs", 0),
                "total_queries": user.get("total_queries", 0),
                "total_rag_documents": user.get("rag_documents", 0),
                "last_activity": datetime.now(),
                "avg_response_time": avg_response_time,
                "notebook_count": len(nbs_res.data),
                "notebook_stats": notebook_stats,
                "recent_queries": recent_queries
            }
            
            return True, analytics
        except Exception as e:
            return False, str(e)
            
    def get_notebook_analytics(self, notebook_id):
        """Get analytics for a notebook."""
        if self.client is None:
            return False, "Database connection not established"
            
        try:
            nb_res = self.client.table("notebooks").select("*").eq("id", notebook_id).execute()
            if not nb_res.data:
                return False, "Notebook not found"
            notebook = nb_res.data[0]
            
            query_logs_res = self.client.table("query_logs").select("*").eq("notebook_id", notebook_id).order("timestamp", desc=True).execute()
            query_logs = query_logs_res.data
            
            avg_response_time = sum(log.get("response_time", 0) for log in query_logs) / len(query_logs) if query_logs else 0
            
            recent_queries = []
            for log in query_logs[:10]:
                recent_queries.append({
                    "query": log["query"],
                    "timestamp": datetime.fromisoformat(log["timestamp"].replace("Z", "+00:00")),
                    "response_time": log.get("response_time", 0)
                })
                
            analytics = {
                "notebook_id": str(notebook["id"]),
                "name": notebook["name"],
                "description": notebook.get("description", ""),
                "created_at": datetime.fromisoformat(notebook["created_at"].replace("Z", "+00:00")),
                "last_accessed": datetime.fromisoformat(notebook["last_accessed"].replace("Z", "+00:00")),
                "document_count": notebook.get("document_count", 0),
                "rag_document_count": notebook.get("rag_document_count", 0),
                "query_count": len(query_logs),
                "avg_response_time": avg_response_time,
                "recent_queries": recent_queries
            }
            return True, analytics
        except Exception as e:
            return False, str(e)
            
    def save_faiss_index(self, notebook_id, user_id, index_binary, documents_binary, metadata=None):
        """Save FAISS index binary files to Supabase Storage."""
        if self.client is None:
            return False, "Database connection not established"
            
        try:
            index_path = f"{notebook_id}/faiss_index.bin"
            docs_path = f"{notebook_id}/documents.pkl" if len(documents_binary) > 0 else None
            
            # Upload index bytes to storage
            self.client.storage.from_("faiss-indexes").upload(
                path=index_path,
                file=index_binary,
                file_options={"content-type": "application/octet-stream", "x-upsert": "true"}
            )
            
            # Upload documents pickle to storage
            if docs_path:
                self.client.storage.from_("faiss-indexes").upload(
                    path=docs_path,
                    file=documents_binary,
                    file_options={"content-type": "application/octet-stream", "x-upsert": "true"}
                )
                
            # Update index record inside PG table
            existing_res = self.client.table("faiss_indexes").select("*").eq("notebook_id", notebook_id).execute()
            
            db_data = {
                "notebook_id": notebook_id,
                "user_id": user_id,
                "faiss_index_path": index_path,
                "documents_path": docs_path,
                "metadata": metadata or {},
                "updated_at": datetime.now().isoformat()
            }
            
            if existing_res.data:
                self.client.table("faiss_indexes").update(db_data).eq("notebook_id", notebook_id).execute()
                return True, "FAISS index updated successfully"
            else:
                db_data["created_at"] = datetime.now().isoformat()
                self.client.table("faiss_indexes").insert(db_data).execute()
                return True, "FAISS index created successfully"
        except Exception as e:
            return False, f"Error saving FAISS index: {str(e)}"
            
    def get_faiss_index(self, notebook_id):
        """Retrieve FAISS index bytes from Supabase Storage."""
        if self.client is None:
            return False, "Database connection not established"
            
        try:
            res = self.client.table("faiss_indexes").select("*").eq("notebook_id", notebook_id).execute()
            if not res.data:
                return False, "No FAISS index found for this notebook"
                
            row = res.data[0]
            index_path = row["faiss_index_path"]
            docs_path = row.get("documents_path")
            
            # Download files from storage
            index_binary = self.client.storage.from_("faiss-indexes").download(index_path)
            documents_binary = self.client.storage.from_("faiss-indexes").download(docs_path) if docs_path else b''
            
            return True, {
                "faiss_index": index_binary,
                "documents": documents_binary,
                "metadata": row.get("metadata", {}),
                "updated_at": datetime.fromisoformat(row["updated_at"].replace("Z", "+00:00"))
            }
        except Exception as e:
            return False, f"Error retrieving FAISS index: {str(e)}"