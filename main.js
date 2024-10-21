const http = require('http');
const fs = require('fs').promises;
const commander = require('commander');
const path = require('path');

const program = new commander.Command();
program
  .requiredOption('-h, --host <host>', 'Server host address')
  .requiredOption('-p, --port <port>', 'Server port')
  .requiredOption('-c, --cache <path>', 'Cache directory path');

program.parse(process.argv);

const { host, port, cache } = program.opts();

// Перевірка існування директорії кешу
if (!fs.stat(cache).then(() => true).catch(() => false)) {
  console.error(`Cache directory does not exist: ${cache}`);
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.slice(1);  // Видаляємо слеш на початку
  const filePath = path.join(cache, `${urlPath}.jpg`);  // Шлях до картинки у кеші

  try {
    if (req.method === 'GET') {
      // Читання файлу з кешу
      const fileData = await fs.readFile(filePath);
      res.writeHead(200, { 'Content-Type': 'image/jpeg' });
      res.end(fileData);
    } else if (req.method === 'PUT') {
      // Запис файлу у кеш
      let body = [];
      req.on('data', chunk => body.push(chunk));
      req.on('end', async () => {
        const fileData = Buffer.concat(body);
        await fs.writeFile(filePath, fileData);
        res.writeHead(201, { 'Content-Type': 'text/plain' });
        res.end('File created or updated');
      });
    } else if (req.method === 'DELETE') {
      // Видалення файлу з кешу
      await fs.unlink(filePath);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('File deleted');
    } else {
      // Метод не підтримується
      res.writeHead(405, { 'Content-Type': 'text/plain' });
      res.end('Method not allowed');
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    }
  }
});

// Запуск сервера
server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}/`);
});
