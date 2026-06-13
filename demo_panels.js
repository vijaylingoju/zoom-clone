/**
 * Playwright demo: shows opening Chat and Participants panels in the meeting room.
 * Run: node demo_panels.js
 */

const { chromium } = require("playwright");

const FRONTEND    = "http://localhost:3010";
const BACKEND     = "http://localhost:8010";

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  let MEETING_CODE, HOST_KEY;
  try {
    const res = await fetch(`${BACKEND}/api/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meeting_type: "instant", use_pmi: false })
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    MEETING_CODE = data.meeting_code;
    HOST_KEY = data.host_key;
    console.log(`✅ Created dynamic meeting: ${MEETING_CODE} with host key: ${HOST_KEY}`);
  } catch (err) {
    console.warn("⚠️ Failed to create dynamic meeting, using fallbacks:", err.message);
    MEETING_CODE = "ckk-gqdg-p9h";
    HOST_KEY    = "019ec038-26f0-748e-9749-bbdf69217f77";
  }

  const browser = await chromium.launch({
    headless: false,
    executablePath: "/usr/bin/google-chrome",
    args: [
      "--use-fake-ui-for-media-stream",     // auto-grant camera/mic
      "--use-fake-device-for-media-stream", // virtual device, no real hw needed
      "--no-sandbox",
    ],
  });

  const ctx = await browser.newContext({
    permissions: ["camera", "microphone"],
    viewport:    { width: 1400, height: 900 },
  });

  const page = await ctx.newPage();

  // Log console and errors from browser
  page.on("console", (msg) => {
    console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
  });
  page.on("pageerror", (err) => {
    console.error(`[BROWSER ERROR] ${err.stack}`);
  });
  page.on("requestfailed", (req) => {
    console.error(`[BROWSER REQ FAILED] ${req.method()} ${req.url()}: ${req.failure()?.errorText || "unknown error"}`);
  });

  // ── 1. Inject host key, then navigate to the meeting ──────────────────────
  await page.goto(`${FRONTEND}/meeting/${MEETING_CODE}`, { waitUntil: "domcontentloaded" });

  await page.evaluate(
    ({ code, key }) => localStorage.setItem(`zc_host_key_${code}`, key),
    { code: MEETING_CODE, key: HOST_KEY }
  );

  // Reload now that the host key is in localStorage
  await page.goto(`${FRONTEND}/meeting/${MEETING_CODE}`, { waitUntil: "domcontentloaded" });
  await sleep(4000); // let React render the initial stage

  console.log("✅ Step 1 — Page loaded");
  await page.screenshot({ path: "/tmp/demo_01_loaded.png" });

  // ── 2. Click "Use microphone and camera" (permission stage) ───────────────
  const camBtn = page.locator("button", { hasText: /use microphone and camera/i });
  const isVisible = await camBtn.isVisible().catch(() => false);
  if (isVisible) {
    await camBtn.click();
    console.log("   Clicked 'Use microphone and camera'");
  } else {
    // Maybe already at the "joining" or another stage — click whatever is there
    console.log("   Permission button not visible, checking current stage...");
    await page.screenshot({ path: "/tmp/demo_01b_stage.png" });
  }

  await sleep(3000); // wait for joining + WebRTC

  console.log("✅ Step 2 — In meeting room");
  await page.screenshot({ path: "/tmp/demo_02_room.png" });

  // ── 3. Move mouse to reveal control bar ───────────────────────────────────
  await page.mouse.move(700, 800);
  await sleep(600);

  // ── 4. Open PARTICIPANTS ──────────────────────────────────────────────────
  // Try exact button text first, then fallback to aria-label
  let participantsBtn = page.locator("button").filter({ hasText: /^Participants$/i });
  let btnVisible = await participantsBtn.isVisible().catch(() => false);
  if (!btnVisible) {
    participantsBtn = page.locator("[aria-label*='Participants' i]");
    btnVisible = await participantsBtn.isVisible().catch(() => false);
  }

  if (btnVisible) {
    await participantsBtn.first().click();
    await sleep(1500);
    console.log("✅ Step 3 — Participants panel opened");
    await page.screenshot({ path: "/tmp/demo_03_participants.png" });

    // Close participants
    const closeBtn = page.locator("button[aria-label='Close participants panel']");
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
      await sleep(600);
    }
  } else {
    console.log("   ⚠️  Participants button not found, screenshotting page for debug");
    await page.screenshot({ path: "/tmp/demo_03_debug.png" });
  }

  // ── 5. Open CHAT ──────────────────────────────────────────────────────────
  await page.mouse.move(700, 800);
  await sleep(600);

  let chatBtn = page.locator("button").filter({ hasText: /^Chat$/i });
  let chatVisible = await chatBtn.isVisible().catch(() => false);
  if (!chatVisible) {
    chatBtn = page.locator("[aria-label*='Chat' i]");
    chatVisible = await chatBtn.isVisible().catch(() => false);
  }

  if (chatVisible) {
    await chatBtn.first().click();
    await sleep(1500);
    console.log("✅ Step 4 — Chat panel opened");
    await page.screenshot({ path: "/tmp/demo_04_chat.png" });

    // Type a message
    const input = page.locator("input[aria-label='Chat message'], textarea[aria-label='Chat message']");
    if (await input.isVisible().catch(() => false)) {
      await input.fill("Hello from the demo! 👋");
      await input.press("Enter");
      await sleep(800);
      console.log("✅ Step 5 — Message sent");
      await page.screenshot({ path: "/tmp/demo_05_message_sent.png" });
    }

    // Close chat
    const closeChat = page.locator("button[aria-label='Close chat panel']");
    if (await closeChat.isVisible().catch(() => false)) {
      await closeChat.click();
      await sleep(600);
    }
  } else {
    console.log("   ⚠️  Chat button not found, screenshotting page for debug");
    await page.screenshot({ path: "/tmp/demo_04_debug.png" });
  }

  // ── 6. Final: open both quickly for a side-by-side overview ──────────────
  await page.mouse.move(700, 800);
  await sleep(400);
  if (btnVisible) {
    await participantsBtn.first().click();
    await sleep(1000);
  }
  await page.screenshot({ path: "/tmp/demo_06_final.png" });

  console.log("\n📸 Screenshots saved:");
  console.log("   /tmp/demo_01_loaded.png       — Landing (permission / lobby)");
  console.log("   /tmp/demo_02_room.png          — Inside room");
  console.log("   /tmp/demo_03_participants.png  — Participants panel on RIGHT");
  console.log("   /tmp/demo_04_chat.png          — Chat panel on RIGHT");
  console.log("   /tmp/demo_05_message_sent.png  — Chat message sent");
  console.log("   /tmp/demo_06_final.png         — Final view");

  await sleep(2000);
  await browser.close();
})();
