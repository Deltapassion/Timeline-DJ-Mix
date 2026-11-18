// TIMELINE DJ MIX — application de bureau (Electron)
// © 2026 DJ LATIN JAZZ & DJ CRISLATINO, en collaboration avec Claude.ai — logiciel libre, GNU GPL v2 ou ultérieure
const { app, BrowserWindow, session, shell, Menu } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

app.setAppUserModelId('fr.jacques.timelinedjmix');
if (!app.requestSingleInstanceLock()) { app.quit(); }

const PAGE = path.join(__dirname, 'app', 'index.html');
const PAGE_URL = pathToFileURL(PAGE).href;
const NOTICE_URL = pathToFileURL(path.join(__dirname, 'app', 'notice')).href + '/';
let win = null;
// la page du logiciel est la seule autorisée à utiliser le MIDI, l'USB HID et les cartes son
const isOurPage = url => typeof url === 'string' && (url.split('#')[0] === PAGE_URL || url === 'about:blank' || url === 'about:srcdoc');

function createWindow() {
  win = new BrowserWindow({
    width: 1500, height: 920, minWidth: 1000, minHeight: 640, show: false,
    title: 'TIMELINE DJ MIX', backgroundColor: '#12161d', autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, spellcheck: false, autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false }
  });
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.loadFile(PAGE);
  // aucune navigation hors du logiciel ; les liens https s'ouvrent dans le navigateur par défaut
  const openOutside = url => { try { if (new URL(url).protocol === 'https:') shell.openExternal(url); } catch (e) { /* adresse invalide */ } };
  // la notice installée avec le logiciel s'ouvre dans sa propre fenêtre ; tout le reste dans le navigateur
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(NOTICE_URL)) return { action: 'allow', overrideBrowserWindowOptions: { width: 1100, height: 900, autoHideMenuBar: true, title: 'TIMELINE DJ MIX', icon: path.join(__dirname, 'build', 'icon.png'), webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } } };
    openOutside(url); return { action: 'deny' };
  });
  win.webContents.on('did-create-window', w => {
    w.webContents.setWindowOpenHandler(({ url }) => { openOutside(url); return { action: 'deny' }; });
    w.webContents.on('will-navigate', (e, url) => { if (!url.startsWith(NOTICE_URL)) { e.preventDefault(); openOutside(url); } });
  });
  win.webContents.on('will-navigate', (e, url) => { if (url.split('#')[0] !== PAGE_URL) { e.preventDefault(); openOutside(url); } });
  win.webContents.on('will-attach-webview', e => e.preventDefault());
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  const ses = session.defaultSession;
  const allowed = new Set(['midi', 'midiSysex', 'hid', 'media', 'speaker-selection', 'fullscreen', 'clipboard-sanitized-write', 'persistent-storage']);
  ses.setPermissionRequestHandler((wc, perm, cb, details) => cb(allowed.has(perm) && isOurPage((details && details.requestingUrl) || wc.getURL())));
  ses.setPermissionCheckHandler((wc, perm, origin) => allowed.has(perm) && (origin === 'file://' || isOurPage(wc ? wc.getURL() : '')));
  ses.setDevicePermissionHandler(d => d.deviceType === 'hid' && (d.origin === 'file://' || isOurPage(d.origin)));
  // USB HID : une table Kontrol Z1 si elle est branchée, sinon le premier appareil proposé
  ses.on('select-hid-device', (event, details, callback) => {
    event.preventDefault();
    const list = details.deviceList || [];
    const pick = list.find(d => /kontrol|z1|gmx|gemini/i.test(d.name || '')) || list[0];
    callback(pick ? pick.deviceId : '');
  });
  const view = { label: 'Affichage', submenu: [
    { role: 'togglefullscreen', label: 'Plein écran' },
    { type: 'separator' }, { role: 'reload', label: 'Recharger' }, { role: 'toggleDevTools', label: 'Outils de développement' }
  ] };
  Menu.setApplicationMenu(Menu.buildFromTemplate(process.platform === 'darwin' ? [
    { label: app.name, submenu: [{ role: 'about', label: 'À propos de TIMELINE DJ MIX' }, { type: 'separator' }, { role: 'hide', label: 'Masquer' }, { role: 'hideOthers', label: 'Masquer les autres' }, { type: 'separator' }, { role: 'quit', label: 'Quitter' }] },
    { label: 'Édition', submenu: [{ role: 'undo', label: 'Annuler' }, { role: 'redo', label: 'Rétablir' }, { type: 'separator' }, { role: 'cut', label: 'Couper' }, { role: 'copy', label: 'Copier' }, { role: 'paste', label: 'Coller' }, { role: 'selectAll', label: 'Tout sélectionner' }] },
    view
  ] : [view]));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { app.quit(); });
