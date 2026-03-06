# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-03-06

### Added
- Electron desktop applicatie met native macOS look & feel
- Upload rapportage Excel bestanden (drag & drop of bestandskiezer)
- Upload productiviteit Excel om contracturen bij te werken
- Automatische extractie van `totaletijd`, `uitgevoerd_door`, `medewerker_id`, `uitvoerdatum`
- Generatie van productiviteitsoverzicht Excel met formules `(minuten/60)/contracturen`
- Tweede sheet "Uren (detail)" met werkelijke uren per week
- SQLite database voor persistente opslag van medewerkers, uren en contracturen
- Standaard contracturen: 36 uur
- Upload geschiedenis overzicht
- Medewerkers overzicht met contracturen
- Jaar-selector voor download
- `install.sh` voor macOS/Linux
- Unit tests (19 tests) voor database en Excel verwerking
