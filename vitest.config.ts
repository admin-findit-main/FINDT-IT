import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@findit/types": path.resolve(__dirname, "./packages/types/src/index.ts"),
      "@findit/domain": path.resolve(__dirname, "./packages/domain/src/index.ts"),
      "@findit/domain/constants": path.resolve(
        __dirname,
        "./packages/domain/src/constants.ts"
      ),
      "@findit/domain/routing": path.resolve(
        __dirname,
        "./packages/domain/src/routing.ts"
      ),
      "@findit/domain/category-routing": path.resolve(
        __dirname,
        "./packages/domain/src/category-routing.ts"
      ),
      "@findit/domain/store-hours": path.resolve(
        __dirname,
        "./packages/domain/src/store-hours.ts"
      ),
      "@findit/domain/request-lifecycle": path.resolve(
        __dirname,
        "./packages/domain/src/request-lifecycle.ts"
      ),
      "@findit/domain/validations": path.resolve(
        __dirname,
        "./packages/domain/src/validations.ts"
      ),
      "@findit/domain/home-path": path.resolve(
        __dirname,
        "./packages/domain/src/home-path.ts"
      ),
      "@findit/domain/store-role": path.resolve(
        __dirname,
        "./packages/domain/src/store-role.ts"
      ),
      "@findit/domain/product-utils": path.resolve(
        __dirname,
        "./packages/domain/src/product-utils.ts"
      ),
      "@findit/domain/analytics": path.resolve(
        __dirname,
        "./packages/domain/src/analytics.ts"
      ),
      "@findit/domain/deep-links": path.resolve(
        __dirname,
        "./packages/domain/src/deep-links.ts"
      ),
      "@findit/supabase-client": path.resolve(
        __dirname,
        "./packages/supabase-client/src/index.ts"
      ),
      "@findit/theme": path.resolve(__dirname, "./packages/theme/src/index.ts"),
    },
  },
});
