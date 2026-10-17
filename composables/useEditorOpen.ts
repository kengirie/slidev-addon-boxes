import { ref } from 'vue'

/**
 * 画面上のエディタ（slidev-addon-keynote-editor）が開いているか。
 *
 * エディタは開いている間 <html> に `slidev-studio-docked` クラスを付ける。
 * 開いている間は、枠の移動・リサイズをエディタに任せるため、KBox は Slidev の v-drag を付けない
 * （v-drag はエディタがスライドを縮小表示していることを知らないので、座標がずれる）。
 */
const CLASS = 'slidev-studio-docked'
const open = ref(false)
let started = false

export function useEditorOpen() {
  if (!started && typeof document !== 'undefined' && import.meta.env.DEV) {
    started = true
    const root = document.documentElement
    open.value = root.classList.contains(CLASS)
    new MutationObserver(() => {
      const now = root.classList.contains(CLASS)
      if (now !== open.value)
        open.value = now
    }).observe(root, { attributes: true, attributeFilter: ['class'] })
  }
  return open
}
