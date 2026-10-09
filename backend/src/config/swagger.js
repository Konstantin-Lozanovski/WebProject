import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Pickup Game Organizer API",
      version: "1.0.0",
      description: "REST API for creating and joining pickup sports games",
    },
    // Shared pieces that the route comments point to with $ref
    components: {
      // Adds the Authorize button to Swagger UI, where the token is pasted
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            _id: { type: "string", example: "66f1c0a4e3b2a1d4c5f6a7b8" },
            username: { type: "string", example: "marko_7" },
            email: { type: "string", example: "marko@example.com" },
            role: { type: "string", enum: ["user", "admin"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            user: { $ref: "#/components/schemas/User" },
            token: { type: "string" },
          },
        },
        Error: {
          type: "object",
          properties: {
            msg: { type: "string", example: "This email is already taken" },
            fields: {
              type: "object",
              description: "Only on some errors: one message per invalid field",
              example: { email: "This email is already taken" },
            },
          },
        },
      },
    },
  },
  // swagger-jsdoc reads the @openapi comments above the routes in these files.
  // The path is relative to the folder the server is started from (backend/).
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
