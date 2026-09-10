const { protocol } = require("electron");
const path = require("path");
const fs = require("fs");

function resolveFileTarget(requestUrl, shell) {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(requestUrl).pathname);
    } catch (e) {
        pathname = requestUrl;
    }
    if (/^\/[A-Za-z]:/.test(pathname)) pathname = pathname.slice(1);

    let target = path.normalize(pathname);
    try {
        if (fs.statSync(target).isDirectory()) {
            target = path.join(target, "index.html");
        }
    } catch (e) {
        target = shell;
    }
    return target;
}

function registerSpaFileProtocol(appRoot) {
    const shell = path.join(appRoot, "index.html");
    try {
        protocol.interceptFileProtocol("file", (request, callback) => {
            callback(resolveFileTarget(request.url, shell));
        });
    } catch (e) {
        protocol.handle("file", (request) => {
            const target = resolveFileTarget(request.url, shell);
            const type = "text/html; charset=utf-8";
            return new Response(fs.readFileSync(target), {
                headers: { "Content-Type": type },
            });
        });
    }
}

module.exports = { registerSpaFileProtocol, resolveFileTarget };
