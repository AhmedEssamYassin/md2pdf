"use strict";

import { UIController } from "./ui-controller.js";
import { FileHandler } from "./file-handler.js";
import { ConverterService } from "./converter-service.js";

class App {
    constructor() {
        this.ui = new UIController();
        this.files = new FileHandler();
        this.converter = new ConverterService();
        this.selectedFiles = [];
    }

    init() {
        const { DOM } = this.ui;

        // File selection events
        DOM.dropZone.addEventListener("click", () => DOM.fileInput.click());
        DOM.dropZone.addEventListener("dragover", e => this.handleDrag(e, true));
        DOM.dropZone.addEventListener("dragleave", e => this.handleDrag(e, false));
        DOM.dropZone.addEventListener("drop", e => this.handleDrop(e));
        DOM.fileInput.addEventListener("change", e => this.handleFileInput(e));

        // Action buttons
        DOM.convertBtn.addEventListener("click", () => this.handleConvert());
        document.getElementById('fileList').addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-file-btn');
            if (removeBtn) {
                const index = parseInt(removeBtn.dataset.index, 10);
                this.handleRemoveFile(index);
            }
        });
        // Only add remove button listener if the element exists
        if (DOM.removeFileBtn) { DOM.removeFileBtn.addEventListener("click", () => this.handleRemoveFile()); }

        // Prevent default drag behavior on document
        document.addEventListener("dragover", e => e.preventDefault());
        document.addEventListener("drop", e => e.preventDefault());

        this.reset();
    }

    handleDrag(e, over) {
        e.preventDefault();
        e.stopPropagation();
        this.ui.DOM.dropZone.classList.toggle("dragover", over);
    }
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        this.ui.DOM.dropZone.classList.remove("dragover");
        if (e.dataTransfer.files.length) this.handleFiles(e.dataTransfer.files);
    }
    handleFileInput(e) { if (e.target.files.length) this.handleFiles(e.target.files); }

    handleFiles(files) {
        const validFiles = Array.from(files).filter(file => {
            if (!this.files.isValidExtension(file)) {
                this.ui.showStatus(`Invalid file type: ${file.name}`, "error");
                return false;
            }
            if (!this.files.isValidSize(file)) {
                this.ui.showStatus(`File too large: ${file.name}`, "error");
                return false;
            }
            return true;
        });

        if (validFiles.length === 0) {
            return;
        }

        this.selectedFiles.push(...validFiles);

        // Always reset file input to allow re-selecting the same file
        this.ui.DOM.fileInput.value = "";

        this.ui.showFileInfo(this.selectedFiles.map((file, index) => ({
            name: file.name,
            size: this.files.formatSize(file.size),
            index,
            icon: this.files.getFileIcon(file)
        })));

        if (this.hasMarkdownFiles()) {
            this.ui.enableConvertBtn();
            this.ui.hideStatus();
        }
    }

    hasMarkdownFiles() {
        return this.selectedFiles.some(f => this.files.isMarkdown(f));
    }

    handleRemoveFile(index) {
        this.selectedFiles.splice(index, 1);

        if (this.selectedFiles.length > 0) {
            // Still have files, update the display
            this.ui.showFileInfo(this.selectedFiles.map((file, index) => ({
                name: file.name,
                size: this.files.formatSize(file.size),
                index,
                icon: this.files.getFileIcon(file)
            })));
            if (this.hasMarkdownFiles()) {
                this.ui.enableConvertBtn();
            } else {
                this.ui.showStatus("At least one Markdown file is required", "error");
                this.ui.disableConvertBtn();
            }
        } else {
            // No files left, reset everything
            this.ui.hideFileInfo();
            this.ui.resetConvertBtn();
            this.ui.DOM.fileInput.value = ""; // Reset file input
            this.ui.DOM.outputName.value = ""; // Reset output name
        }
    }

    async handleConvert() {
        if (this.selectedFiles.length === 0) return this.ui.showStatus("No files selected", "error");

        const markdownFile = this.selectedFiles.find(f => this.files.isMarkdown(f));
        if (!markdownFile) return this.ui.showStatus("At least one Markdown file is required", "error");

        // Determine output name based on file count
        let outputName;
        if (this.selectedFiles.filter(f => this.files.isMarkdown(f)).length === 1) {
            // Single markdown file: use .pdf extension
            const baseName = markdownFile.name.replace(/\.(md|markdown)$/i, '');
            outputName = this.ui.DOM.outputName.value.trim() || `${baseName}.pdf`;
            // Ensure .pdf extension for single files
            if (!outputName.endsWith('.pdf')) {
                outputName = outputName.replace(/\.(zip|pdf)$/i, '') + '.pdf';
            }
        } else {
            // Multiple files: use .zip extension
            outputName = this.ui.DOM.outputName.value.trim() || 'converted_files.zip';
            // Ensure .zip extension for multiple files
            if (!outputName.endsWith('.zip')) {
                outputName = outputName.replace(/\.(zip|pdf)$/i, '') + '.zip';
            }
        }

        this.ui.setProcessingState();
        this.ui.hideStatus();

        try {
            const blob = await this.converter.convert(this.selectedFiles, outputName);
            this.converter.download(blob, outputName);
            this.ui.showStatus("Conversion completed!", "success");

            // Reset after successful conversion
            setTimeout(() => {
                this.reset();
            }, 10000);

        } catch (err) {
            this.ui.showStatus(`Conversion failed: ${err.message}`, "error");
            this.ui.resetConvertBtn();
        }
    }

    reset() {
        this.selectedFiles = [];
        this.ui.hideFileInfo();
        this.ui.hideStatus();
        this.ui.resetConvertBtn();
        this.ui.DOM.fileInput.value = "";
        this.ui.DOM.outputName.value = "";
    }
}

document.addEventListener("DOMContentLoaded", () => new App().init());
