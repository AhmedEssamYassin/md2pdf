import express from 'express';
import cors from "cors";
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { mdToPdf, closeBrowserInstance } from './md2pdf-converter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const MARKDOWN_EXTS = ['.md', '.markdown'];
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];

const CONFIG = {
    PORT: process.env.PORT || 3000,
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    UPLOAD_DIR: 'uploads',
    OUTPUT_DIR: 'outputs',
    CLIENT_DIR: path.join(__dirname, process.env.NODE_ENV === 'production' ? '../client/dist' : '../client'),
    ALLOWED_EXTENSIONS: [...MARKDOWN_EXTS, ...IMAGE_EXTS],
    ALLOWED_MIMETYPES: ['text/markdown', 'text/x-markdown', 'text/plain', 'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp']
};

const app = express();

// Middleware for JSON and URL-encoded data
app.use(cors()); // Allows requests from frontend
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, CONFIG.UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Generate unique filename to avoid conflicts
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
});

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isValidExt = CONFIG.ALLOWED_EXTENSIONS.includes(ext);
    const isValidMime = CONFIG.ALLOWED_MIMETYPES.includes(file.mimetype) || !file.mimetype;

    if (isValidExt || isValidMime) {
        cb(null, true);
    } else {
        cb(new Error('Only Markdown files (.md, .markdown) and image files (.png, .jpg, .jpeg, .gif, .svg, .webp) are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: CONFIG.MAX_FILE_SIZE, }
});

// Serve static files from client directory
app.use(express.static(CONFIG.CLIENT_DIR));

// API Routes
app.post('/api/convert', upload.array('files', 50), async (req, res) => {
    let inputFiles = [];
    let imageFiles = [];
    let outputFiles = [];
    let zipFile;

    const markdownExts = ['.md', '.markdown'];
    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];

    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                error: 'No markdown files were uploaded',
                code: 'NO_FILE'
            });
        }

        const markdownFiles = req.files.filter(f => MARKDOWN_EXTS.includes(path.extname(f.originalname).toLowerCase()));
        const uploadedImageFiles = req.files.filter(f => IMAGE_EXTS.includes(path.extname(f.originalname).toLowerCase()));

        if (markdownFiles.length === 0) {
            return res.status(400).json({
                error: 'No markdown files were uploaded',
                code: 'NO_FILE'
            });
        }

        const imageMap = {};
        uploadedImageFiles.forEach(img => {
            const basename = path.basename(img.originalname);
            imageMap[basename] = img.path;
        });
        imageFiles = uploadedImageFiles.map(f => f.path);

        // Convert all files to PDF
        for (const file of markdownFiles) {
            const inputFile = file.path;
            const originalName = path.parse(file.originalname).name;
            let outputName = `${originalName}.pdf`;

            // Sanitize filename for security
            outputName = sanitizeFilename(outputName);
            const outputFile = path.join(CONFIG.OUTPUT_DIR, `${Date.now()}-${outputName}`);

            console.log(`Converting: ${file.originalname} -> ${outputName}`);
            await runMdToPdf(inputFile, outputFile, originalName, req.body, imageMap);

            if (!fs.existsSync(outputFile)) {
                throw new Error(`PDF generation failed for ${file.originalname}`);
            }

            inputFiles.push(inputFile);
            outputFiles.push({ path: outputFile, name: outputName });
        }

        // If only one file, send it directly without zipping
        if (outputFiles.length === 1) {
            const singleFile = outputFiles[0];
            const outputName = sanitizeFilename(req.body.outputName || singleFile.name);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${outputName}"`);
            res.setHeader('Cache-Control', 'no-cache');

            const fileStream = fs.createReadStream(singleFile.path);
            fileStream.pipe(res);

            fileStream.on('error', (err) => {
                console.error('Error streaming file:', err);
                cleanupFiles([...inputFiles, ...imageFiles, singleFile.path]);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Failed to send file' });
                }
            });

            res.on('close', () => {
                cleanupFiles([...inputFiles, ...imageFiles, singleFile.path]);
            });

            return; // Exit early for single file
        }

        // Multiple files: create ZIP
        const zipName = req.body.outputName || 'converted_files.zip';
        zipFile = path.join(CONFIG.OUTPUT_DIR, `${Date.now()}-${sanitizeFilename(zipName)}`);

        // Create a zip archive
        const output = fs.createWriteStream(zipFile);
        const archive = archiver('zip', { zlib: { level: 9 } });

        archive.on('error', (err) => {
            console.error('Zip Error:', err);
            const uploadedFiles = req.files ? req.files.map(f => f.path) : [];
            cleanupFiles([...uploadedFiles, ...imageFiles, ...outputFiles.map(f => f.path), zipFile]);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Zip creation failed' });
            }
            res.end();
        });
        archive.pipe(output);

        output.on('close', () => {
            if (res.headersSent) return;

            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
            res.setHeader('Cache-Control', 'no-cache');

            const fileStream = fs.createReadStream(zipFile);
            fileStream.pipe(res);

            fileStream.on('error', (err) => {
                console.error('Error streaming zip:', err);
                cleanupFiles([...inputFiles, ...imageFiles, ...outputFiles.map(f => f.path), zipFile]);
            });

            res.on('close', () => {
                cleanupFiles([...inputFiles, ...imageFiles, ...outputFiles.map(f => f.path), zipFile]);
            });
        });

        // Add all PDFs to the archive
        outputFiles.forEach(file => {
            archive.file(file.path, { name: file.name });
        });

        await archive.finalize();

    } catch (error) {
        console.error('Conversion error:', error);

        // Clean up files if conversion failed
        const uploadedFiles = req.files ? req.files.map(f => f.path) : [];
        cleanupFiles([...uploadedFiles, ...imageFiles, ...outputFiles.map(f => f.path), zipFile]);

        if (!res.headersSent) {
            res.status(500).json({
                error: 'Conversion failed',
                details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                code: 'CONVERSION_FAILED'
            });
        }
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Markdown to PDF converter is running',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime()
    });
});

// Serve index.html for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(CONFIG.CLIENT_DIR, 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);

    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: 'File too large',
                details: `Maximum file size is ${CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`,
                code: 'FILE_TOO_LARGE'
            });
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                error: 'Invalid file upload',
                details: 'Unexpected upload field name. Use "files" as the field name.',
                code: 'INVALID_UPLOAD'
            });
        }
    }

    if (error.message.includes('Markdown files (.md, .markdown) and image files')) {
        return res.status(400).json({
            error: 'Invalid file type',
            details: 'Only .md, .markdown and image files (.png, .jpg, .jpeg, .gif, .svg, .webp) are supported',
            code: 'INVALID_FILE_TYPE'
        });
    }

    if (!res.headersSent) {
        res.status(500).json({
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Utility Functions
async function runMdToPdf(inputFile, outputFile, title, requestBody = {}, imageMap = {}) {
    try {
        await mdToPdf(inputFile, outputFile, {
            title: title,
            author: requestBody.author || undefined,
            coverPage: requestBody.coverPage !== 'false',
            toc: requestBody.toc !== 'false',
            watermark: requestBody.watermark || undefined,
            imageMap: imageMap
        });
    } catch (error) {
        throw new Error(`md-to-pdf process failed: ${error.message}`);
    }
}

function sanitizeFilename(filename) {
    return filename
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/\.+/g, '.')
        .substring(0, 255)
        .trim();
}

function cleanupFiles(files) {
    files.forEach(file => {
        if (file && fs.existsSync(file)) {
            fs.unlink(file, (err) => {
                if (err) console.error(`Error deleting file ${file}:`, err);
                else console.log(`Cleaned up: ${file}`);
            });
        }
    });
}

function ensureDirectories() {
    const dirs = [CONFIG.UPLOAD_DIR, CONFIG.OUTPUT_DIR];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        }
    });
}

function validateEnvironment() {
    const nodeVersion = process.version;
    console.log(`Node.js version: ${nodeVersion}`);
}

// Start the server
function startServer() {
    ensureDirectories();
    validateEnvironment();

    const server = app.listen(CONFIG.PORT, () => {
        console.log(`Markdown to PDF Converter server running on http://localhost:${CONFIG.PORT}`);
        console.log(`Client files served from: ${CONFIG.CLIENT_DIR}`);
        console.log(`Upload directory: ${CONFIG.UPLOAD_DIR}`);
        console.log(`Output directory: ${CONFIG.OUTPUT_DIR}`);
        console.log(`Max file size: ${CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    process.on('SIGINT', () => gracefulShutdown(server));
    process.on('SIGTERM', () => gracefulShutdown(server));

    return server;
}

function gracefulShutdown(server) {
    console.log('\nShutting down server...');

    server.close(async () => {
        try {
            await closeBrowserInstance();
        } catch (e) {
            console.error('Error closing browser:', e);
        }
        console.log('Server closed');

        // Clean up temporary files
        try {
            [CONFIG.UPLOAD_DIR, CONFIG.OUTPUT_DIR].forEach(dir => {
                if (fs.existsSync(dir)) {
                    const files = fs.readdirSync(dir);
                    files.forEach(file => {
                        fs.unlinkSync(path.join(dir, file));
                    });
                }
            });
            console.log('Cleaned up temporary files');
        } catch (err) {
            console.error('Error during cleanup:', err.message);
        }

        process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
}

// Start the server
startServer();