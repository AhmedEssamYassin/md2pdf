# Markdown to PDF Converter 📄

A powerful, full-featured web application that converts Markdown files to beautifully formatted PDF documents with syntax highlighting, mathematical equations, and PDF bookmarks.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Features

### Core Functionality
- **Single & Batch Conversion** - Convert one or multiple Markdown files simultaneously
- **Smart Output** - Single file returns PDF, multiple files return ZIP archive
- **Beautiful Formatting** - GitHub-flavored Markdown styling with professional typography
- **PDF Bookmarks** - Automatic bookmark generation from headings for easy navigation
- **Syntax Highlighting** - Support for 15+ programming languages with Prism.js
- **Math Support** - Full LaTeX/KaTeX support for mathematical equations
- **Responsive Design** - Modern, mobile-friendly interface with drag-and-drop
- **Real-time Progress** - Visual feedback during conversion process

### Technical Features
- **Secure File Handling** - Automatic cleanup and sanitized filenames
- **Type Validation** - Multiple file type checks (extension + MIME type)
- **Size Limits** - Configurable file size restrictions (default: 10MB per file, 50MB total)
- **Error Handling** - Comprehensive error messages and validation
- **CORS Support** - Cross-origin resource sharing enabled
- **No Storage** - Files are processed and immediately deleted
- **Health Checks** - Built-in health monitoring endpoint

### PDF Features
- **Page Layout** - A4 format with optimized margins
- **Syntax Themes** - Tomorrow Night theme for code blocks
- **Professional Fonts** - Inter for body text, Fira Code for code
- **Page Numbers** - Automatic page numbering in footer
- **Smart Page Breaks** - Prevents awkward splits in code blocks, tables, and lists
- **Orphan/Widow Control** - Proper paragraph flow across pages

## 🛠️ Tech Stack

### Frontend
- **Framework**: Vanilla JS (ES6+)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI**: Custom drag-and-drop interface with animations

### Backend
- **Runtime**: Node.js (Express.js)
- **PDF Engine**: [Puppeteer](https://pptr.dev/) (Chrome Headless)
- **File Handling**: Multer (Uploads), Archiver (ZIP generation)
- **Markdown Engine**: Marked.js with `marked-katex-extension`

## System Design (UML Diagram)
![UML Diagram](./docs/system%20design%20UML.svg)

## 📋 Prerequisites

- **Node.js**: Version 18.0.0 or higher.
- **npm**: Installed with Node.js.
- **System**: At least 512MB RAM (required for Puppeteer/Chrome).

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/AhmedEssamYassin/md2pdf.git
cd md2pdf
```

### 2. Install Dependencies
```bash
npm install
cd client && npm install
cd ../server && npm install
cd ..
```

This will install all required packages including Puppeteer, which will download a compatible version of Chromium (~170MB).

### 3. Verify Installation
```bash
node --version  # Should be >= 18.0.0
npm --version
```

## Usage

### Development Mode
Run the frontend (Vite) and backend (Express) concurrently from the root.

```Bash
npm run dev
```

- Frontend: http://localhost:5173 (Proxies API requests to backend)
- Backend: http://localhost:3000

### Production Mode
Build the frontend and serve it via the Node.js backend.

```Bash
# 1. Build the client
npm run build
# 2. Start the server
npm start
```

- Application: http://localhost:3000

### Command Line Conversion
You can convert files directly using the backend script without the web interface.
```Bash
# Usage: node server/md2pdf-converter.js <input.md> [output.pdf] [Title]
node server/md2pdf-converter.js my-document.md output.pdf "My Report"
```

## API Documentation

`POST /api/convert`\
Converts uploaded Markdown files to PDF.

### Headers:

- `Content-Type`: `multipart/form-data`

### Body:

- `markdowns`: File(s) (One or more .md files).

- `outputName`: String (Optional filename for the result).

### Response:

- Returns `application/pdf` if one file is uploaded.

- Returns `application/zip` if multiple files are uploaded.

**Example using curl:**
```bash
# Single file
curl -X POST -F "markdowns=@document.md" \
  http://localhost:3000/api/convert \
  --output document.pdf

# Multiple files
curl -X POST \
  -F "markdowns=@file1.md" \
  -F "markdowns=@file2.md" \
  -F "outputName=my-documents.zip" \
  http://localhost:3000/api/convert \
  --output output.zip
```

#### 2. Health Check
```http
GET /api/health
```

**Response:**
```json
{
  "status": "OK",
  "message": "Markdown to PDF converter is running",
  "timestamp": "2025-01-XX...",
  "version": "1.0.0",
  "uptime": 123.45
}
```

## ⚙️ Configuration

Edit `server.js` to customize settings:

```javascript
const CONFIG = {
    PORT: 3000,                    // Server port
    MAX_FILE_SIZE: 10 * 1024 * 1024,  // 10MB per file
    UPLOAD_DIR: 'uploads',         // Upload directory
    OUTPUT_DIR: 'outputs',         // Output directory
    ALLOWED_EXTENSIONS: ['.md', '.markdown'],
    ALLOWED_MIMETYPES: ['text/markdown', 'text/x-markdown', 'text/plain']
};
```

Edit `FileHandler.js` for client-side limits:

```javascript
static MAX_MB = 50;  // Total size limit for all files
```

## 🎨 Markdown Features Supported

### Basic Syntax
- ✅ Headings (H1-H6)
- ✅ Bold, Italic, Strikethrough
- ✅ Links and Images
- ✅ Blockquotes
- ✅ Ordered and Unordered Lists
- ✅ Horizontal Rules
- ✅ Inline Code and Code Blocks

### Advanced Features
- ✅ Tables
- ✅ Task Lists
- ✅ Footnotes
- ✅ Definition Lists
- ✅ Mathematical Equations (LaTeX)
  - Inline: `$E = mc^2$`
  - Display: `$$\int_{0}^{\infty} e^{-x} dx = 1$$`

### Syntax Highlighting Languages
JavaScript, Python, Java, C, C++, C#, TypeScript, JSX, CSS, HTML/XML, Bash, JSON, SQL, YAML, Markdown, and many more via Prism.js autoloader.

## 🔒 Security Features

1. **File Validation**
   - Extension checking (.md, .markdown)
   - MIME type verification
   - File size limits

2. **Sanitization**
   - Filename sanitization (removes special characters)
   - Path traversal prevention

3. **Headers**
   - X-Content-Type-Options: nosniff
   - X-Frame-Options: DENY
   - X-XSS-Protection: 1; mode=block
   - Cache-Control: no-cache

4. **Cleanup**
   - Automatic file deletion after processing
   - Graceful shutdown with cleanup
   - Timeout protection (30s per conversion)

## Troubleshooting

### Common Issues

#### 1. Puppeteer/Chrome Issues
```bash
# Linux: Install dependencies
sudo apt-get install -y \
  ca-certificates fonts-liberation \
  libnss3 libxss1 libappindicator3-1 \
  libatk-bridge2.0-0 libcups2 \
  libgbm1 libgtk-3-0

# Or use puppeteer with system Chrome
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install
```

#### 2. Port Already in Use
```bash
# Change port in server.js or use environment variable
PORT=3001 npm start
```

#### 3. File Size Errors
Increase limits in `CONFIG.MAX_FILE_SIZE` and `FileHandler.MAX_MB`

#### 4. Permission Errors
```bash
# Ensure directories are writable
chmod 755 uploads outputs
```

### Debug Mode
Enable detailed logging:
```bash
NODE_ENV=development npm start
```

## 📊 Performance

- Conversion Speed: ~2-5 seconds per page
- Memory Usage: ~200-300MB per conversion
- Concurrent Conversions: Handles multiple requests (limited by system resources)
- File Size Limit: 10MB per file (configurable)
- Total Batch Limit: 50MB (configurable)

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Add comments for complex logic
- Test thoroughly before submitting
- Update README if needed

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Credits

### Libraries & Tools
- [Puppeteer](https://pptr.dev/) - Headless Chrome automation
- [Marked](https://marked.js.org/) - Markdown parser
- [KaTeX](https://katex.org/) - Math typesetting
- [Prism.js](https://prismjs.com/) - Syntax highlighting
- [Express.js](https://expressjs.com/) - Web framework
- [pdf-lib](https://pdf-lib.js.org/) - PDF manipulation
- [GitHub Markdown CSS](https://github.com/sindresorhus/github-markdown-css) - Styling

### Fonts
- [Inter](https://rsms.me/inter/) - UI and body text
- [Fira Code](https://github.com/tonsky/FiraCode) - Monospace code font

## 🗺️ Roadmap

- [ ] Docker support
- [ ] Custom CSS themes
- [ ] Watermark support
- [ ] Header/footer customization
- [ ] Table of contents generation
- [ ] Dark mode PDF option
- [ ] Export to other formats (DOCX, HTML)
- [ ] Cloud storage integration
- [ ] User templates

---

Made by [Ahmed Yassin](https://github.com/AhmedEssamYassin)