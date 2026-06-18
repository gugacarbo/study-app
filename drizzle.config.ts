import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema',
  out: './migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
});
