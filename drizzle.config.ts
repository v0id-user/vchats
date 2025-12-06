import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schemas/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: "0b572acb-fb3f-46d4-a112-c7cc03aaa85d",
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
});
