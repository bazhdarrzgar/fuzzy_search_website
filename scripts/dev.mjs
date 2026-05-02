import { spawn } from 'child_process';
import net from 'net';

async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => {
        server.close();
        resolve(true);
      })
      .listen(port);
  });
}

async function findAvailablePort(startPort) {
  let port = startPort;
  while (!(await isPortAvailable(port))) {
    console.log(`Port ${port} is busy, trying ${port + 1}...`);
    port++;
  }
  return port;
}

async function startDev() {
  const port = await findAvailablePort(3000);
  console.log(`Starting Next.js on port ${port} with increased memory...`);
  
  // Set NODE_OPTIONS for memory increase cross-platform
  process.env.NODE_OPTIONS = '--max-old-space-size=512';
  
  // Use 'npm' or 'yarn' based on what's available, or just run next directly via npx
  const nextDev = spawn('npx', ['next', 'dev', '--hostname', '0.0.0.0', '--port', port.toString()], {
    stdio: 'inherit',
    shell: true,
    env: process.env
  });

  nextDev.on('close', (code) => {
    process.exit(code);
  });
}

startDev();
