import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "../config/swagger.js";

const router = express.Router();

// The generated OpenAPI file itself
router.get("/swagger.json", (req, res) => {
  res.json(swaggerSpec);
});

// The page where the API can be read and tried out
router.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

export default router;
