// 설정 (소리, 색약 모드). 기기에 계속 남는다.
const KEY = 'cell-survivor-settings';
export interface Settings { muted: boolean; cb: boolean }

export function loadSettings(): Settings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { muted: !!v.muted, cb: !!v.cb };
  } catch {
    return { muted: false, cb: false };
  }
}

export function saveSettings(s: Settings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 저장 실패해도 계속 */ }
}
