class AsciiBox {
    constructor(options = {}) {
        this.corner = options.corner || "*";
        this.vertical = options.updown || "|";
        this.horizontal = options.leftright || "-";

        this.mode = options.mode || "dynamic";

        this.fixedHeight = options.fixedHeight || null;

        this.content = "";
    }

    setContent(text) {
        this.content = text;
        return this.render();
    }

    setMode(mode) {
        this.mode = mode;
        return this.render();
    }

    setFixedHeight(h) {
        this.fixedHeight = h;
        return this.render();
    }

    _splitLines(text) {
        return text.split("\n");
    }

    _getWidth(lines) {
        return Math.max(...lines.map((l) => l.length), 0);
    }

    _pad(line, width) {
        return line + " ".repeat(width - line.length);
    }

    render() {
        const lines = this._splitLines(this.content);
        const width = this._getWidth(lines);

        let height = lines.length;

        if (this.mode === "fixed" && this.fixedHeight) {
            height = this.fixedHeight - 2;
        }

        const top = this.corner.repeat(width + 2);
        const bottom = this.corner.repeat(width + 2);

        const result = [];

        result.push(top);

        for (let i = 0; i < height; i++) {
            const line = lines[i] || "";
            const padded = this._pad(line, width);

            result.push(this.vertical + padded + this.vertical);
        }

        result.push(bottom);

        return result.join("\n");
    }
}
