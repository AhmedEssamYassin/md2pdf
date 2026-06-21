import { fileURLToPath } from 'node:url';
import fs from "node:fs";
import path from "node:path";
import { Marked } from "marked";
import markedKatex from "marked-katex-extension";
import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRISM_CSS_URL = `file:///${path.join(__dirname, 'node_modules/prismjs/themes/prism.min.css').replace(/\\/g, '/')}`;
const KATEX_CSS_URL = `file:///${path.join(__dirname, 'node_modules/katex/dist/katex.min.css').replace(/\\/g, '/')}`;
const PRISM_CORE_JS_URL = `file:///${path.join(__dirname, 'node_modules/prismjs/components/prism-core.min.js').replace(/\\/g, '/')}`;
const PRISM_AUTOLOADER_JS_URL = `file:///${path.join(__dirname, 'node_modules/prismjs/plugins/autoloader/prism-autoloader.min.js').replace(/\\/g, '/')}`;
const KATEX_JS_URL = `file:///${path.join(__dirname, 'node_modules/katex/dist/katex.min.js').replace(/\\/g, '/')}`;
const KATEX_AUTO_RENDER_JS_URL = `file:///${path.join(__dirname, 'node_modules/katex/dist/contrib/auto-render.min.js').replace(/\\/g, '/')}`;
const MERMAID_JS_URL = `file:///${path.join(__dirname, 'node_modules/mermaid/dist/mermaid.min.js').replace(/\\/g, '/')}`;

// Configuration
// Configure marked with KaTeX for local instance use
const katexOptions = {
    throwOnError: false,
    nonStandard: true
};

// Styling
// Print layout optimizations for rendering PDF
const INLINE_STYLES = `
    :root {
        /* Book-quality fonts */
        --font-body: "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
        --font-headings: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        --font-code: "SF Mono", Consolas, "Liberation Mono", Menlo, "Courier New", monospace;
        
        /* Print-optimized colors */
        --color-text: #1a1a1a;
        --color-text-light: #4a4a4a;
        --color-border: #c0c0c0;
        --color-bg-code: #f5f5f5;
        --color-heading-number: #666;
        
        /* Print-optimized spacing */
        --line-height-body: 1.5;
        --line-height-headings: 1.2;
        --line-height-code: 1.4;
    }

    /* CSS RESET & PRINT SETUP */
    /* NOTE: @page margin is intentionally omitted. Puppeteer's margin option controls page margins.
       Having both causes conflicting content-height calculations and incorrect page breaks. */

    * {
        box-sizing: border-box;
    }

    body {
        font-family: var(--font-body);
        font-size: 11pt; /* Print standard */
        line-height: var(--line-height-body);
        color: var(--color-text);
        max-width: 100%;
        margin: 0;
        padding: 0;
        text-align: left;
        hyphens: auto; /* Better text flow */
        -webkit-hyphens: auto;
    }

    /* HEADINGS */
    h1, h2, h3, h4, h5, h6 {
        font-family: var(--font-headings);
        margin-top: 1.5em;
        margin-bottom: 0.5em;
        font-weight: 600;
        line-height: var(--line-height-headings);
        
        /* Widow/orphan control */
        page-break-after: avoid;
        break-after: avoid;
        orphans: 3;
        widows: 3;
    }

    h1 { 
        font-size: 2em; 
        border-bottom: 1px solid var(--color-border); 
        padding-bottom: 0.3em;
        margin-top: 0;
    }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }
    h4 { font-size: 1.1em; }
    h5 { font-size: 1em; font-weight: 700; }
    h6 { font-size: 1em; font-weight: 600; color: var(--color-text-light); }

    /* Keep heading + following content together */
    h1 + p, h1 + ul, h1 + ol, h1 + pre, h1 + table,
    h2 + p, h2 + ul, h2 + ol, h2 + pre, h2 + table,
    h3 + p, h3 + ul, h3 + ol, h3 + pre, h3 + table {
        page-break-before: avoid;
        break-before: avoid;
    }

    /* PARAGRAPHS */
    p {
        margin: 0.75em 0;
        orphans: 3;
        widows: 3;
    }

    /* CODE BLOCKS */
    pre {
        background-color: var(--color-bg-code);
        padding: 12px 14px;
        border-radius: 4px;
        font-family: var(--font-code);
        font-size: 9.5pt;
        line-height: var(--line-height-code);
        border: 1px solid var(--color-border);
        margin: 1em 0;
        
        /* overflow:visible prevents Chrome from ignoring page-break-inside:avoid */
        overflow: visible;
        white-space: pre-wrap;
        word-break: break-word;
        
        /* Atomic page breaking */
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        -webkit-column-break-inside: avoid;
        display: block;
    }
    
    @media print {
        pre {
            /* If the block is somehow forced to break, this forces the grey background to smoothly wrap both fragments instead of leaving massive ugly gaps! */
            -webkit-box-decoration-break: clone;
            box-decoration-break: clone;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
    }

    code {
        font-family: var(--font-code);
        background-color: rgba(175, 184, 193, 0.2);
        padding: 0.15em 0.4em;
        border-radius: 3px;
        font-size: 90%;
    }

    pre code {
        background-color: transparent;
        padding: 0;
        font-size: 100%;
        border-radius: 0;
    }

    /* LISTS */
    ul, ol {
        padding-left: 2em;
        margin: 0.75em 0;
        /* Let container break naturally */
    }

    li {
        margin-bottom: 0.3em;
        /* Prevent single list items from fracturing vertically */
        page-break-inside: avoid;
        break-inside: avoid;
    }
    
    /* Nested lists */
    li > ul, li > ol {
        margin-top: 0.3em;
        margin-bottom: 0.3em;
    }

    /* TABLES */
    table {
        border-collapse: collapse;
        width: 100%;
        margin: 1.5em 0;
        font-size: 10pt;
        /* Let table break naturally */
        orphans: 2;
        widows: 2;
    }
    
    /* Repeat table headers on each page */
    thead {
        display: table-header-group;
    }
    
    tbody {
        display: table-row-group;
    }
    
    /* Prevent table rows from slicing horizontally in the middle of text */
    tr {
        page-break-inside: avoid;
        break-inside: avoid;
    }
    
    th, td {
        border: 1px solid var(--color-border);
        padding: 8px 12px;
        text-align: left;
        vertical-align: top;
    }
    
    th { 
        background-color: var(--color-bg-code);
        font-weight: 600;
        font-family: var(--font-headings);
    }
    
    tr:nth-child(even) { 
        background-color: #fafafa; 
    }

    /* BLOCKQUOTES */
    blockquote {
        border-left: 4px solid var(--color-border);
        padding: 0.5em 1em;
        margin: 1em 0;
        color: var(--color-text-light);
        font-style: italic;
        background-color: #fafafa;
        page-break-inside: avoid;
    }

    blockquote p {
        margin: 0.5em 0;
    }

    /* IMAGES */
    img {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 1.5em auto;
        page-break-inside: avoid;
    }
    
    /* MATH */
    .katex-display {
        overflow-x: auto;
        overflow-y: hidden;
        margin: 1em 0;
        padding: 0.5em 0;
        page-break-inside: avoid;
    }
    
    .katex {
        font-size: 1.1em;
    }

    /* HORIZONTAL RULES */
    hr {
        border: none;
        border-top: 1px solid var(--color-border);
        margin: 2em 0;
        page-break-after: avoid;
    }

    /* LINKS - Print-friendly */
    a {
        color: #0366d6;
        text-decoration: none;
    }
    
    a:hover {
        text-decoration: underline;
    }

    @media print {
        /* Show URLs for external links */
        a[href^="http"]::after {
            content: " (" attr(href) ")";
            font-size: 0.8em;
            color: var(--color-text-light);
        }
        
        /* Don't show URLs for internal anchors */
        a[href^="#"]::after {
            content: "";
        }
    }

    /* CUSTOM EXTENSIONS */
    .cover-page {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 80vh;
        text-align: center;
        page-break-after: always;
    }
    .cover-page h1 { border: none; font-size: 3em; margin-bottom: 0.5em; }
    .cover-page .meta { font-size: 1.2em; color: var(--color-text-light); }
    
    .toc-page {
        page-break-after: always;
    }
    #toc {
        list-style: none;
        padding: 0;
    }
    #toc li {
        margin-bottom: 0.5em;
        line-height: 1.4;
    }
    #toc a {
        color: #0366d6;
        text-decoration: none;
        font-size: 1.1em;
    }
    #toc a:hover {
        text-decoration: underline;
    }

    .watermark {
        position: fixed;
        top: 30%;
        left: 50%;
        transform: translate(-50%, -30%);
        opacity: 0.05;
        max-width: 60%;
        z-index: -10;
        pointer-events: none;
    }

    .alert {
        border-left: 4px solid;
        padding: 1em 1.5em;
        margin: 1.5em 0;
        border-radius: 4px;
        background-color: #f8f9fa;
        page-break-inside: avoid;
    }
    .alert p { margin: 0; }
    .alert p + p { margin-top: 0.5em; }
    .alert-title {
        display: flex;
        align-items: center;
        font-weight: 600;
        margin-bottom: 0.5em;
        font-family: var(--font-headings);
    }
    .alert-title svg { width: 1.2em; height: 1.2em; min-width: 1.2em; min-height: 1.2em; margin-right: 0.5em; fill: currentColor; flex-shrink: 0; }
    .alert.NOTE { border-color: #0969da; background-color: #f6f8fa; color: #24292f; }
    .alert.NOTE .alert-title { color: #0969da; }
    .alert.IMPORTANT { border-color: #8250df; background-color: #f3f0ff; color: #24292f; }
    .alert.IMPORTANT .alert-title { color: #8250df; }
    .alert.WARNING { border-color: #9a6700; background-color: #fff8c5; color: #24292f; }
    .alert.WARNING .alert-title { color: #9a6700; }
    .alert.TIP { border-color: #1a7f37; background-color: #dcffe4; color: #24292f; }
    .alert.TIP .alert-title { color: #1a7f37; }
    .alert.CAUTION { border-color: #d1242f; background-color: #ffebe9; color: #24292f; }
    .alert.CAUTION .alert-title { color: #d1242f; }

    .markdown-body input[type="checkbox"] {
        appearance: none;
        width: 1.2em;
        height: 1.2em;
        border: 2px solid var(--color-border);
        border-radius: 3px;
        margin-right: 0.5em;
        vertical-align: middle;
        position: relative;
        top: -2px;
    }
    .markdown-body input[type="checkbox"]:checked {
        background-color: #0969da;
        border-color: #0969da;
    }
    .markdown-body input[type="checkbox"]:checked::after {
        content: '';
        position: absolute;
        width: 4px;
        height: 8px;
        border: solid white;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
        left: 4px;
        top: 1px;
    }

    .code-wrapper {
        page-break-inside: avoid;
        break-inside: avoid;
        display: inline-block;
        width: 100%;
        margin: 1em 0;
        vertical-align: top;
    }

    /* UTILITY CLASSES */
    .page-break {
        page-break-after: always;
        break-after: page;
    }
    
    .no-break {
        page-break-inside: avoid;
        break-inside: avoid;
    }

    pre.mermaid {
        background-color: transparent !important;
        border: none !important;
        padding: 0 !important;
        margin: 1.5em auto !important;
        overflow: visible !important;
        display: flex;
        justify-content: center;
        page-break-inside: avoid;
        break-inside: avoid;
    }
    .mermaid svg {
        max-width: 100% !important;
        max-height: 8.5in !important;
        height: auto !important;
        width: auto !important;
        display: block;
        margin: 0 auto;
    }
`;

// Nested PDF Bookmarks
async function addBookmarksToPdf(pdfDoc, bookmarks) {
    const pages = pdfDoc.getPages();

    if (bookmarks.length === 0) {
        return;
    }

    const context = pdfDoc.context;
    // Puppeteer margins: top 0.5in + bottom 0.8in = 1.3in.
    // A4 height = 11.69in. Usable = 11.69 - 1.3 = 10.39in at 96dpi ≈ 997.44px
    const contentPageHeight = 10.39 * 96;
    const pdfPageHeight = pages[0].getHeight();
    const outlineRef = context.nextRef();

    // Build hierarchical bookmark structure
    const rootItems = [];
    const stack = []; // Track parent chain by level

    for (const bookmark of bookmarks) {
        const item = {
            title: bookmark.title,
            level: bookmark.level,
            pageNum: Math.min(Math.max(0, Math.floor(bookmark.top / contentPageHeight)), pages.length - 1),
            children: [],
            ref: context.nextRef()
        };

        // Find parent: pop stack until we find a level < current
        while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
            stack.pop();
        }

        if (stack.length === 0) {
            rootItems.push(item);
        } else {
            stack[stack.length - 1].children.push(item);
        }
        stack.push(item);
    }

    // Recursive PDF outline builder with proper nesting
    function createOutlineItem(item, parentRef) {
        const page = pages[item.pageNum];
        const itemDict = {
            Title: context.obj(item.title),
            Parent: parentRef,
            Dest: [page.ref, 'XYZ', null, pdfPageHeight, null]
        };

        // Process children recursively
        if (item.children.length > 0) {
            const childRefs = item.children.map(child => child.ref);

            itemDict.First = childRefs[0];
            itemDict.Last = childRefs[childRefs.length - 1];
            itemDict.Count = context.obj(item.children.length); // Expanded by default

            item.children.forEach((child, idx) => {
                createOutlineItem(child, item.ref);

                // Link siblings
                const childDict = context.lookup(child.ref);
                if (idx > 0) childDict.set(context.obj('Prev'), childRefs[idx - 1]);
                if (idx < childRefs.length - 1) childDict.set(context.obj('Next'), childRefs[idx + 1]);
            });
        }

        context.assign(item.ref, context.obj(itemDict));
    }

    // Create root-level items and link siblings
    rootItems.forEach((item, idx) => {
        createOutlineItem(item, outlineRef);

        const itemDict = context.lookup(item.ref);
        if (idx > 0) itemDict.set(context.obj('Prev'), rootItems[idx - 1].ref);
        if (idx < rootItems.length - 1) itemDict.set(context.obj('Next'), rootItems[idx + 1].ref);
    });

    // Create root outline dictionary
    const outlineDict = context.obj({
        Type: 'Outlines',
        First: rootItems[0].ref,
        Last: rootItems[rootItems.length - 1].ref,
        Count: context.obj(rootItems.length)
    });

    context.assign(outlineRef, outlineDict);
    pdfDoc.catalog.set(context.obj('Outlines'), outlineRef);
}

// Main Conversion Function
let browserInstance = null;

export async function getBrowserInstance() {
    if (!browserInstance) {
        console.log("Launching browser...");
        browserInstance = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--allow-file-access-from-files'
            ]
        });
        browserInstance.on('disconnected', () => { browserInstance = null; });
    }
    return browserInstance;
}

export async function closeBrowserInstance() {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const MAX_CONCURRENT = 3;
let activeConversions = 0;
const conversionQueue = [];

async function acquireSlot() {
    if (activeConversions < MAX_CONCURRENT) {
        activeConversions++;
        return;
    }
    return new Promise(resolve => conversionQueue.push(resolve));
}

function releaseSlot() {
    activeConversions--;
    if (conversionQueue.length > 0) {
        activeConversions++;
        conversionQueue.shift()();
    }
}

export async function mdToPdf(inputFile, outputFile, options = {}) {
    await acquireSlot();
    try {
        await _mdToPdf(inputFile, outputFile, options);
    } finally {
        releaseSlot();
    }
}

async function _mdToPdf(inputFile, outputFile, options = {}) {
    const markdown = fs.readFileSync(inputFile, "utf-8");
    const headings = [];

    // Create local marked instance for this request
    const markedInstance = new Marked();
    markedInstance.use(markedKatex(katexOptions));

    const renderer = {
        heading(text, level, raw) {
            const id = raw.toLowerCase().replace(/[^\w]+/g, '-');
            headings.push({ level, text: raw, id }); // Store raw for text, we escape it later in TOC, or store `text` which is HTML
            return `<h${level} id="${id}" class="section-heading level-${level}">${text}</h${level}>`;
        },
        code(code, lang) {
            const language = lang || 'plaintext';
            const validLang = language.toLowerCase();
            if (validLang === 'mermaid') {
                return `<div class="mermaid-container no-break"><pre class="mermaid">${escapeHtml(code)}</pre></div>`;
            }
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            };
            const escapedCode = code.replace(/[&<>"']/g, (char) => map[char]);
            return `<div class="code-wrapper"><pre style="margin: 0;"><code class="language-${validLang}">${escapedCode}</code></pre></div>`;
        },
        blockquote(quote) {
            const alertMap = {
                'NOTE': { title: 'Note', class: 'NOTE', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/></svg>' },
                'IMPORTANT': { title: 'Important', class: 'IMPORTANT', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v9.5A1.75 1.75 0 0 1 14.25 13H8.06l-2.573 2.573A1.458 1.458 0 0 1 3 14.543V13H1.75A1.75 1.75 0 0 1 0 11.25Zm1.75-.25a.25.25 0 0 0-.25.25v9.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.75.75 0 0 1 .53-.22h6.5a.25.25 0 0 0 .25-.25v-9.5a.25.25 0 0 0-.25-.25Zm7 2.25v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 9a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>' },
                'WARNING': { title: 'Warning', class: 'WARNING', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>' },
                'TIP': { title: 'Tip', class: 'TIP', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 1.5c-2.363 0-4 1.69-4 3.75 0 .984.424 1.625.984 2.304l.214.253c.223.264.47.556.673.848.284.411.537.896.621 1.49a.75.75 0 0 1-1.484.211c-.04-.282-.163-.547-.37-.847a8.456 8.456 0 0 0-.542-.68c-.084-.1-.173-.205-.268-.32C3.201 7.75 2.5 6.766 2.5 5.25 2.5 2.31 4.863 0 8 0s5.5 2.31 5.5 5.25c0 1.516-.701 2.5-1.328 3.259-.095.115-.184.22-.268.319-.207.245-.383.453-.541.681-.208.3-.33.565-.37.847a.751.751 0 0 1-1.485-.212c.084-.593.337-1.078.621-1.489.203-.292.45-.584.673-.848.075-.088.147-.173.213-.253.561-.679.985-1.32.985-2.304 0-2.06-1.637-3.75-4-3.75ZM5.75 12h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5ZM6 15.25a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z"/></svg>' },
                'CAUTION': { title: 'Caution', class: 'CAUTION', icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>' }
            };
            const match = quote.match(/^\s*<p>\[!(NOTE|IMPORTANT|WARNING|TIP|CAUTION)\](?:<br>|\n)?([\s\S]*?)<\/p>([\s\S]*)$/i);
            if (match) {
                const type = match[1].toUpperCase();
                const firstParagraphContent = match[2];
                const restContent = match[3];
                const alert = alertMap[type];
                return `<div class="alert ${alert.class}">\n<div class="alert-title">${alert.icon}${alert.title}</div>\n<p>${firstParagraphContent}</p>${restContent}\n</div>`;
            }
            return `<blockquote>${quote}</blockquote>`;
        }
    };

    markedInstance.use({ renderer });

    const htmlContent = markedInstance.parse(markdown);

    // Resolve relative image paths to absolute file:// URLs
    const inputDir = path.dirname(path.resolve(inputFile));
    const resolvedContent = htmlContent.replace(
        /(<img\s+[^>]*src=["'])(?!https?:\/\/|data:|file:\/\/)([^"']+)(["'])/gi,
        (match, prefix, src, suffix) => {
            const srcDecoded = decodeURIComponent(src);
            const basename = path.basename(srcDecoded);

            if (options.imageMap && options.imageMap[basename]) {
                const imagePath = path.resolve(options.imageMap[basename]);
                const fileUrl = `file:///${imagePath.replace(/\\/g, '/')}`;
                return `${prefix}${fileUrl}${suffix}`;
            }

            const absPath = path.resolve(inputDir, srcDecoded);
            const fileUrl = `file:///${absPath.replace(/\\/g, '/')}`;
            return `${prefix}${fileUrl}${suffix}`;
        }
    );
    const documentTitle = escapeHtml(options.title || path.basename(inputFile, '.md'));
    const author = escapeHtml(options.author || process.env.PDF_AUTHOR || '');
    const date = options.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // Detect if the user's markdown already contains a Table of Contents
    const userHasToc = /^#{1,3}\s+table\s+of\s+contents/im.test(markdown);

    // Generate Cover Page HTML
    const coverPage = options.coverPage !== false ? `
        <div class="cover-page">
            <h1>${documentTitle}</h1>
            <div class="meta">
                ${author ? `<p><strong>Author:</strong> ${author}</p>` : ''}
                <p><strong>Date:</strong> ${date}</p>
            </div>
        </div>
    ` : '';

    // Generate TOC HTML only if user hasn't written their own
    const tocPage = options.toc !== false && headings.length > 0 && !userHasToc ? `
        <div class="toc-page">
            <h1 style="border-bottom: 2px solid var(--color-border); padding-bottom: 0.5em;">Table of Contents</h1>
            <ul id="toc">
                ${headings.map((h) => `
                    <li style="margin-left: ${(h.level - 1) * 1.5}em">
                        <a href="#${escapeHtml(h.id)}">
                            ${escapeHtml(h.text)}
                        </a>
                    </li>
                `).join('')}
            </ul>
        </div>
    ` : '';

    // Watermark HTML
    const watermarkHtml = options.watermark ? `<img class="watermark" src="${escapeHtml(options.watermark)}" alt="Watermark">` : '';

    // Rendering with fallback
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>${documentTitle}</title>
    
    <link rel="stylesheet" href="${PRISM_CSS_URL}">
    <link rel="stylesheet" href="${KATEX_CSS_URL}">

    <style>${INLINE_STYLES}</style>
</head>
<body>
    ${watermarkHtml}
    ${coverPage}
    ${tocPage}
    <article class="markdown-body">
        ${resolvedContent}
    </article>
    
    <script src="${PRISM_CORE_JS_URL}"></script>
    <script src="${PRISM_AUTOLOADER_JS_URL}"></script>
    <script src="${KATEX_JS_URL}"></script>
    <script src="${KATEX_AUTO_RENDER_JS_URL}"></script>
    <script src="${MERMAID_JS_URL}"></script>

    <script>
        // Rendering with timeout fallback
        window.status = 'loading';
        
        document.addEventListener('DOMContentLoaded', function() {
            // Render timeout fallback
            const renderTimeout = setTimeout(() => {
                console.warn('Render timeout reached - proceeding with PDF generation');
                window.status = 'ready';
            }, 8000); // 8 second safety net

            Promise.all([
                // Math rendering with error handling
                new Promise((resolve) => {
                    try {
                        if (window.renderMathInElement) {
                            renderMathInElement(document.body, {
                                delimiters: [
                                    {left: '$$', right: '$$', display: true},
                                    {left: '$', right: '$', display: false},
                                    {left: '\\\\(', right: '\\\\)', display: false},
                                    {left: '\\\\[', right: '\\\\]', display: true}
                                ],
                                throwOnError: false
                            });
                            console.log('✓ KaTeX rendered');
                        } else {
                            console.warn('⚠ KaTeX not available - skipping math rendering');
                        }
                    } catch(e) { 
                        console.error('✗ KaTeX error:', e); 
                    }
                    resolve();
                }),
                
                // Syntax highlighting with error handling
                new Promise((resolve) => {
                    try {
                        if (window.Prism) {
                            Prism.highlightAll();
                            console.log('✓ Prism highlighted');
                            // Small delay for DOM repaint
                            setTimeout(resolve, 150);
                        } else {
                            console.warn('⚠ Prism not available - skipping syntax highlighting');
                            resolve();
                        }
                    } catch(e) {
                        console.error('✗ Prism error:', e);
                        resolve();
                    }
                }),

                // Render Mermaid diagrams
                new Promise((resolve) => {
                    try {
                        const elements = document.querySelectorAll('.mermaid');
                        if (elements.length > 0 && window.mermaid) {
                            mermaid.initialize({
                                startOnLoad: false,
                                theme: 'default',
                                securityLevel: 'loose',
                                flowchart: { useMaxWidth: false, htmlLabels: true }
                            });
                            mermaid.run().then(() => {
                                console.log('✓ Mermaid rendered');
                                resolve();
                            }).catch((err) => {
                                console.error('✗ Mermaid run error:', err);
                                resolve();
                            });
                        } else {
                            resolve();
                        }
                    } catch(e) {
                        console.error('✗ Mermaid error:', e);
                        resolve();
                    }
                })
            ]).then(() => {
                clearTimeout(renderTimeout);
                console.log('✓ All rendering complete');
                window.status = 'ready';
                document.body.classList.add('render-complete');
            }).catch((err) => {
                console.error('Rendering failed:', err);
                clearTimeout(renderTimeout);
                window.status = 'ready'; // Proceed anyway
            });
        });
    </script>
</body>
</html>`;

    const browser = await getBrowserInstance();
    const context = await browser.createBrowserContext();
    let pdfBuffer;
    let bookmarkData = [];
    const htmlPath = inputFile.replace(/\.(md|markdown)$/i, '.html');
    try {
        const page = await context.newPage();

        // Puppeteer block file:// images on about:blank pages, so we must save the HTML
        // to a temporary file and navigate directly to it to establish a valid file:// origin.
        fs.writeFileSync(htmlPath, html, 'utf8');
        const fileUrl = `file:///${path.resolve(htmlPath).replace(/\\/g, '/')}`;

        await page.goto(fileUrl, { waitUntil: 'networkidle0' });

        console.log("Waiting for rendering (Math + Syntax highlighting)...");
        await page.waitForFunction("window.status === 'ready'", { timeout: 60000 });

        console.log("Calculating bookmarks...");
        for (const heading of headings) {
            const position = await page.evaluate((id) => {
                const element = document.getElementById(id);
                if (!element) return null;
                const rect = element.getBoundingClientRect();
                return { top: rect.top + window.scrollY };
            }, heading.id);

            if (position) {
                bookmarkData.push({
                    title: heading.text,
                    level: heading.level,
                    top: position.top
                });
            }
        }

        // Smart page-break pass: measure elements and protect small ones from splitting
        console.log("Optimizing page breaks...");
        await page.evaluate(() => {
            // A4 = 11.69in, minus 0.5in top + 0.8in bottom = 10.39in usable at 96dpi
            const pageHeight = 10.39 * 96; // ~998px
            const breakable = document.querySelectorAll('ul, ol, table, blockquote, .code-wrapper');
            breakable.forEach(el => {
                const height = el.getBoundingClientRect().height;
                if (height < pageHeight) {
                    // Small enough to keep together — prevent splitting
                    el.style.pageBreakInside = 'avoid';
                    el.style.breakInside = 'avoid';
                } else {
                    // Too large for one page — allow natural breaking
                    el.style.pageBreakInside = 'auto';
                    el.style.breakInside = 'auto';
                }
            });
        });

        console.log("Generating PDF...");
        pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            displayHeaderFooter: true,
            footerTemplate: `
            <div style="font-size: 9pt; font-family: -apple-system, sans-serif; color: #666; margin: 0 0.5in; width: 100%; text-align: center; border-top: 1px solid #ddd; padding-top: 8px;">
                <span style="font-weight: 500;">${documentTitle}</span>
                <span style="margin: 0 1em;">•</span>
                Page <span class="pageNumber"></span> of <span class="totalPages"></span>
            </div>
        `,
            headerTemplate: '<div></div>',
            margin: {
                top: "0.5in",
                bottom: "0.8in",
                left: "0.5in",
                right: "0.5in"
            }
        });
    } finally {
        await context.close();
        if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
    }

    // Add PDF metadata
    console.log("Setting PDF metadata...");
    const pdfDoc = await PDFDocument.load(pdfBuffer);

    const metadata = {
        title: documentTitle,
        author: options.author || process.env.PDF_AUTHOR || "Generated by md-to-pdf",
        subject: options.subject || process.env.PDF_SUBJECT || "Technical Documentation",
        keywords: options.keywords || (process.env.PDF_KEYWORDS ? process.env.PDF_KEYWORDS.split(',') : []),
        creator: "md-to-pdf (Puppeteer + marked + KaTeX + Prism)",
        producer: "md-to-pdf v2.0"
    };

    pdfDoc.setTitle(metadata.title);
    pdfDoc.setAuthor(metadata.author);
    pdfDoc.setSubject(metadata.subject);
    if (metadata.keywords.length > 0) {
        pdfDoc.setKeywords(metadata.keywords);
    }
    pdfDoc.setCreator(metadata.creator);
    pdfDoc.setProducer(metadata.producer);
    pdfDoc.setCreationDate(new Date());
    pdfDoc.setModificationDate(new Date());

    // Add bookmarks to the PDF with metadata
    if (bookmarkData.length > 0) {
        console.log(`Injecting ${bookmarkData.length} nested bookmarks...`);
        await addBookmarksToPdf(pdfDoc, bookmarkData);
        console.log(`Success! Professional PDF created: ${outputFile}`);
    } else {
        console.log(`Success! PDF created: ${outputFile}`);
    }

    fs.writeFileSync(outputFile, await pdfDoc.save());
}

// CLI Parser
const isCLI = process.argv[1] === fileURLToPath(import.meta.url);
if (isCLI) {
    const args = process.argv.slice(2);
    const flags = {
        input: null,
        output: null,
        title: null,
        author: null,
        subject: null,
        keywords: null
    };

    // Parse flags
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const value = args[i + 1];

            if (key === 'author' && value) { flags.author = value; i++; }
            else if (key === 'title' && value) { flags.title = value; i++; }
            else if (key === 'subject' && value) { flags.subject = value; i++; }
            else if (key === 'keywords' && value) { flags.keywords = value.split(',').map(k => k.trim()); i++; }
            else if (key === 'help' || key === 'h') {
                console.log(`
Professional Markdown to PDF Converter

USAGE:
  node script.js <input.md> [output.pdf] [options]

POSITIONAL ARGUMENTS:
  input.md          Input Markdown file (required)
  output.pdf        Output PDF file (default: input name with .pdf extension)

OPTIONS:
  --title "Title"           Set PDF title metadata
  --author "Name"           Set PDF author metadata
  --subject "Topic"         Set PDF subject metadata
  --keywords "k1,k2,k3"     Set PDF keywords (comma-separated)
  --help, -h                Show this help message

EXAMPLES:
  node script.js document.md
  node script.js doc.md report.pdf
  node script.js doc.md --author "Dr. Jane Smith"
  node script.js doc.md output.pdf --author "John Doe" --subject "API Documentation" --keywords "REST,API,Guide"

ENVIRONMENT VARIABLES:
  PDF_AUTHOR       Default author name
  PDF_SUBJECT      Default subject
  PDF_KEYWORDS     Default keywords (comma-separated)

FEATURES:
  ✓ Nested PDF bookmarks (hierarchical outline)
  ✓ Syntax highlighting (170+ languages via Prism)
  ✓ Math equations (LaTeX via KaTeX)
  ✓ Smart page breaks (no orphaned headings)
  ✓ Professional typography
  ✓ Repeating table headers
  ✓ PDF metadata (author, subject, keywords)
  ✓ Graceful CDN fallback
`);
                process.exit(0);
            }
        } else {
            if (!flags.input) flags.input = arg;
            else if (!flags.output) flags.output = arg;
            else if (!flags.title) flags.title = arg;
        }
    }

    if (!flags.input) {
        console.error("Error: No input file specified");
        console.error("Usage: node script.js <input.md> [output.pdf] [options]");
        console.error("Run 'node script.js --help' for more information");
        process.exit(1);
    }

    if (!fs.existsSync(flags.input)) {
        console.error(`Error: Input file not found: ${flags.input}`);
        process.exit(1);
    }

    const finalOutputFile = flags.output || `${path.basename(flags.input, '.md')}.pdf`;

    mdToPdf(flags.input, finalOutputFile, flags).then(() => {
        closeBrowserInstance().then(() => process.exit(0));
    }).catch(error => {
        console.error("Fatal Error:", error);
        process.exit(1);
    });
}