(function () {
    "use strict";

    function initTheme() {
        const select = document.getElementById("themeSelect");
        if (!select) return;

        const saved = localStorage.getItem("reader-theme");
        if (saved) {
            document.body.className = saved;
            select.value = saved;
        }

        select.addEventListener("change", () => {
            document.body.className = "";
            const theme = select.value;
            if (theme) {
                document.body.classList.add(theme);
                localStorage.setItem("reader-theme", theme);
            } else {
                localStorage.removeItem("reader-theme");
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initTheme);
    } else {
        initTheme();
    }
})();
