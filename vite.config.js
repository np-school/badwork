import { defineConfig } from "vite";

// เว็บนี้จะถูก deploy ที่ https://lektheholy-jpg.github.io/badwork/
// ต้องตั้ง base ให้ตรงกับชื่อ repo ไม่งั้น path ของไฟล์ .js/.css จะหลุดออกนอก /badwork/
export default defineConfig({
  base: "/badwork/"
});
