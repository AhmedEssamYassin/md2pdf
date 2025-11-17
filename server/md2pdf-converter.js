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
    // Note: We add a specific class 'section-heading' for CSS page-break logic
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
// DIRECTION 3: Editorial Polish & DIRECTION 2: Smart Layout
// We inline the CSS to ensure it works even if external styles fail to load
const INLINE_STYLES = `
    :root {
        --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        --font-code: "Consolas", monospace;
        --color-text: #24292f;
        --color-border: #d0d7de;
        --color-bg-code: #f6f8fa;
    }

    /* CSS RESET & PRINT SETUP */
    @page {
        margin: 2cm;
    }

    body {
        font-family: var(--font-body);
        font-size: 14px; /* Slightly smaller for better PDF density */
        line-height: 1.6;
        color: var(--color-text);
        max-width: 100%;
        margin: 0;
        text-align: left; /* Professional book look */
    }

    /* AUTO-NUMBERING (DIRECTION 3) */
    body { counter-reset: h1counter; }
    
    h1 { counter-reset: h2counter; }
    h1::before {
        counter-increment: h1counter;
        content: counter(h1counter) ". ";
        color: #555;
    }

    h2 { counter-reset: h3counter; }
    h2::before {
        counter-increment: h2counter;
        content: counter(h1counter) "." counter(h2counter) " ";
        color: #555;
    }
    
    h3::before {
        counter-increment: h3counter;
        content: counter(h1counter) "." counter(h2counter) "." counter(h3counter) " ";
        color: #555;
    }

    /* HEADINGS */
    h1, h2, h3, h4, h5, h6 {
        margin-top: 1.5em;
        margin-bottom: 0.5em;
        font-weight: 600;
        line-height: 1.25;
        /* DIRECTION 2: Keep headings attached to content below */
        page-break-after: avoid;
        break-after: avoid;
    }

    h1 { font-size: 2em; border-bottom: 1px solid var(--color-border); padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; }
    h3 { font-size: 1.25em; }

    /* CODE BLOCKS (DIRECTION 2) */
    pre {
        background-color: var(--color-bg-code);
        padding: 12px;
        border-radius: 6px;
        overflow-x: auto;
        font-family: var(--font-code);
        font-size: 12px;
        border: 1px solid var(--color-border);
        
        /* Smart breaking: try to keep together, but allow break if it's huge */
        page-break-inside: avoid; 
        break-inside: avoid;
    }
    
    /* If a code block is massive, we must allow it to break or it disappears */
    @media print {
        pre {
            white-space: pre-wrap; /* Wraps long lines instead of scrolling off page */
            word-break: break-all;
        }
    }

    code {
        font-family: var(--font-code);
        background-color: rgba(175, 184, 193, 0.2);
        padding: 0.2em 0.4em;
        border-radius: 4px;
        font-size: 85%;
    }

    pre code {
        background-color: transparent;
        padding: 0;
        font-size: 100%;
    }
    /* Lists */    
    ul, ol {
        padding-left: 2em;
        margin: 1em 0;
        /* 1. Keep the list items together */
        page-break-inside: avoid; 
        break-inside: avoid;
        
        /* 2. Glue the list to the paragraph immediately before it */
        /* This ensures "Key Insights" intro text jumps to Page 2 if the list does */
        page-break-before: avoid;
        break-before: avoid;
    }

    li {
        /* Keep a single bullet point content together */
        page-break-inside: avoid;
        break-inside: avoid;
        margin-bottom: 0.25em;
    }
    /* TABLES */
    table {
        border-collapse: collapse;
        width: 100%;
        margin: 1em 0;
        page-break-inside: avoid; /* Don't split tables */
    }
    
    th, td {
        border: 1px solid var(--color-border);
        padding: 8px;
        text-align: left;
    }
    
    th { background-color: var(--color-bg-code); font-weight: 600; }
    tr:nth-child(even) { background-color: #fafafa; }

    /* MISC */
    blockquote {
        border-left: 4px solid var(--color-border);
        padding: 0 1em;
        color: #57606a;
        margin: 1em 0;
    }

    img {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 1em auto;
        page-break-inside: avoid;
    }
    
    .katex-display {
        overflow-x: auto;
        overflow-y: hidden;
        margin: 1em 0;
        padding: 0.5em 0;
        page-break-inside: avoid;
    }
`;

// --- PDF BOOKMARK FUNCTION ---
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
    const outlineDict = context.obj({ Type: 'Outlines' });
    const itemRefs = bookmarks.map(() => context.nextRef());

    for (let i = 0; i < bookmarks.length; i++) {
        const bookmark = bookmarks[i];
        const pageNum = Math.floor(bookmark.top / 841.89); // Approx A4 height in pts (adjust if needed)
        // Clamp page number to valid range
        const targetPageIdx = Math.min(Math.max(0, pageNum), pages.length - 1);
        const page = pages[targetPageIdx];

        const itemDict = {
            Title: context.obj(bookmark.title),
            Parent: outlineRef,
            Dest: [page.ref, 'XYZ', null, pageHeight, null] // Top of page
        };

        if (i > 0) itemDict.Prev = itemRefs[i - 1];
        if (i < bookmarks.length - 1) itemDict.Next = itemRefs[i + 1];

        context.assign(itemRefs[i], context.obj(itemDict));
    }

    outlineDict.set(context.obj('First'), itemRefs[0]);
    outlineDict.set(context.obj('Last'), itemRefs[itemRefs.length - 1]);
    outlineDict.set(context.obj('Count'), context.obj(bookmarks.length));

    context.assign(outlineRef, outlineDict);
    pdfDoc.catalog.set(context.obj('Outlines'), outlineRef);

    fs.writeFileSync(outputPath, await pdfDoc.save());
}

// --- MAIN CONVERSION FUNCTION ---
async function mdToPdf(inputFile, outputFile, title) {
    const markdown = fs.readFileSync(inputFile, "utf-8");
    headings.length = 0; // Reset headings

    const htmlContent = marked.parse(markdown);
    const documentTitle = title || path.basename(inputFile, '.md');

    // DIRECTION 1: Robust Logic
    // We add a specific "signal" script that sets window.status = 'ready'
    // only when fonts, math, and highlighting are actually done.
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${documentTitle}</title>
    
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css">
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
        // DIRECTION 1: Robust Event Locking
        window.status = 'loading';
        
        document.addEventListener('DOMContentLoaded', function() {
            // 1. Render Math
            try {
                renderMathInElement(document.body, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\\\(', right: '\\\\)', display: false},
                        {left: '\\\\[', right: '\\\\]', display: true}
                    ],
                    throwOnError: false
                });
            } catch(e) { console.error(e); }

            // 2. Trigger Syntax Highlight
            // We wrap Prism in a promise to ensure we wait for it
            const highlightPromise = new Promise((resolve) => {
                if (window.Prism) {
                    Prism.highlightAll();
                    // Give it a small buffer for the DOM to repaint
                    setTimeout(resolve, 100); 
                } else {
                    resolve();
                }
            });

            highlightPromise.then(() => {
                console.log('Rendering Done');
                // DIRECTION 1: The Signal
                window.status = 'ready'; 
                // Add a class for visual debugging if needed
                document.body.classList.add('render-complete');
            });
        });
    </script>
</body>
</html>`;

    console.log("Launching browser...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set content and wait for network idle (downloads finished)
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // DIRECTION 1: Wait for the Explicit Signal
    console.log("Waiting for rendering logic (Math + Syntax)...");
    await page.waitForFunction("window.status === 'ready'", { timeout: 60000 });

    console.log("Calculating bookmarks...");
    // Get element positions
    const bookmarkData = [];
    for (const heading of headings) {
        const position = await page.evaluate((id) => {
            const element = document.getElementById(id);
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            // We use window.scrollY in case the viewport scrolled, though usually 0 in print
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

    console.log("Printing PDF...");
    const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        // DIRECTION 3: Better Footer
        footerTemplate: `
            <div style="font-size: 10px; font-family: sans-serif; color: #999; margin: 0 2cm; width: 100%; text-align: center; border-top: 1px solid #eee; padding-top: 5px;">
                Page <span class="pageNumber"></span> of <span class="totalPages"></span>
            </div>
        `,
        headerTemplate: '<div></div>', // Keep empty to avoid default date/title
        margin: {
            top: "2cm",
            bottom: "2cm",
            left: "2cm",
            right: "2cm"
        }
    });

    await browser.close();

    if (bookmarkData.length > 0) {
        console.log("Injecting bookmarks...");
        await addBookmarksToPdf(pdfBuffer, outputFile, bookmarkData);
        console.log(`Success! PDF with bookmarks: ${outputFile}`);
    } else {
        fs.writeFileSync(outputFile, pdfBuffer);
        console.log(`Success! PDF created: ${outputFile}`);
    }
}

// CLI Execution
const [, , inputFile, outputFile, title] = process.argv;

if (!inputFile) {
    console.error("Usage: node script.js <input.md> [output.pdf] [title]");
    process.exit(1);
}
const finalOutputFile = outputFile || `${path.basename(inputFile, '.md')}.pdf`;

mdToPdf(inputFile, finalOutputFile, title).catch(error => {
    console.error("Fatal Error:", error);
    process.exit(1);
});