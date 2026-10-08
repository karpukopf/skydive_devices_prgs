// Проверяет все описания прошивок. Запускается вручную (`npm run check`) и в GitHub Actions при каждом push.
// Главное, что он ловит: SHA-256 и размер в описании не совпадают с настоящим файлом, версия без файла.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { parse } from 'yaml';

const root = 'firmware';
const base = JSON.parse(readFileSync('config.json', 'utf8')).filesBaseUrl?.replace(/\/$/, '');
const errors = [];
const warnings = [];
let count = 0;

for (const device of readdirSync(root)) {
  const dir = `${root}/${device}`;
  if (!statSync(dir).isDirectory()) continue;
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.md'))) {
    count++;
    const where = `${device}/${name}`;
    const err = (m) => errors.push(`${where}: ${m}`);
    const warn = (m) => warnings.push(`${where}: ${m}`);

    const m = readFileSync(`${dir}/${name}`, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) { err('нет блока данных между строками ---'); continue; }
    let d;
    try { d = parse(m[1]) ?? {}; } catch (e) { err(`ошибка YAML: ${e.message.split('\n')[0]}`); continue; }

    const version = name.replace(/\.md$/, '');
    if (d.device !== device) err(`device: «${d.device}», а лежит в папке «${device}»`);
    if (String(d.version) !== version) err(`version: «${d.version}», а имя файла «${version}»`);
    if (!/^\d+\.\d+\.\d+(-beta\.\d+)?$/.test(String(d.version))) err('версия должна быть вида 1.4.2 (стабильная) или 1.5.0-beta.1 (бета)');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date)) || Number.isNaN(Date.parse(String(d.date)))) err('date должна быть вида 2026-09-20');
    if (d.minAppVersion !== undefined && !/^\d+\.\d+\.\d+$/.test(String(d.minAppVersion))) err('minAppVersion должна быть вида 2.1.0');
    if (!d.summary?.en || !String(d.summary.en).trim()) err('summary.en обязателен');
    for (const l of ['es', 'ru']) if (!d.summary?.[l] || !String(d.summary[l]).trim()) warn(`нет перевода summary.${l}, на сайте покажется английский`);
    if (!/^[a-f0-9]{64}$/.test(String(d.sha256))) err('sha256 должен быть 64 символа 0-9a-f');

    const expectedUrl = base && `${base}/${device}/${version}.prg`;
    if (expectedUrl && d.url !== expectedUrl) err(`url должен быть ${expectedUrl}`);

    const bin = `${dir}/${version}.prg`;
    if (!existsSync(bin)) {
      if (!d.draft) err(`нет файла ${device}/${version}.prg (добавьте его или поставьте draft: true)`);
    } else {
      const data = readFileSync(bin);
      const actual = createHash('sha256').update(data).digest('hex');
      if (actual !== d.sha256) err(`sha256 не совпадает с файлом .prg (в файле ${actual})`);
      if (data.length !== d.size) err(`size ${d.size}, а файл ${data.length} байт`);
    }
  }
  // .prg без описания: такой файл лежит на хостинге, но на сайте его нет
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.prg'))) {
    if (!existsSync(`${dir}/${name.replace(/\.prg$/, '.md')}`)) warnings.push(`${device}/${name}: нет описания .md`);
  }
}

for (const w of warnings) console.warn(`Предупреждение: ${w}`);
for (const e of errors) console.error(`Ошибка: ${e}`);
console.log(`Проверено описаний: ${count}. Ошибок: ${errors.length}, предупреждений: ${warnings.length}.`);
process.exit(errors.length ? 1 : 0);
