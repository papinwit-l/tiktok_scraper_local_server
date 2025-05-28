const jwt = require("jsonwebtoken");
const createError = require("../utils/createError");
const prisma = require("../config/prima");

module.exports.auth = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return createError(401, "unauthenticated");
    }
    const accessToken = authorization.split(" ")[1];
    if (accessToken === null) {
      return createError(401, "unauthenticated");
    }
    // verify access token
    const payload = jwt.verify(accessToken, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) {
      createError(401, "unauthenticated user not found");
    }

    //check user session
    const userSession = await prisma.userSession.findFirst({
      where: {
        user_id: user.id,
        token: accessToken,
      },
    });
    if (!userSession) {
      return createError(401, "unauthenticated");
    }

    delete user.password;
    req.user = user;
    next();
  } catch (error) {
    console.log(error);
    next(error);
  }
};
