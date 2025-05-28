const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Function to detect Chrome executable path based on OS and architecture
const getChromeExecutablePath = () => {
  const platform = os.platform();
  const arch = os.arch();

  if (platform === "win32") {
    // Windows paths for both x64 and x86
    const chromePaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", // x64
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", // x86
      "C:\\Users\\%USERNAME%\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe", // User install
    ];

    // Check which Chrome installation exists
    for (const chromePath of chromePaths) {
      const expandedPath = chromePath.replace(
        "%USERNAME%",
        os.userInfo().username
      );
      if (fs.existsSync(expandedPath)) {
        return expandedPath;
      }
    }
  } else if (platform === "darwin") {
    // macOS paths
    const chromePaths = [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];

    for (const chromePath of chromePaths) {
      if (fs.existsSync(chromePath)) {
        return chromePath;
      }
    }
  } else if (platform === "linux") {
    // Linux paths
    const chromePaths = [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/snap/bin/chromium",
    ];

    for (const chromePath of chromePaths) {
      if (fs.existsSync(chromePath)) {
        return chromePath;
      }
    }
  }

  // If no Chrome found, return null to use Puppeteer's bundled Chromium
  console.warn(
    "No Chrome installation found, falling back to bundled Chromium"
  );
  return null;
};

// Common Puppeteer launch options
const getPuppeteerOptions = (headless = false) => {
  const chromeExecutablePath = getChromeExecutablePath();

  const baseOptions = {
    headless: headless,
    slowMo: 30,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-web-security",
      "--disable-features=VizDisplayCompositor",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  };

  // Add Chrome-specific options if Chrome is found
  if (chromeExecutablePath) {
    baseOptions.executablePath = chromeExecutablePath;
    baseOptions.channel = "chrome";
  }

  return baseOptions;
};

//prepare data to add to database
const addToDatabase = async (posts, tags, userInfo) => {
  const uniqueUserInfo = [
    ...new Map(userInfo.map((item) => [item.username, item])).values(),
  ];

  const postNumber = posts.split(" ")[0];

  const finalData = [];

  for (const user of uniqueUserInfo) {
    finalData.push({
      username: user.username,
      avatar: user.userAvatar,
      tiktok_src: `https://www.tiktok.com/@${user.username}`,
    });
  }
  return finalData;
};

const scrollPage = async (page, maxScroll = 5, delay = 500) => {
  for (let i = 0; i < maxScroll; i++) {
    await page.evaluate(() => {
      window.scrollBy(0, 300);
    });
    await new Promise((r) => setTimeout(r, delay));
  }
};

//get user from tiktok tag
module.exports.getPostsFromTags = async (req, res, next) => {
  try {
    const { tags } = req.body;

    const browser = await puppeteer.launch(getPuppeteerOptions(false));

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1366, height: 768 });

    const url = `https://www.tiktok.com/tag/${tags}`;
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 600000,
    });

    await page.waitForSelector("p.user-name", { timeout: 30000 });

    // Scroll from Node.js side (not inside page context)
    // await scrollPage(page, 10, 600);

    // Extract data (only synchronous function inside evaluate)
    const data = await page.evaluate(async () => {
      const postsEl = document.querySelector('[data-e2e="challenge-vvcount"]');
      const posts = postsEl ? postsEl.textContent.trim() : null;

      const postsText = posts && posts.split(" ")[0];
      // convert to number (140.2K => 140200, 5.4M => 5400000)
      let postsNumber = 0;
      if (postsText) {
        const num = parseFloat(postsText.replace(/[KMB]/g, ""));
        if (postsText.includes("K")) {
          postsNumber = num * 1000;
        } else if (postsText.includes("M")) {
          postsNumber = num * 1000000;
        } else if (postsText.includes("B")) {
          postsNumber = num * 1000000000;
        } else {
          postsNumber = num;
        }
      }

      const postsPerRow = 5;
      const rowHeight = 300;
      const totalRows = Math.ceil(postsNumber / postsPerRow);
      // const totalScrolllHeight = totalRows * rowHeight;
      const totalScrolllHeight = 75000000;
      const maxAttempts = 10;

      console.log("postsNumber: " + postsNumber);
      await new Promise((resolve) => {
        let totalHeight = 0;
        let attemps = 0;
        const distance = 300;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          const currentScrollHeight = document.documentElement.scrollHeight;

          if (currentScrollHeight >= totalScrolllHeight) {
            // if (currentScrollHeight >= 1000) {
            console.log("totalHeight: " + totalHeight);
            attemps = 0;
            clearInterval(timer);
            resolve();
          } else {
            if (currentScrollHeight < totalHeight) {
              totalHeight = currentScrollHeight;
              attemps++;
            } else {
              attemps = 0;
            }
          }

          if (attemps >= maxAttempts) {
            clearInterval(timer);
            resolve();
          }
        }, 500); // slow scroll to mimic human
      });

      // const postsEl = document.querySelector('[data-e2e="challenge-vvcount"]');
      // const posts = postsEl ? postsEl.textContent.trim() : null;

      const userElements = document.querySelectorAll(
        '[data-e2e="challenge-item-username"], p.user-name'
      );
      const userList = Array.from(userElements).map((el) =>
        el.textContent.trim()
      );

      const userPicElements = document.querySelectorAll('[loading="lazy"]');

      const userPicList = Array.from(userPicElements).map((el) =>
        el.getAttribute("src")
      );

      const userInfo = [];
      for (let i = 0; i < userList.length; i++) {
        userInfo.push({
          username: userList[i],
          userAvatar: userPicList[i],
        });
      }

      return { posts, userList, userPicList, postsNumber, userInfo };
    });

    await browser.close();

    const finalData = await addToDatabase(data.posts, tags, data.userInfo);

    console.log("finalData: ", finalData);

    res.json({ data, finalData });
  } catch (error) {
    console.error("Scraping error:", error);
    next(error);
  }
};

//get user info
module.exports.getUserInfo = async (req, res, next) => {
  try {
    const { username } = req.body;

    const browser = await puppeteer.launch(getPuppeteerOptions(true));

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto(`https://www.tiktok.com/@${username}`, {
      waitUntil: "networkidle2",
      timeout: 20000,
    });

    await page.waitForSelector(`[data-e2e="likes-count"]`, { timeout: 30000 });

    const data = await page.evaluate(async () => {
      const followingEl = document.querySelector(
        `[data-e2e="following-count"]`
      );
      const following = followingEl ? followingEl.textContent.trim() : null;

      const followersEl = document.querySelector(
        `[data-e2e="followers-count"]`
      );
      const followers = followersEl ? followersEl.textContent.trim() : null;

      const likesEl = document.querySelector(`[data-e2e="likes-count"]`);
      const likes = likesEl ? likesEl.textContent.trim() : null;

      return { following, followers, likes };
    });
    await browser.close();

    const userData = {
      ...data,
      username: username,
      tiktok_src: `https://www.tiktok.com/@${username}`,
    };

    console.log(`${username} => Get User Data`);
    res.json(userData);
  } catch (error) {
    console.log(error);
    next(error);
  }
};
