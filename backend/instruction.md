npm run dev — Starts your server and watches for changes.

npm run build — Compiles TypeScript into JavaScript.

npm start — Runs the compiled production server.


#phase 1

npm i envalid
envalid validates environment variables. It can check:
- Whether required variables exist.
- Whether PORT is a valid number.
- Whether NODE_ENV has an allowed value.
- Whether configuration is missing.



env.ts — validates environment variables.
db.ts — handles MongoDB connections.
logger.ts — handles application logging through Pino.