/* ============================================================
   VALENTINE'S MESSAGES FROM THE SEA
   Pixel Art Engine + Game Logic
   ============================================================ */

// ─── CONFIG ───────────────────────────────────────────────────
const CONFIG = {
    startDate: '2026-02-05',
    recipientName: 'Aparna',
    messages: [
        {
            title: "Soupy Noodles",
            content: "Relationships die in the conversations they never have.\n\nThey thrive when conversations are like a hot bowl of soup on a cold day - nourishing, comforting, and a little bit messy.\n\nThank you for being my favorite conversation.",
            signature: "Howling Wolf 🐺"
        },
        {
            title: "Coherence",
            content: "You bring coherence to my chaos.\n\nSure, I may not get you the first time, but I'll retry over and over.",
            signature: "Leaping Leopard 🐆"
        },
        {
            title: "Seattle Serenity",
            content: "Did you like me driving you around? Those narrow streets, dark alleys and steep slopes?",
            signature: "Tempting Tiger  🐅"
        },
        {
            title: "Cascades of Comfort",
            content: "Held your hand in North Cascades and discovered Snowshoe Hare. Rare.",
            signature: "Hovering Hawk 🦅"
        },
        {
            title: "I wrote a song for you",
            content: "A Neanderthal like me could compose only out of love.",
            signature: "Singing Sparrow 🐦"
        },
        {
            title: "Innit to Winnit",
            content: "I'm in this to win you forever. No contest.",
            signature: "Winning Whale 🐋"
        },
        {
            title: "Happy Valentine's Day",
            content: "Today and every day, I choose you.\n\nI love you not just for who you are, but for who I become when I'm with you.\n\nYou are my greatest adventure, my deepest love, my best friend.\n\n💕 Happy Valentine's Day 💕",
            signature: "Eternal Elephant 🐘"
        }
    ]
};

// ─── UTILITIES ────────────────────────────────────────────────
const $ = (sel) => document.getElementById(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const el = (tag, cls, parent) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
};

// ─── RESPONSIVE HELPERS ──────────────────────────────────────
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const Responsive = {
    _bp: null,
    breakpoints: {
        tiny: 380,
        small: 480,
        medium: 600,
        tablet: 768
    },
    get bp() {
        if (this._bp) return this._bp;
        this._bp = this._calc();
        return this._bp;
    },
    _calc() {
        const w = window.innerWidth;
        if (w <= 380) return 'tiny';
        if (w <= 480) return 'small';
        if (w <= 600) return 'medium';
        if (w <= 768) return 'tablet';
        return 'desktop';
    },
    invalidate() { this._bp = null; },
    isMobile() { return window.innerWidth <= 600; },
    isTiny() { return window.innerWidth <= 380; },
    isLandscape() { return window.innerHeight <= 500 && window.innerWidth > window.innerHeight; }
};

// ─── PIXEL ART RENDERER ──────────────────────────────────────
// Draws true pixel art on <canvas> from grid data
const PixelArt = {
    /**
     * Create a canvas from a pixel grid.
     * @param {string[][]} grid  - 2D array of hex colors (' ' = transparent)
     * @param {number} scale     - pixel scale multiplier
     * @returns {HTMLCanvasElement}
     */
    fromGrid(grid, scale = 4) {
        const h = grid.length;
        const w = Math.max(...grid.map(r => r.length));
        const canvas = document.createElement('canvas');
        canvas.width = w * scale;
        canvas.height = h * scale;
        canvas.style.width = (w * scale) + 'px';
        canvas.style.height = (h * scale) + 'px';
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < grid[y].length; x++) {
                const c = grid[y][x];
                if (c && c !== ' ' && c !== '.') {
                    ctx.fillStyle = c;
                    ctx.fillRect(x * scale, y * scale, scale, scale);
                }
            }
        }
        return canvas;
    },

    /** Shorthand: parse compact string grid where each char maps to a palette */
    fromString(str, palette, scale = 4) {
        const lines = str.split('\n').filter(l => l.length > 0);
        const grid = lines.map(line =>
            [...line].map(ch => palette[ch] || null)
        );
        return this.fromGrid(grid, scale);
    }
};

// ─── PIXEL ART ASSETS ────────────────────────────────────────
const Assets = {

    // SUN — warm filled disc, no thin rays
    sun() {
        const p = {
            '.': null,
            'W': '#FFF8D0',  // blazing center
            'Y': '#F8C800',  // SNES gold
            'y': '#E08000',  // deep amber rim
        };
        return PixelArt.fromString(`
.....yy.....
...yyyyyy...
..yyyyyyyy..
.yyyYYYYyyy.
yyyyYYYYyyyy
yyyYWWWWYyyy
yyyYWWWWYyyy
yyyyYYYYyyyy
.yyyYYYYyyy.
..yyyyyyyy..
...yyyyyy...
.....yy.....`, p, 4);
    },

    // CLOUD — simple puffy, 3 tones
    cloud(size = 'md') {
        const p = { '.': null, 'W': '#F8F8F8', 'w': '#D8E8F0', 's': '#7898A8' };
        const shapes = {
            sm: `
.....WW.....
...WWWWWW...
..WwwwwwwW..
.WWwwwwwwWW.
WWwwwwwwwwWW
.ssssssssss.`,
            md: `
......WW........
....WWWWWW......
..WWWwwwwWWW....
.WWwwwwwwwwWWW..
WWwwwwwwwwwwwWW.
WWwwwwwwwwwwwWW.
.sssssssssssss..`,
            lg: `
........WW..........
......WWWWWW........
...WWWWwwwwWWWW.....
..WWwwwwwwwwwwWWW...
.WWwwwwwwwwwwwwwWW..
WWwwwwwwwwwwwwwwwWW.
WWwwwwwwwwwwwwwwwWW.
.sssssssssssssssss..`
        };
        return PixelArt.fromString(shapes[size] || shapes.md, p, 4);
    },

    // SEAGULL — simple soaring bird, thick filled wings
    seagull() {
        const p = { '.': null, 'W': '#F8F8F8', 'w': '#C0D0D8', 'B': '#181818' };
        return PixelArt.fromString(`
W.............W
.WW.........WW.
..WWW.....WWW..
...WWWWWWWWW...
....WwwwwwW....
.....WWWW......`, p, 3);
    },

    // WAVE CRESTS — simple, clean foam shapes
    waveCrest(row = 1) {
        const palettes = {
            1: { '.': null, 'W': '#F0F8F8', 'F': '#C0E8F0', 'f': '#90D0E0', 'b': '#60B8D0', 'c': '#38A0C0' },
            2: { '.': null, 'W': '#D8F0F0', 'F': '#A8D8E8', 'f': '#78C0D8', 'b': '#50A8C8', 'c': '#3090B0' },
            3: { '.': null, 'W': '#B8E0E8', 'F': '#88C8D8', 'f': '#60B0C8', 'b': '#4098B0', 'c': '#2880A0' },
            4: { '.': null, 'W': '#98D0E0', 'F': '#70B8D0', 'f': '#50A0C0', 'b': '#3888A8', 'c': '#207090' },
            5: { '.': null, 'W': '#78C0D8', 'F': '#58A8C8', 'f': '#4090B0', 'b': '#2878A0', 'c': '#186888' }
        };
        const shapes = {
            1: `
.....WW.....
....FWWF....
...FfWWfF...
..FfffWffF..
.FbfffffffF.
FcbbffffffcF
cccbbffffccc`,
            2: `
......WW......
.....FWWF.....
....FffWfF....
...FfffWffF...
..FbffffffbF..
.FcbbffffbbcF.
FcccbbffbbcccF
.ccccbbbbcccc.`,
            3: `
........WW........
.......FWWF.......
......FffWffF.....
.....FffffWfffF...
....FbbfffffffbF..
...FccbbfffffbbcF.
..FcccbbfffffcccF.
.Fccccbbfffcccccc.
.ccccccbbbccccccc.`,
            4: `
..........WW..........
.........FWWF.........
........FfffWfF.......
.......FbfffWfffF.....
......FcbbffffffbF....
.....Fccbbfffffbbccc..
....Fcccbbffffbccccc..
...ccccccbbbbccccccc..`,
            5: `
............WW............
...........FWWF...........
..........FffffF..........
.........FbbffffbF........
........FccbbfffbbcF......
.......FcccbbfbbcccF......
......ccccccbbbbccccc.....
.....cccccccccccccccc.....`
        };
        const p = palettes[Math.min(row, 5)] || palettes[1];
        return PixelArt.fromString(shapes[Math.min(row, 5)] || shapes[1], p, 3);
    },

    // BOAT — simple sailboat
    boat() {
        const p = {
            '.': null,
            'B': '#603020',
            'W': '#E8E0D0',
            'M': '#381008',
            'R': '#E01818',
        };
        return PixelArt.fromString(`
........R......
........RR.....
.......MM......
.......MM......
......WMM......
.....WWMM......
....WWWMM......
...WWWWMM......
..WWWWWMM......
.WWWWWWMM......
.WWWWWWWM......
.BBBBBBBBBBBB.
BBBBBBBBBBBBBB
.BBBBBBBBBBBBB.
..BBBBBBBBBBB.
...BBBBBBBBB..`, p, 3);
    },

    // PALM TREE — clean tropical palm
    palmTree() {
        const p = {
            '.': null,
            'T': '#502810', 't': '#704018',
            'l': '#20B038',
            'G': '#189838',
            'L': '#107820',
        };
        return PixelArt.fromString(`
.......lll..........
......ll.ll.........
.....ll.llll........
....lll.lllll.......
...lll..lllllll.....
..lll.llllll.lll....
.GGG.llll.lllllll...
GGGGGlll.llllllll...
GGGGGGGlllll.llllll.
LLLGGGGGlllllll.llll
LLLLLGGGGlllllllllll
LLLLLLLGGGGllllllll.
.LLLLLLLGGGlllllll..
..LLLLLL.TtT.lll....
....LL...TtT........
.........TtT........
.........TtT........
........TTtTT.......
........TTtTT.......
........TtTTT.......
........TtTT........
.......TTtTT........
.......TTtTT........
.......TtTTT........
.......TtTT.........
......TTtTT.........
......TtTTT.........
......TtTT..........
......TTTT..........`, p, 4);
    },

    // MESSAGE BOTTLE (sealed)
    bottleSealed() {
        const p = {
            '.': null,
            'G': '#18A030', 'g': '#40C848', 'D': '#108020',
            'K': '#C89028',
            'P': '#F0E0C0',
            'R': '#E01818', 'r': '#A81010',
            'S': 'rgba(255,255,255,0.55)',
        };
        return PixelArt.fromString(`
.....KKKK.....
....KKKKKK....
....KKKKKK....
....KKKKKK....
....DGGGGD....
...DGGgGGGD...
...DGgSGGGD...
...GGgSGGGG...
...GGgSGGGG...
...GGgSPPGG...
...GGgPPPGG...
...GGgPPPGG...
...GGPPPGGG...
...GGPPPGGG...
...GGPPPGGG...
...GGPPPGGG...
...GGPPrPGG...
...GGPRrPGG...
...GGgSGGGG...
...GGgSGGGG...
...DGgSGGGD...
...DGGgGGGD...
....DGGGGD....
.....DDDD.....`, p, 4);
    },

    // MESSAGE BOTTLE (opened)
    bottleOpened() {
        const p = {
            '.': null,
            'G': '#7898A8', 'g': '#B8C8D8', 'D': '#6080A0',
            'P': '#F0E0C0',
            'S': 'rgba(255,255,255,0.55)',
        };
        return PixelArt.fromString(`
....DGGGGD....
...DGGgGGGD...
...DGgSGGGD...
...GGgSGGGG...
...GGgSGGGG...
...GGgSPPGG...
...GGgPPPGG...
...GGgPPPGG...
...GGPPPGGG...
...GGPPPGGG...
...GGPPPGGG...
...GGPPPGGG...
...GGPPPPGG...
...GGPPPPGG...
...GGgSGGGG...
...GGgSGGGG...
...DGgSGGGD...
...DGGgGGGD...
....DGGGGD....
.....DDDD.....`, p, 4);
    },

    // PIXEL HEART
    heart(filled = true) {
        const p = {
            '.': null,
            'R': filled ? '#E01818' : '#555',
            'r': filled ? '#A81010' : '#444',
            'h': filled ? '#F83838' : '#666',
        };
        return PixelArt.fromString(`
.hRR..hRR.
hRRRhhRRRh
hRRRRRRRRh
hRRRRRRRRh
.rRRRRRRr.
..rRRRRr..
...rRRr...
....rr....`, p, 2);
    },

    // BEACH SHELL
    shell() {
        const p = {
            '.': null,
            'S': '#E8A060', 's': '#D08848', 'P': '#F0A880', 'p': '#E07050'
        };
        return PixelArt.fromString(`
..SS..
.SPPs.
SPppPS
SppppS
.ssss.`, p, 3);
    },

    // STARFISH
    starfish() {
        const p = {
            '.': null,
            'O': '#D06008', 'o': '#E88008', 'Y': '#F0A800'
        };
        return PixelArt.fromString(`
....o....
...oYo...
...oYo...
..oYYYo..
OoYYYYYoO
.oOYYYOo.
..oOYOo..
..o.O.o..
.o.....o.`, p, 3);
    },

    // ANGRY SEAGULL — standing guard bird
    angrySeagull() {
        const p = {
            '.': null,
            'W': '#F8F8F0', 'w': '#D8E0E0', 'G': '#B0C0C8',
            'B': '#181818',
            'O': '#E87000', 'o': '#F89000',
            'R': '#E01818',
            'Y': '#F8D000',
        };
        return PixelArt.fromString(`
......YY..........
.....YYYY.........
....YBYBYY........
....BWwWWB........
...BWwwwwWB.......
...BWRwwwWB.......
...BWwwwwWB.OOO...
....BWwWBOOOooO...
.....BBBOoooooO...
......BBB.OOOO....
.....BWwWB........
....BWwwwWB.......
...BWwwwwwWB......
...BWwGwGwWB......
...BWwGGGGwWB.....
....BWGGGGwWB.....
.....BGGGGGB......
......BBBBB.......
......B...B.......
.....OO...OO......`, p, 3);
    },

    // SMALL BOTTLE (for ocean scatter)
    bottleSmall() {
        const p = {
            '.': null,
            'G': '#20A838', 'D': '#108020',
            'K': '#D0A838',
            'P': '#F0E0C0',
            'S': 'rgba(255,255,255,0.50)',
        };
        return PixelArt.fromString(`
...KKK...
...KKK...
...DGD...
..DGGD...
..GSGD...
..GPGD...
..GPGD...
..GPGD...
..DGGD...
...DDD...`, p, 4);
    },

    // WELCOME BOTTLE (hero size) — bottleSealed grid at larger scale
    welcomeBottle() {
        const p = {
            '.': null,
            'G': '#18A030', 'g': '#40C848', 'D': '#108020',
            'K': '#C89028',
            'P': '#F0E0C0',
            'R': '#E01818', 'r': '#A81010',
            'H': '#F83838',
            'S': 'rgba(255,255,255,0.55)',
        };
        return PixelArt.fromString(`
.....KKKK.....
....KKKKKK....
....KKKKKK....
....KKKKKK....
....DGGGGD....
...DGGgGGGD...
...DGgSGGGD...
...GGgSGGGG...
...GGgSGGGG...
...GGgSPPGG...
...GGgPPPGG...
...GGgPPPGG...
...GGPPPGGG...
...GGPPPGGG...
...GGPPPGGG...
...GGPPPGGG...
...GGPPrPGG...
...GGPHRrPGG..
...GGgSGGGG...
...GGgSGGGG...
...DGgSGGGD...
...DGGgGGGD...
....DGGGGD....
.....DDDD.....`, p, 5);
    },

    // ORCA — compact, clearly a whale
    orca() {
        const p = {
            '.': null,
            'B': '#080810',  // deep black body
            'b': '#181828',  // blue-tinted shadow
            'W': '#F0F0F8',  // crisp white belly
            'w': '#B8C8D8',  // cool eye patch
        };
        return PixelArt.fromString(`
.......BB..........
......BBBB.........
.....BBBBBB........
....BBBBBBBBB......
...BBBBBBBBBBB.....
..BBBwwBBBBBBBBb...
.BWWWWWBBBBBBBBBB..
BWWWWWWBBBBBBBBBBb.
.BWWWBBBBBBBBBBBBb.
..BBBBBBBBBBBBBbb..
....BBBBBBBBBbb....
......bBb.bBb......
.....bb.....bb.....`, p, 3);
    },

    // SEA TURTLE — side view, basking on shore
    seaTurtle() {
        const p = {
            '.': null,
            'G': '#108020',
            'K': '#40C848',
            'S': '#483018',
            'H': '#20A830',
            'E': '#080808',
            'D': '#0C6818',
        };
        return PixelArt.fromString(`
...HH...............
..HHHH..............
..HEHH..............
...HH...............
...SSSSSSSS.........
..SSDKGKDGSS........
.SSGKDKKDGSS........
.SSGKDKDKGSS........
..SSDGKGDGSS........
...SSSSSSSS.........
..HH......HH........
.HH........HH......`, p, 3);
    },

    // MOON — thin crescent for night sky
    moon() {
        const p = {
            '.': null,
            'M': '#F8F0B8',
            'd': '#D0B060',
        };
        return PixelArt.fromString(`
......MM......
....MMMMM.....
...MMMMMd.....
..MMdMMMMd....
..MMMdMd......
.MMMMd........
.MMMd.........
.MMMd.........
.MMMMd........
..MMMdMd......
..MMdMMMMd....
...MMMMMd.....
....MMMMM.....
......MM......`, p, 4);
    },

    // SITTING SEAGULL — perched on beach, compact body
    sittingSeagull() {
        const p = {
            '.': null,
            'W': '#F0F0E8',
            'G': '#8CA0A8',
            'B': '#181818',
            'O': '#D88000',
        };
        return PixelArt.fromString(`
.....BB......
....BWWB.....
...BWBWWB....
...BWWWWB....
...OOOWWWB...
...BWWWWWGB..
..BWWWWWWGGB.
..BWWWWWGGB..
...BWWWGGB...
....BBBBB....
....OO.OO....`, p, 3);
    },

    // PIXEL STAR (for night sky)
    nightStar(brightness = 1) {
        const b = brightness;
        const color = b > 0.7 ? '#F8F8E0' : b > 0.4 ? '#E8D8A0' : '#C8B880';
        const p = { '.': null, 'S': color };
        return PixelArt.fromString(`
.S.
SSS
.S.`, p, 2);
    }
};

// ─── STATE MANAGEMENT ─────────────────────────────────────────
const State = {
    opened: [],
    soundOn: true,
    _key: 'kaayko_valentine_v1',

    load() {
        try {
            const d = JSON.parse(localStorage.getItem(this._key) || '{}');
            this.opened = d.opened || [];
            this.soundOn = d.soundOn !== false;
        } catch (e) { /* fresh state */ }
    },
    save() {
        localStorage.setItem(this._key, JSON.stringify({
            opened: this.opened,
            soundOn: this.soundOn
        }));
    },
    markOpened(day) {
        if (!this.opened.includes(day)) {
            this.opened.push(day);
            this.save();
        }
    },
    isOpened(day) {
        return this.opened.includes(day);
    }
};

// ─── DATE UTILITIES ───────────────────────────────────────────
const DateUtil = {
    getStart() {
        return new Date(CONFIG.startDate + 'T00:00:00');
    },
    getCurrentDay() {
        const s = this.getStart();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return Math.max(0, Math.floor((today - s) / (1000 * 60 * 60 * 24)) + 1);
    },
    getTotal() {
        return CONFIG.messages.length;
    },
    getHour() {
        return new Date().getHours();
    }
};

// ─── AUDIO ENGINE ─────────────────────────────────────────────
const Audio = {
    ctx: null,
    oceanNodes: [],
    playing: false,
    _unlocked: false,
    _gestureBound: false,
    _visListening: false,

    init() {
        // Do NOT create AudioContext here — iOS/Android permanently block
        // contexts created outside a user gesture.  Let _bindGestureUnlock
        // or ensureReadySync() create it inside a real tap/click.
        if (!this._gestureBound) this._bindGestureUnlock();

        // F2: Recover from tab-switch / app-switch / lock-screen suspension
        if (!this._visListening) {
            this._visListening = true;
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && this.ctx && State.soundOn) {
                    this.ctx.resume().then(() => {
                        if (!this.playing) this.startOcean();
                    }).catch(() => {});
                }
            });
        }
    },

    // iOS Safari + Android Chrome require playing an actual buffer
    // inside a user-gesture handler to unlock audio output.
    _bindGestureUnlock() {
        this._gestureBound = true;
        const unlock = () => {
            if (this._unlocked) return;
            // Create context if not done yet
            if (!this.ctx) {
                try {
                    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                } catch (e) { return; }
            }
            this._attachStateChangeListener();
            // Resume suspended context
            const ctx = this.ctx;
            if (ctx.state === 'suspended') ctx.resume();
            // Play a silent buffer — this is what iOS actually requires
            const silent = ctx.createBuffer(1, 1, 22050);
            const src = ctx.createBufferSource();
            src.buffer = silent;
            src.connect(ctx.destination);
            src.start(0);
            src.onended = () => {
                src.disconnect();
                this._unlocked = true;
            };
            // F4: Force iOS out of ambient audio category via <audio> element
            this._forcePlaybackCategory();
            // Remove listeners after first unlock
            ['touchstart', 'touchend', 'click', 'keydown'].forEach(evt =>
                document.removeEventListener(evt, unlock, true));
        };
        ['touchstart', 'touchend', 'click', 'keydown'].forEach(evt =>
            document.addEventListener(evt, unlock, true));
    },

    // F3: Listen for state changes to auto-recover from 'interrupted' (iOS calls, alarms, Siri)
    _attachStateChangeListener() {
        if (!this.ctx || this.ctx.onstatechange) return;
        this.ctx.onstatechange = () => {
            console.log(`[Audio] State → ${this.ctx.state}`);
            if (this.ctx.state === 'running' && State.soundOn && !this.playing) {
                this.startOcean();
            }
        };
    },

    // F4: Force iOS playback audio session category so sound works even with ringer off
    _forcePlaybackCategory() {
        if (this._audioEl) return;
        // Generate a proper 1-second silent WAV programmatically for reliable iOS playback
        const sampleRate = 22050;
        const numSamples = sampleRate; // 1 second
        const dataSize = numSamples * 2; // 16-bit
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);
        // RIFF header
        const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
        writeStr(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeStr(8, 'WAVE');
        writeStr(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeStr(36, 'data');
        view.setUint32(40, dataSize, true);
        // All samples = 0 (silence)
        const blob = new Blob([buffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        this._audioEl = document.createElement('audio');
        this._audioEl.src = url;
        this._audioEl.loop = true;
        this._audioEl.volume = 0.01;
        this._audioEl.setAttribute('playsinline', '');
        this._audioEl.play().catch(() => {});
    },

    resume() {
        if (this.ctx?.state === 'suspended') this.ctx.resume();
    },

    // F3: Guard with auto-recovery for suspended/interrupted states
    _ensure() {
        if (!this.ctx || !State.soundOn) {
            if (!this.ctx) console.warn('[Audio] No context');
            return false;
        }
        if (this.ctx.state === 'running') return true;
        // Auto-recovery attempt for suspended/interrupted
        if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') {
            console.warn(`[Audio] Context state: ${this.ctx.state} — attempting resume`);
            this.ctx.resume().then(() => {
                // Deferred recovery: if ocean isn't playing, start it now
                if (State.soundOn && !this.playing) this.startOcean();
            }).catch(() => {});
        }
        return false;
    },

    // Retry a sound-playing function after the context resumes (mobile fix)
    _retryAfterResume(fn) {
        if (!this.ctx) return;
        let fired = false;
        const attempt = () => {
            if (fired) return;  // Only fire once across all retry timers
            if (this.ctx.state === 'running') { fired = true; fn.call(this); }
            // Give up after 1.5s
        };
        // Try at 100ms, 300ms, 800ms, 1500ms
        [100, 300, 800, 1500].forEach(ms => setTimeout(attempt, ms));
    },

    // F1/F5: Synchronous version for use inside gesture handlers — NO await
    ensureReadySync() {
        if (!this._gestureBound) this._bindGestureUnlock();
        if (!this.ctx) {
            try {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {
                console.warn('[Audio] Failed to create context', e);
                return false;
            }
        }
        this._attachStateChangeListener();
        if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') {
            this.ctx.resume().then(() => {
                console.log('[Audio] Context resumed via ensureReadySync');
                // Deferred start — catches mobile where resume is async
                if (State.soundOn && !this.playing) this.startOcean();
            }).catch(() => {});
        }
        // Play a silent buffer inside this gesture to unlock iOS audio
        try {
            const silent = this.ctx.createBuffer(1, 1, 22050);
            const src = this.ctx.createBufferSource();
            src.buffer = silent;
            src.connect(this.ctx.destination);
            src.start(0);
        } catch (e) { /* ignore */ }
        this._unlocked = true;
        this._forcePlaybackCategory();
        return this.ctx.state === 'running';
    },

    startOcean() {
        if (this.playing) return;
        if (!this._ensure()) {
            // Schedule retry — on mobile, context may still be transitioning
            this._retryAfterResume(this.startOcean);
            return;
        }
        this.playing = true;
        const ctx = this.ctx;
        const len = ctx.sampleRate * 4;
        const buf = ctx.createBuffer(2, len, ctx.sampleRate);

        for (let c = 0; c < 2; c++) {
            const data = buf.getChannelData(c);
            let last = 0;
            for (let i = 0; i < len; i++) {
                const white = Math.random() * 2 - 1;
                data[i] = (last + 0.02 * white) / 1.02;
                last = data[i];
                data[i] *= 3.5;
            }
        }

        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;

        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 350;

        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.08;
        lfoGain.gain.value = 80;
        lfo.connect(lfoGain);
        lfoGain.connect(lp.frequency);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 2);

        src.connect(lp);
        lp.connect(gain);
        gain.connect(ctx.destination);
        src.start();
        lfo.start();

        this.oceanNodes = [src, lfo, gain];
    },

    stopOcean() {
        this.oceanNodes.forEach(n => {
            try { n.stop?.(); } catch (e) { /* */ }
            try { n.disconnect(); } catch (e) { /* */ }
        });
        this.oceanNodes = [];
        this.playing = false;
    },

    playCork() {
        if (!this._ensure()) { this._retryAfterResume(this.playCork); return; }
        const ctx = this.ctx, now = ctx.currentTime;

        // Pop tone
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.12);
        oscGain.gain.setValueAtTime(0.5, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(oscGain);
        oscGain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
        osc.onended = () => { osc.disconnect(); oscGain.disconnect(); };

        // Pop noise burst
        const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
        const noiseData = noiseBuf.getChannelData(0);
        for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;
        const noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = noiseBuf;
        const noiseFilt = ctx.createBiquadFilter();
        noiseFilt.type = 'bandpass';
        noiseFilt.frequency.value = 1200;
        noiseFilt.Q.value = 1.5;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.4, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        noiseSrc.connect(noiseFilt);
        noiseFilt.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noiseSrc.start(now);
        noiseSrc.onended = () => { noiseSrc.disconnect(); noiseFilt.disconnect(); noiseGain.disconnect(); };
    },

    playPaper() {
        if (!this._ensure()) { this._retryAfterResume(this.playPaper); return; }
        const ctx = this.ctx, now = ctx.currentTime, len = 0.35;
        const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.sin((i / data.length) * Math.PI);
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 2500;
        const gain = ctx.createGain();
        gain.gain.value = 0.15;
        src.connect(hp);
        hp.connect(gain);
        gain.connect(ctx.destination);
        src.start(now);
        src.onended = () => { src.disconnect(); hp.disconnect(); gain.disconnect(); };
    },

    playChime() {
        if (!this._ensure()) { this._retryAfterResume(this.playChime); return; }
        const ctx = this.ctx, now = ctx.currentTime;
        [523.25, 659.25, 783.99].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const t = now + i * 0.1;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.12, t + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.7);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); };
        });
    },

    playSeagull() {
        if (!this._ensure()) { this._retryAfterResume(this.playSeagull); return; }
        const ctx = this.ctx, now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(700, now);
        osc.frequency.linearRampToValueAtTime(1100, now + 0.12);
        osc.frequency.linearRampToValueAtTime(500, now + 0.35);
        osc.frequency.linearRampToValueAtTime(800, now + 0.45);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.06, now + 0.03);
        gain.gain.setValueAtTime(0.06, now + 0.2);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
        osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    },

    playSeagullCroak() {
        if (!this._ensure()) { this._retryAfterResume(this.playSeagullCroak); return; }
        const ctx = this.ctx, now = ctx.currentTime;
        // Angry double-croak: two harsh descending squawks
        for (let i = 0; i < 2; i++) {
            const t = now + i * 0.25;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(900 + i * 100, t);
            osc.frequency.linearRampToValueAtTime(1400 + i * 50, t + 0.06);
            osc.frequency.linearRampToValueAtTime(400, t + 0.2);
            osc.frequency.linearRampToValueAtTime(600, t + 0.28);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.14, t + 0.02);
            gain.gain.setValueAtTime(0.12, t + 0.1);
            gain.gain.linearRampToValueAtTime(0.08, t + 0.2);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass'; bp.frequency.value = 1000; bp.Q.value = 2;
            osc.connect(bp);
            bp.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.35);
            osc.onended = () => { osc.disconnect(); bp.disconnect(); gain.disconnect(); };
        }
    },

    playSunShimmer() {
        if (!this._ensure()) { this._retryAfterResume(this.playSunShimmer); return; }
        const ctx = this.ctx, now = ctx.currentTime;
        // Warm golden glow — descending major chord with gentle vibrato
        const freqs = [659, 523, 440, 349];
        freqs.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const vibrato = ctx.createOscillator();
            const vibGain = ctx.createGain();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            // Gentle vibrato
            vibrato.frequency.value = 5;
            vibGain.gain.value = 3;
            vibrato.connect(vibGain);
            vibGain.connect(osc.frequency);
            const t = now + i * 0.12;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.05, t + 0.05);
            gain.gain.setValueAtTime(0.04, t + 0.2);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.6);
            vibrato.start(t); vibrato.stop(t + 0.6);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); vibrato.disconnect(); vibGain.disconnect(); };
        });
    },

    playMoonHum() {
        if (!this._ensure()) { this._retryAfterResume(this.playMoonHum); return; }
        const ctx = this.ctx, now = ctx.currentTime;
        // Ethereal nighttime hum — soft detuned fifth with shimmer
        [220, 330, 440].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = i === 0 ? 'sine' : 'triangle';
            osc.frequency.value = freq + (i * 0.5); // slight detune
            const t = now + i * 0.1;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.035, t + 0.1);
            gain.gain.setValueAtTime(0.03, t + 0.4);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass'; lp.frequency.value = 600;
            osc.connect(lp); lp.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.9);
            osc.onended = () => { osc.disconnect(); lp.disconnect(); gain.disconnect(); };
        });
    },

    playTurtleChirp() {
        if (!this._ensure()) { this._retryAfterResume(this.playTurtleChirp); return; }
        const ctx = this.ctx, now = ctx.currentTime;
        // Gentle double-chirp — two rising notes like a sleepy creature
        [280, 350].forEach((baseFreq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            const t = now + i * 0.18;
            osc.frequency.setValueAtTime(baseFreq, t);
            osc.frequency.linearRampToValueAtTime(baseFreq * 1.3, t + 0.06);
            osc.frequency.linearRampToValueAtTime(baseFreq * 1.1, t + 0.15);
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.07, t + 0.02);
            gain.gain.setValueAtTime(0.05, t + 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
            // Warm low-pass filter
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass'; lp.frequency.value = 800;
            osc.connect(lp); lp.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.25);
            osc.onended = () => { osc.disconnect(); lp.disconnect(); gain.disconnect(); };
        });
    },

    playStarfishTinkle() {
        if (!this._ensure()) { this._retryAfterResume(this.playStarfishTinkle); return; }
        const ctx = this.ctx, now = ctx.currentTime;
        // Tiny fairy-dust tinkle — rapid high notes like touching something magical
        [2093, 1760, 2349, 1568].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const t = now + i * 0.06;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.04, t + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t); osc.stop(t + 0.2);
            osc.onended = () => { osc.disconnect(); gain.disconnect(); };
        });
    },

    playShellClink() {
        if (!this._ensure()) { this._retryAfterResume(this.playShellClink); return; }
        const ctx = this.ctx, now = ctx.currentTime;
        // Hollow shell tap — short percussive with resonance
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 5;
        osc.connect(bp); bp.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now); osc.stop(now + 0.15);
        osc.onended = () => { osc.disconnect(); bp.disconnect(); gain.disconnect(); };
        // Second tap — lighter
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        const bp2 = ctx.createBiquadFilter();
        bp2.type = 'bandpass'; bp2.frequency.value = 900; bp2.Q.value = 5;
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1400, now + 0.08);
        osc2.frequency.exponentialRampToValueAtTime(700, now + 0.14);
        gain2.gain.setValueAtTime(0.04, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc2.connect(bp2); bp2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.08); osc2.stop(now + 0.2);
        osc2.onended = () => { osc2.disconnect(); bp2.disconnect(); gain2.disconnect(); };
    },

    playBoatHorn() {
        if (!this._ensure()) { this._retryAfterResume(this.playBoatHorn); return; }
        const ctx = this.ctx, now = ctx.currentTime;
        // Foghorn — low drone with harmonic
        [130, 195].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = i === 0 ? 'sawtooth' : 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(i === 0 ? 0.06 : 0.03, now + 0.15);
            gain.gain.setValueAtTime(i === 0 ? 0.05 : 0.025, now + 0.5);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass'; lp.frequency.value = 400;
            osc.connect(lp); lp.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.8);
            osc.onended = () => { osc.disconnect(); lp.disconnect(); gain.disconnect(); };
        });
    },

    playWhaleCall() {
        if (!this._ensure()) { this._retryAfterResume(this.playWhaleCall); return; }
        const ctx = this.ctx, now = ctx.currentTime;
        // Haunting whale song — layered harmonics with slow portamento
        // Fundamental moan
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(120, now);
        osc1.frequency.linearRampToValueAtTime(180, now + 0.4);
        osc1.frequency.linearRampToValueAtTime(140, now + 0.8);
        osc1.frequency.linearRampToValueAtTime(200, now + 1.1);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.06, now + 0.08);
        gain1.gain.setValueAtTime(0.05, now + 0.5);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc1.connect(gain1); gain1.connect(ctx.destination);
        osc1.start(now); osc1.stop(now + 1.2);
        osc1.onended = () => { osc1.disconnect(); gain1.disconnect(); };
        // Overtone shimmer
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(360, now + 0.1);
        osc2.frequency.linearRampToValueAtTime(540, now + 0.5);
        osc2.frequency.linearRampToValueAtTime(420, now + 0.9);
        gain2.gain.setValueAtTime(0, now + 0.1);
        gain2.gain.linearRampToValueAtTime(0.02, now + 0.2);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 700;
        osc2.connect(lp); lp.connect(gain2); gain2.connect(ctx.destination);
        osc2.start(now + 0.1); osc2.stop(now + 1.0);
        osc2.onended = () => { osc2.disconnect(); lp.disconnect(); gain2.disconnect(); };
    },

    playCharacterSound(character) {
        switch (character) {
            case 'sun':      this.playSunShimmer(); break;
            case 'moon':     this.playMoonHum(); break;
            case 'turtle':   this.playTurtleChirp(); break;
            case 'seagull':  this.playSeagull(); break;
            case 'boat':     this.playBoatHorn(); break;
            case 'orca':     this.playWhaleCall(); break;
            case 'starfish': this.playStarfishTinkle(); break;
            case 'shell':    this.playShellClink(); break;
        }
    }
};

// ─── PARTICLE SYSTEM ──────────────────────────────────────────
const Particles = {
    _spawn(cls, x, y, props = {}) {
        const e = el('div', `particle ${cls}`, document.body);
        e.style.left = x + 'px';
        e.style.top = y + 'px';
        Object.entries(props).forEach(([k, v]) => {
            if (k.startsWith('--')) e.style.setProperty(k, v);
            else e.style[k] = v;
        });
        return e;
    },

    cork(x, y) {
        const e = this._spawn('particle--cork', x, y, {
            '--tx': (70 + Math.random() * 50) + 'px',
            '--ty': (-130 - Math.random() * 50) + 'px'
        });
        e.textContent = '🪵';
        setTimeout(() => e.remove(), 900);
    },

    sparkles(x, y, count = 12) {
        const colors = ['#FFD700', '#FF69B4', '#FF6B6B', '#FFF', '#FFE082'];
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count;
            const dist = 45 + Math.random() * 35;
            const e = this._spawn('particle--sparkle', x, y, {
                '--tx': Math.cos(angle) * dist + 'px',
                '--ty': Math.sin(angle) * dist + 'px',
                background: colors[i % colors.length],
                animationDelay: (i * 0.03) + 's'
            });
            setTimeout(() => e.remove(), 700);
        }
    },

    hearts(x, y, count = 5) {
        for (let i = 0; i < count; i++) {
            const e = this._spawn('particle--heart', x, y, {
                '--tx': (Math.random() - 0.5) * 80 + 'px',
                animationDelay: i * 0.12 + 's'
            });
            e.textContent = '💕';
            setTimeout(() => e.remove(), 1100);
        }
    }
};

// ─── FOAM BUBBLES (pooled — no DOM churn) ─────────────────────
const FoamBubbles = {
    _interval: null,
    _pool: [],
    _poolSize: 24,
    _beach: null,

    _initPool(beach) {
        this._beach = beach;
        // Pre-create bubble elements once
        for (let i = 0; i < this._poolSize; i++) {
            const bub = document.createElement('div');
            bub.className = 'beach__foam-bubble';
            bub.style.display = 'none';
            beach.appendChild(bub);
            this._pool.push(bub);
        }
    },

    _acquire() {
        // Find a hidden (idle) bubble from the pool
        for (let i = 0; i < this._pool.length; i++) {
            if (this._pool[i].style.display === 'none') return this._pool[i];
        }
        return null; // pool exhausted — skip this cycle
    },

    start(beach) {
        this.stop();
        if (prefersReducedMotion) return;
        if (window.innerWidth <= 480) return;
        if (!beach) beach = document.querySelector('.beach');
        if (!beach) return;
        if (this._pool.length === 0) this._initPool(beach);

        this._interval = setInterval(() => {
            // Skip spawning when tab is hidden to prevent stacking
            if (document.hidden) return;
            const count = 3 + Math.floor(Math.random() * 5);
            for (let i = 0; i < count; i++) {
                const bub = this._acquire();
                if (!bub) break;
                const sz = 2 + Math.random() * 4;
                bub.style.setProperty('--bub-size', sz + 'px');
                bub.style.setProperty('--bub-dur', (1.5 + Math.random() * 2) + 's');
                bub.style.setProperty('--bub-del', (Math.random() * 0.8) + 's');
                bub.style.left = (5 + Math.random() * 90) + '%';
                bub.style.top = (1 + Math.random() * 6) + '%';
                bub.style.display = '';
                bub.style.animation = 'none';
                // Restart animation without synchronous reflow
                requestAnimationFrame(() => { bub.style.animation = ''; });
                setTimeout(() => { bub.style.display = 'none'; }, 4000);
            }
        }, 3500);
    },

    stop() {
        if (this._interval) { clearInterval(this._interval); this._interval = null; }
        this._pool.forEach(b => { b.style.display = 'none'; });
    }
};

// ─── SCENE BUILDER ────────────────────────────────────────────
const Scene = {
    buildSky() {
        const sky = document.querySelector('.sky');
        const hour = DateUtil.getHour();
        const isNight = hour >= 20 || hour < 6;
        const isSunset = hour >= 17 && hour < 20;

        if (isNight) {
            // NIGHT: Moon + stars, no sun, no seagulls
            const moonCanvas = Assets.moon();
            moonCanvas.className = 'sky__moon-canvas';
            moonCanvas.style.cursor = 'pointer';
            moonCanvas.addEventListener('click', () => CharacterChat.show('moon', moonCanvas));
            sky.appendChild(moonCanvas);

            // Twinkling pixel stars — varied sizes, patterns, some steady
            const starVariants = ['', '--b', '--c', '--steady'];
            for (let i = 0; i < 50; i++) {
                const brightness = 0.2 + Math.random() * 0.8;
                const star = Assets.nightStar(brightness);
                star.className = 'sky__night-star';
                // Pick a twinkle pattern: 30% A, 25% B, 25% C, 20% steady
                const roll = Math.random();
                const variant = roll < 0.3 ? '' : roll < 0.55 ? '--b' : roll < 0.8 ? '--c' : '--steady';
                if (variant) star.classList.add('sky__night-star' + variant);
                star.style.position = 'absolute';
                star.style.left = (Math.random() * 96 + 2) + '%';
                star.style.top = (Math.random() * 78 + 2) + '%';
                // Varied timing so they're never in sync
                star.style.setProperty('--twinkle-delay', -(Math.random() * 10) + 's');
                star.style.setProperty('--twinkle-dur', (2 + Math.random() * 5) + 's');
                // Per-star opacity range based on brightness
                const minOp = (0.15 + brightness * 0.2).toFixed(2);
                const maxOp = (0.5 + brightness * 0.5).toFixed(2);
                star.style.setProperty('--star-min', minOp);
                star.style.setProperty('--star-max', maxOp);
                // Atmospheric halo — brighter stars glow more through the atmosphere
                const glowPx = brightness > 0.7 ? '3px' : brightness > 0.4 ? '2px' : '1px';
                const haloOp = (0.15 + brightness * 0.45).toFixed(2);
                star.style.setProperty('--star-glow', glowPx);
                star.style.setProperty('--star-halo', haloOp);
                // Size variation: some stars slightly larger
                if (brightness > 0.8) {
                    star.style.transform = 'scale(1.3)';
                } else if (brightness < 0.35) {
                    star.style.transform = 'scale(0.7)';
                }
                sky.appendChild(star);
            }

            // Occasional meteors / shooting stars
            this._spawnMeteors(sky);
        } else {
            // DAY or SUNSET: Sun
            const sunCanvas = Assets.sun();
            sunCanvas.className = 'sky__sun-canvas';
            if (isSunset) {
                sunCanvas.style.filter = 'hue-rotate(-15deg) saturate(1.4) brightness(0.9)';
                sunCanvas.style.top = '35%'; // lower in sky
            }
            sunCanvas.style.cursor = 'pointer';
            sunCanvas.addEventListener('click', () => CharacterChat.show('sun', sunCanvas));
            sky.appendChild(sunCanvas);
        }

        // Clouds (all times, fewer at night)
        const cloudConfigs = isNight ? [
            { size: 'sm', top: '15%', delay: '-20s', time: '160s' },
            { size: 'md', top: '28%', delay: '-60s', time: '200s' },
        ] : [
            { size: 'lg', top: '12%', delay: '0s',   time: '140s'  },
            { size: 'md', top: '22%', delay: '-35s',  time: '170s' },
            { size: 'sm', top: '8%',  delay: '-60s',  time: '150s'  },
            { size: 'md', top: '30%', delay: '-90s',  time: '190s' },
        ];
        cloudConfigs.forEach(cfg => {
            const c = Assets.cloud(cfg.size);
            c.className = 'sky__cloud';
            if (isNight) c.style.opacity = '0.3';
            c.style.top = cfg.top;
            c.style.setProperty('--drift-delay', cfg.delay);
            c.style.setProperty('--drift-time', cfg.time);
            sky.appendChild(c);
        });

        // Seagulls — only during daytime & sunset
        if (!isNight) {
            const gullConfigs = [
                { top: '18%', delay: '0s',  time: '24s' },
                { top: '26%', delay: '-8s', time: '30s' },
                { top: '14%', delay: '-4s', time: '20s' },
            ];
            gullConfigs.forEach(cfg => {
                const g = Assets.seagull();
                g.className = 'sky__gull-canvas flap';
                g.style.top = cfg.top;
                g.style.setProperty('--fly-delay', cfg.delay);
                g.style.setProperty('--fly-time', cfg.time);
                g.style.cursor = 'pointer';
                g.style.pointerEvents = 'auto';
                g.addEventListener('click', () => CharacterChat.show('seagull', g));
                sky.appendChild(g);
            });
        }
    },

    _meteorId: 0,

    _spawnMeteors(sky) {
        if (prefersReducedMotion) return;
        // Occasional shooting stars — realistic trajectory
        // CSS rotate(angle) + translateX(dist) moves the head along a straight line.
        // angle is measured CW from the +X axis (CSS convention).
        // Meteors enter from the upper region and streak diagonally downward.
        const id = ++this._meteorId;
        const spawnOne = () => {
            const m = document.createElement('div');
            m.className = 'sky__meteor';

            // Entry point: upper 30% of sky, random horizontal
            const startX = 10 + Math.random() * 80;   // 10-90%
            const startY = 2 + Math.random() * 25;     // 2-27%
            m.style.left = startX + '%';
            m.style.top = startY + '%';

            // Travel direction: downward diagonal
            // CSS rotate: 0°=right, 90°=down, 180°=left, 270°=up
            // Down-left = 120-160°, Down-right = 30-70°
            const goLeft = Math.random() < 0.65;
            const angle = goLeft
                ? 120 + Math.random() * 40    // 120-160° → down-left
                : 30 + Math.random() * 40;    // 30-70°  → down-right

            // Distance: 250-450px — long streak across the sky
            const dist = 250 + Math.random() * 200;

            // Speed: fast! 0.3-0.7s — real meteors are blink-and-miss
            const dur = 0.3 + Math.random() * 0.4;

            // Tail length: proportional to distance (60-140px)
            const tail = 60 + Math.random() * 80;

            m.style.setProperty('--m-angle', angle + 'deg');
            m.style.setProperty('--m-dist', dist + 'px');
            m.style.setProperty('--m-dur', dur + 's');
            m.style.setProperty('--m-tail', tail + 'px');

            sky.appendChild(m);
            setTimeout(() => m.remove(), dur * 1000 + 300);
        };
        const loop = () => {
            if (!sky.isConnected || id !== this._meteorId) return;
            spawnOne();
            // 8-18s between meteors — rare enough to feel special
            setTimeout(loop, 8000 + Math.random() * 10000);
        };
        // First one after 4-10s
        setTimeout(loop, 4000 + Math.random() * 6000);
    },

    buildOcean() {
        // ── SNES Parallax Wave Ripple Lines ──
        const ocean = document.querySelector('.ocean');

        // Remove old ripples if rebuilding
        ocean.querySelectorAll('.ocean__wave-ripple, .ocean__caustic, .ocean__streak, .ocean__sitting-gull, .ocean__wave-crest').forEach(e => e.remove());

        // Wave ripple config: y%, height, type, speed, opacity, direction
        const ripples = [
            // Surface — bright, fast
            { y: 1,  h: 2, type: 'light', speed: 8,  op: 0.55, dir: 1 },
            { y: 3,  h: 1, type: 'light', speed: 10, op: 0.4,  dir: -1 },
            { y: 5,  h: 2, type: 'light', speed: 7,  op: 0.5,  dir: 1 },
            { y: 8,  h: 1, type: 'light', speed: 9,  op: 0.35, dir: -1 },
            { y: 11, h: 2, type: 'light', speed: 11, op: 0.45, dir: 1 },
            // Upper-mid
            { y: 15, h: 2, type: 'mid', speed: 14, op: 0.4, dir: -1 },
            { y: 19, h: 1, type: 'mid', speed: 12, op: 0.35, dir: 1 },
            { y: 23, h: 2, type: 'mid', speed: 16, op: 0.4, dir: -1 },
            { y: 28, h: 1, type: 'mid', speed: 13, op: 0.3, dir: 1 },
            // Mid-deep
            { y: 34, h: 2, type: 'mid',  speed: 18, op: 0.3, dir: -1 },
            { y: 40, h: 1, type: 'deep', speed: 20, op: 0.3, dir: 1 },
            { y: 46, h: 2, type: 'deep', speed: 22, op: 0.25, dir: -1 },
            { y: 52, h: 1, type: 'deep', speed: 19, op: 0.3, dir: 1 },
            // Deep
            { y: 60, h: 2, type: 'deep', speed: 25, op: 0.25, dir: -1 },
            { y: 68, h: 1, type: 'dark', speed: 28, op: 0.2, dir: 1 },
            { y: 75, h: 2, type: 'dark', speed: 30, op: 0.2, dir: -1 },
            { y: 83, h: 1, type: 'dark', speed: 35, op: 0.15, dir: 1 },
            { y: 90, h: 2, type: 'dark', speed: 32, op: 0.15, dir: -1 },
        ];

        ripples.forEach(r => {
            const line = document.createElement('div');
            line.className = 'ocean__wave-ripple ocean__wave-ripple--' + r.type;
            line.style.top = r.y + '%';
            line.style.setProperty('--rh', r.h + 'px');
            line.style.setProperty('--ro', r.op);
            line.style.setProperty('--rspeed', r.speed + 's');
            if (r.dir < 0) line.style.animationDirection = 'reverse';
            // Offset start so not all synchronized
            line.style.animationDelay = -(Math.random() * r.speed) + 's';
            ocean.appendChild(line);
        });

        // ── Surface Caustic Light Layer ──
        const caustic = document.createElement('div');
        caustic.className = 'ocean__caustic';
        ocean.appendChild(caustic);

        // ── Horizontal Light Streaks (replace old dot shimmers) ──
        const shimmerContainer = $('shimmers');
        if (shimmerContainer) {
            shimmerContainer.innerHTML = '';
            const streakCount = window.innerWidth <= 480 ? 15 : window.innerWidth <= 600 ? 25 : 50;
            for (let i = 0; i < streakCount; i++) {
                const s = document.createElement('div');
                s.className = 'ocean__streak';
                const yPct = Math.random() * 95 + 2;
                s.style.left = (Math.random() * 95 + 2) + '%';
                s.style.top = yPct + '%';
                // Deeper = dimmer, shorter, cooler
                const depthFactor = yPct / 100;
                const w = Math.round(15 + Math.random() * 40 * (1 - depthFactor * 0.5));
                const h = Math.random() < 0.3 ? 1 : 2;
                const alpha = (0.3 + Math.random() * 0.5) * (1 - depthFactor * 0.6);
                const blue = Math.round(200 + Math.random() * 55);
                const green = Math.round(220 + Math.random() * 35);
                s.style.setProperty('--sw', w + 'px');
                s.style.setProperty('--sh', h + 'px');
                s.style.setProperty('--sc', 'rgba(' + Math.round(140 - depthFactor * 60) + ',' + green + ',' + blue + ',' + alpha.toFixed(2) + ')');
                s.style.setProperty('--sdur', (3 + Math.random() * 5) + 's');
                s.style.setProperty('--sdelay', (Math.random() * 8) + 's');
                shimmerContainer.appendChild(s);
            }
        }

        // Boat (clickable)
        const boatContainer = document.querySelector('.ocean__boat');
        if (boatContainer) {
            boatContainer.innerHTML = '';
            boatContainer.style.cursor = 'pointer';
            boatContainer.style.pointerEvents = 'auto';
            if (!boatContainer._listenerAttached) {
                boatContainer.addEventListener('click', () => CharacterChat.show('boat', boatContainer));
                boatContainer._listenerAttached = true;
            }
            boatContainer.appendChild(Assets.boat());
        }

        // Sitting seagulls floating in the ocean
        const isMobileOcean = window.innerWidth <= 600;
        const gullPositions = isMobileOcean ? [
            { top: '40%', left: '15%', flip: false, scale: 0.5 },
            { top: '25%', left: '50%', flip: true,  scale: 0.4 },
            { top: '55%', left: '80%', flip: false, scale: 0.45 },
        ] : [
            { top: '55%', left: '12%', flip: false, scale: 1 },
            { top: '35%', left: '30%', flip: true,  scale: 0.75 },
            { top: '45%', left: '52%', flip: true,  scale: 0.9 },
            { top: '68%', left: '62%', flip: false, scale: 0.65 },
            { top: '58%', left: '88%', flip: false, scale: 0.85 },
        ];
        gullPositions.forEach(pos => {
            const gull = Assets.sittingSeagull();
            gull.className = 'ocean__sitting-gull';
            gull.style.top = pos.top;
            gull.style.left = pos.left;
            const xform = (pos.flip ? 'scaleX(-1) ' : '') + 'scale(' + pos.scale + ')';
            gull.style.transform = xform;
            gull.dataset.baseTransform = xform;
            gull.style.cursor = 'pointer';
            gull.style.pointerEvents = 'auto';
            gull.addEventListener('click', () => {
                Audio.playSeagullCroak();
                gull.style.pointerEvents = 'none';
                gull.classList.add('ocean__sitting-gull--flyaway');
                setTimeout(() => gull.remove(), 1200);
            });
            ocean.appendChild(gull);
        });

        // ── Wave Crest Sprites ──
        const crestLayer = document.getElementById('waveCrestLayer');
        if (crestLayer) {
            crestLayer.innerHTML = '';
            if (window.innerWidth <= 480) { /* skip crests entirely on small phones */ }
            else {
            const crestCount = window.innerWidth <= 600 ? 4 : 7;
            for (let i = 0; i < crestCount; i++) {
                const row = Math.min(Math.floor(i / 2) + 1, 3);
                const canvas = Assets.waveCrest(row);
                canvas.className = 'ocean__wave-crest';
                canvas.style.left = (100 + Math.random() * 50) + '%';
                canvas.style.bottom = (row * 3 + Math.random() * 4) + '%';
                canvas.style.setProperty('--crest-speed', (18 + row * 6 + Math.random() * 8) + 's');
                canvas.style.setProperty('--crest-delay', (-Math.random() * 30) + 's');
                canvas.style.setProperty('--crest-opacity', (0.85 - row * 0.12).toFixed(2));
                canvas.style.setProperty('--crest-scale', (0.6 + (3 - row) * 0.15).toFixed(2));
                crestLayer.appendChild(canvas);
            }
            } /* end else: skip crests on small phones */
        }

        // ── Night Bioluminescence ──
        ocean.querySelectorAll('.ocean__biolum').forEach(e => e.remove());
        const biolumCount = window.innerWidth <= 480 ? 8 : window.innerWidth <= 600 ? 15 : 25;
        const biolumColors = [
            'rgba(80,220,200,0.8)',
            'rgba(60,200,255,0.7)',
            'rgba(100,255,180,0.6)',
            'rgba(140,200,255,0.5)',
        ];
        for (let i = 0; i < biolumCount; i++) {
            const bl = document.createElement('div');
            bl.className = 'ocean__biolum';
            bl.style.left = (Math.random() * 96 + 2) + '%';
            // Exponential distribution — dense near surface, sparse at depth
            const rawDepth = -Math.log(1 - Math.random() * 0.95) / 3;
            bl.style.top = (Math.min(rawDepth, 1) * 35 + 2) + '%';
            const depthPct = parseFloat(bl.style.top) / 37;
            const sz = (1 + Math.random() * 2.5) * (1 - depthPct * 0.4);
            const color = biolumColors[Math.floor(Math.random() * biolumColors.length)];
            bl.style.setProperty('--bl-size', sz + 'px');
            bl.style.setProperty('--bl-color', color);
            bl.style.setProperty('--bl-dur', (2 + Math.random() * 4) + 's');
            bl.style.setProperty('--bl-del', (Math.random() * 6) + 's');
            ocean.appendChild(bl);
        }

        // ── Shared depth indicator line (lives in ocean, not per-bottle) ──
        let depthLine = ocean.querySelector('.ocean__depth-line');
        if (!depthLine) {
            depthLine = document.createElement('div');
            depthLine.className = 'ocean__depth-line';
            ocean.appendChild(depthLine);
        }

        // (turtles are on the beach, not ocean)
    },

    buildBeach() {
        const beach = document.querySelector('.beach');

        // Sand sparkles — random glints with diamond/star variants
        const sparklesEl = $('sandSparkles');
        if (sparklesEl) {
            sparklesEl.innerHTML = '';
            const sparkleCount = window.innerWidth <= 600 ? 15 : 35;
            for (let i = 0; i < sparkleCount; i++) {
                const variant = Math.random();
                let cls = 'beach__sparkle';
                if (variant > 0.8) cls += ' beach__sparkle--diamond';
                else if (variant > 0.65) cls += ' beach__sparkle--star';

                const sp = el('div', cls, sparklesEl);
                sp.style.left = (3 + Math.random() * 94) + '%';
                sp.style.top = (12 + Math.random() * 80) + '%';
                sp.style.setProperty('--sp-dur', (2.5 + Math.random() * 4) + 's');
                sp.style.setProperty('--sp-del', (Math.random() * 6) + 's');
                if (!cls.includes('star') && !cls.includes('diamond')) {
                    const sz = 1 + Math.random() * 2;
                    sp.style.width = sz + 'px';
                    sp.style.height = sz + 'px';
                }
            }
        }

        // Footprint impressions — tap sand to leave prints
        const sandBase = beach.querySelector('.beach__sand-base');
        if (sandBase && !sandBase._footprintListener) {
            sandBase.style.cursor = 'default';
            sandBase.style.pointerEvents = 'auto';
            sandBase._footprintListener = true;
            sandBase.addEventListener('click', (e) => {
                const rect = beach.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width * 100);
                const y = ((e.clientY - rect.top) / rect.height * 100);
                if (y < 25) return;
                const print = document.createElement('div');
                print.className = 'beach__footprint';
                print.style.left = x + '%';
                print.style.top = y + '%';
                print.style.transform = 'rotate(' + (Math.random() * 30 - 15) + 'deg)';
                beach.appendChild(print);
                setTimeout(() => print.remove(), 6500);
            });
        }

        // Foam bubbles — ephemeral bubble pops at tide line
        FoamBubbles.start(beach);

        // Foam and tide wash are now pure CSS — no JS generation needed

        // Decorations — well-spaced across the beach, avoiding bottle zone
        const isMobile = window.innerWidth <= 600;
        const decoConfigs = isMobile ? [
            { type: 'shell',    bottom: '20%', left: '8%' },
            { type: 'starfish', bottom: '35%', left: '42%' },
            { type: 'shell',    bottom: '18%', left: '85%' },
        ] : [
            { type: 'shell',    bottom: '42%', left: '18%' },
            { type: 'starfish', bottom: '55%', left: '48%' },
            { type: 'shell',    bottom: '45%', left: '78%' },
        ];
        decoConfigs.forEach(cfg => {
            const canvas = cfg.type === 'shell' ? Assets.shell() : Assets.starfish();
            canvas.className = 'beach__deco';
            canvas.style.bottom = cfg.bottom;
            canvas.style.left = cfg.left;
            canvas.style.cursor = 'pointer';
            canvas.style.pointerEvents = 'auto';
            canvas.addEventListener('click', () => CharacterChat.show(cfg.type, canvas));
            beach.appendChild(canvas);
        });

        // Sea turtle basking on shore
        beach.querySelectorAll('.beach__turtle').forEach(t => t.remove());
        const turtle = Assets.seaTurtle();
        turtle.className = 'beach__turtle';
        if (window.innerWidth <= 600) {
            turtle.style.bottom = '12%';
            turtle.style.left = '68%';
        } else {
            turtle.style.bottom = '35%';
            turtle.style.left = '72%';
        }
        turtle.style.cursor = 'pointer';
        turtle.addEventListener('click', () => CharacterChat.show('turtle', turtle));
        beach.appendChild(turtle);
    },

    buildPalms() {
        const palmLeft = document.querySelector('.palm--left');
        const palmRight = document.querySelector('.palm--right');
        if (palmLeft) {
            const c = Assets.palmTree();
            c.className = 'palm__canvas';
            palmLeft.appendChild(c);
        }
        if (palmRight) {
            const c = Assets.palmTree();
            c.className = 'palm__canvas';
            palmRight.appendChild(c);
        }
    },

    buildWelcome() {
        const bottleEl = document.querySelector('.welcome__bottle');
        if (bottleEl) {
            bottleEl.innerHTML = '';
            bottleEl.appendChild(Assets.welcomeBottle());
        }

        // Add twinkling stars to welcome screen
        const welcome = document.querySelector('.welcome-screen');
        const starCount = prefersReducedMotion ? 0 : (window.innerWidth <= 480 ? 10 : window.innerWidth <= 600 ? 18 : 30);
        for (let i = 0; i < starCount; i++) {
            const star = el('div', 'welcome-star', welcome);
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 60 + '%';
            star.style.animationDelay = (Math.random() * 3) + 's';
            star.style.animationDuration = (1.5 + Math.random() * 2) + 's';
        }
    }
};

// ─── SEAGULL POPUP (angry crocking!) ──────────────────────────
const SeagullPopup = {
    _el: null,
    _timeout: null,

    show(cx, cy) {
        this.hide();
        Audio.playSeagullCroak();

        const popup = el('div', 'seagull-popup', document.body);
        // Position above the clicked element, clamped to viewport with safe area padding
        const safeL = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sal') || '0', 10);
        const safeR = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sar') || '0', 10);
        const popW = 140, margin = 10;
        const maxLeft = window.innerWidth - popW - safeR - margin;
        popup.style.left = Math.max(margin + safeL, Math.min(cx - popW / 2, maxLeft)) + 'px';
        popup.style.top = Math.max(margin, cy - 130) + 'px';

        const gullCanvas = Assets.angrySeagull();
        gullCanvas.className = 'seagull-popup__sprite';
        popup.appendChild(gullCanvas);

        const bubble = el('div', 'seagull-popup__bubble', popup);
        const messages = [
            'SQUAWK!! 🚫\nNot yet, matey!',
            'CAW CAW!! 😤\nThis one\'s still at sea!',
            'SCREEE!! 🌊\nWait your turn!',
            'RAWK!! 💢\nPatience, landlubber!',
            'SKREE!! 🏴‍☠️\nThe sea decides!',
            'CAWK!! 😠\nHands off me bottle!',
            'SQUAAAK!! 🦀\nNot washed ashore yet!'
        ];
        bubble.textContent = messages[Math.floor(Math.random() * messages.length)];

        this._el = popup;
        this._timeout = setTimeout(() => this.hide(), 3000);
    },

    hide() {
        if (this._el) {
            this._el.classList.add('seagull-popup--leaving');
            const ref = this._el;
            setTimeout(() => ref.remove(), 400);
            this._el = null;
        }
        if (this._timeout) {
            clearTimeout(this._timeout);
            this._timeout = null;
        }
    }
};

// ─── CHARACTER CHAT (clickable speech bubbles) ────────────────
// Combinatorial matrix: opener × compliment × closer = 365+ unique per character
const FlirtMatrix = {
    // ─── SUN ───── (cocky, warm, self-aware diva)
    sun: {
        openers: [
            'Real talk:', 'Okay so—', 'Not to flex but', 'Hot take:',
            'Between you and me,', 'Don\'t tell the clouds—', 'Confession:',
            'I\'ve been 4.6 billion years\nand finally—', 'Look,',
            'Alright alright—', 'Quick aside:', 'Off the record:',
            'Gonna be honest:', 'Since we\'re here—'
        ],
        compliments: [
            'you\'re genuinely the best part\nof my daily commute',
            'I light the whole planet\nand you still\nmanaged to stand out',
            'I tried taking a day off once\nthen remembered you\nneeded good lighting',
            'my surface is 5,500°C\nand somehow you\'re\nthe warm one here',
            'you know that golden hour glow?\nyeah I do that on purpose\nwhen you\'re outside',
            'I set every evening\njust so you get\na pretty sky to look at',
            'they named a whole system\nafter me\nbut I\'d name it after you',
            'clouds keep getting in my way\nbut your vibe cuts through\neven overcast days',
            'I provide energy\nfor all living things on earth\nbut somehow you\nrecharge me',
            'sunflowers literally track me\nacross the sky\nand I get it now\nbecause same',
            'photosynthesis is cool\nbut have you tried\nmaking someone smile?',
            'every planet orbits me\nbut I\'d happily\norbit your schedule',
            'people chase sunsets\nbut you\'re more of\na whole sunrise situation'
        ],
        closers: [
            ' ☀️', '\n—Sol, the original', ' 🌅',
            '\n*drops behind horizon*', ' 😎', '\n…no SPF for this',
            '\n*lens flare*', ' 💛', '\nI said what I said',
            '\n*hides behind cloud*', ' ✨', '\n—your local star'
        ]
    },
    // ─── TURTLE ───── (chill philosopher, unbothered, dry humor)
    turtle: {
        openers: [
            '*blinks once*', 'So.', 'Not to rush things but—',
            '*slowly looks up*', 'Fun fact:', 'Hot take\n(said slowly):',
            'After careful deliberation,', 'The sand and I agree:',
            'In no particular hurry:', 'Took me a while\nbut:',
            'Between naps,', 'Okay I thought about it\nfor three hours:',
            'Unpopular opinion:', 'Slow news day so—'
        ],
        compliments: [
            'you\'re the only reason\nI\'d come out of this shell\nand I LOVE this shell',
            'I move at my own pace\nbut I picked it up\nwhen I saw you',
            'I\'ve been around\nsince the dinosaurs\nand you\'re easily top 5',
            'everyone wants me\nto speed up\nbut you just… let me be me',
            'I carry my house\non my back\nwhich honestly\nrelates to nothing\nbut hi',
            'I\'ve outlived the T-Rex\nand can confirm\nyour vibe is timeless',
            'the beach is fine\nbut you just made it\nkind of great actually',
            'I was going to nap\nbut you\'re more interesting\nthan sleep\nand I don\'t say\nthat lightly',
            'my metabolism is slow\nbut I was quick\nto notice how cool you are',
            'I don\'t do much\nbut I appreciate a lot\nespecially you',
            'they say slow and steady\nwins the race\nI just think\nslow and steady\nis the only way to enjoy this',
            'you have that calm energy\nthat makes everything else\nfeel less chaotic',
            'the sea is patient\nand so am I\nespecially when it comes to you'
        ],
        closers: [
            ' 🐢', '\n*retreats, satisfied*', ' 💚',
            '\n…okay nap time', '\n*slow nod*', '\n—Shelly',
            '\n*sinks into sand*', ' 💤', '\nno rush on a reply',
            '\n(I\'ll be here)', ' 🏖️', '\n*vibes*'
        ]
    },
    // ─── SEAGULL ───── (chaotic, unhinged, absurdly confident)
    seagull: {
        openers: [
            'SQUAWK!', 'LISTEN—', 'OI!', 'BREAKING:',
            '*lands aggressively*', 'OKAY SO—', 'HEAR ME OUT—',
            'I just SWOOPED in to say—', 'ALERT ALERT:', 'RIGHT—',
            'THIS JUST IN:', 'FROM 200 FEET UP:', 'NO TIME TO EXPLAIN—',
            '*crashes into conversation*'
        ],
        compliments: [
            'you\'re more appealing\nthan an unattended plate of fries\nand that\'s MY highest compliment',
            'I see EVERYTHING from up here\nand you\'re the only thing\nworth dive-bombing towards',
            'I\'d share my fish with you\nactually no I wouldn\'t\nbut I\'d THINK about it',
            'I scream at everything\nbut you make me want\nto scream NICELY',
            'the wind takes me everywhere\nand yet HERE I AM\ntalking to YOU\nthat means something',
            'I stole a tourist\'s sandwich\nearlier\nbut you stole my attention\nso we\'re even',
            'I\'ve pooped on\na LOT of things\nbut I\'d never\npoop on your car\nprobably',
            'most humans are just\nwalking French fry dispensers\nbut you\'ve got substance',
            'I have the attention span\nof a—\noh hey a chip—\nwait no YOU\nyou\'re important',
            'birds of a feather\nflock together\nand I\'d join YOUR flock\nany day',
            'every beach every pier\nevery boardwalk\nand you\'re still\nthe best scenery',
            'I\'m technically a wild animal\nbut you make me\nwant to be civilized',
            'I could literally fly\nANYWHERE\nand I chose to fly HERE\nconnect the dots'
        ],
        closers: [
            ' 🍟', '\nMINE! wait— YOURS!', ' 🐦',
            '\n*flies into a pole*', ' 💨', '\nSQUAAWK!',
            '\n—Gull #7', ' 😤', '\n*steals your heart\nthen drops it\nthen picks it up again*',
            '\n*aggressive eye contact*', ' 🌬️', '\nCAW! (affectionately)'
        ]
    },
    // ─── BOAT ───── (old soul, romantic but grounded, salty wisdom)
    boat: {
        openers: [
            'Captain\'s log:', 'Ahoy,', '*creaks thoughtfully*', 'Navigation update:',
            'Between ports,', 'Docked here to say:', 'Overheard on the water:',
            'From the helm:', 'Weather report says clear skies—', 'Compass says:',
            'Mid-voyage thought:', 'Anchored here because:',
            'Wind\'s picking up and—', 'Small craft advisory:'
        ],
        compliments: [
            'I\'ve been everywhere\nand "here with you"\nis the best coordinates yet',
            'the ocean is vast\nand unpredictable\nbut the way I feel\nis pretty straightforward',
            'every port has something\nworth seeing\nbut none of them\nmade me want to stay',
            'the horizon is the most\nbeautiful line in nature\nuntil you smiled',
            'I was built to keep moving\nbut some things\nare worth dropping anchor for',
            'the sea taught me patience\nyou taught me\nwhy it\'s worth it',
            'sailors navigate by stars\nbut honestly\nyou\'re easier to find',
            'I\'ve weathered storms\nthat would sink lesser boats\nbut your laugh\nstill catches me off guard',
            'the best view from this deck\nisn\'t the sunset\nit\'s knowing\nyou\'re on the shore',
            'saltwater heals everything\nbut you do it faster',
            'every journey starts\nby leaving the harbor\nand every good one\nends where you are',
            'the tide comes and goes\nbut some things just… stay',
            'I creak a lot\nand I\'m not that fast\nbut I always\nfind my way back'
        ],
        closers: [
            ' ⛵', '\n—S.S. Still Here', ' ⚓',
            '\n*foghorn, softly*', ' 🌊', '\nfair winds',
            '\n—helm\'s log, final entry', ' 🧭',
            '\n*drifts on*', ' 💙', '\nsmooth sailing', '\n*gentle creak*'
        ]
    },
    // ─── ORCA ───── (dramatic, extra, surprisingly wholesome)
    orca: {
        openers: [
            '*BREACH*', '*surfaces casually*', 'So—', 'Quick question:',
            'The pod sent me to say:', 'From below:', 'Fun whale fact:',
            '*spyhops*', 'Mid-breach thought:', 'Whale hello,',
            'Coming up for air and:', 'Deep sea dispatch:', 'Surfacing because:',
            'WOOSH okay hi—'
        ],
        compliments: [
            'I\'m literally called\na killer whale\nand yet here I am\nbeing soft about you',
            'I can hold my breath\nfor 17 minutes\nbut you made me\nforget to breathe\nand I live underwater',
            'my brain weighs 6kg\nand most of it\nis thinking about\nhow cool you are',
            'I\'m the apex predator\nof the ocean\nand you just\nmade me nervous',
            'the ocean is 36,000 feet deep\nand so is my respect\nfor whatever it is you\'ve got going on',
            'I travel 100 miles a day\nand the best mile\nwas the one closest to here',
            'my pod is my whole world\nbut I\'d add you\nto the group chat',
            'I breached just now\nand I\'d like you to think\nit was to impress you\nbecause it was',
            'great whites are scared of me\nbut your smile\nmakes me the nervous one',
            'echolocation lets me\nsee everything\nand you\'re the clearest signal out here',
            'I\'m black and white\nbut how I feel\nis pretty colorful right now',
            'they put us in movies\nand theme parks\nbut this\nright here\nis the main event',
            'I swim in pods of 40\nbut honestly\nyou\'d be my favorite one'
        ],
        closers: [
            ' 🐋', '\n*disappears dramatically*', ' 💦',
            '\n—self-freed since \'93', ' 🖤🤍', '\n*tail slap*',
            '\nSPLASH (lovingly)', ' 🌊', '\n—ocean\'s most dramatic',
            '\n*sinks below, smiling\nprobably*', ' 💙', '\n*cannonball*'
        ]
    },
    // ─── MOON ───── (quiet, introspective, low-key poetic)
    moon: {
        openers: [
            '*glows*', 'Hey,', 'Quiet thought:', 'Look up for a sec—',
            'Between phases,', 'When the world gets still:', 'Silver lining:',
            'Night shift update:', 'The stars and I were talking—',
            'While everyone sleeps:', '3am thought:', 'Softly:',
            'You\'re still up?', 'Can\'t sleep either?'
        ],
        compliments: [
            'I light up the whole sky\nand somehow\nyou\'re the one\npeople write poems about',
            'I pull the entire ocean\ntwice a day\nbut you\'re the thing\nthat moves me',
            'I go through phases\nbut how I feel about you\nhas been consistent\nfor a while now',
            'the night is quieter\nwhen you\'re in it\nlike even the dark\nrespects your peace',
            'wolves howl at me\nand honestly\nI get it\nsome things just make you feel something',
            'I disappear for days\nand come back different\nbut you\nyou\'re steady\nand that\'s rare',
            'half the planet\nis looking up right now\nbut I only notice\nwhen you do',
            'the sun gets all the credit\nbut the best conversations\nhappen under my light',
            'I\'m 4.5 billion years old\nand still learning\nnew reasons\nto pay attention to you',
            'astronauts walked on me\nand even they said\nthe best view\nwas back towards earth',
            'I reflect light\nthat isn\'t mine\nbut the way you glow\nis entirely yours',
            'the darkest skies\nmake the brightest stars visible\nyou taught me that',
            'I\'m always here\neven when you\ncan\'t see me\njust so you know'
        ],
        closers: [
            ' 🌙', '\n*dims slightly*', ' 💫', '\n—Luna',
            ' 🌟', '\n*silver light*', '\nsweet dreams',
            '\n—night shift', ' 🤍', '\n*crater wink*',
            '\nstill here', ' ✨'
        ]
    },
    // ─── STARFISH ───── (upbeat, self-deprecating, absurdist charm)
    starfish: {
        openers: [
            '*wiggles*', 'Hey down here!', 'FIVE reasons:', 'Quick—',
            'The sand told me:', 'Arm update:', 'Beach bulletin:',
            'No bones about it\n(literally, I have zero):', 'So get this—',
            'Tidal report:', '*flexes (?) arm*', 'Between waves,',
            'Low tide exclusive:', 'Before the tide takes me—'
        ],
        compliments: [
            'I don\'t have a brain\nand even I can tell\nyou\'re something special',
            'I have five arms\nand zero ability\nto play it cool around you',
            'I can regenerate\na whole arm\nbut I cannot regenerate\nmy composure near you',
            'I cling to rocks\nfor a living\nso commitment\nis kind of my thing',
            'I\'m technically\nan echinoderm\nwhich isn\'t relevant\nbut I\'m nervous',
            'the ocean has 230,000 species\nand you\'re more interesting\nthan all of them',
            'I eat by pushing\nmy stomach out of my body\nwhich is disgusting\nbut I\'m still\nmore charming than most',
            'they say reach for the stars\nbut I\'m right here\nmuch easier logistics',
            'I\'ve been on this beach\nfor six hours\nand you\'re the first thing\nthat made it worthwhile',
            'I don\'t technically\nhave a heart\nbut something in my\nwater vascular system\nskipped a beat',
            'the beach is full\nof beautiful things\nand I\'m including\nmyself and you in that',
            'I move using\ntube feet\nwhich is embarrassing\nbut I\'m confident\nso it works',
            'I\'m small, flat,\nand stuck to a rock\nbut I\'ve got great taste'
        ],
        closers: [
            ' ⭐', '\n*wiggles contentedly*', '\n—Seastarr', ' 🌟',
            '\n*clings harder*', ' 🧪', '\n*turns slightly oranger*',
            '\nall five arms salute you', ' 💛', '\n*sparkles*',
            '\n—your beach friend', ' 🌊'
        ]
    },
    // ─── SHELL ───── (mysterious, gentle, oddly wise)
    shell: {
        openers: [
            '*hold me to your ear*', 'Listen—', 'Psst:', 'The ocean says:',
            'Echoing inside:', 'Small voice, big truth:', 'From the shoreline,',
            '*tiny rattle*', 'Washed up to tell you:', 'Secret:',
            'The tide left me here\nbecause:', 'Pearl of wisdom:',
            'Can you hear it?', 'Quietly:'
        ],
        compliments: [
            'the ocean put a whole song\ninside me\nand somehow\nit sounds like you',
            'I traveled the entire seafloor\nand the best thing\nthat happened to me\nwas landing here',
            'everyone picks up shells\nlooking for the perfect one\nand here you are\nbeing found too',
            'I\'m proof that\nthe rough stuff\nmakes you more beautiful\nand so are you',
            'hold me to your ear\nand the ocean will tell you\nwhat I already know',
            'the sea spent years\nshaping me into this\nimagine what it did\nwhen it made you',
            'I don\'t do much\njust sit here\nlooking pretty\nkind of a vibe honestly',
            'millions of shells\non millions of beaches\nand you picked this one up\nthat says something',
            'I\'m small and I crack\nif you squeeze too hard\nbut that\'s not a metaphor\nI\'m literally fragile\nplease be gentle',
            'the waves move everything around\nbut some things\nend up exactly\nwhere they should be',
            'I used to be someone\'s home\nnow I\'m a beach decoration\nand honestly\nboth careers slap',
            'every wave that shaped me\nknew where I\'d end up\nand I\'m glad it\'s here',
            'the prettiest things\nwash up without trying\njust like you showed up today'
        ],
        closers: [
            ' 🐚', '\n*ocean sound*', '\n—a small shell',
            ' 🌊', '\n*soft rattle*', ' 🤍',
            '\n—from the deep', '\n*catches the light*',
            ' ✨', '\n*rolls back into surf*', ' 💕',
            '\nlisten closely…'
        ]
    }
};

// Generate a unique message from the matrix
function generateFlirt(character) {
    const m = FlirtMatrix[character];
    if (!m) return '…';
    const o = m.openers[Math.floor(Math.random() * m.openers.length)];
    const c = m.compliments[Math.floor(Math.random() * m.compliments.length)];
    const e = m.closers[Math.floor(Math.random() * m.closers.length)];
    return o + '\n' + c + e;
}

const CharacterChat = {
    _el: null,
    _timeout: null,
    _cooldowns: {},
    _pausedEl: null,

    show(character, targetEl) {
        // Cooldown — prevent spam
        if (this._cooldowns[character]) return;
        this._cooldowns[character] = true;
        setTimeout(() => { this._cooldowns[character] = false; }, 2500);

        this.hide();

        // Pause the clicked character's animation
        this._pausedEl = targetEl;
        targetEl.style.animationPlayState = 'paused';
        // Also pause the parent if it's the boat container (boat-sail + boat-bob)
        if (targetEl.parentElement) {
            targetEl.parentElement.style.animationPlayState = 'paused';
        }

        // Play the character's sound
        Audio.playCharacterSound(character);

        // Position near the clicked element
        const rect = targetEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top;

        const popup = el('div', 'char-bubble', document.body);
        popup.dataset.character = character;
        const cbW = Responsive.isMobile() ? 220 : 260, cbMargin = 10;
        const cbMaxLeft = window.innerWidth - cbW - cbMargin;
        popup.style.left = Math.max(cbMargin, Math.min(cx - cbW / 2, cbMaxLeft)) + 'px';
        popup.style.top = Math.max(cbMargin, cy - 45) + 'px';

        const bubble = el('div', 'char-bubble__text', popup);
        bubble.textContent = generateFlirt(character);

        this._el = popup;
        this._timeout = setTimeout(() => this.hide(), 4000);
    },

    hide() {
        // Resume the paused character
        if (this._pausedEl) {
            this._pausedEl.style.animationPlayState = '';
            if (this._pausedEl.parentElement) {
                this._pausedEl.parentElement.style.animationPlayState = '';
            }
            this._pausedEl = null;
        }
        if (this._el) {
            this._el.classList.add('char-bubble--leaving');
            const ref = this._el;
            setTimeout(() => ref.remove(), 400);
            this._el = null;
        }
        if (this._timeout) {
            clearTimeout(this._timeout);
            this._timeout = null;
        }
    }
};

// ─── BOTTLE MANAGER (ocean scatter system) ────────────────────
const BottleManager = {
    // ── DRAW DISTANCE SYSTEM ──────────────────────────────────
    // Each bottle has depth properties that control parallax:
    //   scale       — visual size (small = far, large = near)
    //   bobY        — bob amplitude in px (gentle far, strong near)
    //   depthBlur   — CSS blur in px (hazy far, sharp near)
    //   depthOpacity — 0-1 (faded far, solid near)
    //   depthSat    — 0-1 saturation multiplier (washed-out far)
    //   bottom%     — vertical position (high = horizon, low = foreground)
    //
    // Three depth lanes:
    //   FAR  (horizon)  — bottom 75-86%, scale 0.28-0.38
    //   MID  (mid-sea)  — bottom 55-70%, scale 0.50-0.68
    //   NEAR (shore)    — bottom 34-48%, scale 0.82-1.00
    // ──────────────────────────────────────────────────────────
    oceanPositions: [
        // ── FAR HORIZON — tiny indistinct specks, heavily faded ──
        { left: 14,  bottom: 84, scale: 0.18, bobDelay: 0,   bobDur: 7.2, driftAmt: 3,  bobY: 2,  depthBlur: 2.5, depthOpacity: 0.38, depthSat: 0.40 },
        { left: 72,  bottom: 80, scale: 0.22, bobDelay: 1.6, bobDur: 6.8, driftAmt: 4,  bobY: 2,  depthBlur: 2.2, depthOpacity: 0.42, depthSat: 0.45 },
        // ── MID OCEAN — recognizable but atmospheric ──
        { left: 44,  bottom: 68, scale: 0.42, bobDelay: 0.7, bobDur: 5.4, driftAmt: 7,  bobY: 6,  depthBlur: 1.0, depthOpacity: 0.68, depthSat: 0.65 },
        { left: 84,  bottom: 62, scale: 0.50, bobDelay: 2.0, bobDur: 5.0, driftAmt: 9,  bobY: 7,  depthBlur: 0.7, depthOpacity: 0.75, depthSat: 0.72 },
        { left: 26,  bottom: 56, scale: 0.58, bobDelay: 0.3, bobDur: 4.8, driftAmt: 11, bobY: 9,  depthBlur: 0.4, depthOpacity: 0.82, depthSat: 0.80 },
        // ── NEAR SHORE — large, crisp, strong bob ──
        { left: 60,  bottom: 44, scale: 0.78, bobDelay: 1.5, bobDur: 4.0, driftAmt: 14, bobY: 14, depthBlur: 0,   depthOpacity: 1.0,  depthSat: 1.0 },
        { left: 16,  bottom: 36, scale: 0.90, bobDelay: 0.9, bobDur: 3.5, driftAmt: 7,  bobY: 15, depthBlur: 0,   depthOpacity: 1.0,  depthSat: 1.0 },
    ],

    // Extra decorative ocean bottles — fill across all depth lanes
    decorativeOceanPositions: [
        { left: 50,  bottom: 86, scale: 0.15, bobDelay: 0.5, bobDur: 7.6, driftAmt: 2,  bobY: 2,  depthBlur: 2.8, depthOpacity: 0.35, depthSat: 0.35 },
        { left: 88,  bottom: 76, scale: 0.26, bobDelay: 2.2, bobDur: 6.4, driftAmt: 5,  bobY: 3,  depthBlur: 1.8, depthOpacity: 0.48, depthSat: 0.48 },
        { left: 36,  bottom: 72, scale: 0.35, bobDelay: 1.0, bobDur: 5.8, driftAmt: 6,  bobY: 4,  depthBlur: 1.2, depthOpacity: 0.58, depthSat: 0.55 },
        { left: 76,  bottom: 48, scale: 0.70, bobDelay: 0.8, bobDur: 4.2, driftAmt: 12, bobY: 12, depthBlur: 0.1, depthOpacity: 0.92, depthSat: 0.90 },
    ],

    // Organic shore positions — bottles washed ashore, lying at angles, partially buried
    shorePositions: [
        { left: 28, bottom: 50, rot: -65, buryPct: 35, scale: 1.05 },  // day 1 — tilted left, buried in sand
        { left: 62, bottom: 38, rot: 42,  buryPct: 28, scale: 1.12 },  // day 2 — tilted right, near foam
        { left: 15, bottom: 30, rot: -78, buryPct: 40, scale: 1.00 },  // day 3 — almost horizontal, deep in sand
        { left: 75, bottom: 55, rot: 25,  buryPct: 20, scale: 1.10 },  // day 4 — slight tilt, freshly washed
        { left: 45, bottom: 65, rot: -35, buryPct: 30, scale: 1.04 },  // day 5 — center left lean
        { left: 52, bottom: 42, rot: 80,  buryPct: 38, scale: 1.08 },  // day 6 — nearly flat right
        { left: 35, bottom: 25, rot: -50, buryPct: 32, scale: 1.06 },  // day 7 — diagonal in wet sand
    ],

    // Mobile shore positions — compact, gentle tilts, phone-friendly
    shorePositionsMobile: [
        { left: 18, bottom: 50, rot: -12, buryPct: 35, scale: 0.55 },
        { left: 58, bottom: 38, rot: 15,  buryPct: 30, scale: 0.58 },
        { left: 10, bottom: 30, rot: -18, buryPct: 40, scale: 0.52 },
        { left: 76, bottom: 55, rot: 10,  buryPct: 24, scale: 0.56 },
        { left: 40, bottom: 62, rot: -8,  buryPct: 28, scale: 0.54 },
        { left: 54, bottom: 44, rot: 14,  buryPct: 36, scale: 0.55 },
        { left: 30, bottom: 28, rot: -15, buryPct: 32, scale: 0.52 },
    ],

    _getShorePos(dayIndex) {
        const isMobile = Responsive.isMobile();
        const arr = isMobile ? this.shorePositionsMobile : this.shorePositions;
        return arr[dayIndex % arr.length];
    },

    render() {
        const area = $('bottleArea');
        const oceanArea = $('oceanBottles');
        if (!area) return;
        area.innerHTML = '';
        if (oceanArea) oceanArea.innerHTML = '';

        const currentDay = DateUtil.getCurrentDay();
        const total = DateUtil.getTotal();

        if (currentDay < 1) {
            // All bottles in ocean, none on shore yet
            this._renderOceanBottles(total, 0);
            area.innerHTML = '<div style="text-align:center;color:var(--ui-text);font-size:7px;text-shadow:1px 1px 0 #000;padding:20px;">The first message arrives soon... 🌊</div>';
            this.updateHUD();
            return;
        }

        // If past the valentine period, unlock all bottles on shore
        if (currentDay > total) {
            this._renderAllBottlesOnShore(area, total);
            this.updateHUD();
            return;
        }

        // Render ocean bottles (future days still at sea)
        this._renderOceanBottles(total, currentDay);

        // Render ALL unlocked bottles on shore (day 1 → currentDay)
        // Unopened ones accumulate — if you skip Day 1, both Day 1 and Day 2 appear!
        const maxShoreDay = Math.min(currentDay, total);
        for (let day = 1; day <= maxShoreDay; day++) {
            const opened = State.isOpened(day);
            const pos = this._getShorePos(day - 1);

            if (opened) {
                // Past opened bottles — small, faded, click to re-read
                const mini = el('div', 'bottle bottle--opened bottle--past-mini', area);
                mini.title = `Day ${day}: ${CONFIG.messages[day-1]?.title || ''}`;
                mini.style.left = pos.left + '%';
                mini.style.bottom = pos.bottom + '%';
                mini.style.transform = `rotate(${pos.rot}deg) scale(${pos.scale * 0.55})`;

                const canvas = Assets.bottleSmall();
                canvas.className = 'bottle__canvas';
                canvas.style.opacity = '0.5';
                canvas.style.filter = 'grayscale(0.5)';
                mini.appendChild(canvas);

                const sb = el('div', 'bottle__sand-bury', mini);
                sb.style.setProperty('--bury-h', (pos.buryPct + 10) + '%');

                mini.addEventListener('click', () => Modal.show(day));
            } else {
                // Unopened bottle — full size, glowing, clickable
                const wrapper = el('div', 'bottle', area);
                wrapper.dataset.day = day;
                wrapper.style.left = pos.left + '%';
                wrapper.style.bottom = pos.bottom + '%';
                wrapper.style.transform = `rotate(${pos.rot}deg) scale(${pos.scale})`;

                const glow = el('span', 'bottle__glow', wrapper);
                glow.textContent = '💌';

                const canvas = Assets.bottleSealed();
                canvas.className = 'bottle__canvas';
                wrapper.appendChild(canvas);

                // Sand burial overlay
                const sandBury = el('div', 'bottle__sand-bury', wrapper);
                sandBury.style.setProperty('--bury-h', pos.buryPct + '%');

                // Wet sand ring at base
                el('div', 'bottle__wet-ring', wrapper);

                const label = el('div', 'bottle__day', wrapper);
                label.textContent = `Day ${day} — Open me!`;

                wrapper.addEventListener('click', () => this.open(day, wrapper));
            }
        }

        this.updateHUD();
    },

    _renderOceanBottle(oceanArea, pos, dayLabel, isDecorative) {
        const wrapper = el('div', 'ocean-bottle' + (isDecorative ? ' ocean-bottle--decorative' : ''), oceanArea);
        if (dayLabel) wrapper.dataset.day = dayLabel;
        wrapper.style.left = pos.left + '%';
        wrapper.style.bottom = pos.bottom + '%';
        // CSS custom properties for scale, bob, and lateral drift
        wrapper.style.setProperty('--s', pos.scale);
        wrapper.style.setProperty('--bob-delay', pos.bobDelay + 's');
        wrapper.style.setProperty('--bob-dur', pos.bobDur + 's');
        wrapper.style.setProperty('--drift-amt', (pos.driftAmt || 10) + 'px');
        wrapper.style.setProperty('--drift-dur', (pos.bobDur * 2.2 + Math.random() * 3) + 's');
        wrapper.style.setProperty('--drift-delay', (Math.random() * 4) + 's');
        // Draw-distance depth properties
        wrapper.style.setProperty('--bob-y', (pos.bobY || 12) + 'px');
        wrapper.style.setProperty('--depth-blur', (pos.depthBlur || 0) + 'px');
        wrapper.style.setProperty('--depth-opacity', pos.depthOpacity != null ? pos.depthOpacity : 1);
        wrapper.style.setProperty('--depth-sat', pos.depthSat != null ? pos.depthSat : 1);

        // Per-bottle chop variance (folded into swell animation)

        // Full-size sealed bottle — CSS scale handles depth/perspective
        const canvas = Assets.bottleSealed();
        canvas.className = 'ocean-bottle__canvas';
        wrapper.appendChild(canvas);

        // Submerged water overlay
        el('div', 'ocean-bottle__water', wrapper);

        // Skip ripples + spray on far AND mid bottles (perf: reduce DOM + animations)
        const isFarBottle = pos.scale < 0.6;
        if (!isFarBottle) {
            // Ripple rings at waterline
            for (let r = 0; r < 3; r++) {
                const ripple = el('div', 'ocean-bottle__ripple', wrapper);
                ripple.style.setProperty('--ripple-dur', (2.0 + Math.random() * 2.5) + 's');
                ripple.style.setProperty('--ripple-delay', (r * 1.0 + Math.random() * 0.8) + 's');
            }

            // Spray particles — synced to bob peak moments
            const sprayCount = pos.scale > 0.6 ? 4 : 2;
            for (let sp = 0; sp < sprayCount; sp++) {
                const spray = el('div', 'ocean-bottle__spray', wrapper);
                spray.style.setProperty('--spray-delay', (sp * 0.15).toFixed(2) + 's');
                spray.style.setProperty('--spray-x', (Math.random() * 40 - 20) + 'px');
                spray.style.setProperty('--spray-y', (-10 - Math.random() * 22) + 'px');
            }
        }

        // Depth indicator — show shared ocean line on hover
        const depthLine = oceanArea.closest('.ocean')?.querySelector('.ocean__depth-line');
        if (depthLine) {
            wrapper.addEventListener('mouseenter', () => {
                const oceanRect = oceanArea.closest('.ocean').getBoundingClientRect();
                const wrapperRect = wrapper.getBoundingClientRect();
                const yPct = ((wrapperRect.top + wrapperRect.height * 0.6 - oceanRect.top) / oceanRect.height * 100);
                depthLine.style.top = yPct + '%';
                depthLine.classList.add('ocean__depth-line--visible');
            });
            wrapper.addEventListener('mouseleave', () => {
                depthLine.classList.remove('ocean__depth-line--visible');
            });
        }

        if (!isDecorative && dayLabel) {
            const dayTag = el('div', 'ocean-bottle__tag', wrapper);
            dayTag.textContent = `Day ${dayLabel}`;
        }

        // Click on a future bottle → angry seagull guards it!
        wrapper.addEventListener('click', () => {
            const rect = wrapper.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top;
            SeagullPopup.show(cx, cy);
        });

        return wrapper;
    },

    _renderOceanBottles(total, currentDay) {
        const oceanArea = $('oceanBottles');
        if (!oceanArea) return;

        let renderedCount = 0;

        // Render message bottles still at sea
        for (let day = 1; day <= total; day++) {
            if (day <= currentDay) continue;
            const pos = this.oceanPositions[(day - 1) % this.oceanPositions.length];
            this._renderOceanBottle(oceanArea, pos, day, false);
            renderedCount++;
        }

        // Fill with decorative bottles so the ocean never looks empty (min 7 visible)
        const minVisible = 7;
        const decoPositions = this.decorativeOceanPositions;
        let decoIdx = 0;
        while (renderedCount < minVisible && decoIdx < decoPositions.length) {
            this._renderOceanBottle(oceanArea, decoPositions[decoIdx], null, true);
            renderedCount++;
            decoIdx++;
        }
    },

    // _renderPastBottles removed — all shore bottles (opened + unopened) now rendered in main render() loop

    _renderAllBottlesOnShore(area, total) {
        // All messages unlocked — show every bottle scattered organically on the shore
        for (let day = 1; day <= total; day++) {
            const opened = State.isOpened(day);
            const pos = this._getShorePos(day - 1);
            const wrapper = el('div', 'bottle' + (opened ? ' bottle--opened' : ''), area);
            wrapper.dataset.day = day;
            wrapper.style.left = pos.left + '%';
            wrapper.style.bottom = pos.bottom + '%';
            wrapper.style.transform = `rotate(${pos.rot}deg) scale(${pos.scale})`;

            if (!opened) {
                const glow = el('span', 'bottle__glow', wrapper);
                glow.textContent = '💌';
            }

            const canvas = opened ? Assets.bottleOpened() : Assets.bottleSealed();
            canvas.className = 'bottle__canvas';
            wrapper.appendChild(canvas);

            // Sand burial overlay
            const sandBury = el('div', 'bottle__sand-bury', wrapper);
            sandBury.style.setProperty('--bury-h', pos.buryPct + '%');

            // Wet sand ring
            el('div', 'bottle__wet-ring', wrapper);

            const label = el('div', 'bottle__day', wrapper);
            label.textContent = opened ? `Day ${day} ✓` : `Day ${day} — Open me!`;

            if (!opened) {
                wrapper.addEventListener('click', () => this.open(day, wrapper));
            } else {
                wrapper.addEventListener('click', () => Modal.show(day));
            }
        }
    },

    _opening: false,

    open(day, element) {
        // Guard: prevent double-tap / race condition
        if (this._opening) return;
        this._opening = true;

        // Ensure AudioContext is active inside this user-gesture handler
        Audio.ensureReadySync();

        const rect = element.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + 20;

        // Visual feedback — immediately mark the bottle as opening
        element.style.pointerEvents = 'none';
        element.classList.add('bottle--opening');

        Audio.playCork();
        Particles.cork(cx, cy);

        setTimeout(() => {
            Particles.sparkles(cx, rect.top + rect.height / 2);
            Particles.hearts(cx, rect.top);
        }, 120);

        State.markOpened(day);

        setTimeout(() => {
            Audio.playPaper();
            setTimeout(() => Audio.playChime(), 200);
            Modal.show(day);
            // Defer render to next frame so modal transition isn't blocked
            requestAnimationFrame(() => {
                this.render();
                this._opening = false;
            });
        }, 350);
    },

    updateHUD() {
        const currentDay = DateUtil.getCurrentDay();
        const total = DateUtil.getTotal();
        const day = Math.min(Math.max(currentDay, 1), total);

        const dayLabel = $('dayLabel');
        if (dayLabel) dayLabel.textContent = `Day ${day} of ${total}`;

        const heartsContainer = $('hearts');
        if (heartsContainer) {
            heartsContainer.innerHTML = '';
            for (let i = 1; i <= total; i++) {
                const canvas = Assets.heart(State.isOpened(i));
                canvas.className = 'hud__heart-icon' + (State.isOpened(i) ? ' hud__heart-icon--on' : '');
                heartsContainer.appendChild(canvas);
            }
        }
    }
};

// ─── MODAL ────────────────────────────────────────────────────
const Modal = {
    show(day) {
        const msg = CONFIG.messages[day - 1];
        if (!msg) return;

        const overlay = $('modalOverlay');
        $('msgDay').textContent = `Day ${day} of ${DateUtil.getTotal()}`;
        $('msgTitle').textContent = `💕 ${msg.title} 💕`;
        $('msgBody').textContent = msg.content;
        $('msgSig').textContent = msg.signature;
        overlay.classList.add('modal-overlay--on');
    },

    hide() {
        const overlay = $('modalOverlay');
        overlay.classList.remove('modal-overlay--on');
    },

    init() {
        $('closeBtn').addEventListener('click', () => this.hide());
        $('modalOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'modalOverlay') this.hide();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hide();
        });
    }
};

// ─── THEME ENGINE ─────────────────────────────────────────────
const Theme = {
    _lastMode: null,

    apply() {
        const hour = DateUtil.getHour();
        const scene = document.querySelector('.scene');
        if (!scene) return;
        let mode = 'day';
        if (hour >= 17 && hour < 20) mode = 'sunset';
        else if (hour >= 20 || hour < 6) mode = 'night';

        scene.classList.remove('scene--sunset', 'scene--night');
        if (mode === 'sunset') scene.classList.add('scene--sunset');
        else if (mode === 'night') scene.classList.add('scene--night');

        // Also theme the welcome screen
        const welcome = document.querySelector('.welcome-screen');
        if (welcome) {
            welcome.classList.remove('welcome--sunset', 'welcome--night');
            if (mode === 'sunset') welcome.classList.add('welcome--sunset');
            else if (mode === 'night') welcome.classList.add('welcome--night');
        }

        // If mode changed (e.g. day→night), rebuild sky for sun/moon swap
        if (this._lastMode && this._lastMode !== mode) {
            const sky = document.querySelector('.sky');
            if (sky) { sky.innerHTML = ''; Scene.buildSky(); }
        }
        this._lastMode = mode;
    }
};

// ─── AMBIENT SEAGULL SCHEDULER ────────────────────────────────
let seagullTimeout;
function scheduleSeagull() {
    if (prefersReducedMotion) return;
    seagullTimeout = setTimeout(() => {
        // Skip when tab is hidden — no wasted audio work
        if (!document.hidden && State.soundOn && Math.random() > 0.4) Audio.playSeagull();
        scheduleSeagull();
    }, 14000 + Math.random() * 25000);
}

// ─── ORCA BREACH MANAGER ──────────────────────────────────────
const OrcaManager = {
    _timeout: null,

    start() {
        if (prefersReducedMotion) return;
        this._scheduleNext();
    },

    _scheduleNext() {
        const delay = 18000 + Math.random() * 22000; // 18–40 seconds
        this._timeout = setTimeout(() => this._breach(), delay);
    },

    _breach() {
        // Skip breach when tab is hidden
        if (document.hidden) { this._scheduleNext(); return; }

        const ocean = document.querySelector('.ocean');
        if (!ocean) { this._scheduleNext(); return; }

        // Create orca sprite
        const sprite = Assets.orca();
        sprite.className = 'ocean__orca-sprite';

        // Random horizontal position (15–85% of ocean)
        const left = 15 + Math.random() * 70;
        sprite.style.left = left + '%';
        // Appear in mid-ocean depth
        sprite.style.top = (25 + Math.random() * 25) + '%';

        // Random facing direction
        if (Math.random() > 0.5) {
            sprite.style.cssText += 'transform: scaleX(-1);';
        }

        sprite.style.cursor = 'pointer';
        sprite.style.pointerEvents = 'auto';
        sprite.addEventListener('click', () => CharacterChat.show('orca', sprite));
        ocean.appendChild(sprite);

        // Splash particles at breach point
        this._splash(ocean, left);

        // Play a subtle whale-ish sound
        this._playBreachSound();

        // Remove after animation — with fallback timeout in case animationend doesn't fire
        let removed = false;
        const cleanup = () => { if (!removed) { removed = true; sprite.remove(); } };
        sprite.addEventListener('animationend', cleanup);
        setTimeout(cleanup, 5000); // safety net

        this._scheduleNext();
    },

    _splash(ocean, leftPct) {
        for (let i = 0; i < 8; i++) {
            const drop = document.createElement('div');
            drop.className = 'orca-splash';
            drop.style.left = leftPct + '%';
            drop.style.top = '35%';
            drop.style.setProperty('--sx', (Math.random() - 0.5) * 60 + 'px');
            drop.style.setProperty('--sy', -(20 + Math.random() * 30) + 'px');
            drop.style.animationDelay = (Math.random() * 0.15) + 's';
            ocean.appendChild(drop);
            setTimeout(() => drop.remove(), 1000);
        }
    },

    _playBreachSound() {
        if (!Audio._ensure()) return;
        const ctx = Audio.ctx, now = ctx.currentTime;
        // Deep splash: filtered noise burst
        const len = 0.5;
        const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.25));
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 500;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + len);
        src.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
        src.start(now);
        src.stop(now + len);
        src.onended = () => { src.disconnect(); lp.disconnect(); gain.disconnect(); };
    }
};

// ─── ACCESS CONTROL ───────────────────────────────────────────
// Page is hidden from nav, sitemap, robots.txt & has noindex meta.
// Smart link 302 redirects don't preserve referrer, so we simply
// allow all visits — discovery requires knowing the URL.
const AccessControl = {
    validate() { return true; }
};

// ─── INITIALIZATION ───────────────────────────────────────────
function init() {
    // Validate access
    if (!AccessControl.validate()) return;

    // Eagerly init audio so gesture unlock listener is in place
    Audio.init();

    // Load state
    State.load();

    // Auto-demo on localhost when valentine period is over
    if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        && DateUtil.getCurrentDay() > DateUtil.getTotal()) {
        const demoDay = 1;
        const now = new Date();
        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() - demoDay + 1);
        const y = target.getFullYear();
        const m = String(target.getMonth() + 1).padStart(2, '0');
        const d = String(target.getDate()).padStart(2, '0');
        CONFIG.startDate = `${y}-${m}-${d}`;
        // Clear stale state — fresh start
        State.opened = [];
        State.save();
        console.log(`%c🌊 Demo mode — simulating Day ${demoDay}. Use DEBUG.setDay(n) to change.`, 'color:#44b0d9;font-weight:bold');
    }

    // Apply theme
    Theme.apply();

    // Build the scene
    Scene.buildWelcome();
    Scene.buildSky();
    Scene.buildOcean();
    Scene.buildBeach();
    Scene.buildPalms();

    // Render bottles
    BottleManager.render();

    // Initialize modal
    Modal.init();

    // Sound button
    const sndBtn = $('sndBtn');
    const updateSndBtn = () => {
        sndBtn.textContent = State.soundOn ? '🔊' : '🔇';
        sndBtn.classList.toggle('sound-btn--off', !State.soundOn);
    };
    updateSndBtn();
    sndBtn.addEventListener('click', () => {                  // NOT async — F1 fix
        State.soundOn = !State.soundOn;
        State.save();
        updateSndBtn();
        if (State.soundOn) {
            Audio.init();
            Audio.ensureReadySync();                          // SYNC — preserves gesture
            Audio.startOcean();                               // SYNC — inside gesture
        } else {
            Audio.stopOcean();
        }
    });

    // Start button
    $('startBtn').addEventListener('click', () => {           // NOT async — F1 fix
        Audio.init();
        Audio.ensureReadySync();                              // SYNC — preserves gesture
        if (State.soundOn) Audio.startOcean();                // SYNC — inside gesture
        scheduleSeagull();
        OrcaManager.start();
        document.querySelector('.welcome-screen').classList.add('hidden');
    });

    // Periodic theme updates
    setInterval(() => Theme.apply(), 60000);

    // Resize handler — debounced, rebuilds on breakpoint crossing
    let resizeTimer;
    let lastBp = Responsive.bp;
    const handleResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            Responsive.invalidate();
            const newBp = Responsive.bp;
            if (newBp !== lastBp) {
                // Breakpoint crossed — full rebuild
                lastBp = newBp;
                Scene.buildOcean();
                Scene.buildBeach();
                BottleManager.render();
            } else {
                // Same breakpoint — just rebuild ocean (ripple counts etc.)
                Scene.buildOcean();
            }
        }, 250);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => {
        // Orientation change fires before dimensions update — delay rebuild
        setTimeout(handleResize, 100);
    });
}

// Boot
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ─── DEBUG TOOLS ──────────────────────────────────────────────
window.DEBUG = {
    reset: () => { localStorage.removeItem(State._key); location.reload(); },
    unlockAll: () => { CONFIG.startDate = '2020-01-01'; BottleManager.render(); },
    setDay: (d) => {
        const now = new Date();
        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() - d + 1);
        const y = target.getFullYear();
        const m = String(target.getMonth() + 1).padStart(2, '0');
        const dd = String(target.getDate()).padStart(2, '0');
        CONFIG.startDate = `${y}-${m}-${dd}`;
        BottleManager.render();
    },
    testSounds: () => {
        Audio.init();
        Audio.playCork();
        setTimeout(() => Audio.playPaper(), 400);
        setTimeout(() => Audio.playChime(), 800);
        setTimeout(() => Audio.playSeagull(), 1200);
    },
    showAllBottles: () => {
        CONFIG.startDate = '2020-01-01';
        BottleManager.render();
    }
};
