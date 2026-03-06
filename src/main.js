const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
let ProductiviteitDB;
let parseRapportage, generateProductiviteitExcel;

function loadNativeModules() {
  ProductiviteitDB = require('./database');
  ({ parseRapportage, generateProductiviteitExcel } = require('./excel-handler'));
}

const PROJECT_DIR = path.resolve(__dirname, '..');

const DATA_DIR = path.join(app.getPath('userData'), 'productiviteit-data');
const DB_PATH = path.join(DATA_DIR, 'productiviteit.db');

let mainWindow;
let db;

function createWindow() {
  const isMac = process.platform === 'darwin';

  const winOptions = {
    width: 1100,
    height: 780,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  };

  if (isMac) {
    winOptions.titleBarStyle = 'hiddenInset';
    winOptions.trafficLightPosition = { x: 16, y: 16 };
  }

  mainWindow = new BrowserWindow(winOptions);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function tryRebuildNativeModules() {
  const isWin = process.platform === 'win32';
  const env = isWin
    ? process.env
    : { ...process.env, PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH}` };
  const opts = { cwd: PROJECT_DIR, encoding: 'utf8', env, timeout: 120000, shell: true, stdio: 'pipe' };

  // Try electron-rebuild first
  try {
    execSync('npx electron-rebuild -f -w better-sqlite3', opts);
    return true;
  } catch (_) { /* fall through */ }

  // Try manual rebuild with electron target
  try {
    const electronPkg = JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'node_modules', 'electron', 'package.json'), 'utf8'));
    const electronVersion = electronPkg.version;
    const cmd = `npm rebuild better-sqlite3 --runtime=electron --target=${electronVersion} --disturl=https://electronjs.org/headers`;
    execSync(cmd, opts);
    return true;
  } catch (_) { /* fall through */ }

  return false;
}

app.whenReady().then(() => {
  // First attempt: load modules normally
  let loadError = null;
  try {
    loadNativeModules();
    db = new ProductiviteitDB(DB_PATH);
  } catch (err) {
    loadError = err;
  }

  // If failed due to NODE_MODULE_VERSION mismatch, auto-rebuild
  if (loadError && loadError.message && loadError.message.includes('NODE_MODULE_VERSION')) {
    const rebuildResult = dialog.showMessageBoxSync({
      type: 'info',
      title: 'Productiviteit ATR',
      message: 'Eerste keer opstarten — native modules worden gebouwd voor deze computer.\n\nDit duurt 1-2 minuten. Klik OK om door te gaan.',
      buttons: ['OK', 'Annuleren'],
      defaultId: 0,
    });

    if (rebuildResult === 0) {
      const rebuilt = tryRebuildNativeModules();
      if (rebuilt) {
        // Clear module cache and retry
        delete require.cache[require.resolve('better-sqlite3')];
        Object.keys(require.cache).forEach(key => {
          if (key.includes('better-sqlite3') || key.includes('database')) {
            delete require.cache[key];
          }
        });

        try {
          loadNativeModules();
          db = new ProductiviteitDB(DB_PATH);
          loadError = null;
        } catch (retryErr) {
          loadError = retryErr;
        }
      }
    }
  }

  if (loadError) {
    dialog.showErrorBox(
      'Productiviteit ATR - Fout bij opstarten',
      `De database kon niet worden geladen.\n\n` +
      `Oplossing: vraag je IT-beheerder om install.sh (macOS) of install.bat (Windows) opnieuw uit te voeren.\n\n` +
      `Technisch detail: ${loadError.message}`
    );
    app.quit();
    return;
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (db) db.close();
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers ---

ipcMain.handle('upload-rapportage', async (_event, filePath) => {
  try {
    const { records, medewerkers } = await parseRapportage(filePath);

    if (records.length === 0) {
      return { success: false, error: 'Geen geldige data gevonden in het bestand.' };
    }

    // Aggregate minutes per medewerker per week per year
    const aggregated = new Map();
    for (const rec of records) {
      const key = `${rec.medewerkerId}_${rec.jaar}_${rec.week}`;
      aggregated.set(key, (aggregated.get(key) || 0) + rec.totaleTijd);
    }

    // Upsert medewerkers (without changing contract hours)
    for (const [id, naam] of medewerkers) {
      db.upsertMedewerker(id, naam, null);
    }

    // Overwrite uren (new upload data is always the truth)
    for (const [key, minuten] of aggregated) {
      const [medewerkerId, jaar, week] = key.split('_').map(Number);
      db.setUren(medewerkerId, jaar, week, minuten);
    }

    const fileName = path.basename(filePath);
    db.logUpload(fileName, 'rapportage', records.length);

    // Determine years in the data
    const years = [...new Set(records.map(r => r.jaar))];

    return {
      success: true,
      message: `${records.length} regels verwerkt van ${medewerkers.size} medewerkers.`,
      years,
      medewerkerCount: medewerkers.size,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('update-contract-uren', async (_event, medewerkerId, uren) => {
  try {
    db.updateContractUren(medewerkerId, uren);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('download-excel', async (_event, jaar) => {
  try {
    const workbook = await generateProductiviteitExcel(db, jaar);

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Productiviteit Excel Opslaan',
      defaultPath: path.join(
        app.getPath('downloads'),
        `Productiviteit-ATR-Medewerkers-${jaar}.xlsx`
      ),
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });

    if (canceled || !filePath) {
      return { success: false, error: 'Opslaan geannuleerd.' };
    }

    await workbook.xlsx.writeFile(filePath);
    return { success: true, message: `Bestand opgeslagen: ${path.basename(filePath)}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-status', async () => {
  try {
    const medewerkers = db.getAllMedewerkers();
    const years = db.getAvailableYears();
    const history = db.getUploadHistory();
    return { success: true, medewerkers, years, history };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-available-years', async () => {
  try {
    const years = db.getAvailableYears();
    return { success: true, years };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-upload-history', async () => {
  try {
    const history = db.getUploadHistory();
    return { success: true, history };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('select-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecteer Excel bestand',
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
    properties: ['openFile'],
  });

  if (canceled || filePaths.length === 0) return null;
  return filePaths[0];
});

ipcMain.handle('show-save-dialog', async (_event, jaar) => {
  try {
    const workbook = await generateProductiviteitExcel(db, jaar);

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Productiviteit Excel Opslaan',
      defaultPath: path.join(
        app.getPath('downloads'),
        `Productiviteit-ATR-Medewerkers-${jaar}.xlsx`
      ),
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
    });

    if (canceled || !filePath) {
      return { success: false, error: 'Opslaan geannuleerd.' };
    }

    await workbook.xlsx.writeFile(filePath);
    return { success: true, message: `Bestand opgeslagen: ${path.basename(filePath)}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('drop-file', async (_event, filePaths) => {
  if (!filePaths || filePaths.length === 0) return null;
  return filePaths[0];
});

ipcMain.handle('get-app-version', async () => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_DIR, 'package.json'), 'utf8'));
    return { success: true, version: pkg.version };
  } catch (err) {
    return { success: false, version: '?' };
  }
});

ipcMain.handle('check-for-updates', async () => {
  try {
    const isWin = process.platform === 'win32';
    const env = isWin
      ? process.env
      : { ...process.env, PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH}` };
    const opts = { cwd: PROJECT_DIR, encoding: 'utf8', env, timeout: 30000, shell: isWin };

    // Fetch latest from remote
    execSync('git fetch origin main', opts);

    // Check if we're behind
    const local = execSync('git rev-parse HEAD', opts).trim();
    const remote = execSync('git rev-parse origin/main', opts).trim();

    if (local === remote) {
      return { success: true, upToDate: true, message: 'Je hebt de nieuwste versie.' };
    }

    // Count commits behind
    const behindCount = execSync('git rev-list HEAD..origin/main --count', opts).trim();
    return {
      success: true,
      upToDate: false,
      message: `Er is een update beschikbaar (${behindCount} wijziging${behindCount === '1' ? '' : 'en'}).`,
    };
  } catch (err) {
    return { success: false, message: 'Kan niet controleren op updates. Controleer je internetverbinding.' };
  }
});

ipcMain.handle('install-update', async () => {
  try {
    const isWin = process.platform === 'win32';
    const env = isWin
      ? process.env
      : { ...process.env, PATH: `/usr/local/bin:/opt/homebrew/bin:${process.env.PATH}` };
    const opts = { cwd: PROJECT_DIR, encoding: 'utf8', env, timeout: 120000, shell: isWin };

    // Pull latest
    execSync('git pull origin main', opts);

    // Install any new dependencies
    execSync('npm install', opts);

    // Rebuild native modules for Electron
    const rebuildCmd = isWin
      ? 'npx electron-rebuild -f -w better-sqlite3 2>nul || echo ok'
      : 'npx electron-rebuild -f -w better-sqlite3 2>/dev/null || true';
    execSync(rebuildCmd, { ...opts, shell: true });

    return { success: true, message: 'Update geïnstalleerd! De app wordt herstart...' };
  } catch (err) {
    return { success: false, message: `Update mislukt: ${err.message}` };
  }
});

ipcMain.handle('restart-app', async () => {
  app.relaunch();
  app.exit(0);
});
