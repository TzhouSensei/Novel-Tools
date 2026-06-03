const { contextBridge } = require("electron");
const fs = require("fs");
const path = require("path");

contextBridge.exposeInMainWorld("api", {
    readFile: (filePath) => {
        return fs.readFileSync(filePath, "utf-8");
    },

    writeFile: (filePath, data) => {
        fs.writeFileSync(filePath, data, "utf-8");
    },

    readJSON: (filePath) => {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    },

    writeJSON: (filePath, obj) => {
        fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
    },

    joinPath: (...args) => path.join(...args),
});
