class Pinger {
    constructor(host, url) {
        this.host = host;
        this.url = url;
        this.pings = [];
        this.onping = null;
        this.running = true;
        this.#connect();
    }

    stop() {
        this.running = false;
    }

    #connect() {
        if (!this.running) {
            return;
        }
        console.log(`Restarting pinger for ${this.host}`);
        let ws = new WebSocket(this.url);
        const sendPing = () => {
            if (!this.running) {
                ws.close();
                return;
            }
            if (ws.readyState != ws.OPEN) {
                return;
            }
            const now = new Date();
            ws.send('PING ' + now.toJSON());
        };
        ws.addEventListener('open', (event) => {
            sendPing();
        });
        ws.addEventListener('message', (event) => {
            const [cmd, t] = event.data.split(' ');
            if (cmd != 'PONG') throw new Error('Unexpected response from server');
            const now = new Date();
            const then = new Date(t);
            const elapsed = now - then;

            // Throttle in case the ping is fast
            const delay = (elapsed < 250) ? (250 - elapsed) : 0;
            setTimeout(sendPing, delay);

            this.pings.push(elapsed);
            if (this.onping) {
                this.onping();
            }
        });
        ws.addEventListener('close', (event) => {
            // Throttle to prevent thrashing in case of fast failure
            setTimeout(() => this.#connect(), 250);
        });
    }
}

function sum(arr) {
    return arr.reduce((x, y) => x + y, 0);
}

class Region {
    constructor(id, host, name, city, proxy_path) {
        this.id = id;
        this.host = host;
        this.name = name;
        this.city = city;
        this.proxy_url = `wss://${host}${proxy_path}`;
        this.packs_dir = `https://${host}/mtl/696fd8788cc0/packs`;
        this.pinger = new Pinger(host, this.proxy_url);
        // Stop pinging after 30 seconds
        setTimeout(() => { this.pinger.stop(); }, 30*1000);
        this.avgPing = null;
        this.onping = null;
        this.pinger.onping = () => {
            this.avgPing = sum(this.pinger.pings) / this.pinger.pings.length;
            if (this.onping) {
                this.onping();
            }
        };
    }
}

const REGIONS = [
    new Region("eu1", "eu1.dustlabs.io", "Europe", "Frankfurt", "/mtproxy"),
    new Region("na1", "na1.dustlabs.io", "North America", "Dallas", "/mtproxy"),
    new Region("sa1", "sa1.dustlabs.io", "South America", "São Paulo", "/mtproxy"),
    new Region("ap1", "ap1.dustlabs.io", "Asia", "Singapore", "/mtproxy"),
    new Region("ap2", "ap2.dustlabs.io", "Australia", "Melbourne", "/mtproxy"),
];

if (window.location.pathname.startsWith('/dev/')) {
    REGIONS.length = 0;
    REGIONS.push(new Region("dev", "minetest.dustlabs.io", "Dev Region", "-", "/proxy"));
    const packs_dir_url = new URL(window.location);
    packs_dir_url.search = '';
    packs_dir_url.pathname += `696fd8788cc0/packs`;
    REGIONS[0].packs_dir = packs_dir_url.href;
}

var autoRegion = REGIONS[0];
var selRegionId = "auto";
var selRegion = autoRegion;
var selRegionLocked = false;

function initRegionSelector() {
    const sel = document.getElementById('region_selector');
    sel.addEventListener('change', (event) => {
        if (!selRegionLocked) {
            selRegionId = sel.value;
            selRegion = getRegionById(selRegionId);
        }
    });

    const auto_opt = document.createElement('option');
    auto_opt.value = 'auto';
    auto_opt.innerText = `Auto [${autoRegion.name}]`;
    sel.appendChild(auto_opt);

    for (const r of REGIONS) {
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.innerText = `${r.name} [ping: ---]`;
        sel.appendChild(opt);
        r.onping = () => {
            const newText = `${r.name} [ping: ${Math.round(r.avgPing)} ms]`;
            // On Firefox, assigning innerText causes flicker. Do it sparingly.
            if (opt.innerText != newText) {
                opt.innerText = newText;
            }
            const autoAvg = autoRegion.avgPing;
            if (autoAvg == null || autoAvg > r.avgPing * 1.10) {
                autoRegion = r;
                auto_opt.innerText = `Auto [${autoRegion.name}]`;
            }
        };
    }
}

// Internal helpers

function getRegionById(id) {
    if (id == "auto") {
        return autoRegion;
    }
    for (const r of REGIONS) {
        if (r.id == id) {
            return r;
        }
    }
    return null;
}

///////////////////////////////////////////////////////////////
// External methods

function lockRegion(id) {
    if (selRegionLocked) {
        if (id && autoRegion.id != id) {
            alert("lockRegion called twice with mismatched region");
        }
        return;
    }
    selRegionLocked = true;
    if (id) {
        selRegionId = id;
        selRegion = getRegionById(selRegionId);
    } else if (selRegionId == "auto") {
        selRegion = autoRegion;
        selRegionId = autoRegion.id;
    }
}

function getRegion() {
    lockRegion();
    return selRegion;
}

document.addEventListener("DOMContentLoaded", initRegionSelector);
