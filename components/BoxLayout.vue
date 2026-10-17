<script setup lang="ts">
// 名前付きの枠を並べるレイアウトの本体。
// def（枠の既定座標の表）に frontmatter.boxes を重ね、名前付きスロット（::title:: など）を同名の枠へ流し込む。
// テーマのレイアウトは <BoxLayout name="default" :def="..."> と書くだけの薄いラッパーにする。
import { computed, useSlots } from 'vue'
import { useSlideContext } from '@slidev/client'
import type { BoxDef, LayoutDef } from '../types'
import KBox from './KBox.vue'
import { resolveAssetUrl } from '../layoutHelper'

const props = defineProps<{
  /** レイアウト名（クラス名 box-layout-<name> に使う） */
  name: string
  /** 枠の既定座標の表 */
  def: LayoutDef
}>()
const slots = useSlots()
const { $frontmatter, $slidev } = useSlideContext()

const def = computed(() => props.def ?? { boxes: {} })

/** スロット名 → スロット関数。名前なし（default）は layout の main ボックスへ */
function slotFor(key: string) {
  if (slots[key])
    return slots[key]
  if (key === def.value.main)
    return slots.default
  return undefined
}

const boxes = computed(() => {
  const overrides: Record<string, Partial<BoxDef> & { hide?: boolean }> = $frontmatter.boxes ?? {}
  const images: Record<string, string> = { ...($frontmatter.images ?? {}) }
  if ($frontmatter.image)
    images.image ??= $frontmatter.image

  const result: Array<BoxDef & { key: string, src?: string }> = []
  const keys = new Set([...Object.keys(def.value.boxes), ...Object.keys(overrides)])
  for (const key of keys) {
    const o = overrides[key] ?? {}
    if (o.hide)
      continue
    // レイアウトに無い名前は「追加テキストボックス」として扱う
    const base: BoxDef = def.value.boxes[key] ?? { x: 0, y: 0, w: 400, h: 100, role: 'body' }
    // 座標（x, y, w, h, rotate）は既定値のまま渡し、boxes の上書きは KBox 側で適用する（v-drag の既定座標にするため）
    const { x, y, w, h, rotate, ...rest } = o as any
    const box = { ...base, ...rest, key }
    if (box.kind === 'image') {
      if (!images[key])
        continue
      result.push({ ...box, src: images[key] })
    }
    else if (slotFor(key)) {
      result.push(box)
    }
  }
  return result
})

const overlay = computed(() => $frontmatter.overlay ? resolveAssetUrl($frontmatter.overlay) : undefined)
</script>

<template>
  <div class="slidev-layout box-layout" :class="`box-layout-${name}`">
    <template v-for="b in boxes" :key="b.key">
      <KBox
        :name="b.key"
        :x="b.x" :y="b.y" :w="b.w" :h="b.h"
        :role="b.role" :valign="b.valign" :align="b.align"
        :columns="b.columns" :column-gap="b.columnGap" :autofit="b.autofit ?? true"
        :src="b.src"
      >
        <component :is="slotFor(b.key)" v-if="!b.src" />
      </KBox>
    </template>
    <!-- 名前なしスロットを受けるボックスが無いレイアウトでも、<KBox> 直書きなどは描画する -->
    <div v-if="!def.main || !def.boxes[def.main]" class="box-layout-free">
      <slot />
    </div>
    <img
      v-if="overlay"
      class="box-layout-overlay"
      :src="overlay"
      :style="{ opacity: $frontmatter.overlayOpacity ?? $slidev.themeConfigs?.overlayOpacity ?? 0.5 }"
    >
  </div>
</template>
