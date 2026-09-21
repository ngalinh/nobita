/**
 * Smoke: scrape sample URL rồi gửi đơn nếu còn hàng
 * Yêu cầu server đang chạy: npm start
 */
const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto("http://localhost:3847");

  await page.getByTestId("product-url").fill("http://localhost:3847/sample/ao-thun.html");
  await page.getByTestId("btn-scrape").click();
  await page.getByTestId("scrape-status").filter({ hasText: "OK" }).waitFor({ timeout: 60000 });

  const decision = page.getByTestId("agent-decision");
  await decision.waitFor();
  const state = await decision.getAttribute("data-state");
  console.log("decision:", state, await decision.innerText());

  if (state === "send") {
    await page.getByTestId("btn-send").click();
    console.log("Đã gửi đơn sau scrape.");
  }

  await page.waitForTimeout(1200);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
