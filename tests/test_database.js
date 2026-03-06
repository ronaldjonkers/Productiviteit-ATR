const path = require('path');
const fs = require('fs');
const ProductiviteitDB = require('../src/database');

const TEST_DB_PATH = path.join(__dirname, 'test_data', 'test.db');
const TEST_TIMEOUT = 10000;

let db;

beforeEach(() => {
  const dir = path.dirname(TEST_DB_PATH);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
  db = new ProductiviteitDB(TEST_DB_PATH);
});

afterEach(() => {
  if (db) db.close();
  const dir = path.dirname(TEST_DB_PATH);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
});

describe('ProductiviteitDB', () => {
  test('creates database and tables', () => {
    const medewerkers = db.getAllMedewerkers();
    expect(Array.isArray(medewerkers)).toBe(true);
    expect(medewerkers.length).toBe(0);
  }, TEST_TIMEOUT);

  test('upsertMedewerker - insert new', () => {
    db.upsertMedewerker(201, 'Mevr. R. Landsmark', 36);
    const all = db.getAllMedewerkers();
    expect(all.length).toBe(1);
    expect(all[0].medewerker_id).toBe(201);
    expect(all[0].naam).toBe('Mevr. R. Landsmark');
    expect(all[0].contract_uren).toBe(36);
  }, TEST_TIMEOUT);

  test('upsertMedewerker - update contract hours', () => {
    db.upsertMedewerker(201, 'Mevr. R. Landsmark', 36);
    db.upsertMedewerker(201, 'Mevr. R. Landsmark', 32);
    const all = db.getAllMedewerkers();
    expect(all.length).toBe(1);
    expect(all[0].contract_uren).toBe(32);
  }, TEST_TIMEOUT);

  test('upsertMedewerker - update without changing contract hours', () => {
    db.upsertMedewerker(201, 'Mevr. R. Landsmark', 32);
    db.upsertMedewerker(201, 'Mevr. R. Landsmark Updated', null);
    const all = db.getAllMedewerkers();
    expect(all.length).toBe(1);
    expect(all[0].naam).toBe('Mevr. R. Landsmark Updated');
    expect(all[0].contract_uren).toBe(32);
  }, TEST_TIMEOUT);

  test('addUren - adds minutes', () => {
    db.upsertMedewerker(201, 'Test', 36);
    db.addUren(201, 2026, 1, 120);
    const uren = db.getMedewerkerUren(201, 2026);
    expect(uren.length).toBe(1);
    expect(uren[0].week).toBe(1);
    expect(uren[0].totaal_minuten).toBe(120);
  }, TEST_TIMEOUT);

  test('addUren - accumulates on conflict', () => {
    db.upsertMedewerker(201, 'Test', 36);
    db.addUren(201, 2026, 1, 60);
    db.addUren(201, 2026, 1, 90);
    const uren = db.getMedewerkerUren(201, 2026);
    expect(uren.length).toBe(1);
    expect(uren[0].totaal_minuten).toBe(150);
  }, TEST_TIMEOUT);

  test('setUren - replaces value', () => {
    db.upsertMedewerker(201, 'Test', 36);
    db.setUren(201, 2026, 1, 60);
    db.setUren(201, 2026, 1, 90);
    const uren = db.getMedewerkerUren(201, 2026);
    expect(uren[0].totaal_minuten).toBe(90);
  }, TEST_TIMEOUT);

  test('getUrenPerWeek - returns all for a year', () => {
    db.upsertMedewerker(201, 'A', 36);
    db.upsertMedewerker(202, 'B', 32);
    db.addUren(201, 2026, 1, 60);
    db.addUren(201, 2026, 2, 120);
    db.addUren(202, 2026, 1, 45);
    const all = db.getUrenPerWeek(2026);
    expect(all.length).toBe(3);
  }, TEST_TIMEOUT);

  test('getAvailableYears', () => {
    db.upsertMedewerker(201, 'Test', 36);
    db.addUren(201, 2025, 10, 60);
    db.addUren(201, 2026, 1, 60);
    const years = db.getAvailableYears();
    expect(years).toContain(2025);
    expect(years).toContain(2026);
  }, TEST_TIMEOUT);

  test('logUpload and getUploadHistory', () => {
    db.logUpload('test.xlsx', 'rapportage', 100);
    db.logUpload('test2.xlsx', 'productiviteit', 5);
    const history = db.getUploadHistory();
    expect(history.length).toBe(2);
    const names = history.map(h => h.bestandsnaam);
    expect(names).toContain('test.xlsx');
    expect(names).toContain('test2.xlsx');
  }, TEST_TIMEOUT);

  test('clearUrenForYear', () => {
    db.upsertMedewerker(201, 'Test', 36);
    db.addUren(201, 2026, 1, 60);
    db.addUren(201, 2025, 1, 60);
    db.clearUrenForYear(2026);
    expect(db.getUrenPerWeek(2026).length).toBe(0);
    expect(db.getUrenPerWeek(2025).length).toBe(1);
  }, TEST_TIMEOUT);

  test('updateContractUren - updates only contract hours', () => {
    db.upsertMedewerker(201, 'Mevr. R. Landsmark', 36);
    db.updateContractUren(201, 24);
    const all = db.getAllMedewerkers();
    const mw = all.find(m => m.medewerker_id === 201);
    expect(mw.contract_uren).toBe(24);
    expect(mw.naam).toBe('Mevr. R. Landsmark');
  }, TEST_TIMEOUT);

  test('default contract hours is 36', () => {
    db.upsertMedewerker(999, 'Nieuwe Medewerker');
    const all = db.getAllMedewerkers();
    const mw = all.find(m => m.medewerker_id === 999);
    expect(mw.contract_uren).toBe(36);
  }, TEST_TIMEOUT);
});
