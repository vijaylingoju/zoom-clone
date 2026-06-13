"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface FloatingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseFloatingWindowOptions {
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  /** Top-left default, inset from edges like Zoom. */
  initialPosition?: { x: number; y: number };
}

const DEFAULT_WIDTH = 340;
const DEFAULT_HEIGHT = 286;

export function useFloatingWindow({
  defaultWidth = DEFAULT_WIDTH,
  defaultHeight = DEFAULT_HEIGHT,
  minWidth = 280,
  minHeight = 220,
  maxWidth = 480,
  maxHeight = 420,
  initialPosition = { x: 56, y: 40 },
}: UseFloatingWindowOptions = {}) {
  const [rect, setRect] = useState<FloatingRect>(() => ({
    x: initialPosition.x,
    y: initialPosition.y,
    width: defaultWidth,
    height: defaultHeight,
  }));

  const dragRef = useRef({ active: false, offsetX: 0, offsetY: 0 });
  const resizeRef = useRef({ active: false, startX: 0, startY: 0, startW: 0, startH: 0 });

  const clampPosition = useCallback(
    (x: number, y: number, width: number, height: number) => {
      if (typeof window === "undefined") return { x, y };
      const maxX = Math.max(12, window.innerWidth - width - 12);
      const maxY = Math.max(12, window.innerHeight - height - 12);
      return {
        x: Math.min(Math.max(12, x), maxX),
        y: Math.min(Math.max(12, y), maxY),
      };
    },
    [],
  );

  const onDragPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      dragRef.current = {
        active: true,
        offsetX: event.clientX - rect.x,
        offsetY: event.clientY - rect.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [rect.x, rect.y],
  );

  const onDragPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!dragRef.current.active) return;
      const pos = clampPosition(
        event.clientX - dragRef.current.offsetX,
        event.clientY - dragRef.current.offsetY,
        rect.width,
        rect.height,
      );
      setRect((r) => ({ ...r, ...pos }));
    },
    [clampPosition, rect.width, rect.height],
  );

  const onDragPointerUp = useCallback((event: React.PointerEvent<HTMLElement>) => {
    dragRef.current.active = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  const onResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      resizeRef.current = {
        active: true,
        startX: event.clientX,
        startY: event.clientY,
        startW: rect.width,
        startH: rect.height,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [rect.width, rect.height],
  );

  const onResizePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!resizeRef.current.active) return;
      const dx = event.clientX - resizeRef.current.startX;
      const dy = event.clientY - resizeRef.current.startY;
      const width = Math.min(maxWidth, Math.max(minWidth, resizeRef.current.startW + dx));
      const height = Math.min(maxHeight, Math.max(minHeight, resizeRef.current.startH + dy));
      setRect((r) => {
        const pos = clampPosition(r.x, r.y, width, height);
        return { ...pos, width, height };
      });
    },
    [clampPosition, maxHeight, maxWidth, minHeight, minWidth],
  );

  const onResizePointerUp = useCallback((event: React.PointerEvent<HTMLElement>) => {
    resizeRef.current.active = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  useEffect(() => {
    function handleResize() {
      setRect((r) => {
        const pos = clampPosition(r.x, r.y, r.width, r.height);
        return { ...r, ...pos };
      });
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPosition]);

  return {
    rect,
    onDragPointerDown,
    onDragPointerMove,
    onDragPointerUp,
    onResizePointerDown,
    onResizePointerMove,
    onResizePointerUp,
  };
}
