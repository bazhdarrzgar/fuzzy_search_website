import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let devProcess = null;
let projectLogs = [];
const DASHBOARD_PORT = 4998; // Different port to avoid conflict if both projects run
let allocatedPort = 3000;
let hasOpenedBrowser = false;

async function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 500);

    socket.connect(port, '127.0.0.1', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
}

function openBrowser(url) {
  const start = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  spawn(start, [url], { shell: true });
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fuzzy Search Control Panel</title>
        <style>
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #0f172a; color: white; margin: 0; padding: 20px; }
          .panel { background: #1e293b; padding: 3rem; border-radius: 2rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); text-align: center; width: 100%; max-width: 400px; border: 1px solid #334155; position: relative; }
          
          .indicator-group { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 2rem; }
          .dot { width: 12px; height: 12px; border-radius: 50%; background: #475569; transition: all 0.3s ease; }
          .dot.running { background: #10b981; box-shadow: 0 0 15px #10b981; }
          .dot.stopped { background: #ef4444; box-shadow: 0 0 15px #ef4444; }
          .status-text { font-size: 14px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }

          h2 { margin-top: 0; margin-bottom: 2rem; font-size: 24px; font-weight: 800; color: #f8fafc; }
          
          .button-group { display: flex; flex-direction: column; gap: 1.5rem; margin-top: 1rem; }
          button { padding: 18px; font-size: 16px; cursor: pointer; border: none; border-radius: 1.25rem; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
          
          .start { background: #10b981; color: white; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4); opacity: 1; }
          .start:hover:not(:disabled) { background: #059669; transform: translateY(-2px); box-shadow: 0 8px 25px rgba(16, 185, 129, 0.5); }
          .start:disabled { opacity: 0.15; cursor: not-allowed; box-shadow: none; filter: grayscale(1); }
          
          .stop { background: #ef4444; color: white; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.4); opacity: 1; }
          .stop:hover:not(:disabled) { background: #dc2626; transform: translateY(-2px); box-shadow: 0 8px 25px rgba(239, 68, 68, 0.5); }
          .stop:disabled { opacity: 0.15; cursor: not-allowed; box-shadow: none; filter: grayscale(1); }

          .loading-area { margin-top: 2.5rem; display: none; }
          .timer { font-size: 48px; font-weight: 800; color: #38bdf8; font-variant-numeric: tabular-nums; margin-bottom: 0.5rem; }
          .loading-text { color: #64748b; font-size: 14px; font-weight: 500; }
          
          .loader-bar { width: 100%; height: 4px; background: #334155; border-radius: 2px; overflow: hidden; margin-top: 1rem; }
          .loader-progress { width: 30%; height: 100%; background: #38bdf8; animation: slide 1.5s infinite ease-in-out; }
          
          @keyframes slide {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(300%); }
          }
        </style>
      </head>
      <body>
        <div class="panel">
          <div class="indicator-group">
            <div id="statusDot" class="dot"></div>
            <span id="statusText" class="status-text">Disconnected</span>
          </div>
          
          <h2>Fuzzy Search Explorer</h2>
          
          <div class="button-group">
            <button id="startButton" class="start">Start Server</button>
            <button id="stopButton" class="stop" disabled>Stop Server</button>
          </div>

          <div id="loadingArea" class="loading-area">
            <div id="timer" class="timer">0.0s</div>
            <div class="loading-text">Optimizing & Compiling...</div>
            <div class="loader-bar">
              <div class="loader-progress"></div>
            </div>
          </div>
        </div>
        
        <script>
          const startBtn = document.getElementById('startButton');
          const stopBtn = document.getElementById('stopButton');
          const statusDot = document.getElementById('statusDot');
          const statusText = document.getElementById('statusText');
          const loadingArea = document.getElementById('loadingArea');
          const timerDisplay = document.getElementById('timer');

          let startTime = 0;
          let timerInterval = null;
          let isCompiling = false;

          function startTimer() {
            startTime = Date.now();
            loadingArea.style.display = 'block';
            timerInterval = setInterval(() => {
              const elapsed = (Date.now() - startTime) / 1000;
              timerDisplay.innerText = elapsed.toFixed(1) + 's';
            }, 100);
          }

          function stopTimer() {
            clearInterval(timerInterval);
            loadingArea.style.display = 'none';
          }

          async function updateDashboard() {
            try {
              const res = await fetch('/status');
              const data = await res.json();
              
              if (data.running) {
                statusDot.className = 'dot running';
                statusText.innerText = 'Online';
                startBtn.disabled = true;
                stopBtn.disabled = false;
              } else {
                statusDot.className = 'dot stopped';
                statusText.innerText = 'Offline';
                startBtn.disabled = false;
                stopBtn.disabled = true;
                if (!isCompiling) stopTimer();
              }
            } catch (e) {}
          }

          startBtn.onclick = async () => {
            isCompiling = true;
            startBtn.disabled = true;
            startTimer();
            await fetch('/start');
            
            let attempts = 0;
            const checkInterval = setInterval(async () => {
              attempts++;
              const res = await fetch('/check-port?trigger=true');
              const data = await res.json();
              
              if (data.available) {
                clearInterval(checkInterval);
                isCompiling = false;
                stopTimer();
                statusText.innerText = 'Ready!';
              } else if (attempts > 120) {
                clearInterval(checkInterval);
                isCompiling = false;
                stopTimer();
                alert('Startup timed out.');
              }
            }, 1000);
          };

          stopBtn.onclick = async () => {
            await fetch('/stop');
            updateDashboard();
          };

          setInterval(updateDashboard, 1000);
          updateDashboard();
        </script>
      </body>
      </html>
    `);
  } else if (req.url === '/start') {
    if (!devProcess) {
      projectLogs = ["Starting Next.js..."];
      hasOpenedBrowser = false;
      // Use npm run dev which now calls our cross-platform scripts/dev.mjs
      devProcess = spawn('npm', ['run', 'dev'], { 
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32'
      });

      devProcess.stdout.on('data', (data) => {
        const text = data.toString();
        process.stdout.write(text);
        
        projectLogs.push(text.trim());
        if (projectLogs.length > 50) projectLogs.shift();

        const portMatch = text.match(/http:\/\/localhost:(\d+)/);
        if (portMatch) {
          allocatedPort = parseInt(portMatch[1]);
        }
      });

      devProcess.stderr.on('data', (data) => {
        const text = data.toString();
        projectLogs.push("Error: " + text.trim());
      });

      devProcess.on('exit', () => {
        devProcess = null;
        projectLogs.push("Process stopped.");
      });
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } else if (req.url === '/stop') {
    if (devProcess) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', devProcess.pid, '/f', '/t'], { shell: true });
      } else {
        try {
          process.kill(-devProcess.pid);
        } catch (e) {
          devProcess.kill();
        }
      }
      devProcess = null;
      projectLogs.push("Process tree terminated.");
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
  } else if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ running: !!devProcess, logs: projectLogs }));
  } else if (req.url?.startsWith('/check-port')) {
    const urlParams = new URL(req.url, `http://localhost:${DASHBOARD_PORT}`).searchParams;
    const trigger = urlParams.get('trigger') === 'true';
    
    let available = await isPortOpen(allocatedPort);
    if (available && trigger && !hasOpenedBrowser) {
        hasOpenedBrowser = true;
        openBrowser(`http://localhost:${allocatedPort}`);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ available, url: `http://localhost:${allocatedPort}` }));
  }
});

server.listen(DASHBOARD_PORT, () => {
  console.log(`Launcher dashboard running at http://localhost:${DASHBOARD_PORT}`);
  openBrowser(`http://localhost:${DASHBOARD_PORT}`);
});
