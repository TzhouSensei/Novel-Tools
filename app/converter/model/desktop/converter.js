import { parseEpubAdvanced } from "../../parser/epubParser.js";

const fileInput = document.getElementById("file");
const output = document.getElementById("output");
const btn = document.getElementById("download");

let state = { characters: [] };
let cached = null;
let renderMode = { open: "{", close: "}" };
let finalTxt = "";

const modes = [
    { name: "{}", open: "{", close: "}" },
    { name: "⟨⟩", open: "⟨", close: "⟩" },
    { name: "⟦⟧", open: "⟦", close: "⟧" },
    { name: "⟪⟫", open: "⟪", close: "⟫" },
    { name: "⟬⟭", open: "⟬", close: "⟭" },
    { name: "⌈⌋", open: "⌈", close: "⌋" },
    { name: "⌊⌉", open: "⌊", close: "⌉" },
    { name: "⌜⌟", open: "⌜", close: "⌟" },
    { name: "⌞⌝", open: "⌞", close: "⌝" },
];

const container = document.createElement("div");
document.body.insertBefore(container, fileInput);

function renderModeUI() {
    modeContainer.innerHTML = "";
    delimiterModes.forEach((mode, idx) => {
        const label = document.createElement("label");
        label.style.marginRight = "10px";
        label.style.cursor = "pointer";

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "chapterMode";
        radio.value = idx;

        if (mode.open === renderMode.open && mode.close === renderMode.close) {
            radio.checked = true;
        }

        radio.addEventListener("change", () => {
            renderMode.open = mode.open;
            renderMode.close = mode.close;

            if (window.__lastRender) {
                output.value = render(state.characters);
            }
        });

        label.appendChild(radio);
        label.appendChild(document.createTextNode(" " + mode.name));
        modeContainer.appendChild(label);
    });
}

function render() {
    let out = "";

    out += `<>\n${cached.title}\n</>\n\n`;

    out += `<info>\n`;
    out += `Author: ${cached.creator}\n`;
    out += `Genre: ${cached.genre}\n`;
    out += `Chapters: ${cached.validChapters.length}\n`;
    out += `${cached.description}\n`;
    out += `</info>\n\n`;

    out += `[\n${state.characters.map((c) => "- " + c).join("\n")}\n]\n\n`;

    out += `<list>\n`;

    cached.validChapters.forEach((ch) => {
        out += `${ch.title} ${renderMode.open}\n`;
        out += `•\n${ch.text}\n`;
        out += `• ${renderMode.close}\n\n`;
    });

    out += `</list>`;

    finalTxt = out;
    output.value = out;
}

fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const data = await parseEpubAdvanced(file, JSZip, DOMParser, state);
    btn.style.display = "inline-block";
    cached = data;
    render();
});

btn.onclick = () => {
    const blob = new Blob([finalTxt], {
        type: "text/plain",
    });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (cached?.title || "converted") + ".txt";
    a.click();
};
