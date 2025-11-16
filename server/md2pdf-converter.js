import fs from "fs";
import path from "path";
import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";

// Configure marked with KaTeX BEFORE parsing
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
    return `<h${level} id="${id}">${text}</h${level}>`;
};

// Enhanced code renderer to ensure proper syntax highlighting
renderer.code = function (code, language) {
    const lang = language || 'plaintext';
    const validLang = lang.toLowerCase();
    return `<pre><code class="language-${validLang}">${code}</code></pre>`;
};

marked.use({ renderer });

async function addBookmarksToPdf(pdfBuffer, outputPath, bookmarks) {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();

    if (bookmarks.length === 0) {
        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(outputPath, pdfBytes);
        return;
    }

    const context = pdfDoc.context;
    const pageHeight = pages[0].getHeight();

    // Create outline dictionary (root of bookmarks tree)
    const outlineRef = context.nextRef();
    const outlineDict = context.obj({
        Type: 'Outlines'
    });

    // Create bookmark items
    const itemRefs = bookmarks.map(() => context.nextRef());

    for (let i = 0; i < bookmarks.length; i++) {
        const bookmark = bookmarks[i];
        const pageNum = Math.floor(bookmark.top / 900);
        const page = pages[Math.min(pageNum, pages.length - 1)];

        const itemDict = {
            Title: context.obj(bookmark.title),
            Parent: outlineRef,
            Dest: [page.ref, 'XYZ', null, pageHeight, null]
        };

        // Link to previous sibling
        if (i > 0) {
            itemDict.Prev = itemRefs[i - 1];
        }

        // Link to next sibling
        if (i < bookmarks.length - 1) {
            itemDict.Next = itemRefs[i + 1];
        }

        context.assign(itemRefs[i], context.obj(itemDict));
    }

    // Update outline dictionary with first and last items
    outlineDict.set(context.obj('First'), itemRefs[0]);
    outlineDict.set(context.obj('Last'), itemRefs[itemRefs.length - 1]);
    outlineDict.set(context.obj('Count'), context.obj(bookmarks.length));

    context.assign(outlineRef, outlineDict);

    // Add outlines to catalog
    pdfDoc.catalog.set(context.obj('Outlines'), outlineRef);

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, pdfBytes);
}

async function mdToPdf(inputFile, outputFile, title) {
    const markdown = fs.readFileSync(inputFile, "utf-8");

    // Reset headings array for each conversion
    headings.length = 0;

    const htmlContent = marked.parse(markdown);
    const documentTitle = title || path.basename(inputFile, '.md');

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${documentTitle}</title>
    
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Fira+Code:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown.min.css">
    
    <!-- Enhanced Prism theme for better syntax highlighting -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css">
    
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">

    <style>
        * {
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            display: flex;
            justify-content: center;
            background: white;
        }

        .markdown-body {
            box-sizing: border-box;
            min-width: 200px;
            max-width: 980px;
            margin: 0 auto;
            padding: 45px;
            font-size: 16px;
            line-height: 1.7;
        }

        /* Enhanced code block styling with better contrast */
        .markdown-body pre {
            padding: 20px !important;
            border-radius: 8px !important;
            overflow-x: auto !important;
            margin: 1.5em 0 !important;
            /* CRITICAL: Prevent page breaks inside code blocks */
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }
        
        .markdown-body pre > code {
            font-family: 'Fira Code', 'Consolas', 'Monaco', monospace !important;
            font-size: 13px !important;
            line-height: 1.6 !important;
            font-variant-ligatures: none;
            background: transparent !important;
            display: block;
            white-space: pre;
            word-wrap: normal;
        }

        /* Inline code styling */
        .markdown-body code {
            font-family: 'Consolas', 'Monaco', monospace;
            background-color: #f3f4f6;
            color: #e83e8c;
            padding: .2em .4em;
            margin: 0;
            font-size: 85%;
            border-radius: 4px;
            border: 1px solid #e1e4e8;
        }

        /* Reset inline styles for code inside pre blocks */
        .markdown-body pre code {
            padding: 0 !important;
            background-color: transparent !important;
            border-radius: 0 !important;
            border: 0 !important;
            color: inherit !important;
        }

        /* Table styling - prevent page breaks */
        .markdown-body table {
            border-collapse: collapse;
            width: 100%;
            margin: 1.5em 0;
            /* CRITICAL: Prevent page breaks inside tables */
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }

        .markdown-body table th,
        .markdown-body table td {
            border: 1px solid #d0d7de;
            padding: 8px 12px;
        }

        .markdown-body table th {
            background-color: #f6f8fa;
            font-weight: 600;
        }

        .markdown-body table tr:nth-child(even) {
            background-color: #f9fafb;
        }

        /* Prevent orphaned table rows */
        .markdown-body table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }

        /* List items - prevent breaks */
        .markdown-body li {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
        }

        /* Blockquotes - prevent breaks */
        .markdown-body blockquote {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border-left: 4px solid #d0d7de;
            padding: 0 1em;
            color: #57606a;
            margin: 1.5em 0;
        }

        /* Images - prevent breaks */
        .markdown-body img {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            max-width: 100%;
            height: auto;
        }

        /* Paragraphs - keep together when possible */
        .markdown-body p {
            margin: 1em 0;
            orphans: 3;
            widows: 3;
        }

        /* Headings */
        .markdown-body h1,
        .markdown-body h2,
        .markdown-body h3,
        .markdown-body h4,
        .markdown-body h5,
        .markdown-body h6 {
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            font-weight: 600;
            line-height: 1.25;
        }

        /* Horizontal rules */
        .markdown-body hr {
            height: 2px;
            padding: 0;
            margin: 24px 0;
            background-color: #d0d7de;
            border: 0;
            page-break-after: avoid !important;
        }

        /* KaTeX equations - prevent breaks */
        .katex-display {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 1.5em 0;
        }

        @media print {
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
                color-adjust: exact;
            }

            .markdown-body {
                padding: 0;
                font-size: 12pt;
            }

            /* Page break rules */
            h1 {
                page-break-before: always;
                page-break-after: avoid;
            }

            h1:first-child {
                page-break-before: avoid;
            }

            h2, h3, h4, h5, h6 {
                page-break-after: avoid;
                page-break-inside: avoid;
            }

            /* Prevent breaks in various elements */
            pre, 
            blockquote, 
            table, 
            figure, 
            .katex-display,
            ul, 
            ol {
                page-break-inside: avoid;
                break-inside: avoid;
            }

            /* List items */
            li {
                page-break-inside: avoid;
                break-inside: avoid;
            }

            /* Images */
            img {
                page-break-inside: avoid;
                break-inside: avoid;
                page-break-after: avoid;
            }

            /* Paragraphs - widow and orphan control */
            p {
                orphans: 3;
                widows: 3;
            }

            /* Code blocks - ensure they stay together */
            pre code {
                white-space: pre-wrap;
                word-break: break-word;
            }

            /* Keep heading with following content */
            h1, h2, h3, h4, h5, h6 {
                page-break-after: avoid;
            }

            /* Keep heading with at least 2 lines of following content */
            h1 + *, h2 + *, h3 + *, h4 + *, h5 + *, h6 + * {
                page-break-before: avoid;
            }
        }
    </style>
</head>
<body>
    <article class="markdown-body">${htmlContent}</article>
    
    <!-- Prism Core and Language Components -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
    
    <!-- Common programming languages for better support -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-java.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-c.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-cpp.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-csharp.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-typescript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-jsx.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-css.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markup.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-bash.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-json.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-sql.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-yaml.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-markdown.min.js"></script>
    
    <!-- KaTeX -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js"></script>
    
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            try {
                // Render math equations
                renderMathInElement(document.body, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\\\(', right: '\\\\)', display: false},
                        {left: '\\\\[', right: '\\\\]', display: true}
                    ],
                    throwOnError: false
                });

                // Ensure all code blocks have language classes
                document.querySelectorAll('pre code').forEach((block) => {
                    if (!block.className || block.className.indexOf('language-') === -1) {
                        block.className = 'language-plaintext';
                    }
                });

                // Highlight all code blocks
                Prism.highlightAll();

                console.log('Rendering complete - Math and Code highlighted');
            } catch (e) {
                console.error("Error during rendering:", e);
            } finally {
                document.body.classList.add('render-complete');
            }
        });
    </script>
</body>
</html>`;

    console.log("🚀 Launching browser...");
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle0' });

    console.log("🎨 Rendering content...");
    await page.waitForSelector('body.render-complete', { timeout: 30000 });

    // Give extra time for syntax highlighting to complete
    console.log("✅ Rendering complete.");
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log("📄 Generating PDF with bookmarks...");

    // Get element positions for bookmarks
    const bookmarkData = [];
    for (const heading of headings) {
        const position = await page.evaluate((id) => {
            const element = document.getElementById(id);
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return { top: window.scrollY + rect.top };
        }, heading.id);

        if (position) {
            bookmarkData.push({
                title: heading.text,
                level: heading.level,
                top: position.top
            });
        }
    }

    const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        footerTemplate: `
            <div style="font-size: 9px; margin: 0 1cm; width: 100%; text-align: right;">
                <span class="pageNumber"></span> / <span class="totalPages"></span>
            </div>
        `,
        headerTemplate: '<div></div>',
        margin: {
            top: "1.5cm",
            bottom: "1.5cm",
            left: "1cm",
            right: "1cm"
        },
        preferCSSPageSize: false,
        tagged: true
    });

    await browser.close();

    // Write PDF with bookmarks using pdf-lib
    if (bookmarkData.length > 0) {
        console.log("🔖 Adding bookmarks to PDF...");
        await addBookmarksToPdf(pdfBuffer, outputFile, bookmarkData);
        console.log(`✨ PDF created successfully with ${bookmarkData.length} bookmarks: ${outputFile}`);
    } else {
        fs.writeFileSync(outputFile, pdfBuffer);
        console.log(`✨ PDF created successfully: ${outputFile}`);
    }
}

const [, , inputFile, outputFile, title] = process.argv;

if (!inputFile) {
    console.error("❌ Usage: node script.js <input.md> [output.pdf] [title]");
    process.exit(1);
}
const finalOutputFile = outputFile || `${path.basename(inputFile, '.md')}.pdf`;
mdToPdf(inputFile, finalOutputFile, title).catch(error => {
    console.error("❌ An error occurred:", error);
    process.exit(1);
});