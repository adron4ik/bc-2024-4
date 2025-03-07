const http = require('http');
const fs = require('fs').promises;
const commander = require('commander');
const path = require('path');
const superagent = require('superagent');

const program = new commander.Command();
program
  .requiredOption('-h, --host <host>', 'Server host address')
  .requiredOption('-p, --port <port>', 'Server port')
  .requiredOption('-c, --cache <path>', 'Cache directory path');

program.parse(process.argv);

const { host, port, cache } = program.opts();

// Перевірка існування директорії кешу
async function checkCacheDirectory() {
  try {
    await fs.stat(cache); // Перевіряємо, чи існує директорія
  } catch (err) {
    console.error(`Cache directory does not exist: ${cache}`);
    process.exit(1);
  }
}

checkCacheDirectory();

// Функція для завантаження картинки з http.cat
async function fetchImageFromHttpCat(statusCode) {
  try {
    const response = await superagent.get(`https://http.cat/${statusCode}.jpg`);
    return response.body; // Повертаємо дані картинки
  } catch (err) {
    console.error(`Error fetching image for status code ${statusCode}:`, err.message);
    return null; // Якщо помилка, повертаємо null
  }
}

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.slice(1);  // Видаляємо слеш на початку
  const statusCode = urlPath.split('/')[0]; // Припускаємо, що URL виглядає як /statusCode
  const filePath = path.join(cache, `${statusCode}.jpg`);  // Шлях до картинки у кеші

  try {
    if (req.method === 'GET') {
      // Перевіряємо, чи є картинка в кеші
      try {
        const fileData = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(fileData);
      } catch (err) {
        // Якщо картинки немає в кеші, запитуємо її з http.cat
        const imageData = await fetchImageFromHttpCat(statusCode);
        if (imageData) {
          await fs.writeFile(filePath, imageData); // Зберігаємо картинку в кеш
          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          res.end(imageData);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Image not found');
        }
      }
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

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}/`);
});
