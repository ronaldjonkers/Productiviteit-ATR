const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class ProductiviteitDB {
  constructor(dbPath) {
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this._initTables();
  }

  _initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS medewerkers (
        medewerker_id INTEGER PRIMARY KEY,
        naam TEXT NOT NULL,
        contract_uren REAL NOT NULL DEFAULT 36
      );

      CREATE TABLE IF NOT EXISTS uren_per_week (
        medewerker_id INTEGER NOT NULL,
        jaar INTEGER NOT NULL,
        week INTEGER NOT NULL,
        totaal_minuten REAL NOT NULL DEFAULT 0,
        PRIMARY KEY (medewerker_id, jaar, week),
        FOREIGN KEY (medewerker_id) REFERENCES medewerkers(medewerker_id)
      );

      CREATE TABLE IF NOT EXISTS upload_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bestandsnaam TEXT NOT NULL,
        type TEXT NOT NULL,
        upload_datum TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        aantal_rijen INTEGER NOT NULL DEFAULT 0
      );
    `);
  }

  upsertMedewerker(medewerkerId, naam, contractUren = null) {
    const existing = this.db.prepare(
      'SELECT contract_uren FROM medewerkers WHERE medewerker_id = ?'
    ).get(medewerkerId);

    if (existing) {
      if (contractUren !== null) {
        this.db.prepare(
          'UPDATE medewerkers SET naam = ?, contract_uren = ? WHERE medewerker_id = ?'
        ).run(naam, contractUren, medewerkerId);
      } else {
        this.db.prepare(
          'UPDATE medewerkers SET naam = ? WHERE medewerker_id = ?'
        ).run(naam, medewerkerId);
      }
    } else {
      this.db.prepare(
        'INSERT INTO medewerkers (medewerker_id, naam, contract_uren) VALUES (?, ?, ?)'
      ).run(medewerkerId, naam, contractUren !== null ? contractUren : 36);
    }
  }

  addUren(medewerkerId, jaar, week, minuten) {
    this.db.prepare(`
      INSERT INTO uren_per_week (medewerker_id, jaar, week, totaal_minuten)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(medewerker_id, jaar, week)
      DO UPDATE SET totaal_minuten = totaal_minuten + excluded.totaal_minuten
    `).run(medewerkerId, jaar, week, minuten);
  }

  setUren(medewerkerId, jaar, week, minuten) {
    this.db.prepare(`
      INSERT INTO uren_per_week (medewerker_id, jaar, week, totaal_minuten)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(medewerker_id, jaar, week)
      DO UPDATE SET totaal_minuten = excluded.totaal_minuten
    `).run(medewerkerId, jaar, week, minuten);
  }

  getAllMedewerkers() {
    return this.db.prepare('SELECT * FROM medewerkers ORDER BY naam').all();
  }

  getUrenPerWeek(jaar) {
    return this.db.prepare(
      'SELECT * FROM uren_per_week WHERE jaar = ? ORDER BY medewerker_id, week'
    ).all(jaar);
  }

  getMedewerkerUren(medewerkerId, jaar) {
    return this.db.prepare(
      'SELECT week, totaal_minuten FROM uren_per_week WHERE medewerker_id = ? AND jaar = ? ORDER BY week'
    ).all(medewerkerId, jaar);
  }

  logUpload(bestandsnaam, type, aantalRijen) {
    this.db.prepare(
      'INSERT INTO upload_log (bestandsnaam, type, aantal_rijen) VALUES (?, ?, ?)'
    ).run(bestandsnaam, type, aantalRijen);
  }

  getUploadHistory() {
    return this.db.prepare(
      'SELECT * FROM upload_log ORDER BY upload_datum DESC LIMIT 50'
    ).all();
  }

  getAvailableYears() {
    return this.db.prepare(
      'SELECT DISTINCT jaar FROM uren_per_week ORDER BY jaar DESC'
    ).all().map(r => r.jaar);
  }

  updateContractUren(medewerkerId, uren) {
    this.db.prepare(
      'UPDATE medewerkers SET contract_uren = ? WHERE medewerker_id = ?'
    ).run(uren, medewerkerId);
  }

  clearUrenForYear(jaar) {
    this.db.prepare('DELETE FROM uren_per_week WHERE jaar = ?').run(jaar);
  }

  close() {
    this.db.close();
  }
}

module.exports = ProductiviteitDB;
