"use strict";

export class FileHandler {
    static VALID_EXTENSIONS = /\.(md|markdown)$/i;
    static MAX_MB = 50;

    isValid(file) {
        return this.isValidExtension(file) && this.isValidSize(file);
    }
    isValidExtension(file) {
        return file && file.name && FileHandler.VALID_EXTENSIONS.test(file.name);
    }
    isValidSize(file) {
        return file.size <= FileHandler.MAX_MB * 1024 * 1024;
    }
    formatSize(bytes) {
        if (bytes === 0) return "0 Bytes";
        const k = 1024, i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(2)} ${["Bytes", "KB", "MB", "GB"][i]}`;
    }
    defaultOutputName(name) {
        const base = name.replace(FileHandler.VALID_EXTENSIONS, "");
        return `${base}.pdf`;
    }
}
