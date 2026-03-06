# Productiviteit ATR

Desktop applicatie voor het verwerken van rapportages en genereren van productiviteitsoverzichten per medewerker per week.

## Functionaliteit

- **Upload rapportage Excel**: Verwerkt `totaletijd`, `uitgevoerd_door`, `medewerker_id` en `uitvoerdatum` uit rapportage bestanden
- **Upload productiviteit Excel**: Werkt contracturen per medewerker bij
- **Download productiviteitsoverzicht**: Genereert een Excel met productiviteitspercentages per medewerker per week (met formules)
- **Persistente opslag**: Alle data wordt lokaal opgeslagen in een SQLite database
- **Drag & drop**: Sleep bestanden direct in de applicatie

## Installatie

```bash
./install.sh
```

Dit script installeert automatisch:
- Node.js (indien nodig)
- Alle npm dependencies
- Native modules voor Electron

## Starten

```bash
npm start
```

## Testen

```bash
npm test
```

## Hoe werkt het?

1. **Upload een rapportage Excel** (.xlsx) met afspraakdata
2. De applicatie extraheert de relevante velden en berekent het aantal minuten per medewerker per week
3. **Download het productiviteitsoverzicht** als Excel bestand
4. Het overzicht bevat per medewerker het productiviteitspercentage per week: `(uren / contracturen)`
5. **Contracturen bijwerken**: Upload een productiviteit Excel om de contracturen per medewerker aan te passen (standaard: 36 uur)

## Excel Output

### Sheet 1: Productiviteit
- Kolom A: Medewerker naam
- Kolom B: Medewerker ID
- Kolom C: Contracturen
- Kolom D-BC: Week 1-52 (productiviteitspercentage als Excel formule)

### Sheet 2: Uren (detail)
- Zelfde structuur maar met het werkelijke aantal uren per week

## Technologie

- **Electron** - Desktop applicatie framework
- **better-sqlite3** - Lokale database opslag
- **ExcelJS** - Excel bestanden lezen en schrijven

## Versie

v1.0.0
