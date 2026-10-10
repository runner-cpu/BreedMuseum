/**
 * react-three-fiber v8 的类型增强接入。
 *
 * 背景：R3F 8 通过全局 `JSX.IntrinsicElements` 注册 three 元素类型，
 * 而本仓库的 `@types/react` 为 19（JSX 命名空间在 `React.JSX`，全局 JSX 已移除），
 * 因此需要在这里把 `ThreeElements` 显式并入 `React.JSX.IntrinsicElements`。
 */
import type { ThreeElements } from '@react-three/fiber';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}
