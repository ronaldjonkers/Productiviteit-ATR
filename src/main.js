const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const ProductiviteitDB = require('./database');
const { parseRapportage, parseProductiviteitExcel, generateProductiviteitExcel } = require('./excel-handler');

const DATA_DIR = path.join(app.getPath('userData'), 'productiviteit-data');
const DB_PATH = path.join(DATA_DIR, 'productiviteit.db');

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  db = new ProductiviteitDB(DB_PATH);
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

    // Set aggregated uren
    for (const [key, minuten] of aggregated) {
      const [medewerkerId, jaar, week] = key.split('_').map(Number);
      db.addUren(medewerkerId, jaar, week, minuten);
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

ipcMain.handle('upload-productiviteit', async (_event, filePath) => {
  try {
    const updates = await parseProductiviteitExcel(filePath);

    if (updates.length === 0) {
      return { success: false, error: 'Geen medewerkerdata gevonden in het bestand.' };
    }

    // Match by name and update contract hours
    const allMedewerkers = db.getAllMedewerkers();
    let matched = 0;

    for (const update of updates) {
      const match = allMedewerkers.find(
        m => m.naam.toLowerCase().trim() === update.naam.toLowerCase().trim()
      );
      if (match) {
        db.upsertMedewerker(match.medewerker_id, match.naam, update.contractUren);
        matched++;
      }
    }

    const fileName = path.basename(filePath);
    db.logUpload(fileName, 'productiviteit', updates.length);

    return {
      success: true,
      message: `${matched} van ${updates.length} medewerkers bijgewerkt met nieuwe contracturen.`,
    };
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
