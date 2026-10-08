// Использование: npm run new-fw -- arient 1.4.3 путь/к/файлу.prg "Short summary in English"
// Для бета-версии добавьте суффикс: npm run new-fw -- arient 1.5.0-beta.1 путь/к/файлу.prg "..."
// Копирует файл в firmware/<прибор>/<версия>.prg, считает SHA-256 и размер
// и создаёт заготовку firmware/<прибор>/<версия>.md с блоками для en, es, ru.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';

const [device, version, file, summary = 'Short summary of the changes'] = process.argv.slice(2);
if (!device || !version || !file) {
  console.error('Использование: npm run new-fw -- <прибор> <версия> <файл.prg> ["summary по-английски"]');
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(device)) { console.error('Ключ прибора: маленькие латинские буквы, цифры и дефис (например arient)'); process.exit(1); }
if (!/^\d+\.\d+\.\d+(-beta\.\d+)?$/.test(version)) { console.error('Версия должна быть вида 1.4.2 (стабильная) или 1.5.0-beta.1 (бета)'); process.exit(1); }
if (!existsSync(file)) { console.error(`Файл не найден: ${file}`); process.exit(1); }

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

const today = new Date().toISOString().slice(0, 10);
writeFileSync(md, `---
device: ${device}
version: ${version}
date: ${today}
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

console.log(`Канал: ${version.includes('-') ? 'beta' : 'stable'}`);
console.log(`Создано: ${md}`);
console.log(`Скопировано: ${bin} (${data.length} байт)`);
console.log('Заполните summary и changes. Пустые es и ru можно оставить: на сайте покажется английский.');
console.log('Затем: npm run check, git add ., git commit, git push');
