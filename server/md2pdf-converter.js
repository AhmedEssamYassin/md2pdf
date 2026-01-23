import fs from "fs";
import path from "path";
import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";

// --- CONFIGURATION ---
// Configure marked with KaTeX
marked.use(markedKatex({
    throwOnError: false,
    nonStandard: true
}));

// Custom renderer to add IDs to headings for PDF bookmarks
const renderer = new marked.Renderer();
const headings = [];

renderer.heading = function (text, level, raw) {
    const id = raw.toLowerCase().replace(/[^\w]+/g, '-');
    headings.push({ level, text: raw, id });
    // Note: I add a specific class 'section-heading' for CSS page-break logic
    return `<h${level} id="${id}" class="section-heading level-${level}">${text}</h${level}>`;
};

renderer.code = function (code, language) {
    const lang = language || 'plaintext';
    const validLang = lang.toLowerCase();

    // Map of characters to escape
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };

    // Single-pass regex replacement (Faster & Cleaner)
    const escapedCode = code.replace(/[&<>"']/g, (char) => map[char]);

    return `<pre><code class="language-${validLang}">${escapedCode}</code></pre>`;
};

marked.use({ renderer });

// --- STYLING ---
// Professional book-quality typography and print optimization
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
    @page {
        margin: 2cm;
    }

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

    /* AUTO-NUMBERING */
    body { counter-reset: h1counter; }
    
    h1 { counter-reset: h2counter; }
    h1::before {
        counter-increment: h1counter;
        content: counter(h1counter) ". ";
        color: var(--color-heading-number);
    }

    h2 { counter-reset: h3counter; }
    h2::before {
        counter-increment: h2counter;
        content: counter(h1counter) "." counter(h2counter) " ";
        color: var(--color-heading-number);
    }
    
    h3::before {
        counter-increment: h3counter;
        content: counter(h1counter) "." counter(h2counter) "." counter(h3counter) " ";
        color: var(--color-heading-number);
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
        overflow-x: auto;
        font-family: var(--font-code);
        font-size: 9.5pt;
        line-height: var(--line-height-code);
        border: 1px solid var(--color-border);
        margin: 1em 0;
        
        /* Smart breaking for code blocks */
        page-break-inside: avoid;
        break-inside: avoid;
        orphans: 4;
        widows: 4;
    }
    
    /* Handle very large code blocks */
    @media print {
        pre {
            white-space: pre-wrap;
            word-break: break-word;
            max-height: 85vh; /* Prevent single block from consuming entire page */
        }
        
        /* Allow breaking only for syntax-highlighted long blocks */
        pre:has(code[class*="language-"]) {
            page-break-inside: auto;
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
        
        /* Keep lists together and glued to intro text */
        page-break-inside: avoid;
        break-inside: avoid;
        page-break-before: avoid;
        break-before: avoid;
    }

    li {
        margin-bottom: 0.3em;
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
        
        /* Better table handling */
        page-break-inside: avoid;
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

    /* UTILITY CLASSES */
    .page-break {
        page-break-after: always;
        break-after: page;
    }
    
    .no-break {
        page-break-inside: avoid;
        break-inside: avoid;
    }
`;

// --- NESTED PDF BOOKMARKS ---
async function addBookmarksToPdf(pdfBuffer, outputPath, bookmarks) {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    if (bookmarks.length === 0) {
        fs.writeFileSync(outputPath, await pdfDoc.save());
        return;
    }

    const context = pdfDoc.context;
    const pageHeight = pages[0].getHeight();
    const outlineRef = context.nextRef();

    // Build hierarchical bookmark structure
    const rootItems = [];
    const stack = []; // Track parent chain by level

    for (const bookmark of bookmarks) {
        const item = {
            title: bookmark.title,
            level: bookmark.level,
            pageNum: Math.min(Math.max(0, Math.floor(bookmark.top / 841.89)), pages.length - 1),
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
            Dest: [page.ref, 'XYZ', null, pageHeight, null]
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

    fs.writeFileSync(outputPath, await pdfDoc.save());
}

// --- MAIN CONVERSION FUNCTION ---
async function mdToPdf(inputFile, outputFile, options = {}) {
    const markdown = fs.readFileSync(inputFile, "utf-8");
    headings.length = 0; // Reset headings

    const htmlContent = marked.parse(markdown);
    const documentTitle = options.title || path.basename(inputFile, '.md');

    // Robust rendering with graceful fallback
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>${documentTitle}</title>
    
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">

    <style>${INLINE_STYLES}</style>
</head>
<body>
    <article class="markdown-body">
        ${htmlContent}
    </article>
    
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js"></script>

    <script>
        // Robust rendering with timeout fallback
        window.status = 'loading';
        
        document.addEventListener('DOMContentLoaded', function() {
            // Safety timeout - proceed even if rendering fails
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

    console.log("Launching browser...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();

    // Set content and wait for network idle
    await page.setContent(html, { waitUntil: 'networkidle0' });

    console.log("Waiting for rendering (Math + Syntax highlighting)...");
    await page.waitForFunction("window.status === 'ready'", { timeout: 60000 });

    console.log("Calculating bookmarks...");
    const bookmarkData = [];
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

    console.log("Generating PDF...");
    const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        footerTemplate: `
            <div style="font-size: 9pt; font-family: -apple-system, sans-serif; color: #666; margin: 0 2cm; width: 100%; text-align: center; border-top: 1px solid #ddd; padding-top: 8px;">
                <span style="font-weight: 500;">${documentTitle}</span>
                <span style="margin: 0 1em;">•</span>
                Page <span class="pageNumber"></span> of <span class="totalPages"></span>
            </div>
        `,
        headerTemplate: '<div></div>',
        margin: {
            top: "2cm",
            bottom: "2.5cm",
            left: "2cm",
            right: "2cm"
        }
    });

    await browser.close();

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

    const pdfWithMetadata = await pdfDoc.save();

    // Add bookmarks to the PDF with metadata
    if (bookmarkData.length > 0) {
        console.log(`Injecting ${bookmarkData.length} nested bookmarks...`);
        await addBookmarksToPdf(pdfWithMetadata, outputFile, bookmarkData);
        console.log(`Success! Professional PDF created: ${outputFile}`);
    } else {
        fs.writeFileSync(outputFile, pdfWithMetadata);
        console.log(`Success! PDF created: ${outputFile}`);
    }
}

// --- CLI PARSER ---
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

mdToPdf(flags.input, finalOutputFile, flags).catch(error => {
    console.error("Fatal Error:", error);
    process.exit(1);
});