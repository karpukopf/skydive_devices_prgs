// Использование: npm run new-fw -- arient 1.4.3 путь/к/файлу.prg "Short summary in English"
// Для бета-версии добавьте суффикс: npm run new-fw -- arient 1.5.0-beta.1 путь/к/файлу.prg "..."
// Дата релиза: по умолчанию сегодняшняя. Для старых версий укажите её явно:
//   npm run new-fw -- arient 1.2.0 ./old.prg "Summary" --date 2026-03-14
//   npm run new-fw -- arient 1.2.0 ./old.prg "Summary" --date file   (дата изменения самого файла)
// Копирует файл в firmware/<прибор>/<версия>.prg, считает SHA-256 и размер
// и создаёт заготовку firmware/<прибор>/<версия>.md с блоками для en, es, ru.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';

// Флаг --date можно ставить в любое место, остальные аргументы идут по порядку
const args = process.argv.slice(2);
const rest = [];
let dateOpt;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--date' || args[i] === '-d') {
    dateOpt = args[++i];
    if (!dateOpt) { console.error('После --date нужна дата ГГГГ-ММ-ДД или слово file'); process.exit(1); }
  } else if (args[i].startsWith('--date=')) dateOpt = args[i].slice(7);
  else rest.push(args[i]);
}
const [device, version, file, summary = 'Short summary of the changes'] = rest;
if (!device || !version || !file) {
  console.error('Использование: npm run new-fw -- <прибор> <версия> <файл.prg> ["summary по-английски"] [--date ГГГГ-ММ-ДД | --date file]');
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(device)) { console.error('Ключ прибора: маленькие латинские буквы, цифры и дефис (например arient)'); process.exit(1); }
if (!/^\d+\.\d+\.\d+(-beta\.\d+)?$/.test(version)) { console.error('Версия должна быть вида 1.4.2 (стабильная) или 1.5.0-beta.1 (бета)'); process.exit(1); }
if (!existsSync(file)) { console.error(`Файл не найден: ${file}`); process.exit(1); }

// Дата релиза в локальном часовом поясе (не UTC, чтобы вечером не получить вчерашнюю)
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let releaseDate, dateSource;
if (!dateOpt) { releaseDate = ymd(new Date()); dateSource = 'сегодня'; }
else if (dateOpt === 'file') { releaseDate = ymd(statSync(file).mtime); dateSource = 'дата изменения файла'; }
else {
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(dateOpt) && ymd(new Date(`${dateOpt}T12:00:00`)) === dateOpt;
  if (!ok) { console.error(`Неверная дата «${dateOpt}». Нужен формат ГГГГ-ММ-ДД, например 2026-03-14, и существующий день.`); process.exit(1); }
  releaseDate = dateOpt; dateSource = 'из аргумента';
}

const base = JSON.parse(readFileSync('config.json', 'utf8')).filesBaseUrl?.replace(/\/$/, '');
if (!base) { console.error('В config.json не задан filesBaseUrl'); process.exit(1); }

const dir = `firmware/${device}`;
const md = `${dir}/${version}.md`;
const bin = `${dir}/${version}.prg`;
if (existsSync(md) || existsSync(bin)) {
  console.error(`Версия ${version} уже существует. Опубликованные файлы не заменяют: выпустите новую версию.`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });

const data = readFileSync(file);
const sha256 = createHash('sha256').update(data).digest('hex');
copyFileSync(file, bin);

writeFileSync(md, `---
device: ${device}
version: ${version}
date: ${releaseDate}
url: ${base}/${device}/${version}.prg
sha256: ${sha256}
size: ${data.length}
# minAppVersion: 2.1.0
# draft: true
summary:
  en: ${summary}
  es: 
  ru: 
changes:
  en:
    fixed:
      - 
    # added:
    # changed:
  es:
    fixed:
      - 
  ru:
    fixed:
      - 
---
`);

console.log(`Дата релиза: ${releaseDate} (${dateSource})`);
console.log(`Канал: ${version.includes('-') ? 'beta' : 'stable'}`);
console.log(`Создано: ${md}`);
console.log(`Скопировано: ${bin} (${data.length} байт)`);
console.log('Заполните summary и changes. Пустые es и ru можно оставить: на сайте покажется английский.');
console.log('Затем: npm run check, git add ., git commit, git push');
