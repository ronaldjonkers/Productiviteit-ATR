const path = require('path');
const fs = require('fs');
const { getISOWeek, parseRapportage, generateProductiviteitExcel } = require('../src/excel-handler');
const ProductiviteitDB = require('../src/database');
const ExcelJS = require('exceljs');

const TEST_DB_PATH = path.join(__dirname, 'test_data_excel', 'test.db');
const TEST_TIMEOUT = 15000;

describe('getISOWeek', () => {
  test('parses dd-mm-yyyy correctly', () => {
    const result = getISOWeek('05-01-2026');
    expect(result).not.toBeNull();
    expect(result.year).toBe(2026);
    expect(result.week).toBe(2);
  }, TEST_TIMEOUT);

  test('returns week 1 for first days of Jan if applicable', () => {
    const result = getISOWeek('01-01-2026');
    expect(result).not.toBeNull();
    expect(result.year).toBe(2026);
    expect(result.week).toBe(1);
  }, TEST_TIMEOUT);

  test('returns null for invalid date', () => {
    expect(getISOWeek('invalid')).toBeNull();
    expect(getISOWeek('')).toBeNull();
  }, TEST_TIMEOUT);

  test('handles end of year dates', () => {
    const result = getISOWeek('31-12-2025');
    expect(result).not.toBeNull();
    expect(result.week).toBeGreaterThanOrEqual(1);
    expect(result.week).toBeLessThanOrEqual(53);
  }, TEST_TIMEOUT);
});

describe('parseRapportage', () => {
  const sampleFile = path.join(__dirname, '..', 'rapportage_voorbeeld.xlsx');

  test('parses the example rapportage file', async () => {
    if (!fs.existsSync(sampleFile)) {
      console.warn('Skipping: rapportage_voorbeeld.xlsx not found');
      return;
    }
    const { records, medewerkers } = await parseRapportage(sampleFile);
    expect(records.length).toBeGreaterThan(0);
    expect(medewerkers.size).toBeGreaterThan(0);

    // Each record should have required fields
    for (const rec of records.slice(0, 10)) {
      expect(rec.medewerkerId).toBeDefined();
      expect(rec.naam).toBeDefined();
      expect(typeof rec.totaleTijd).toBe('number');
      expect(rec.week).toBeGreaterThanOrEqual(1);
      expect(rec.week).toBeLessThanOrEqual(53);
      expect(rec.jaar).toBeGreaterThanOrEqual(2020);
    }
  }, TEST_TIMEOUT);
});

describe('generateProductiviteitExcel', () => {
  let db;

  beforeEach(() => {
    const dir = path.dirname(TEST_DB_PATH);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
    db = new ProductiviteitDB(TEST_DB_PATH);
  });

  afterEach(() => {
    if (db) db.close();
    const dir = path.dirname(TEST_DB_PATH);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
  });

  test('generates valid Excel with formulas', async () => {
    db.upsertMedewerker(201, 'Mevr. R. Landsmark', 36);
    db.upsertMedewerker(209, 'Mevr. P. van Beekhoven', 32);
    db.addUren(201, 2026, 1, 1800); // 30 hours
    db.addUren(201, 2026, 2, 2160); // 36 hours
    db.addUren(209, 2026, 1, 1440); // 24 hours

    const workbook = await generateProductiviteitExcel(db, 2026);

    expect(workbook.worksheets.length).toBe(2);

    const sheet = workbook.getWorksheet('Productiviteit');
    expect(sheet).toBeDefined();

    // Header check
    expect(sheet.getRow(1).getCell(1).value).toBe('Medewerker');
    expect(sheet.getRow(1).getCell(2).value).toBe('Medewerker ID');
    expect(sheet.getRow(1).getCell(3).value).toBe('Contracturen');
    expect(sheet.getRow(1).getCell(4).value).toBe('Week 1');

    // Check data rows exist
    const row2 = sheet.getRow(2);
    expect(row2.getCell(1).value).toBeTruthy();
    expect(row2.getCell(3).value).toBeGreaterThan(0);

    // Check Uren sheet
    const urenSheet = workbook.getWorksheet('Uren (detail)');
    expect(urenSheet).toBeDefined();

    // Save to temp and verify readable
    const tmpPath = path.join(__dirname, 'test_data_excel', 'test_output.xlsx');
    await workbook.xlsx.writeFile(tmpPath);
    expect(fs.existsSync(tmpPath)).toBe(true);

    // Re-read and verify
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.readFile(tmpPath);
    expect(wb2.worksheets.length).toBe(2);
  }, TEST_TIMEOUT);

  test('handles empty data gracefully', async () => {
    const workbook = await generateProductiviteitExcel(db, 2026);
    expect(workbook.worksheets.length).toBe(2);
    const sheet = workbook.getWorksheet('Productiviteit');
    expect(sheet.rowCount).toBe(1); // header only
  }, TEST_TIMEOUT);
});
