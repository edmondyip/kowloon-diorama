import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import { build } from 'vite';
import * as fs from 'fs';
import * as path from 'path';

interface ImageDiffStats {
  name: string;
  width: number;
  height: number;
  meanAbsDiffRgb: number;
  pctPixelsWithinThreshold: number;
}

describe('Real-Browser Smoke, Baseline Capture & Visual Parity (Kowloon Diorama)', () => {
  let browser: Browser;
  let page: Page;
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  const projectRoot = path.resolve(__dirname, '..');
  const distDir = path.join(projectRoot, 'dist');
  const screenshotsDir = path.join(projectRoot, 'docs/screenshots');

  beforeAll(async () => {
    fs.mkdirSync(path.join(screenshotsDir, 'migrated'), { recursive: true });
    fs.mkdirSync(path.join(screenshotsDir, 'baseline'), { recursive: true });

    // Ensure production dist is built
    await build({
      root: projectRoot,
      logLevel: 'silent'
    });

    browser = await chromium.launch({
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      args: ['--headless=new', '--use-gl=angle', '--ignore-gpu-blocklist']
    });

    page = await browser.newPage({
      viewport: { width: 1280, height: 800 }
    });

    // Serve dist/ and prototype/ via Playwright route interception
    await page.route('http://kowloon.local/**', async (route) => {
      const url = new URL(route.request().url());
      let relPath = url.pathname === '/' ? '/index.html' : url.pathname;
      const fullPath = path.join(distDir, relPath);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath);
        const contentType =
          ext === '.html'
            ? 'text/html; charset=utf-8'
            : ext === '.js'
              ? 'application/javascript; charset=utf-8'
              : ext === '.css'
                ? 'text/css; charset=utf-8'
                : 'application/octet-stream';
        await route.fulfill({
          status: 200,
          contentType,
          body: fs.readFileSync(fullPath)
        });
      } else {
        await route.fulfill({ status: 404, body: 'Not found' });
      }
    });

    await page.route('http://prototype.local/**', async (route) => {
      const protoHtml = fs.readFileSync(
        path.join(projectRoot, 'prototype/index.original.html'),
        'utf-8'
      );
      await route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: protoHtml
      });
    });

    // Intercept the CDN Three.js script in prototype.local so the unmodified prototype HTML runs offline
    const threeUmdBundle = (() => {
      const threeCjs = fs.readFileSync(
        path.join(projectRoot, 'node_modules/three/build/three.cjs'),
        'utf-8'
      );
      return `
        (function() {
          const exports = {};
          const module = { exports };
          ${threeCjs}
          window.THREE = Object.assign({}, module.exports);
          if (window.THREE.ColorManagement) {
            window.THREE.ColorManagement.enabled = false;
          }
          const OrigPointLight = window.THREE.PointLight;
          window.THREE.PointLight = function(color, intensity, distance, decay) {
            return new OrigPointLight(color, intensity, distance, decay !== undefined ? decay : 1);
          };
          window.THREE.PointLight.prototype = OrigPointLight.prototype;
        })();
      `;
    })();

    await page.route('https://cdnjs.cloudflare.com/ajax/libs/three.js/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body: threeUmdBundle
      });
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
  }, 30000);

  afterAll(async () => {
    if (page) await page.close();
    if (browser) await browser.close();
  });

  async function captureReferenceStates(targetUrl: string, subDir: 'baseline' | 'migrated') {
    await page.goto(targetUrl, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__KOWLOON_DIORAMA__));
    await page.waitForTimeout(200);

    // Helper to freeze deterministic resident state and wait for camera/cutaway settle
    const setDetState = async (opts: {
      slice: 'all' | '1' | '2';
      theme: 'day' | 'night';
      pixel: 1 | 2 | 3;
      stateIndex: number;
      waypointIndex: number;
      pos: [number, number, number];
      yaw: number;
      pauseTimer: number;
    }) => {
      await page.evaluate((o) => {
        const k = window.__KOWLOON_DIORAMA__!;
        k.setTheme(o.theme);
        k.setPixelScale(o.pixel);
        k.setSliceMode(o.slice);
        k.setSimSpeed(0); // Freeze autonomous movement for deterministic frame comparison
        k.agent.stateIndex = o.stateIndex;
        k.agent.waypointIndex = o.waypointIndex;
        k.agent.pos.set(o.pos[0], o.pos[1], o.pos[2]);
        k.agent.yaw = o.yaw;
        k.agent.pauseTimer = o.pauseTimer;
        k.agent.animTime = 1.0;
      }, opts);
      await page.waitForTimeout(650);
    };

    // 1. Day Paper, all floors
    await setDetState({
      slice: 'all',
      theme: 'day',
      pixel: 2,
      stateIndex: 0,
      waypointIndex: 0,
      pos: [0.0, 0.0, 2.7],
      yaw: 0,
      pauseTimer: 0.1
    });
    await page.screenshot({ path: path.join(screenshotsDir, subDir, '01-day-all-floors.png') });

    // 2. Night Neon, all floors
    await setDetState({
      slice: 'all',
      theme: 'night',
      pixel: 2,
      stateIndex: 0,
      waypointIndex: 0,
      pos: [0.0, 0.0, 2.7],
      yaw: 0,
      pauseTimer: 0.1
    });
    await page.screenshot({ path: path.join(screenshotsDir, subDir, '02-night-all-floors.png') });

    // 3. Day Paper, 1F sliced
    await setDetState({
      slice: '1',
      theme: 'day',
      pixel: 2,
      stateIndex: 0,
      waypointIndex: 0,
      pos: [0.0, 0.0, 2.7],
      yaw: 0,
      pauseTimer: 0.1
    });
    await page.screenshot({ path: path.join(screenshotsDir, subDir, '03-day-1f-sliced.png') });

    // 4. Day Paper, 2F sliced
    await setDetState({
      slice: '2',
      theme: 'day',
      pixel: 2,
      stateIndex: 0,
      waypointIndex: 0,
      pos: [0.0, 0.0, 2.7],
      yaw: 0,
      pauseTimer: 0.1
    });
    await page.screenshot({ path: path.join(screenshotsDir, subDir, '04-day-2f-sliced.png') });

    // 5. Pixel Scale 1px, 2px, 3px
    await setDetState({
      slice: 'all',
      theme: 'day',
      pixel: 1,
      stateIndex: 0,
      waypointIndex: 0,
      pos: [0.0, 0.0, 2.7],
      yaw: 0,
      pauseTimer: 0.1
    });
    await page.screenshot({ path: path.join(screenshotsDir, subDir, '05-pixel-scale-1px.png') });

    await setDetState({
      slice: 'all',
      theme: 'day',
      pixel: 2,
      stateIndex: 0,
      waypointIndex: 0,
      pos: [0.0, 0.0, 2.7],
      yaw: 0,
      pauseTimer: 0.1
    });
    await page.screenshot({ path: path.join(screenshotsDir, subDir, '06-pixel-scale-2px.png') });

    await setDetState({
      slice: 'all',
      theme: 'day',
      pixel: 3,
      stateIndex: 0,
      waypointIndex: 0,
      pos: [0.0, 0.0, 2.7],
      yaw: 0,
      pauseTimer: 0.1
    });
    await page.screenshot({ path: path.join(screenshotsDir, subDir, '07-pixel-scale-3px.png') });

    // 6. Resident working on 1F (1F sliced so workbench & sparks are clearly visible)
    await setDetState({
      slice: '1',
      theme: 'day',
      pixel: 2,
      stateIndex: 2,
      waypointIndex: 0,
      pos: [-0.92, 0.24, -0.58],
      yaw: Math.PI,
      pauseTimer: 1.0
    });
    await page.screenshot({ path: path.join(screenshotsDir, subDir, '08-resident-working-1f.png') });

    // 7. Resident climbing or resting on 2F (2F sliced so 2F loft is clearly visible)
    await setDetState({
      slice: '2',
      theme: 'day',
      pixel: 2,
      stateIndex: 3,
      waypointIndex: 5,
      pos: [-0.85, 2.56, 1.22],
      yaw: 0.0,
      pauseTimer: 1.0
    });
    await page.screenshot({ path: path.join(screenshotsDir, subDir, '09-resident-resting-2f.png') });

    // Restore simSpeed = 1 and slice = 'all'
    await page.evaluate(() => {
      const k = window.__KOWLOON_DIORAMA__!;
      k.setSimSpeed(1);
      k.setSliceMode('all');
    });
  }

  it('captures baseline reference screenshots from prototype/index.original.html', async () => {
    await captureReferenceStates('http://prototype.local/index.html', 'baseline');
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  }, 25000);

  it('captures migrated application screenshots and verifies all interactive features', async () => {
    await captureReferenceStates('http://kowloon.local/index.html', 'migrated');
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);

    // Verify interactive buttons & raycast floor clicking on migrated app
    await page.click('button[data-theme="night"]');
    expect(await page.evaluate(() => window.__KOWLOON_DIORAMA__!.CONFIG.theme)).toBe('night');
    await page.click('button[data-theme="day"]');
    expect(await page.evaluate(() => window.__KOWLOON_DIORAMA__!.CONFIG.theme)).toBe('day');

    await page.click('button[data-slice="1"]');
    expect(await page.evaluate(() => window.__KOWLOON_DIORAMA__!.CONFIG.sliceMode)).toBe('1');
    expect(await page.evaluate(() => window.__KOWLOON_DIORAMA__!.FloorGroup_2.visible)).toBe(false);

    // Click empty ground to reset slice mode to 'all'
    await page.mouse.click(80, 400);
    expect(await page.evaluate(() => window.__KOWLOON_DIORAMA__!.CONFIG.sliceMode)).toBe('all');
    expect(await page.evaluate(() => window.__KOWLOON_DIORAMA__!.FloorGroup_2.visible)).toBe(true);

    // Click center of shack to slice floor via raycasting
    await page.mouse.click(640, 400);
    const raycastSlice = await page.evaluate(() => window.__KOWLOON_DIORAMA__!.CONFIG.sliceMode);
    expect(['1', '2']).toContain(raycastSlice);

    // Reset to all floors
    await page.click('button[data-slice="all"]');
    expect(await page.evaluate(() => window.__KOWLOON_DIORAMA__!.CONFIG.sliceMode)).toBe('all');

    // Orbit drag and wheel zoom
    await page.mouse.move(640, 400);
    await page.mouse.down();
    await page.mouse.move(710, 420, { steps: 4 });
    await page.mouse.up();
    await page.mouse.wheel(0, -100);

    // Resize
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(100);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(100);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  }, 25000);

  it('compares baseline and migrated screenshots for visual parity', async () => {
    const files = [
      '01-day-all-floors.png',
      '02-night-all-floors.png',
      '03-day-1f-sliced.png',
      '04-day-2f-sliced.png',
      '05-pixel-scale-1px.png',
      '06-pixel-scale-2px.png',
      '07-pixel-scale-3px.png',
      '08-resident-working-1f.png',
      '09-resident-resting-2f.png'
    ];

    const comparisons: ImageDiffStats[] = [];

    for (const file of files) {
      const baseB64 = fs.readFileSync(path.join(screenshotsDir, 'baseline', file)).toString('base64');
      const migB64 = fs.readFileSync(path.join(screenshotsDir, 'migrated', file)).toString('base64');

      const diff = await page.evaluate(
        async ({ b1, b2, name }) => {
          const loadImg = (b64: string): Promise<HTMLImageElement> =>
            new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = reject;
              img.src = `data:image/png;base64,${b64}`;
            });

          const [img1, img2] = await Promise.all([loadImg(b1), loadImg(b2)]);
          const w = img1.width;
          const h = img1.height;
          const c1 = document.createElement('canvas');
          const c2 = document.createElement('canvas');
          c1.width = c2.width = w;
          c1.height = c2.height = h;
          const ctx1 = c1.getContext('2d')!;
          const ctx2 = c2.getContext('2d')!;
          ctx1.drawImage(img1, 0, 0);
          ctx2.drawImage(img2, 0, 0);
          const d1 = ctx1.getImageData(0, 0, w, h).data;
          const d2 = ctx2.getImageData(0, 0, w, h).data;

          let sumAbsDiff = 0;
          let matchingPixels = 0;
          const totalPixels = w * h;

          for (let i = 0; i < d1.length; i += 4) {
            const dr = Math.abs(d1[i] - d2[i]);
            const dg = Math.abs(d1[i + 1] - d2[i + 1]);
            const db = Math.abs(d1[i + 2] - d2[i + 2]);
            sumAbsDiff += (dr + dg + db) / 3;
            if (dr <= 8 && dg <= 8 && db <= 8) {
              matchingPixels++;
            }
          }

          return {
            name,
            width: w,
            height: h,
            meanAbsDiffRgb: Number((sumAbsDiff / totalPixels).toFixed(4)),
            pctPixelsWithinThreshold: Number(((matchingPixels / totalPixels) * 100).toFixed(2))
          };
        },
        { b1: baseB64, b2: migB64, name: file }
      );

      comparisons.push(diff);
    }

    fs.writeFileSync(
      path.join(screenshotsDir, 'parity-report.json'),
      JSON.stringify(comparisons, null, 2)
    );

    for (const diff of comparisons) {
      expect(diff.width).toBe(1280);
      expect(diff.height).toBe(800);
      expect(diff.pctPixelsWithinThreshold).toBeGreaterThan(97.0);
    }
  }, 20000);
});
