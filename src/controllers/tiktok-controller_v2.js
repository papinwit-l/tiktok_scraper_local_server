const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

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

const scrollPage = async (page, maxScroll = 10, delay = 600) => {
  for (let i = 0; i < maxScroll; i++) {
    await page.evaluate(() => window.scrollBy(0, 300));
    await new Promise((r) => setTimeout(r, delay));
  }
};

module.exports.getPostsFromTags = async (req, res, next) => {
  try {
    const { tags } = req.body;
    const browser = await puppeteer.launch({
      headless: false,
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

    const url = `https://www.tiktok.com/tag/${tags}`;
    await page.goto(url);

    await page.waitForSelector("p.user-name");

    await scrollPage(page, 10, 600);

    const data = await page.evaluate(() => {
      const postsEl = document.querySelector('[data-e2e="challenge-vvcount"]');
      const posts = postsEl ? postsEl.textContent.trim() : null;

      let postsNumber = 0;
      const postsText = posts && posts.split(" ")[0];
      if (postsText) {
        const num = parseFloat(postsText.replace(/[KMB]/g, ""));
        if (postsText.includes("K")) postsNumber = num * 1e3;
        else if (postsText.includes("M")) postsNumber = num * 1e6;
        else if (postsText.includes("B")) postsNumber = num * 1e9;
        else postsNumber = num;
      }

      const userElements = document.querySelectorAll(
        '[data-e2e="challenge-item-username"], p.user-name'
      );
      const userList = Array.from(userElements).map((el) =>
        el.textContent.trim()
      );

      const userPicElements = document.querySelectorAll('[loading="lazy"]');
      const userPicList = Array.from(userPicElements).map(
        (el) => el.getAttribute("src") || ""
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
