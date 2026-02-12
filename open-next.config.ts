// 避免 CI 构建时交互提示 "Missing required open-next.config.ts"
// 见 https://opennext.js.org/cloudflare/get-started
import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";

export default defineCloudflareConfig({});
