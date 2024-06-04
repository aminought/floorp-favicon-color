const FAVICON_COLOR_PREF = 'floorp.titlebar.favicon.color';
const TOOLBAR_COLOR_CLASSNAME = 'floorp-toolbar-bgcolor';
const FAVICON_COLOR_CLASSNAME = 'favicon-color';
const FAVICON_COLOR_SELECTOR = `.${FAVICON_COLOR_CLASSNAME}`;
const SATURATION_LIMIT = 0.75;

const gFaviconColor = {
    initialized: false,

    init() {
        if (this.initialized) return;

        this.injectChroma().then(() => {
            this.observeOriginalStyle();
            this.switchFaviconColor();
            this.initialized = true;
        });
    },

    async injectChroma() {
        return fetch('https://cdnjs.cloudflare.com/ajax/libs/chroma-js/2.4.2/chroma.min.js')
            .then((response) => {
                return response.text();
            })
            .then((html) => {
                let script = document.head.appendChild(document.createElement('script'));
                script.type = 'module';
                script.textContent = html;
            });
    },

    observeOriginalStyle() {
        this.observer = new MutationObserver((records) => {
            for (const record of records) {
                for (const node of record.addedNodes) {
                    if (node.className == TOOLBAR_COLOR_CLASSNAME) {
                        node.remove();
                    }
                }
            }
        });
        this.observer.observe(document.head, { childList: true });
    },

    switchFaviconColor() {
        if (Services.prefs.getBoolPref(FAVICON_COLOR_PREF, true)) {
            window.setTimeout(() => {
                gFaviconColor.enableFaviconColorToTitlebar();
            }, 1000);

            Services.prefs.addObserver(FAVICON_COLOR_PREF, () => {
                if (Services.prefs.getBoolPref(FAVICON_COLOR_PREF, true)) {
                    gFaviconColor.enableFaviconColorToTitlebar();
                } else {
                    gFaviconColor.disableFaviconColorToTitlebar();
                }
            });
        }
    },

    getPalette(base64Image) {
        if (!base64Image) {
            return Promise.reject('No image provided');
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        return new Promise((resolve, reject) => {
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                const pixelCount = pixelData.length / 4;

                const colorPalette = [];

                for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex++) {
                    const offset = 4 * pixelIndex;
                    const red = pixelData[offset];
                    const green = pixelData[offset + 1];
                    const blue = pixelData[offset + 2];
                    let colorIndex;

                    if (!(red === 0 || (red > 240 && green > 240 && blue > 240))) {
                        for (
                            let colorIndexIterator = 0;
                            colorIndexIterator < colorPalette.length;
                            colorIndexIterator++
                        ) {
                            const currentColor = colorPalette[colorIndexIterator];
                            if (
                                red === currentColor[0] &&
                                green === currentColor[1] &&
                                blue === currentColor[2]
                            ) {
                                colorIndex = colorIndexIterator;
                                break;
                            }
                        }
                        if (colorIndex === undefined) {
                            colorPalette.push([red, green, blue, 1]);
                        } else {
                            colorPalette[colorIndex][3]++;
                        }
                    }
                }
                colorPalette.sort((a, b) => b[3] - a[3]);
                const topColors = colorPalette.slice(0, Math.min(10, colorPalette.length));
                resolve({ palette: topColors.map((color) => [color[0], color[1], color[2]]) });
            };

            img.onerror = reject;
            img.src = base64Image;
        });
    },

    setFaviconColorToTitlebar() {
        const base64Image = gBrowser.selectedTab.querySelector('.tab-icon-image')?.src;

        gFaviconColor
            .getPalette(base64Image)
            .then((result) => {
                let elems = document.querySelectorAll(FAVICON_COLOR_SELECTOR);
                for (let i = 0; i < elems.length; i++) {
                    elems[i].remove();
                }

                if (!result.palette.length) {
                    return;
                }

                let colorAccentBg = chroma(result.palette[0]);
                const saturation = colorAccentBg.get('hsl.s');
                colorAccentBg = colorAccentBg.set('hsl.s', saturation * SATURATION_LIMIT);
                const isBright = colorAccentBg.luminance() > 0.4;
                const colorAccentFg = isBright ? chroma('#000') : chroma('#FFF');

                let elem = document.createElement('style');
                let styleSheet = `
                    :root {
                        --floorp-favicon-bg-color: ${colorAccentBg};
                        --floorp-favicon-fg-color: ${colorAccentFg};
                    }
                `;
                elem.textContent = styleSheet;
                elem.className = FAVICON_COLOR_CLASSNAME;
                document.head.appendChild(elem);
            })
            .catch(() => {
                let elems = document.querySelectorAll(FAVICON_COLOR_SELECTOR);
                for (let i = 0; i < elems.length; i++) {
                    elems[i].remove();
                }
            });
    },

    enableFaviconColorToTitlebar() {
        gFaviconColor.setFaviconColorToTitlebar();

        document.addEventListener('floorpOnLocationChangeEvent', function () {
            gFaviconColor.setFaviconColorToTitlebar();
        });
    },

    disableFaviconColorToTitlebar() {
        let elems = document.querySelectorAll(FAVICON_COLOR_CLASSNAME_SELECTOR);
        for (let i = 0; i < elems.length; i++) {
            elems[i].remove();
        }

        document.removeEventListener('floorpOnLocationChangeEvent', function () {
            gFaviconColor.setFaviconColorToTitlebar();
        });
    },
};

gFaviconColor.init();
window.gFaviconColor = gFaviconColor;
