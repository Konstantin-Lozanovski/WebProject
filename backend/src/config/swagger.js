import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Pickup Game Organizer API",
      version: "1.0.0",
      description: "REST API for creating and joining pickup sports games",
    },
  },
  // swagger-jsdoc reads the @openapi comments above the routes in these files.
  // The path is relative to the folder the server is started from (backend/).
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
