import { readFileSync, writeFileSync } from 'node:fs';
import { crc32 } from 'node:zlib';

// Small, uncompressed ZIP using Node's built-in CRC32; no packaging dependency.
const files = ['manifest.json', 'background.js', 'bridge.js', 'extractor.js'];
const local = [];
const central = [];
let offset = 0;
for (const filename of files) {
  const name = Buffer.from(filename);
  const data = readFileSync(new URL(`../public/quizlet-bridge/${filename}`, import.meta.url));
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(33, 12); // 1980-01-01, reproducible archives.
  header.writeUInt32LE(crc32(data), 14);
  header.writeUInt32LE(data.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(name.length, 26);
  local.push(header, name, data);
  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50);
  directory.writeUInt16LE(20, 4);
  directory.writeUInt16LE(20, 6);
  directory.writeUInt16LE(33, 14);
  directory.writeUInt32LE(crc32(data), 16);
  directory.writeUInt32LE(data.length, 20);
  directory.writeUInt32LE(data.length, 24);
  directory.writeUInt16LE(name.length, 28);
  directory.writeUInt32LE(offset, 42);
  central.push(directory, name);
  offset += header.length + name.length + data.length;
}
const directory = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(directory.length, 12);
end.writeUInt32LE(offset, 16);
writeFileSync(new URL('../public/quizlet-bridge.zip', import.meta.url), Buffer.concat([...local, directory, end]));
console.log(`Packaged Quizlet bridge (${files.length} files)`);
