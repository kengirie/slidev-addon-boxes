/**
 * レイアウトの「名前付きの枠」の定義。
 * 単位はスライドの px（canvasWidth 1920 なら Keynote の pt と同じ）。
 */
export type VAlign = 'top' | 'middle' | 'bottom'
export type HAlign = 'left' | 'center' | 'right'

export interface BoxDef {
  x: number
  y: number
  w: number
  h: number
  /** テキストスタイル（.k-role-<role> クラスとして付く。中身はテーマが決める） */
  role?: string
  valign?: VAlign
  align?: HAlign
  /** image: 写真プレースホルダー */
  kind?: 'text' | 'image'
  /** 段組み。columnGap は px */
  columns?: number
  columnGap?: number
  /** 「テキストを縮小して合わせる」。レイアウトの枠は既定で true */
  autofit?: boolean
  /** 空のときに編集画面だけで表示する案内文（例：「スライドのタイトル」） */
  prompt?: string
}

export interface LayoutDef {
  /** 元になったマスター名など（表示用） */
  label?: string
  /** 名前なしスロット（区切り無しで書いた Markdown）を流し込むボックス */
  main?: string
  boxes: Record<string, BoxDef>
}
