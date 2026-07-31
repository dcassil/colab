/**
 * `JsonValue` — the recursive, structured-clone-safe value space.
 *
 * Every value that crosses the `colab` wire is expressible as a `JsonValue`:
 * JSON primitives, arrays, and plain objects. This deliberately excludes
 * functions, class instances, DOM nodes, symbols-as-values, `Map`, and `Set`,
 * so any payload built from it is safe to pass through `structuredClone`,
 * `postMessage`, or `JSON.stringify` without loss.
 *
 * Used to constrain open-ended `extra` / payload shapes throughout the
 * protocol. It is a pure data space with no host, framework, layout, or
 * domain meaning attached.
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | JsonObject;

/**
 * A plain JSON object whose values are all `JsonValue`.
 *
 * Declared as an `interface` (rather than `Record<string, JsonValue>`) so the
 * mutual reference with {@link JsonValue} is a legal recursive definition
 * instead of a self-referential type alias.
 */
export interface JsonObject {
  [key: string]: JsonValue;
}
