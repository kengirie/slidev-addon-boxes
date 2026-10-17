<script setup lang="ts">
// 二層構造の「外側」：絶対座標の枠。中身（slot）は普通の Markdown フロー。
//
// 枠の移動・リサイズ：
// - 画面上のエディタ（slidev-addon-keynote-editor）が開いているときは、エディタが動かす。
//   KBox は data-studio-box などの印を付け、位置は dragPos.<name> か既定の座標から自分で描く。
// - エディタが無い・閉じているときは、Slidev 標準の v-drag に任せる（ダブルクリックで選択）。
//   v-drag は frontmatter の dragPos.<name> を読むので、そこに「既定の座標」を見せかけて渡す。
// どちらの場合も、動かした枠だけが dragPos.<name> としてファイルに書かれる。
import type { Directive } from 'vue'
import { computed, getCurrentInstance, inject, nextTick, onBeforeUnmount, onMounted, provide, reactive, ref, shallowRef, watch, watchEffect } from 'vue'
import { useSlideContext } from '@slidev/client'
import { resolveAssetUrl } from '../layoutHelper'
import { useEditorInstalled, useEditorOpen } from '../composables/useEditorOpen'

const props = withDefaults(defineProps<{
  x?: number | string
  y?: number | string
  w?: number | string
  h?: number | string
  rotate?: number | string
  role?: string
  valign?: 'top' | 'middle' | 'bottom'
  align?: 'left' | 'center' | 'right'
  /** 段組み数と段間（Keynote の「列」） */
  columns?: number | string
  columnGap?: number | string
  /** Keynote の「テキストを縮小して合わせる」 */
  autofit?: boolean
  /** 指定すると写真プレースホルダーとして描画 */
  src?: string
  fit?: 'cover' | 'contain'
  /** 名前を付けると v-drag で動かせる（座標は dragPos.<name> に保存） */
  name?: string
  /** 空のときに編集画面だけで表示する案内文（Keynote のプレースホルダーの仮テキスト） */
  prompt?: string
  /** レイアウトのメインの枠（区切りなしで書いた Markdown が入る枠）か */
  main?: boolean
}>(), {
  x: 0,
  y: 0,
  w: 400,
  h: 100,
  rotate: 0,
  role: 'body',
  valign: 'top',
  align: 'left',
  columns: 1,
  columnGap: 0,
  autofit: false,
  fit: 'cover',
})

const { $slidev, $frontmatter } = useSlideContext()

const debug = computed(() => $frontmatter.debug ?? $slidev.themeConfigs?.debug ?? false)
const editable = import.meta.env.DEV && !!props.name

const px = (v: number | string) => `${Number(v)}px`

// ---- 既定の座標 ----
// props（レイアウトの定義 or <KBox> の属性）に、手書きの boxes.<name> を重ねたもの
const base = computed(() => {
  const o = (props.name && $frontmatter.boxes?.[props.name]) || {}
  const pick = (k: string, d: number | string) => Number(o[k] ?? d)
  return { x: pick('x', props.x), y: pick('y', props.y), w: pick('w', props.w), h: pick('h', props.h), rotate: pick('rotate', props.rotate) }
})
const baseDragPos = computed(() => {
  const { x, y, w, h, rotate } = base.value
  return [x, y, w, h, ...(rotate ? [rotate] : [])].join(',')
})

// ---- v-drag に「既定の座標」を渡す ----
// v-drag は自分を書いたコンポーネント（＝この KBox）の provide から frontmatter を読む。
// 実際の dragPos に無ければ既定の座標を入れた frontmatter を provide する（ファイルには書かれない）。
const FRONTMATTER_KEY = '$$slidev-fontmatter'
// 入れ子の <KBox> は、親の KBox が作った「既定の座標入り」の frontmatter ではなく、スライド本来の frontmatter を使う
// （v-drag は渡された dragPos を丸ごと保存するので、親の既定の座標まで書かれてしまう）
const REAL_FRONTMATTER_KEY = 'kbox-real-frontmatter'
const parentFrontmatter = inject<Record<string, any> | null>(REAL_FRONTMATTER_KEY, null) ?? inject<Record<string, any>>(FRONTMATTER_KEY, {})
provide(REAL_FRONTMATTER_KEY, parentFrontmatter)
const frontmatterForDrag = reactive<Record<string, any>>({})
watchEffect(() => {
  Object.assign(frontmatterForDrag, parentFrontmatter, {
    dragPos: {
      ...(parentFrontmatter.dragPos ?? {}),
      ...(props.name && parentFrontmatter.dragPos?.[props.name] == null ? { [props.name]: baseDragPos.value } : {}),
    },
  })
})
provide(FRONTMATTER_KEY, frontmatterForDrag)

/** v-drag が使う座標（保存済みの dragPos か、既定の座標） */
const dragPos = computed(() => props.name ? frontmatterForDrag.dragPos[props.name] as string : undefined)

// エディタが開いている間は v-drag を付けない（エディタが動かす）
const editorOpen = useEditorOpen()
const editorInstalled = useEditorInstalled()
// エディタが入っているときは閉じていても v-drag を付けない（閉じた状態は「見るだけ」）
const useVDrag = computed(() => !!props.name && !editorOpen.value && !editorInstalled.value)

/**
 * エディタがその場で書いた位置。エディタはスライドを描き直さずに dragPos を保存するので
 * （Slidev の v-drag と同じ）、この枠の frontmatter はしばらく古いまま残る。
 * 古い値で描き直すと枠が元の位置に戻ってしまうため、エディタから知らされた位置を優先する。
 */
const local = shallowRef<{ x: number, y: number, w: number, h: number, rotate: number } | null>(null)
function onPlace(event: Event) {
  const g = (event as CustomEvent).detail
  if (g && [g.x, g.y, g.w, g.h].every(Number.isFinite))
    local.value = { x: g.x, y: g.y, w: g.w, h: g.h, rotate: Number(g.rotate) || 0 }
}
// frontmatter が本当に変わったら（描き直し・手で編集）、そちらに従う
watch(() => props.name && parentFrontmatter.dragPos?.[props.name], () => local.value = null)

/** 保存済みの dragPos（無ければ既定の座標）。v-drag を使わないときはこれで描く */
const placed = computed(() => {
  if (local.value)
    return local.value
  const saved = props.name ? parentFrontmatter.dragPos?.[props.name] : undefined
  const n = typeof saved === 'string' ? saved.split(',').map(Number) : []
  if (n.length >= 4 && n.slice(0, 4).every(Number.isFinite))
    return { x: n[0], y: n[1], w: n[2], h: n[3], rotate: Number.isFinite(n[4]) ? n[4] : 0 }
  return base.value
})

// 名前があるときだけ v-drag を付ける（名前の無い v-drag は Markdown 上の位置を要求するため）
const vDragGlobal = getCurrentInstance()!.appContext.directives.drag as any
const vMaybeDrag: Directive<HTMLElement, string | undefined> = {
  created: (el, b, vn, pv) => b.value && vDragGlobal?.created?.(el, b, vn, pv),
  mounted: (el, b, vn, pv) => b.value && vDragGlobal?.mounted?.(el, b, vn, pv),
  unmounted: (el, b, vn, pv) => b.value && vDragGlobal?.unmounted?.(el, b, vn, pv),
}

// ---- 実際の位置 ----
// v-drag が管理しているときはその状態（ドラッグ中の値）から、そうでなければ既定の座標から
const root = ref<HTMLElement>()
const dragState = shallowRef<any>()
watch(root, el => dragState.value = (el as any)?.draggingState, { flush: 'post', immediate: true })
const geo = computed(() => {
  const st = dragState.value
  if (useVDrag.value && st && Number.isFinite(st.x0.value))
    return { x: st.x0.value - st.width.value / 2, y: st.y0.value - st.height.value / 2 }
  return { x: placed.value.x, y: placed.value.y }
})

// 本文中に <KBox> を書いた場合も「スライド座標」で効くよう、親の枠の原点を打ち消す入れ物を挟む
const parent = inject<{ value: { x: number, y: number } } | null>('kbox-origin', null)
provide('kbox-origin', geo)
const originReset = computed(() => ({
  left: px(-(parent?.value.x ?? 0)),
  top: px(-(parent?.value.y ?? 0)),
}))

const fitScale = ref(1)

const outer = computed(() => ({
  // v-drag が付いている枠は、位置とサイズを v-drag が設定する
  ...(useVDrag.value
    ? {}
    : {
        left: px(placed.value.x),
        top: px(placed.value.y),
        width: px(placed.value.w),
        height: px(placed.value.h),
        transform: placed.value.rotate ? `rotate(${placed.value.rotate}deg)` : undefined,
      }),
  '--k-fit': fitScale.value,
}))

const multiColumn = computed(() => Number(props.columns) > 1)
const flowStyle = computed(() => multiColumn.value
  ? { columnCount: Number(props.columns), columnGap: px(props.columnGap) }
  : {})

const justify = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }

// ---- 縮小して合わせる ----
// Keynote と同様、収まる最大の文字サイズまで縮める（行間・段落間は文字サイズに比例）。
const inner = ref<HTMLElement>()
const flow = ref<HTMLElement>()

function overflows() {
  const i = inner.value!
  const f = flow.value!
  const cs = getComputedStyle(i)
  const avail = i.clientHeight - Number.parseFloat(cs.paddingTop) - Number.parseFloat(cs.paddingBottom)
  if (multiColumn.value)
    return f.scrollHeight > f.clientHeight + 1 || f.scrollWidth > f.clientWidth + 1
  const fm = getComputedStyle(f)
  const used = f.offsetHeight + Number.parseFloat(fm.marginTop) + Number.parseFloat(fm.marginBottom)
  return used > avail + 0.5
}

let busy = false
async function refit() {
  if (!props.autofit || props.src || !inner.value || !flow.value || busy)
    return
  busy = true
  try {
    fitScale.value = 1
    await nextTick()
    if (overflows()) {
      let lo = 0.05
      let hi = 1
      for (let n = 0; n < 12; n++) {
        const mid = (lo + hi) / 2
        fitScale.value = mid
        await nextTick()
        if (overflows())
          hi = mid
        else
          lo = mid
      }
      fitScale.value = lo
    }
  }
  finally {
    busy = false
  }
}

let ro: ResizeObserver | undefined
let mo: MutationObserver | undefined
function observe() {
  ro?.disconnect()
  mo?.disconnect()
  if (!props.autofit || props.src || !inner.value || !flow.value)
    return
  refit()
  mo = new MutationObserver(() => refit())
  mo.observe(flow.value, { childList: true, subtree: true, characterData: true })
  ro = new ResizeObserver(() => refit())
  ro.observe(inner.value)
}
onMounted(async () => {
  await document.fonts?.ready
  // 枠が作り直されたら（key が変わったら）監視し直す
  watch(inner, observe, { flush: 'post', immediate: true })
})
onBeforeUnmount(() => {
  ro?.disconnect()
  mo?.disconnect()
})
</script>

<template>
  <div class="kbox-origin" :style="originReset">
    <!-- key：既定の座標や dragPos が Markdown 側で変わったら v-drag を作り直す（v-drag は作成時にしか読まない） -->
    <div
      :key="`${dragPos}|${useVDrag}`"
      ref="root"
      v-maybe-drag="useVDrag ? name : undefined"
      class="kbox"
      :class="[src ? 'kbox-image' : `k-role-${role}`, { 'kbox-debug': debug, 'kbox-editable': editable && useVDrag }]"
      :style="outer"
      :data-box="name"
      :data-studio-box="editorOpen && name ? name : undefined"
      :data-studio-box-default="editorOpen && name ? baseDragPos : undefined"
      :data-studio-box-prompt="editorOpen && prompt ? prompt : undefined"
      :data-studio-box-main="editorOpen && main ? '1' : undefined"
      @kbox-place="onPlace"
      @dblclick.stop
    >
      <img v-if="src" :src="resolveAssetUrl(src)" :style="{ objectFit: fit }">
      <div v-else ref="inner" class="kbox-inner" :style="{ justifyContent: justify[valign], textAlign: align }">
        <div ref="flow" class="kbox-flow" :class="{ 'kbox-columns': multiColumn }" :style="flowStyle">
          <slot>
            <!-- 中身が無い枠（エディタを開いているときだけ描かれる）には案内文を出す -->
            <p v-if="prompt" class="kbox-prompt">{{ prompt }}</p>
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>
