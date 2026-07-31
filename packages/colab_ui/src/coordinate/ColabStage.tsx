import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  HTMLAttributes,
  PointerEvent as ReactPointerEvent,
} from "react";

import { ColabStageContext } from "./context.js";
import type {
  ColabStageContextValue,
  Point,
  PointerSampleListener,
  PointerSampleSource,
  StageBox,
} from "./types.js";

export type ColabStageProps = HTMLAttributes<HTMLDivElement>;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function boxFromRect(rect: DOMRectReadOnly): StageBox {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function boxesEqual(left: StageBox | null, right: StageBox): boolean {
  return (
    left !== null &&
    left.left === right.left &&
    left.top === right.top &&
    left.width === right.width &&
    left.height === right.height
  );
}

function pointFromRect(
  clientX: number,
  clientY: number,
  rect: DOMRectReadOnly,
): Point {
  const rawX = rect.width <= 0 ? 0 : (clientX - rect.left) / rect.width;
  const rawY = rect.height <= 0 ? 0 : (clientY - rect.top) / rect.height;
  return { x: clamp01(rawX), y: clamp01(rawY) };
}

function positionedStyle(style: CSSProperties | undefined): CSSProperties {
  return { ...style, position: "relative" };
}

export function ColabStage(props: ColabStageProps): React.ReactElement {
  const { children, onPointerMove, style, ...rest } = props;
  const elementRef = useRef<HTMLDivElement | null>(null);
  const listenersRef = useRef<Set<PointerSampleListener>>(new Set());
  const [box, setBox] = useState<StageBox | null>(null);

  const updateBox = useCallback((): StageBox | null => {
    const element = elementRef.current;
    if (element === null) {
      return null;
    }
    const next = boxFromRect(element.getBoundingClientRect());
    setBox((previous) => (boxesEqual(previous, next) ? previous : next));
    return next;
  }, []);

  const samples = useMemo<PointerSampleSource>(
    () => ({
      subscribe(listener) {
        listenersRef.current.add(listener);
        return () => {
          listenersRef.current.delete(listener);
        };
      },
    }),
    [],
  );

  const publish = useCallback((point: Point): void => {
    for (const listener of listenersRef.current) {
      listener(point);
    }
  }, []);

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      const rect = event.currentTarget.getBoundingClientRect();
      const next = boxFromRect(rect);
      setBox((previous) => (boxesEqual(previous, next) ? previous : next));
      publish(pointFromRect(event.clientX, event.clientY, rect));
      onPointerMove?.(event);
    },
    [onPointerMove, publish],
  );

  useEffect(() => {
    const element = elementRef.current;
    if (element === null || typeof ResizeObserver === "undefined") {
      return undefined;
    }
    updateBox();
    const observer = new ResizeObserver(() => {
      updateBox();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [updateBox]);

  const value = useMemo<ColabStageContextValue>(
    () => ({ box, samples }),
    [box, samples],
  );

  return (
    <ColabStageContext.Provider value={value}>
      <div
        {...rest}
        ref={elementRef}
        style={positionedStyle(style)}
        onPointerMove={handlePointerMove}
      >
        {children}
      </div>
    </ColabStageContext.Provider>
  );
}
