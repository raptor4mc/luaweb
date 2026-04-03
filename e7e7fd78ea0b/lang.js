var selLang = getDefaultLanguage();

function initLangSelector() {
    const sel = document.getElementById('lang_selector');
    sel.addEventListener('change', (event) => {
        selLang = sel.value;
    });

    for (const lc of SUPPORTED_LANGUAGES) {
        const opt = document.createElement('option');
        opt.value = lc[0];
        opt.innerText = lc[1];
        sel.appendChild(opt);
    }

    sel.value = selLang;
}

function getSelectedLanguage() {
    return selLang;
}

document.addEventListener("DOMContentLoaded", initLangSelector);
