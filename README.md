# slidev-addon-boxes

Slidev で「**枠は絶対座標、枠の中身は普通の Markdown**」の二層構造でスライドを組むためのアドオン。

- レイアウトに「タイトル」「本文」などの**名前付きの枠と既定の座標**を決めておく
- スライドには、**動かしたときだけ**座標を書く
- 枠の中は普通の Markdown として流れる（上・中央・下揃え、縮小して合わせる、段組みに対応）

見た目（文字サイズ・行間・フォントなど）は持たない。それはテーマが CSS 変数と `.k-role-*` クラスで決める。
Keynote の「ベーシックホワイト」を再現したテーマ [slidev-theme-keynote-basic](https://github.com/kengirie/slidev-theme-keynote-basic) がこのアドオンを使っている。

## 使い方

```yaml
---
addons:
  - slidev-addon-boxes
---
```

### レイアウトを作る（テーマ側）

```ts
// placeholders.ts
import type { LayoutDef } from 'slidev-addon-boxes/types'

export const layouts: Record<string, LayoutDef> = {
  default: {
    main: 'body', // 区切りなしで書いた Markdown を入れる枠
    boxes: {
      title: { x: 95, y: 85, w: 1730, h: 113, role: 'title', valign: 'top' },
      body: { x: 95, y: 335, w: 1730, h: 650, role: 'body' },
    },
  },
}
```

```vue
<!-- layouts/default.vue -->
<script setup lang="ts">
import BoxLayout from 'slidev-addon-boxes/components/BoxLayout.vue'
import { layouts } from '../placeholders'
</script>

<template>
  <BoxLayout name="default" :def="layouts.default">
    <template v-for="(_, s) in $slots" #[s]>
      <slot :name="s" />
    </template>
  </BoxLayout>
</template>
```

### スライドを書く

```md
---
layout: default
boxes:
  body: { y: 420 }          # 手で書く上書き（書いたプロパティだけ変わる）
  subtitle: { hide: true }  # 枠を消す
dragPos:
  title: 300,85,1730,113    # ドラッグで動かすと Slidev がここに書く
---

::title::
タイトル

::body::
- 本文

<KBox name="memo" x="1300" y="600" w="500" h="200">本文中に直接置く枠</KBox>
```

座標の決まり方：レイアウトの既定 → `boxes.<名前>` → `dragPos.<名前>`。

### 枠を動かす

- [slidev-addon-keynote-editor](https://github.com/kengirie/slidev-addon-keynote-editor) を併用すると、Keynote と同じ操作で枠を選んで動かし、文字を編集できる（エディタを開いている間、枠には `data-studio-box` などの印が付き、位置は枠が自分で描く）
- エディタが無い・閉じているときは、`npm run dev` 中に枠をダブルクリックすると Slidev 標準の `v-drag` で動かせる

どちらでも、動かした枠だけが `dragPos` に書かれる。

### 空の枠の案内文

`BoxDef.prompt` を決めておくと、中身の無い枠はエディタを開いている間だけ案内文付きで描かれる（Keynote の空のプレースホルダー）。書き出し・発表では描かれない。

## テーマが決める CSS 変数

| 変数 | 意味 |
|---|---|
| `--k-font`, `--k-text`, `--k-bg` | フォント・文字色・背景 |
| `--k-leading` | フォントの行間（em）。行送り = (`--k-lines` + `--k-leading`) em |
| `--k-inset` | 枠の内側の余白 |
| `--k-bullet`, `--k-bullet-indent`, `--k-bullet-size` | 箇条書きの記号・インデント・記号の大きさ |
| `.k-role-<role>` の `--k-size`, `--k-lines`, `--k-para-before` | 役割ごとの文字サイズ・行間・段落前の間隔 |

## ライセンス

MIT
