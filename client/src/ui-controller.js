"use strict";

export class UIController {
    constructor() {
        this.DOM = {
            selectFile: document.getElementById('selectFileButton'),
            dropZone: document.getElementById('dropZone'),
            fileInput: document.getElementById('fileInput'),
            fileInfo: document.getElementById('fileInfo'),
            fileList: document.getElementById('fileList'),
            outputName: document.getElementById('outputName'),
            convertBtn: document.getElementById('convertBtn'),
            removeFileBtn: document.getElementById('removeFileBtn'),
            convertText: document.getElementById('convertText'),
            spinner: document.getElementById('spinner'),
            progressBar: document.getElementById('progressBar'),
            progressFill: document.getElementById('progressFill'),
            statusMessage: document.getElementById('statusMessage')
        };

        this.validateDOM();
    }

    validateDOM() {
        const required = [
            "dropZone", "fileInput", "fileInfo", "outputName", "convertBtn",
            "convertText", "progressBar", "progressFill", "statusMessage"
        ];
        const missing = required.filter(k => !this.DOM[k]);
        if (missing.length > 0) throw new Error(`Missing DOM: ${missing.join(", ")}`);
    }

    // UI helpers
    showFileInfo(files) {
        // Force a reflow to ensure the animation works even when quickly toggling
        this.DOM.fileInfo.style.display = 'none';
        this.DOM.fileInfo.offsetHeight; // Trigger reflow
        this.DOM.fileInfo.style.display = '';

        this.DOM.fileList.innerHTML = files.map(file => `
        <div class="flex items-center gap-3 relative mb-3 last:mb-0">
            <div class="w-10 h-10 bg-slate-700 border border-blue-500 rounded flex items-center justify-center text-blue-500 font-semibold text-xs">MD</div>
            <div class="flex-1">
                <div class="font-semibold text-slate-50 mb-1 text-sm">${file.name}</div>
                <div class="text-slate-400 text-xs">${file.size}</div>
            </div>
            <button class="remove-file-btn bg-red-600 border border-red-500 rounded w-8 h-8 flex items-center justify-center text-white cursor-pointer transition-all duration-200 hover:bg-red-700 hover:scale-105 active:scale-95" data-index="${file.index}" title="Remove file">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="pointer-events: none;">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
    `).join('');

        this.DOM.fileInfo.classList.remove('hidden');
    }

    hideFileInfo() {
        this.DOM.fileInfo.classList.add('hidden');
    }

    animateFileSelection() {
        // Add a subtle animation when file is selected
        this.DOM.fileInfo.style.transform = 'scale(0.95)';
        this.DOM.fileInfo.style.opacity = '0';

        setTimeout(() => {
            this.DOM.fileInfo.style.transform = 'scale(1)';
            this.DOM.fileInfo.style.opacity = '1';
        }, 100);
    }

    enableConvertBtn() {
        this.DOM.convertBtn.disabled = false;
        this.DOM.convertText.textContent = "Convert to PDF";
    }

    disableConvertBtn() {
        this.DOM.convertBtn.disabled = true;
    }

    setProcessingState() {
        this.disableConvertBtn();
        this.DOM.convertBtn.classList.add("processing");
        this.DOM.spinner?.classList.remove("hidden");
        this.DOM.convertText.textContent = "Converting...";
    }

    resetConvertBtn() {
        this.enableConvertBtn();
        this.DOM.convertBtn.classList.remove("processing");
        this.DOM.spinner?.classList.add("hidden");
        this.DOM.convertText.textContent = "Convert to PDF";
    }

    // Progress
    showProgress() {
        this.DOM.progressBar.classList.remove('hidden');
        this.updateProgress(0);
    }

    hideProgress() {
        this.DOM.progressBar.classList.add('hidden');
        this.updateProgress(0);
    }

    updateProgress(p) {
        this.DOM.progressFill.style.width = `${Math.min(p, 100)}%`;
        this.DOM.progressFill.style.transition = 'width 0.3s ease';
    }

    // Status
    showStatus(msg, type = "info") {
        const el = this.DOM.statusMessage;
        el.textContent = msg;

        // Remove all status classes first
        el.classList.remove("status-success", "status-error", "hidden");

        // Add appropriate class based on type
        if (type === "success") {
            el.classList.add("status-success");
        } else if (type === "error") {
            el.classList.add("status-error");
        }
    }

    hideStatus() {
        const el = this.DOM.statusMessage;
        el.classList.remove("status-success", "status-error");
        el.classList.add("hidden");
    }
}