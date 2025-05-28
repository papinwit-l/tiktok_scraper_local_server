const puppeteer = require("puppeteer");

const addToDatabase = async (posts, tags, userInfo) => {
  const uniqueUserInfo = [
    ...new Map(userInfo.map((item) => [item.username, item])).values(),
  ];

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

module.exports.getPostsFromTags = async (req, res, next) => {
  try {
    const { tags } = req.body;

    // Validate tags to prevent injection issues
    if (!tags || typeof tags !== "string") {
      return res.status(400).json({ error: "Invalid tags parameter" });
    }

    // Encode the tag for safe URL usage
    const encodedTag = encodeURIComponent(tags);

    const browser = await puppeteer.launch({
      headless: false, // Debug mode
      slowMo: 30,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1366, height: 768 });

    // Use the properly encoded tag in the URL
    const url = `https://www.tiktok.com/tag/${encodedTag}`;
    console.log(`Navigating to: ${url}`);

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page
      .waitForSelector("p.user-name", { timeout: 60000 })
      .catch((error) => {
        console.log("Could not find user-name element, continuing anyway");
      });

    // Now extract data
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
      const totalScrolllHeight = totalRows * rowHeight;
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

    res.json({ data, finalData });
  } catch (error) {
    console.error("Scraping error:", error);
    next(error);
  }
};
