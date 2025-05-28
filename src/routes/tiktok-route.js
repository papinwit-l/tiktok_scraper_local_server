const express = require("express");
const tiktokRoute = express.Router();

const tiktokController = require("../controllers/tiktok-controller");

tiktokRoute.post("/get-posts-tags", tiktokController.getPostsFromTags);
tiktokRoute.post("/get-user-info", tiktokController.getUserInfo);

module.exports = tiktokRoute;
