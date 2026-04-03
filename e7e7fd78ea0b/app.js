
// For 'Play with Friends', to reduce memory usage
function enableMemorySaving(mtl) {
    mtl.setConf('viewing_range', 85);
    mtl.setConf('max_block_send_distance', 5);
    mtl.setConf('max_block_generate_distance', 5);
}

var onready_callbacks = [];
function onready(callback) {
    if (onready_callbacks === null) {
        callback();
    } else {
        onready_callbacks.push(callback);
    }
}

let APP_DEBUG_MODE = false;

function app_onload() {
    if (window.location.search) {
        const params = new URLSearchParams(window.location.search);
        if (params.has('debug')) {
            APP_DEBUG_MODE = true;
        }
        if (params.has('join') && params.has('r')) {
            lockRegion(params.get('r'));
            setupJoinPage(params.get('join'));
        } else if (params.has('gameid')) {
            setupLaunchPage(params.get('gameid'));
        }
    }
    enable_tabbing();
    fillGameSelectors();
    setupFriendsTab();
    setupMultiplayerTab();
    setupCustomTab();
}
document.addEventListener("DOMContentLoaded", app_onload);

function setupServer() {
    const r = getRegion();
    mtl.setProxy(r.proxy_url);
    mtl.setPacksDir(r.packs_dir, true);
}

function setLanguage(mtl) {
    mtl.setLang(getSelectedLanguage());
}

function setupFriendsTab() {
    const gameid = document.getElementById('friends_gameid');
    const username = document.getElementById('friends_username');
    const launch = document.getElementById('friends_launch');
    username.addEventListener("input", (event) => {
        launch.disabled = !username.checkValidity();
    });
    launch.disabled = true;
    launch.addEventListener("click", (event) => {
        if (!username.checkValidity()) {
            // This shouldn't ever actually happen, since the button is disabled.
            alert("Invalid username");
            return;
        }
        const game = gameid.value;
        const name = username.value;
        gameid.disabled = true;
        username.disabled = true;
        launch.disabled = true;
        launch.innerText = 'Launching...';
        launchServer(game, name);
    });
}

function setupMultiplayerTab() {
    const multiplayer_launch = document.getElementById('multiplayer_launch');
    const saveText = multiplayer_launch.innerText;
    multiplayer_launch.innerText = 'Loading...';
    multiplayer_launch.disabled = true;
    onready(() => {
        multiplayer_launch.innerText = saveText;
        multiplayer_launch.disabled = false;
    });
    multiplayer_launch.addEventListener("click", (event) => {
        const args = new MinetestArgs();
        history.pushState({clean: 1}, "", "?launch");
        setupServer();
        setLanguage(mtl);
        mtl.launch(args);
    });
}

function setupCustomTab() {
    const custom_launch = document.getElementById('custom_launch');
    const saveText = custom_launch.innerText;
    custom_launch.innerText = 'Loading...';
    custom_launch.disabled = true;
    onready(() => {
        custom_launch.innerText = saveText;
        custom_launch.disabled = false;
    });
    custom_launch.addEventListener("click", (event) => {
        const args = new MinetestArgs();
        history.pushState({clean: 1}, "", "?launch");
        setupServer();
        setLanguage(mtl);
        mtl.launch(args);
    });
}

function queryProxy(cmd) {
    return new Promise((resolve, reject) => {
        let finished = false;
        const ws = new WebSocket(getRegion().proxy_url);
        ws.addEventListener('open', (event) => {
            ws.send(cmd);
        });
        ws.addEventListener('error', (event) => {
            alert('Error initiating proxy connection');
            finished = true;
            reject(new Error('Received error'));
        });
        ws.addEventListener('close', (event) => {
            if (!finished) {
                alert('Proxy connection closed unexpectedly');
                finished = true;
                reject(new Error('Received close'));
            }
        });
        ws.addEventListener('message', (event) => {
            if (typeof event.data !== 'string') {
                alert('Invalid message received from proxy');
                finished = true;
                reject(new Error('Invalid message'));
                return;
            }
            finished = true;
            ws.close();
            resolve(event.data.split(' '));
        });
    });
}


async function launchServer(game, name) {
    const region = getRegion();
    setupServer();
    mtl.addPack(game);
    const [cmd, serverCode, clientCode] = await queryProxy(`MAKEVPN ${game}`);
    if (cmd != 'NEWVPN') {
        alert("Invalid response from proxy");
        return;
    }
    const args = new MinetestArgs();
    args.extra.push('--withserver');
    args.gameid = game;
    args.name = name;
    args.address = '127.0.0.1';
    args.port = 30000;
    args.go = true;
    console.log("Pushing clean state");
    history.pushState({clean: 1}, "", `?r=${region.id}&join=${clientCode}`);
    mtl.setVPN(serverCode, clientCode);
    enableMemorySaving(mtl);
    setLanguage(mtl);
    mtl.launch(args);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function alert_and_throw(msg) {
    alert(msg);
    throw new Error(msg);
}

function swap_page(page) {
    document.getElementById('default_page').style.display = 'none';
    document.getElementById(page).style.display = 'flex';
    document.body.style.height = '100%';
    htmlTags = document.getElementsByTagName("html")
    for (var i=0; i < htmlTags.length; i++) {
        htmlTags[i].style.height = '100%';
    }
}

const gameJoinInfo = {};

function setupJoinPage(code) {
    swap_page('join_page');
    // Setup events
    let gameInfo = null;
    const join_gameid = document.getElementById('join_gameid');
    const join_username = document.getElementById('join_username');
    const join_launch = document.getElementById('join_launch');
    join_username.addEventListener("input", (event) => {
        join_launch.disabled = !join_username.checkValidity() || !gameInfo;
    });
    join_launch.disabled = true;
    join_launch.addEventListener("click", (event) => {
        if (!join_username.checkValidity()) {
            // This shouldn't ever actually happen, since the button is disabled.
            alert("Invalid username");
            return;
        }
        const name = join_username.value;
        join_username.disabled = true;
        join_launch.disabled = true;
        join_launch.innerText = 'Launching...';
        joinServer(code, gameInfo, name);
    });
    getGameInfo(code).then((info) => {
        if (info.game == '_expired_') {
            gameInfo = null;
            join_gameid.innerText = 'Expired join code';
            join_launch.disabled = true;
            return;
        }
        gameInfo = info;
        join_gameid.innerText = info.game;
        join_launch.disabled = !join_username.checkValidity() || !gameInfo;
    });
}

function setupLaunchPage(game) {
    swap_page('launch_page');
    // Setup events
    const launch_gameid = document.getElementById('launch_gameid');
    const launch_launch = document.getElementById('launch_launch');
    const saveText = launch_launch.innerText;
    launch_gameid.innerText = game;
    launch_launch.innerText = 'Loading...';
    onready(() => {
        launch_launch.disabled = false;
        launch_launch.innerText = saveText;
    });
    launch_launch.disabled = true;
    launch_launch.addEventListener("click", (event) => {
        join_launch.disabled = true;
        join_launch.innerText = 'Launching...';
        launchGame(game);
    });
}

async function getGameInfo(code) {
    if (code.indexOf(' ') != -1) {
        alert_and_throw("Invalid join code");
    }
    const region = getRegion();
    const [cmd, game] = await queryProxy(`READVPN ${code}`);
    if (cmd != "VPNINFO") {
        alert_and_throw("Invalid response from proxy");
    }
    console.log("VPNINFO gave game: ", game);
    return {game: game};
}

function joinServer(code, info, name) {
    setupServer();
    mtl.addPack(info.game);
    const args = new MinetestArgs();
    args.extra.push("--warm");
    args.gameid = info.game;
    args.name = name;
    args.address = '172.16.0.1';
    args.port = 30000;
    args.go = true;
    console.log("Pushing clean state");
    mtl.setVPN(null, code);
    enableMemorySaving(mtl);
    setLanguage(mtl);
    mtl.launch(args);
}

function enable_tabbing() {
    // This assumes all the tabs are part of the same group.
    var all_tabs = document.getElementsByClassName("tab");
    var all_contents = document.getElementsByClassName("tab_content");
    function activateTab(tab) {
        if (tab.classList.contains("active"))
            return;

        // Hide all other tabs
        for (const t of all_tabs) {
            t.classList.remove("active");
        }
        for (const c of all_contents) {
            c.style.display = "none";
        }

        // Enable the selected tab
        tab.classList.add("active");
        const content = document.getElementById(tab.id.replace('tab_', ''));
        if (content.id == "multiplayer") {
            //load_server_list();
        }
        content.style.display = "inline";
    }
    activateTab(all_tabs[0]);
    for (const t of all_tabs) {
        t.addEventListener("click", activateTab.bind(null, t));
    }
}

function openInNewTab(url) {
    window.open(url, '_blank').focus();
}

addEventListener('popstate', (event) => {
    window.location.reload();
});

function make_element(tag, text) {
    const e = document.createElement(tag);
    if (text) {
        e.innerText = text;
    }
    return e;
}

function fillGameSelectors() {
    const gameSelectors = document.getElementsByClassName('game_selector');
    for (const e of gameSelectors) {
        const options = [];
        for (const game of CONTENTDB_GAMES) {
            const name = game['name'];
            const opt = document.createElement('option');
            opt.value = name;
            opt.innerText = name;
            options.push(opt);
        }
        e.append(...options);
        // Default to mineclone2 for now
        e.value = 'mineclone2';
    }
}

var filledGameGrid = false;
function fillGameGrid() {
    if (filledGameGrid) return;
    filledGameGrid = true;

    const singleplayerDiv = document.getElementById('singleplayer');
    singleplayerDiv.innerHTML = '';
    const container = document.createElement('div');
    container.style.margin = 'auto';
    container.style.textAlign = 'center';
    const tbl = document.createElement('table');
    tbl.className = 'gamegrid';
    var row = [];
    const addGame = (gameCell) => {
        if (row.length == 4) {
            const tr = document.createElement('tr');
            tr.append(...row);
            tbl.append(tr);
            row = [];
        }
        row.push(gameCell);
    };
    const finishGames = () => {
        if (row.length > 0) {
            while (row.length < 4) {
                const gameCell = document.createElement('td');
                row.push(gameCell);
            }
            const tr = document.createElement('tr');
            tr.append(...row);
            tbl.append(tr);
        }
    };
    for (const game of CONTENTDB_GAMES) {
        const title = game['title'];
        const author = game['author'];
        const desc = game['short_description'];
        const name = game['name'];
        const ext = game['thumbnail'].split('.').pop();

        const gameCell = document.createElement('td');
        const gameDiv = document.createElement('div');
        gameDiv.className = 'gamediv';
        gameDiv.style.backgroundImage = `url("696fd8788cc0/thumbnails/${name}.${ext}")`;
        const dimmer = document.createElement('div');
        dimmer.className = 'gamediv_dimmer';
        gameDiv.appendChild(dimmer);
        const h3 = document.createElement('h3');
        h3.append(make_element('span', title));
        h3.append(make_element('br'));
        h3.append(make_element('small', author));
        gameDiv.appendChild(h3);
        const playButton = document.createElement('div');
        playButton.className = 'playcircle';
        playButton.addEventListener("click", (event) => {
            event.preventDefault();
            launchGame(name);
        });
        gameDiv.appendChild(playButton);
        const infoUrl = `https://content.minetest.net/packages/${author}/${name}/`;
        h3.addEventListener("click", (event) => {
            event.preventDefault();
            openInNewTab(infoUrl);
        });
        //gameDiv.appendChild(info);
        gameCell.append(gameDiv);
        addGame(gameCell);

        //title, author, desc
    }
    finishGames();
    container.appendChild(tbl);
    singleplayerDiv.appendChild(container);
}

function launchGame(name) {
    const args = new MinetestArgs();
    args.gameid = name;
    args.go = true;
    history.pushState({clean: 1}, "", `?gameid=${name}`);
    setupServer();
    setLanguage(mtl);
    mtl.launch(args);
}

var serverListLoading = false;
var serverList = null;
function load_server_list() {
    if (serverListLoading || serverList != null)
        return;
    serverListLoading = true;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://servers.minetest.net/list?proto_version_min=37&proto_version_max=41', true);
    xhr.responseType = 'json';
    xhr.onload = () => {
        if (xhr.response && ('list' in xhr.response)) {
            serverList = xhr.response['list'];
            populateServerList();
        }
    };
    xhr.onerror = () => {
        const multiplayerDiv = document.getElementById('multiplayer');
        multiplayerDiv.innerHTML = '<h1>Failed to load server list</h1>';
    };
    xhr.send(null);
}

function populateServerList() {
    const multiplayerDiv = document.getElementById('multiplayer');
    multiplayerDiv.innerHTML = '';
    const serverTable = document.createElement('table');
    const hdr = document.createElement('tr');
    hdr.appendChild(make_element('th', 'Address[:Port]'));
    hdr.appendChild(make_element('th', 'Players/Max'));
    hdr.appendChild(make_element('th', 'Name'));
    hdr.appendChild(make_element('th', 'Description'));
    serverTable.appendChild(hdr);
    for (const server of serverList) {
        const name = server['name'];
        const address = server['address'];
        const port = server['port'];
        const clients_count = server['clients'];
        const clients_max = server['clients_max'];
        const desc = server['description'];
        const gameid = server['gameid'];
        const website = server['url'];
        const row = document.createElement('tr');
        const addrport = (port != 30000) ? `${address}:${port}` : `${address}`;
        const shortdesc = desc.slice(0, 100) + (desc.length > 100 ? '...' : '');
        row.appendChild(make_element('td', addrport));
        row.appendChild(make_element('td', `${clients_count}/${clients_max}`));
        const nametd = document.createElement('td');
        var namelink;
        if (website) {
            namelink = document.createElement('a');
            namelink.href = website;
            namelink.innerText = name;
        } else {
            namelink = make_element('span', name);
        }
        nametd.appendChild(namelink); row.appendChild(nametd);
        row.appendChild(make_element('td', shortdesc));
        serverTable.appendChild(row);
        row.addEventListener("click", (event) => {
            const args = new MinetestArgs();
            args.address = address;
            args.port = port;
            args.name = 'webusr' + (100000 + Math.floor(Math.random() * 900000));
            args.extra.push('--password', 'rnd' + (10000000 + Math.floor(Math.random() * 90000000)));
            console.log("Using ", args.name, args.extra);
            args.go = true;
            history.pushState({clean: 1}, "", `?address=${address}&port=${port}&name=${args.name}&password=hidden&go`);
            setLanguage(mtl);
            mtl.launch(args);
        });

    }
    multiplayerDiv.appendChild(serverTable);
}

const mtl = new MinetestLauncher();

mtl.onprint = (text) => {
    console.log(text);
    if (text.startsWith('main() exited with return value 0')) {
        if (!APP_DEBUG_MODE) {
            history.back();
        }
    }
};
mtl.onprogress = (key, value) => {
    //console.log(key, value);
};
mtl.onready = () => {
    fillGameGrid();
    const callbacks = onready_callbacks;
    onready_callbacks = null;
    for (const cb of callbacks) {
        cb();
    }
};
mtl.onerror = (err) => {
    console.log(err);
};
