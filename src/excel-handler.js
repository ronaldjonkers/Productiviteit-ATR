const ExcelJS = require('exceljs');
const path = require('path');

function getISOWeek(dateStr) {
  // dateStr format: "dd-mm-yyyy"
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  const date = new Date(year, month, day);
  if (isNaN(date.getTime())) return null;

  // ISO week calculation
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

  return { week: weekNo, year: d.getUTCFullYear() };
}

async function parseRapportage(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  // Find column indices from header row
  const headerRow = sheet.getRow(1);
  const colMap = {};
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const val = (cell.value || '').toString().toLowerCase().trim();
    colMap[val] = colNumber;
  });

  const requiredCols = ['totaletijd', 'uitgevoerd_door', 'medewerker_id', 'uitvoerdatum'];
  for (const col of requiredCols) {
    if (!(col in colMap)) {
      throw new Error(`Kolom '${col}' niet gevonden in het bestand. Gevonden kolommen: ${Object.keys(colMap).join(', ')}`);
    }
  }

  const records = [];
  const medewerkers = new Map();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const medewerkerId = parseInt(row.getCell(colMap['medewerker_id']).value, 10);
    const naam = (row.getCell(colMap['uitgevoerd_door']).value || '').toString().trim();
    const totaleTijd = parseFloat(row.getCell(colMap['totaletijd']).value) || 0;
    let uitvoerdatum = (row.getCell(colMap['uitvoerdatum']).value || '').toString().trim();

    if (!medewerkerId || !naam || !uitvoerdatum) return;

    // Handle Date objects from Excel
    if (row.getCell(colMap['uitvoerdatum']).value instanceof Date) {
      const d = row.getCell(colMap['uitvoerdatum']).value;
      uitvoerdatum = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    }

    const weekInfo = getISOWeek(uitvoerdatum);
    if (!weekInfo) return;

    if (!medewerkers.has(medewerkerId)) {
      medewerkers.set(medewerkerId, naam);
    }

    records.push({
      medewerkerId,
      naam,
      totaleTijd,
      week: weekInfo.week,
      jaar: weekInfo.year,
    });
  });

  return { records, medewerkers };
}

async function parseProductiviteitExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];

  const medewerkerUpdates = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const naam = (row.getCell(1).value || '').toString().trim();
    const contractUren = parseFloat(row.getCell(2).value) || 36;

    if (!naam) return;

    medewerkerUpdates.push({ naam, contractUren });
  });

  return medewerkerUpdates;
}

async function generateProductiviteitExcel(db, jaar) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Productiviteit ATR';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Productiviteit', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }],
  });

  // --- STYLES ---
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B4F72' } };
  const headerFont = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
  const subHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6EAF8' } };
  const headerBorder = {
    top: { style: 'thin', color: { argb: 'FF1B4F72' } },
    bottom: { style: 'thin', color: { argb: 'FF1B4F72' } },
    left: { style: 'thin', color: { argb: 'FFD5D8DC' } },
    right: { style: 'thin', color: { argb: 'FFD5D8DC' } },
  };
  const cellBorder = {
    top: { style: 'thin', color: { argb: 'FFE8E8E8' } },
    bottom: { style: 'thin', color: { argb: 'FFE8E8E8' } },
    left: { style: 'thin', color: { argb: 'FFE8E8E8' } },
    right: { style: 'thin', color: { argb: 'FFE8E8E8' } },
  };

  // --- HEADER ROW ---
  const headers = ['Medewerker', 'Medewerker ID', 'Contracturen'];
  for (let w = 1; w <= 52; w++) {
    headers.push(`Week ${w}`);
  }

  const headerRowExcel = sheet.addRow(headers);
  headerRowExcel.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = headerBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  headerRowExcel.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
  headerRowExcel.height = 28;

  // Set column widths
  sheet.getColumn(1).width = 32;
  sheet.getColumn(2).width = 16;
  sheet.getColumn(3).width = 14;
  for (let w = 1; w <= 52; w++) {
    sheet.getColumn(w + 3).width = 12;
  }

  // --- DATA ROWS ---
  const medewerkers = db.getAllMedewerkers();
  const urenData = db.getUrenPerWeek(jaar);

  // Build lookup: medewerkerId -> { week -> totaal_minuten }
  const urenMap = new Map();
  for (const rec of urenData) {
    if (!urenMap.has(rec.medewerker_id)) {
      urenMap.set(rec.medewerker_id, new Map());
    }
    urenMap.get(rec.medewerker_id).set(rec.week, rec.totaal_minuten);
  }

  for (let i = 0; i < medewerkers.length; i++) {
    const mw = medewerkers[i];
    const rowNum = i + 2; // 1-indexed, row 1 is header
    const rowData = [mw.naam, mw.medewerker_id, mw.contract_uren];

    // Add placeholders for week columns (will set formulas below)
    for (let w = 1; w <= 52; w++) {
      rowData.push(null);
    }

    const dataRow = sheet.addRow(rowData);

    // Style the data row
    const isEven = i % 2 === 0;
    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = cellBorder;
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
      }
      if (colNumber >= 4) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.numFmt = '0.0%';
      }
      if (colNumber === 3) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
    dataRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    dataRow.getCell(1).font = { bold: true, size: 11, name: 'Calibri' };

    // Set week cells: formula = (minutes/60) / contracturen
    // We use Excel formulas so the user can see the hours
    // Formula: =(X/60)/$C$rowNum where X is the actual minutes value
    const weekData = urenMap.get(mw.medewerker_id) || new Map();
    for (let w = 1; w <= 52; w++) {
      const colIdx = w + 3; // column index (1-based)
      const cell = dataRow.getCell(colIdx);
      const minuten = weekData.get(w) || 0;

      if (minuten > 0) {
        const contractCellRef = `$C$${rowNum}`;
        const pct = minuten / 60 / mw.contract_uren;
        cell.value = {
          formula: `(${minuten}/60)/${contractCellRef}`,
          result: pct,
        };

        // Conditional font color based on percentage
        if (pct < 0.6) {
          cell.font = { color: { argb: 'FFE74C3C' }, bold: true, size: 11, name: 'Calibri' };
        } else if (pct < 0.8) {
          cell.font = { color: { argb: 'FFE67E22' }, bold: true, size: 11, name: 'Calibri' };
        } else {
          cell.font = { color: { argb: 'FF27AE60' }, bold: true, size: 11, name: 'Calibri' };
        }
      }
    }
  }

  // Add a "Uren" sheet with raw hours for reference
  const urenSheet = workbook.addWorksheet('Uren (detail)', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }],
  });

  const urenHeaders = ['Medewerker', 'Medewerker ID', 'Contracturen'];
  for (let w = 1; w <= 52; w++) {
    urenHeaders.push(`Week ${w}`);
  }

  const urenHeaderRow = urenSheet.addRow(urenHeaders);
  urenHeaderRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    cell.border = headerBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  urenHeaderRow.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
  urenHeaderRow.height = 28;

  urenSheet.getColumn(1).width = 32;
  urenSheet.getColumn(2).width = 16;
  urenSheet.getColumn(3).width = 14;
  for (let w = 1; w <= 52; w++) {
    urenSheet.getColumn(w + 3).width = 10;
  }

  for (let i = 0; i < medewerkers.length; i++) {
    const mw = medewerkers[i];
    const weekData = urenMap.get(mw.medewerker_id) || new Map();
    const rowData = [mw.naam, mw.medewerker_id, mw.contract_uren];

    for (let w = 1; w <= 52; w++) {
      const minuten = weekData.get(w) || 0;
      rowData.push(minuten > 0 ? Math.round((minuten / 60) * 100) / 100 : null);
    }

    const dataRow = urenSheet.addRow(rowData);
    const isEven = i % 2 === 0;
    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = cellBorder;
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
      }
      if (colNumber >= 4) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.numFmt = '0.00';
      }
    });
    dataRow.getCell(1).font = { bold: true, size: 11, name: 'Calibri' };
  }

  return workbook;
}

module.exports = {
  parseRapportage,
  parseProductiviteitExcel,
  generateProductiviteitExcel,
  getISOWeek,
};
