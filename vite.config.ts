import { defineConfig } from 'vite';
import { existsSync, readdirSync } from 'node:fs';

// virtual:music → public/music 에 실제로 있는 mp3 파일 이름 목록 (없는 파일을 요청해 404가 나지 않게)
const ID = 'virtual:music';
export default defineConfig({
  plugins: [{
    name: 'music-files',
    resolveId: (id) => (id === ID ? '\0' + ID : null),
    load(id) {
      if (id !== '\0' + ID) return null;
      const dir = 'public/music';
      return `export default ${JSON.stringify(existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.mp3')) : [])};`;
    },
  }],
});
