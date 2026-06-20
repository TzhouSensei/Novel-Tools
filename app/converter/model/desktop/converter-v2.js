import {
    parseEpub,
    makeTitleBox,
    makeInfoBox,
} from "../../parser/epubParser.js";

let title = "";
let finalTxt = "";

const fileInput = document.getElementById("file");
const output = document.getElementById("output");
const btn = document.getElementById("download");

const splitterBox = document.createElement("div");
splitterBox.style.margin = "10px 0";

const splitterLength = document.createElement("input");
splitterLength.type = "number";
splitterLength.min = "1";
splitterLength.value = "11";
splitterLength.style.marginLeft = "15px";
splitterLength.style.width = "80px";

const splitterLengthLabel = document.createElement("label");
splitterLengthLabel.textContent = " Width: ";
splitterLengthLabel.appendChild(splitterLength);

const splitterOptions = [
    { label: "Dash (-----)", value: "dash" },
    { label: "Equal (=====)", value: "equal" },
    { label: "Star (***** )", value: "star" },
    { label: "Wave (~~~~~)", value: "wave" },
    { label: "Box (*====*)", value: "box" },
];

splitterOptions.forEach((opt) => {
    const label = document.createElement("label");
    label.style.marginRight = "10px";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "splitter";
    radio.value = opt.value;

    label.appendChild(radio);
    label.appendChild(document.createTextNode(" " + opt.label));

    splitterBox.appendChild(label);
});

splitterBox.appendChild(splitterLengthLabel);
fileInput.parentNode.insertBefore(splitterBox, btn);

const getSplitter = () => {
    const selected = document.querySelector("input[name='splitter']:checked");

    let width = parseInt(splitterLength.value, 10);
    if (isNaN(width)) width = 11;

    switch (selected?.value) {
        case "dash":
            return "\n" + "-".repeat(Math.max(3, width)) + "\n\n";
        case "equal":
            return "\n" + "=".repeat(Math.max(3, width)) + "\n\n";
        case "star":
            return "\n" + "*".repeat(Math.max(3, width)) + "\n\n";
        case "wave":
            return "\n" + "~".repeat(Math.max(3, width)) + "\n\n";
        case "box":
            return "\n*" + "=".repeat(Math.max(1, width - 2)) + "*\n\n";
        default:
            return "\n\n\n";
    }
};

const renderOutput = () => {
    output.value = finalTxt.replaceAll("{{SPLITTER}}", getSplitter());
};

fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const data = await parseEpub(file, t);

    title = data.title;

    const finalDescription = [
        data.description,
        data.comment,
        data.extraDescription,
    ]
        .filter(Boolean)
        .join("\n\n");

    finalTxt =
        makeTitleBox(title) +
        `\n{{SPLITTER}}` +
        makeInfoBox(
            `${t("author")}: ${data.creator} | ${t("genre")}: ${data.genre} | ${t("chapter.count")}: ${data.spineLength}\n\n${t("description")}:\n${finalDescription}`,
        ) +
        `\n{{SPLITTER}}` +
        data.chaptersTxt;

    renderOutput();
    btn.style.display = "inline-block";
});

splitterBox.addEventListener("change", renderOutput);
splitterLength.addEventListener("input", renderOutput);

btn.addEventListener("click", async () => {
    const blob = new Blob([output.value], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);

    const safeTitle = title
        ? title.replace(/[^a-zA-Z0-9À-ỹ ]/g, "")
        : "converted";

    a.download = `${safeTitle}.txt`;
    a.click();
});
