const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

let win;

function createWindow() {
    win = new BrowserWindow({
        width: 1300,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    win.loadFile(path.join(__dirname, "index.html"));

    win.webContents.on("before-input-event", (event, input) => {
        const ctrl = input.control || input.meta;
        const shift = input.shift;
        const key = (input.key || "").toLowerCase();

        const isReload = ctrl && key === "r" && !shift;
        const isForceReload = ctrl && shift && key === "r";
        const isMinimize = ctrl && key === "m";
        const isClose = ctrl && key === "w";

        if (isReload) {
            win.reload();
            return;
        }

        if (isForceReload) {
            win.webContents.reloadIgnoringCache();
            return;
        }

        if (isMinimize) {
            win.minimize();
            return;
        }

        if (isClose) {
            win.close();
            return;
        }

        event.preventDefault();
    });

    win.webContents.on("devtools-opened", () => {
        win.webContents.closeDevTools();
    });

    Menu.setApplicationMenu(null);

    win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        app.quit();
    }
});
