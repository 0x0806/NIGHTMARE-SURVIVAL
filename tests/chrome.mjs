// Shared helpers: find a Chrome/Chromium binary and launch it with software WebGL enabled.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

export function chromePath() {
  const c = [process.env.CHROME_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'];
  const found = c.find((p) => p && fs.existsSync(p));
  if (!found) throw new Error('No Chrome/Chromium found. Set CHROME_PATH to a browser binary.');
  return found;
}
export const launch = () => puppeteer.launch({
  executablePath: chromePath(), headless: 'new',
  args: ['--no-sandbox', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
