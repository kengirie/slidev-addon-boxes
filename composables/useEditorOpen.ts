import { ref } from 'vue'

/**
 * 画面上のエディタ（slidev-addon-keynote-editor）が開いているか。
 *
 * エディタは開いている間 <html> に `slidev-studio-docked` クラスを付ける。
 * 開いている間は、枠の移動・リサイズをエディタに任せるため、KBox は Slidev の v-drag を付けない
 * （v-drag はエディタがスライドを縮小表示していることを知らないので、座標がずれる）。
 */
const CLASS = 'slidev-studio-docked'
/** エディタのアドオンが入っている（閉じていても付く） */
const INSTALLED = 'slidev-keynote-editor'
const open = ref(false)
const installed = ref(false)
let started = false

function start() {
  if (started || typeof document === 'undefined' || !import.meta.env.DEV)
    return
  started = true
  const root = document.documentElement
  const read = () => {
    const nowOpen = root.classList.contains(CLASS)
    const nowInstalled = root.classList.contains(INSTALLED)
    if (nowOpen !== open.value)
      open.value = nowOpen
    if (nowInstalled !== installed.value)
      installed.value = nowInstalled
  }
  read()
  new MutationObserver(read).observe(root, { attributes: true, attributeFilter: ['class'] })
}

export function useEditorOpen() {
  start()
  return open
}

/**
 * エディタのアドオンが入っているか。入っていれば、閉じている間も v-drag は付けない
 * （v-drag のダブルクリックで出る「移動モード」はエディタの操作と食い違うため）。
 */
export function useEditorInstalled() {
  start()
  return installed
}
