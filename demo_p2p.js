const { chromium } = require("playwright");

const FRONTEND = "http://localhost:3010";
const BACKEND  = "http://localhost:8010";

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

(async () => {
  // 1. Create a dynamic meeting
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
    console.log(`✅ Created meeting: ${MEETING_CODE}`);
  } catch (err) {
    console.error("Failed to create meeting:", err);
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: false,
    executablePath: "/usr/bin/google-chrome",
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--no-sandbox",
    ],
  });

  // Host Context
  const hostCtx = await browser.newContext({
    permissions: ["camera", "microphone"],
    viewport: { width: 800, height: 600 },
  });
  const hostPage = await hostCtx.newPage();
  hostPage.on("console", msg => console.log(`[HOST CONSOLE] ${msg.type()}: ${msg.text()}`));
  hostPage.on("pageerror", err => console.error(`[HOST ERROR] ${err.stack}`));
  hostPage.on("requestfailed", req => console.error(`[HOST REQ FAILED] ${req.method()} ${req.url()}: ${req.failure()?.errorText || "unknown error"}`));
  hostPage.on("response", res => {
    if (res.status() >= 400) console.error(`[HOST REQ ERROR] ${res.status()} ${res.url()}`);
  });

  // Guest Context
  const guestCtx = await browser.newContext({
    permissions: ["camera", "microphone"],
    viewport: { width: 800, height: 600 },
  });
  const guestPage = await guestCtx.newPage();
  guestPage.on("console", msg => console.log(`[GUEST CONSOLE] ${msg.type()}: ${msg.text()}`));
  guestPage.on("pageerror", err => console.error(`[GUEST ERROR] ${err.stack}`));
  guestPage.on("requestfailed", req => console.error(`[GUEST REQ FAILED] ${req.method()} ${req.url()}: ${req.failure()?.errorText || "unknown error"}`));
  guestPage.on("response", res => {
    if (res.status() >= 400) console.error(`[GUEST REQ ERROR] ${res.status()} ${res.url()}`);
  });

  // ── 2. Host Joins ──────────────────────────────────────────────────────────
  console.log("🚀 Host joining...");
  await hostPage.goto(`${FRONTEND}/meeting/${MEETING_CODE}`, { waitUntil: "domcontentloaded" });
  await hostPage.evaluate(
    ({ code, key }) => localStorage.setItem(`zc_host_key_${code}`, key),
    { code: MEETING_CODE, key: HOST_KEY }
  );
  await hostPage.goto(`${FRONTEND}/meeting/${MEETING_CODE}`, { waitUntil: "domcontentloaded" });
  await sleep(2000);
  const hostCamBtn = hostPage.locator("button", { hasText: /use microphone and camera/i });
  if (await hostCamBtn.isVisible()) {
    await hostCamBtn.click();
  }
  await sleep(3000); // let host enter room
  await hostPage.screenshot({ path: "/tmp/p2p_host_entered.png" });
  console.log("✅ Host entered room");

  // ── 3. Guest Joins ─────────────────────────────────────────────────────────
  console.log("🚀 Guest joining...");
  await guestPage.goto(`${FRONTEND}/meeting/${MEETING_CODE}`, { waitUntil: "domcontentloaded" });
  await sleep(3000);
  await guestPage.screenshot({ path: "/tmp/p2p_guest_lobby_stage.png" });
  // Type name
  const nameInput = guestPage.locator("input[placeholder='Your name']");
  await nameInput.fill("Guest User");
  await guestPage.locator("button", { hasText: /continue/i }).click();
  await sleep(1500);
  // Grant permissions
  const guestCamBtn = guestPage.locator("button", { hasText: /use microphone and camera/i });
  if (await guestCamBtn.isVisible()) {
    await guestCamBtn.click();
  }
  await sleep(4000); // let guest enter room
  await guestPage.screenshot({ path: "/tmp/p2p_guest_entered.png" });
  console.log("✅ Guest entered room");

  // ── 4. Wait for P2P WebRTC Connection ──────────────────────────────────────
  console.log("⌛ Waiting for WebRTC connection...");
  await sleep(5000);

  await hostPage.screenshot({ path: "/tmp/p2p_host_final.png" });
  await guestPage.screenshot({ path: "/tmp/p2p_guest_final.png" });
  console.log("📸 Final screenshots saved");

  await browser.close();
})();
