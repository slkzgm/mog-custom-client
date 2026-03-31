import { GamePanelView } from "./game-panel-view";
import { useGamePanelModel } from "../runtime/use-game-panel-model";
import { useGameplayHotkeys } from "../runtime/use-gameplay-hotkeys";

export function GamePanel() {
  const model = useGamePanelModel();

  useGameplayHotkeys({
    disabled: model.controls.hotkeysDisabled,
    onMove: model.controls.handleMove,
    onPass: model.controls.handlePass,
  });

  return <GamePanelView model={model} />;
}
