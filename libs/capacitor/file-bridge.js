(function () {
    const getPlugins = () => {
        const capacitor = window.Capacitor;
        return capacitor && capacitor.Plugins ? capacitor.Plugins : null;
    };

    const getFilesystem = () => {
        const plugins = getPlugins();
        return plugins && plugins.Filesystem ? plugins.Filesystem : null;
    };

    const getPicker = () => {
        const plugins = getPlugins();
        return (plugins && (plugins.FilePicker || plugins.Filesystem)) || null;
    };

    const isNative = () => {
        const capacitor = window.Capacitor;
        if (!capacitor) return false;
        if (typeof capacitor.isNativePlatform === "function") {
            return capacitor.isNativePlatform();
        }
        return Boolean(capacitor.Plugins);
    };

    const base64ToBlob = (data, type) => {
        const raw = atob(String(data).replace(/^data:[^;]+;base64,/, ""));
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        return new Blob([bytes], { type: type || "application/octet-stream" });
    };

    const fileFromPicked = async (picked, filesystem, fallbackName, type) => {
        if (picked.data) {
            const blob = base64ToBlob(picked.data, picked.mimeType || type);
            return new File([blob], picked.name || fallbackName, {
                type: picked.mimeType || type || blob.type,
            });
        }

        if (!picked.path || !filesystem || typeof filesystem.readFile !== "function") {
            throw new Error("Native picker không trả về dữ liệu file");
        }

        let result;
        try {
            result = await filesystem.readFile({ path: picked.path });
        } catch (error) {
            result = await filesystem.readFile({
                path: picked.path,
                directory: "Documents",
            });
        }
        const blob = base64ToBlob(result.data, picked.mimeType || type);
        return new File([blob], picked.name || fallbackName, {
            type: picked.mimeType || type || blob.type,
        });
    };

    const pickFile = async ({ types, name = "selected-file" } = {}) => {
        if (!isNative()) return null;
        const picker = getPicker();
        if (!picker || typeof picker.pickFiles !== "function") return null;

        const result = await picker.pickFiles({
            types: types || ["*/*"],
            multiple: false,
            readData: true,
        });
        const picked = result && result.files && result.files[0];
        if (!picked) return null;
        return fileFromPicked(picked, getFilesystem(), name, types && types[0]);
    };

    const blobToBase64 = async (blob) => {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        return btoa(binary);
    };

    const safeFilename = (name) => {
        const value = String(name || "download")
            .replace(/[<>:"/\\|?*\r\n]/g, "_")
            .trim();
        return value || "download";
    };

    const saveFile = async (blob, name) => {
        if (!isNative()) return false;
        const filesystem = getFilesystem();
        if (!filesystem || typeof filesystem.writeFile !== "function") return false;

        await filesystem.writeFile({
            path: safeFilename(name),
            data: await blobToBase64(blob),
            directory: "Documents",
        });
        return true;
    };

    const downloadFile = async (blob, name) => {
        if (isNative()) {
            if (await saveFile(blob, name)) return true;
        }
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
        return false;
    };

    window.CapacitorFileBridge = {
        isNative,
        canPick: () => isNative() && Boolean(getPicker() && typeof getPicker().pickFiles === "function"),
        pickFile,
        saveFile,
        downloadFile,
    };
})();
