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
        Game: {
          type: "object",
          properties: {
            _id: { type: "string", example: "66f1c0a4e3b2a1d4c5f6a7b9" },
            organizer: {
              type: "object",
              properties: {
                _id: { type: "string", example: "66f1c0a4e3b2a1d4c5f6a7b8" },
                username: { type: "string", example: "marko_7" },
              },
            },
            sport: {
              type: "string",
              enum: ["Football", "Basketball", "Volleyball", "Tennis", "Padel"],
            },
            city: { type: "string", example: "Skopje" },
            venue: {
              type: "string",
              example: "Sports Center Boris Trajkovski, pitch 2",
            },
            startTime: { type: "string", format: "date-time" },
            duration: { type: "integer", enum: [60, 90, 120] },
            maxPlayers: { type: "integer", example: 10 },
            notes: { type: "string", example: "Bring a white and a dark shirt." },
            status: {
              type: "string",
              enum: ["upcoming", "in progress", "finished"],
              description: "Calculated from the current time, not stored",
            },
            playerCount: {
              type: "integer",
              description: "How many players the game has, the organizer included",
              example: 7,
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Player: {
          type: "object",
          properties: {
            _id: { type: "string", example: "66f1c0a4e3b2a1d4c5f6a7ba" },
            user: {
              type: "object",
              properties: {
                _id: { type: "string", example: "66f1c0a4e3b2a1d4c5f6a7b8" },
                username: { type: "string", example: "marko_7" },
              },
            },
            game: { type: "string", example: "66f1c0a4e3b2a1d4c5f6a7b9" },
            team: { type: "string", enum: ["A", "B", "unassigned"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        JoinRequest: {
          type: "object",
          properties: {
            _id: { type: "string", example: "66f1c0a4e3b2a1d4c5f6a7bb" },
            user: {
              type: "object",
              properties: {
                _id: { type: "string", example: "66f1c0a4e3b2a1d4c5f6a7b8" },
                username: { type: "string", example: "marko_7" },
              },
            },
            game: { type: "string", example: "66f1c0a4e3b2a1d4c5f6a7b9" },
            state: { type: "string", enum: ["pending", "accepted", "declined"] },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Message: {
          type: "object",
          properties: {
            _id: { type: "string", example: "66f1c0a4e3b2a1d4c5f6a7bc" },
            user: {
              type: "object",
              properties: {
                _id: { type: "string", example: "66f1c0a4e3b2a1d4c5f6a7b8" },
                username: { type: "string", example: "marko_7" },
              },
            },
            game: { type: "string", example: "66f1c0a4e3b2a1d4c5f6a7b9" },
            text: { type: "string", example: "Pitch is booked from 18:00." },
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
