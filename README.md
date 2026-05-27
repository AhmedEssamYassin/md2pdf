# Markdown to PDF Converter 

A powerful, full-featured web application that converts Markdown files to professionally formatted PDF documents with syntax highlighting, mathematical equations, PDF bookmarks, auto-generated cover pages, and smart page-break optimization.

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## Features

### Core Functionality
- **Single & Batch Conversion** — Convert one or multiple Markdown files simultaneously
- **Smart Output** — Single file returns PDF directly, multiple files return a ZIP archive
- **PDF Bookmarks** — Hierarchical, nested bookmark outlines auto-generated from headings
- **Auto Cover Page** — Generates a title page from the document name, author, and date
- **Auto Table of Contents** — Builds a navigable TOC from headings (skipped if you write your own)
- **GitHub-Flavored Alerts** — `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]` rendered with native Octicon SVG icons
- **Syntax Highlighting** — 170+ languages via Prism.js autoloader
- **Math Support** — Full LaTeX/KaTeX support for inline and display equations
- **Image Resource Uploads** — Upload images alongside markdown files; they are automatically linked into the PDF via basename matching
- **Responsive Design** — Modern, mobile-friendly interface with drag-and-drop

### PDF Layout
- **Professional Typography** — Palatino body, system sans-serif headings, SF Mono code
- **Smart Page Breaks** — Post-render measurement pass that keeps small tables, lists, and code blocks unified while allowing large ones to flow naturally
- **Sub-Component Protection** — Individual table rows (`<tr>`) and list items (`<li>`) are never split mid-text
- **Repeating Table Headers** — `<thead>` is duplicated at the top of every page for multi-page tables
- **Widow/Orphan Control** — Headings are glued to their following content; paragraphs enforce minimum line counts
- **Page Numbers** — Centered footer with document title and page count

### Security & Stability
- **XSS-Safe Rendering** — All injected values (title, author) are HTML-escaped
- **Singleton Browser** — One Chromium instance shared via isolated browser contexts per request
- **Crash Recovery** — Automatic browser re-launch on unexpected disconnection
- **Resource Cleanup** — `try/finally` guarantees browser contexts are closed; files are cleaned up on all paths
- **Input Validation** — Extension checking, MIME type verification, file size limits
- **Filename Sanitization** — Special characters stripped, path traversal prevented
- **Security Headers** — `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`

## Tech Stack

### Frontend
- **Framework**: Vanilla JS (ES6+ modules)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **UI**: Custom drag-and-drop interface with animations

### Backend
- **Runtime**: Node.js (Express.js)
- **PDF Engine**: [Puppeteer](https://pptr.dev/) (Headless Chrome)
- **Markdown**: [Marked.js](https://marked.js.org/) with [marked-katex-extension](https://www.npmjs.com/package/marked-katex-extension)
- **PDF Metadata**: [pdf-lib](https://pdf-lib.js.org/) (bookmarks, title, author, keywords)
- **File Handling**: Multer (uploads), Archiver (ZIP generation)

## System Design (UML Diagram)
![UML Diagram](./docs/system%20design%20UML.svg)

## Prerequisites

- **Node.js**: Version 18.0.0 or higher
- **npm**: Installed with Node.js
- **System**: At least 512MB RAM (required for Puppeteer/Chrome)

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

```bash
npm run dev
```

- Frontend: http://localhost:5173 (proxies API requests to backend)
- Backend: http://localhost:3000

### Production Mode
Build the frontend and serve it via the Node.js backend.

```bash
# 1. Build the client
npm run build
# 2. Start the server
# On Windows (PowerShell)
$env:NODE_ENV="production"; node server/server.js

# On Linux/macOS
NODE_ENV=production node server/server.js
```

- Application: http://localhost:3000

### Command Line Conversion
Convert files directly without the web interface.

```bash
# Basic usage
node server/md2pdf-converter.js document.md

# With output path and metadata
node server/md2pdf-converter.js document.md report.pdf --author "Jane Smith" --subject "API Docs"

# See all options
node server/md2pdf-converter.js --help
```

**CLI Options:**

| Flag                 | Description                        |
| -------------------- | ---------------------------------- |
| `--author "Name"`    | Set PDF author metadata            |
| `--subject "Topic"`  | Set PDF subject metadata           |
| `--keywords "k1,k2"` | Set PDF keywords (comma-separated) |
| `--help`             | Show help message                  |

## API Documentation

### `POST /api/convert`

Converts uploaded Markdown files to PDF.

**Headers:** `Content-Type: multipart/form-data`

**Body:**

| Field        | Type    | Description                                                                  |
| ------------ | ------- | ---------------------------------------------------------------------------- |
| `files`      | File(s) | One or more `.md` files, plus optional images (`.png`, `.jpg`, `.svg`, etc.) |
| `outputName` | String  | Optional filename for the output                                             |
| `author`     | String  | Optional author for PDF metadata                                             |
| `coverPage`  | String  | Set to `"false"` to disable cover page                                       |
| `toc`        | String  | Set to `"false"` to disable auto TOC                                         |
| `watermark`  | String  | Optional watermark image URL                                                 |

**Response:**

- Returns `application/pdf` for a single file
- Returns `application/zip` for multiple files

**Example using curl:**
```bash
# Single file
curl -X POST -F "files=@document.md" \
  http://localhost:3000/api/convert \
  --output document.pdf

# With image resources
curl -X POST \
  -F "files=@document.md" \
  -F "files=@diagram.svg" \
  http://localhost:3000/api/convert \
  --output document.pdf

# Multiple markdown files with metadata
curl -X POST \
  -F "files=@file1.md" \
  -F "files=@file2.md" \
  -F "author=Ahmed Yassin" \
  -F "outputName=my-documents.zip" \
  http://localhost:3000/api/convert \
  --output output.zip
```

### `GET /api/health`

**Response:**
```json
{
  "status": "OK",
  "message": "Markdown to PDF converter is running",
  "timestamp": "2026-04-17T...",
  "version": "1.0.0",
  "uptime": 123.45
}
```

## Configuration

### Server (`server/server.js`)

```javascript
const CONFIG = {
    PORT: 3000,
    MAX_FILE_SIZE: 10 * 1024 * 1024,  // 10MB per individual file
    UPLOAD_DIR: 'uploads',
    OUTPUT_DIR: 'outputs',
    ALLOWED_EXTENSIONS: [...MARKDOWN_EXTS, ...IMAGE_EXTS],
    // MARKDOWN_EXTS = ['.md', '.markdown']
    // IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']
};
```

### Production Security Limits

To prevent abuse and protect system resources in production, the server enforces the following limits:

* **Rate Limiting**: Limits each IP address to a maximum of 10 conversion requests per minute using `express-rate-limit`.
* **Total Upload Limit**: Rejects requests immediately if the total payload size (`Content-Length`) exceeds 50 MB.
* **Individual File Limit**: Restricts any single file within the multi-upload to a maximum of 10 MB.
* **Request Timeout**: Limits the execution window of any conversion request to 120 seconds to prevent lingering browser contexts.


### Client (`client/src/file-handler.js`)

```javascript
static MAX_MB = 10;  // Per-file size limit (synchronized with server)
```

### Updating Offline Libraries

Since the offline rendering assets (KaTeX stylesheet/JS and PrismJS stylesheet/JS) are loaded dynamically from the `node_modules` directory on the server, they can be updated using standard npm package commands from the project root directory:

* **Update within semver ranges**: To fetch the latest minor or patch updates permitted by the configuration in [package.json](file:///d:/GitHub/md2pdf/server/package.json), run:
  ```bash
  npm update --prefix server
  ```
* **Upgrade to the absolute latest version**: To upgrade a library to its latest major release, run:
  ```bash
  npm install package_name@latest --prefix server
  ```
  *(Example: `npm install katex@latest --prefix server`)*

### Environment Variables

| Variable       | Description                            |
| -------------- | -------------------------------------- |
| `PORT`         | Server port (default: `3000`)          |
| `NODE_ENV`     | `production` or `development`          |
| `PDF_AUTHOR`   | Default PDF author name                |
| `PDF_SUBJECT`  | Default PDF subject                    |
| `PDF_KEYWORDS` | Default PDF keywords (comma-separated) |

## Markdown Features Supported

### Basic Syntax
- ✅ Headings (H1-H6)
- ✅ Bold, Italic, Strikethrough
- ✅ Links and Images
- ✅ Blockquotes
- ✅ Ordered and Unordered Lists
- ✅ Horizontal Rules
- ✅ Inline Code and Code Blocks

### Advanced Features
- ✅ Tables (with repeating headers on page breaks)
- ✅ Task Lists (custom checkbox styling)
- ✅ GitHub-Flavored Alerts (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`)
- ✅ Mathematical Equations (LaTeX via KaTeX)
  - Inline: `$E = mc^2$`
  - Display: `$$\int_{0}^{\infty} e^{-x} dx = 1$$`
- ✅ Syntax Highlighting (170+ languages via Prism.js autoloader)
- ✅ Manual page breaks via `<div class="page-break"></div>`
- ✅ Image resources alongside markdown files

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
# Change port via environment variable
PORT=3001 npm start
```

#### 3. File Size Errors
Increase limits in both `CONFIG.MAX_FILE_SIZE` (server) and `FileHandler.MAX_MB` (client).

#### 4. Permission Errors
```bash
# Ensure directories are writable
chmod 755 server/uploads server/outputs
```

### Debug Mode
Enable detailed logging:
```bash
NODE_ENV=development npm start
```

## Performance

- **Conversion Speed**: ~2-5 seconds per page
- **Memory Usage**: ~200-300MB (shared Chromium instance)
- **Concurrency**: Queue-based semaphore allowing up to 3 concurrent page-rendering tasks, with subsequent requests queued dynamically.
- **File Size Limit**: 10MB per file (50MB maximum total request size)

## Contributing

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

## Credits

### Libraries & Tools
- [Puppeteer](https://pptr.dev/) — Headless Chrome automation
- [Marked](https://marked.js.org/) — Markdown parser
- [KaTeX](https://katex.org/) — Math typesetting
- [Prism.js](https://prismjs.com/) — Syntax highlighting
- [Express.js](https://expressjs.com/) — Web framework
- [pdf-lib](https://pdf-lib.js.org/) — PDF metadata & bookmarks
- [Archiver](https://www.archiverjs.com/) — ZIP generation

### Typography
- **Palatino Linotype** — Body text
- **System Sans-Serif** — Headings (Apple, Segoe UI, Roboto)
- **SF Mono / Consolas** — Monospace code
