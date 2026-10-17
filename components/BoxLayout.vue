<script setup lang="ts">
// 名前付きの枠を並べるレイアウトの本体。
// def（枠の既定座標の表）に frontmatter.boxes を重ね、名前付きスロット（::title:: など）を同名の枠へ流し込む。
// テーマのレイアウトは <BoxLayout name="default" :def="..."> と書くだけの薄いラッパーにする。
import { computed, useSlots } from 'vue'
import { useSlideContext } from '@slidev/client'
import type { BoxDef, LayoutDef } from '../types'
import KBox from './KBox.vue'
import { resolveAssetUrl } from '../layoutHelper'
import { useEditorOpen } from '../composables/useEditorOpen'

const props = defineProps<{
  /** レイアウト名（クラス名 box-layout-<name> に使う） */
  name: string
  /** 枠の既定座標の表 */
  def: LayoutDef
}>()
const slots = useSlots()
const { $frontmatter, $slidev } = useSlideContext()

const def = computed(() => props.def ?? { boxes: {} })
const editorOpen = useEditorOpen()

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
    else if (slotFor(key) || (editorOpen.value && box.prompt)) {
      // 中身の無い枠は、エディタを開いている間だけ案内文付きで描く（Keynote の空のプレースホルダー）
      result.push(box)
    }
  }
  return result
})

/**
 * エディタ向けの一覧：このレイアウトの名前付きの枠と、表示しているかどうか。
 * 非表示（boxes.<name>.hide）の枠は描かれないので、DOM から辿れるようにここに書いておく。
 */
const boxList = computed(() => {
  if (!editorOpen.value)
    return undefined
  const overrides: Record<string, any> = $frontmatter.boxes ?? {}
  return JSON.stringify(Object.entries(def.value.boxes)
    .filter(([, b]) => b.kind !== 'image')
    .map(([name, b]) => ({ name, prompt: b.prompt ?? '', hidden: !!overrides[name]?.hide })))
})

const overlay = computed(() => $frontmatter.overlay ? resolveAssetUrl($frontmatter.overlay) : undefined)
</script>

<template>
  <div class="slidev-layout box-layout" :class="`box-layout-${name}`" :data-studio-layout-boxes="boxList">
    <template v-for="b in boxes" :key="b.key">
      <KBox
        :name="b.key"
        :x="b.x" :y="b.y" :w="b.w" :h="b.h"
        :role="b.role" :valign="b.valign" :align="b.align"
        :columns="b.columns" :column-gap="b.columnGap" :autofit="b.autofit ?? true"
        :src="b.src"
        :prompt="b.prompt"
        :main="b.key === def.main"
      >
        <template v-if="!b.src && slotFor(b.key)" #default>
          <component :is="slotFor(b.key)" />
        </template>
      </KBox>
    </template>
    <!--
      枠に入らないもの（Keynote でいうスライド上の自由なオブジェクト）を置く層。スライド全体を覆い、座標はスライド座標。
      ::free:: に書いたものと、メインの枠が無いレイアウトの区切りなしの Markdown がここに入る。
    -->
    <div class="box-layout-free">
      <slot v-if="!def.main || !def.boxes[def.main]" />
      <slot name="free" />
    </div>
    <img
      v-if="overlay"
      class="box-layout-overlay"
      :src="overlay"
      :style="{ opacity: $frontmatter.overlayOpacity ?? $slidev.themeConfigs?.overlayOpacity ?? 0.5 }"
    >
  </div>
</template>
