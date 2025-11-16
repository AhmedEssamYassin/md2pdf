"use strict";

export class ConverterService {
    async convert(files, outputName) {
        const formData = new FormData();
        files.forEach(file => {
            formData.append("markdowns", file);
        });
        formData.append("outputName", outputName);

        const res = await fetch("/api/convert", { method: "POST", body: formData });
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const blob = await res.blob();

        // Accept both PDF and ZIP responses
        const validTypes = ["application/zip", "application/pdf"];
        if (!validTypes.includes(blob.type)) {
            throw new Error("Invalid response type");
        }

        return blob;
    }

    download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.style.display = "none";
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
    }
}