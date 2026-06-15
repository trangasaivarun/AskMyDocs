import os
import re

def remove_directory_recursively(directory_path):
    """Recursively remove a directory and all its contents using os module."""
    if not os.path.exists(directory_path):
        return
        
    for root, dirs, files in os.walk(directory_path, topdown=False):
        for file in files:
            file_path = os.path.join(root, file)
            try:
                os.remove(file_path)
            except Exception as e:
                print(f"Error removing file {file_path}: {e}")
                
        for dir_name in dirs:
            dir_path = os.path.join(root, dir_name)
            try:
                os.rmdir(dir_path)
            except Exception as e:
                print(f"Error removing directory {dir_path}: {e}")
    
    try:
        os.rmdir(directory_path)
    except Exception as e:
        print(f"Error removing top directory {directory_path}: {e}")

def check_password_strength(password):
    """Check password strength and return feedback."""
    score = 0
    feedback = ""
    
    if len(password) < 8:
        feedback = "Password is too short. Use at least 8 characters."
        return "weak", feedback
    elif len(password) >= 12:
        score += 2
    elif len(password) >= 8:
        score += 1
    
    if re.search(r'[A-Z]', password) and re.search(r'[a-z]', password):
        score += 1
    else:
        feedback += "Add both uppercase and lowercase letters. "
    
    if re.search(r'\d', password):
        score += 1
    else:
        feedback += "Add numbers. "
    
    if re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        score += 1
    else:
        feedback += "Add special characters. "
    
    if score >= 4:
        return "strong", "Strong password"
    elif score >= 2:
        return "medium", "Medium strength. " + feedback
    else:
        return "weak", "Weak password. " + feedback

def format_file_size(size_bytes):
    """Format file size from bytes to appropriate unit."""
    if size_bytes < 1024:
        return f"{size_bytes} bytes"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"

def scrape_webpage(url):
    """Fetch and parse content from a webpage, returning a dict with title and text."""
    import requests
    from bs4 import BeautifulSoup
    
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
        
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script, style, nav, footer, header, aside elements
        for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
            element.decompose()
            
        title = soup.title.string.strip() if soup.title else url
        
        # Get text
        text = soup.get_text()
        
        # Break into lines and remove leading and trailing whitespace
        lines = (line.strip() for line in text.splitlines())
        # Break multi-headlines into a line each
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        # Drop blank lines
        clean_text = "\n".join(chunk for chunk in chunks if chunk)
        
        return {
            "success": True,
            "title": title,
            "text": clean_text
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }