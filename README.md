# Productiviteit ATR

Desktop applicatie voor het verwerken van rapportages en genereren van productiviteitsoverzichten per medewerker per week.

## Voor gebruikers

### De app starten

- **Dubbelklik** op "Productiviteit ATR" in `/Applications` of op je bureaublad
- Of sleep de app naar je **Dock** voor snelle toegang

### Hoe werkt het?

1. **Sleep een rapportage Excel** (.xlsx) in het upload veld (of klik om te selecteren)
2. De app verwerkt automatisch de afspraakdata per medewerker per week
3. **Pas contracturen aan** direct in de medewerkers tabel (wijzigingen worden automatisch opgeslagen)
4. **Download het productiviteitsoverzicht** als Excel bestand
5. Bij opnieuw uploaden wordt bestaande data overschreven (de upload is altijd leidend)

### Updaten

Klik in de app onderaan op **"Controleer"** bij "App Updates". Als er een update is, klik op **"Update installeren"** — de app herstart automatisch.

## Voor IT-beheerders

### Installatie macOS (eenmalig)

```bash
git clone git@github.com:ronaldjonkers/Productiviteit-ATR.git
cd Productiviteit-ATR
./install.sh
```

Dit script:
- Installeert Homebrew, Node.js en npm (indien nodig)
- Installeert alle dependencies
- Maakt een **macOS .app** aan in `/Applications`
- Plaatst een **snelkoppeling op het bureaublad**
- Verwijdert macOS quarantine zodat de app direct werkt

### Installatie Windows (eenmalig)

**Vereisten:** Installeer eerst [Node.js LTS](https://nodejs.org/) en [Git](https://git-scm.com/download/win) met standaard instellingen.

```cmd
git clone https://github.com/ronaldjonkers/Productiviteit-ATR.git
cd Productiviteit-ATR
install.bat
```

Dit script:
- Controleert of Node.js en Git geïnstalleerd zijn
- Installeert alle dependencies
- Maakt een **snelkoppeling op het bureaublad**
- Maakt een **Start Menu snelkoppeling**
- Maakt een `Productiviteit ATR.bat` launcher in de projectmap

### Testen

```bash
npm test
```

### Handmatig starten (via Terminal/CMD)

```bash
npm start
```

## Functionaliteit

- **Upload rapportage Excel**: Verwerkt `totaletijd`, `uitgevoerd_door`, `medewerker_id` en `uitvoerdatum`
- **Inline contracturen bewerken**: Pas contracturen direct aan in de interface (standaard: 36 uur)
- **Download productiviteitsoverzicht**: Excel met formules `(uren / contracturen)` per week
- **Persistente opslag**: SQLite database — data blijft bewaard tussen sessies
- **Drag & drop**: Sleep bestanden direct in de applicatie
- **In-app updates**: Eén klik om de nieuwste versie te installeren
- **macOS .app**: Dubbelklik om te starten, sleep naar Dock
- **Windows**: Snelkoppeling op bureaublad en in Start Menu

## Excel Output

### Sheet 1: Productiviteit
- **Kolom A**: Medewerker naam
- **Kolom B**: Medewerker ID
- **Kolom C**: Contracturen (bevroren bij scrollen)
- **Kolom D–BC**: Week 1–52 (productiviteitspercentage als Excel formule)

### Sheet 2: Uren (detail)
- Zelfde structuur maar met het werkelijke aantal uren per week

## Technologie

- **Electron** — Desktop applicatie framework
- **better-sqlite3** — Lokale database opslag
- **ExcelJS** — Excel bestanden lezen en schrijven

## Versie

v1.0.0
