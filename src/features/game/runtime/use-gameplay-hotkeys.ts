import { useEffect, useEffectEvent } from "react";

import type { MoveDirection } from "../game.types";
import { shouldIgnoreGameplayHotkey } from "./game-runtime.utils";

interface UseGameplayHotkeysParams {
  disabled: boolean;
  onMove: (direction: MoveDirection) => void | Promise<void>;
  onPass: () => void | Promise<void>;
}

export function useGameplayHotkeys({ disabled, onMove, onPass }: UseGameplayHotkeysParams) {
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (disabled || event.repeat || shouldIgnoreGameplayHotkey(event)) return;

    const normalizedKey = event.key.toLowerCase();

    if (event.code === "Space" || normalizedKey === " ") {
      event.preventDefault();
      void onPass();
      return;
    }

    const direction: MoveDirection | null =
      normalizedKey === "w"
        ? "up"
        : normalizedKey === "a"
          ? "left"
          : normalizedKey === "s"
            ? "down"
            : normalizedKey === "d"
              ? "right"
              : null;

    if (!direction) return;
    event.preventDefault();
    void onMove(direction);
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      handleKeyDown(event);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);
}
