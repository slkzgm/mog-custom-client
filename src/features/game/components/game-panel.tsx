import { GamePanelView } from "./game-panel-view";
import { useGamePanelModel } from "../runtime/use-game-panel-model";
import { useGameplayHotkeys } from "../runtime/use-gameplay-hotkeys";

export function GamePanel() {
  const model = useGamePanelModel();

  useGameplayHotkeys({
    disabled: model.controls.hotkeysDisabled,
    onMove: model.controls.handleMove,
    onPass: model.controls.handlePass,
    pendingUpgradeOptions: model.upgrades.pendingUpgradeOptions,
    onRerollUpgrades: model.upgrades.handleRerollUpgrades,
    onSelectUpgrade: model.upgrades.handleSelectUpgrade,
  });

  return <GamePanelView model={model} />;
}
