window.addEventListener("DOMContentLoaded", () => {
    const introContainer = document.getElementById("chuy");
    const title = document.querySelector("h2");

    if (introContainer && title) {
        wrapLines(introContainer);

        title.classList.add("fade-line");

        const blocks = [title, ...introContainer.querySelectorAll(".fade-line")];

        blocks.forEach((el) => {
            el.classList.remove("exit", "show");
        });

        setTimeout(() => {
            blocks.forEach((el, i) => {
                setTimeout(() => {
                    el.classList.add("show");
                }, i * 90);
            });
        }, 60);
    }
});

function wrapLines(container) {
    const elements = [...container.children];
    container.innerHTML = "";
    elements.forEach((el) => {
        const wrapper = document.createElement("div");
        wrapper.className = "fade-line";
        wrapper.appendChild(el);
        container.appendChild(wrapper);
    });
}

function hideIntro() {
    const intro = document.getElementById("chuy");
    const title = document.querySelector("h2");
    if (!intro || !title) return;

    const blocks = [title, ...intro.querySelectorAll(".fade-line")];
    blocks.forEach((el, i) => {
        setTimeout(() => {
            el.classList.remove("show");
            el.classList.add("exit");
        }, i * 90);
    });
    
    setTimeout(() => {
        title.style.display = "none";
        intro.style.style.display = "none";
    }, blocks.length * 90 + 600);
}

function showIntro() {
    const intro = document.getElementById("chuy");
    const title = document.querySelector("h2");
    if (!intro || !title) return;

    title.style.display = "block";
    intro.style.display = "block";
    
    const blocks = [title, ...intro.querySelectorAll(".fade-line")];
    blocks.forEach((el) => el.classList.remove("exit", "show"));

    blocks.forEach((el, i) => {
        setTimeout(() => {
            el.classList.add("show");
        }, i * 90);
    });
}