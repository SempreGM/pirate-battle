import type { Simulation, Action } from "./simulation";
const KEY_MAP: Record<string, Action> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right",
  Space: "front",
  KeyQ: "port",
  KeyE: "starboard",
};
export class InputController {
  private keys = new Map<string, Action>();
  private pointers = new Map<number, Action>();
  constructor(
    private sim: Simulation,
    private onPause: () => void,
  ) {
    window.addEventListener("keydown", this.down);
    window.addEventListener("keyup", this.up);
    window.addEventListener("blur", this.blur);
    document.addEventListener("visibilitychange", this.visibility);
  }
  private sync() {
    this.sim.clearInput();
    if (this.sim.phase === "running")
      for (const action of [...this.keys.values(), ...this.pointers.values()])
        this.sim.input.add(action);
  }
  private down = (event: KeyboardEvent) => {
    if (this.sim.phase !== "running") return;
    if (event.code === "Escape" || event.code === "KeyP") {
      event.preventDefault();
      this.clear();
      this.onPause();
      return;
    }
    const action = KEY_MAP[event.code];
    if (action) {
      event.preventDefault();
      this.keys.set(event.code, action);
      this.sync();
    }
  };
  private up = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
    this.sync();
  };
  private blur = () => {
    this.clear();
    if (this.sim.phase === "running") this.onPause();
  };
  private visibility = () => {
    if (document.hidden) this.blur();
  };
  press(pointer: number, action: Action) {
    this.pointers.set(pointer, action);
    this.sync();
  }
  release(pointer: number) {
    this.pointers.delete(pointer);
    this.sync();
  }
  clear() {
    this.keys.clear();
    this.pointers.clear();
    this.sim.clearInput();
  }
  destroy() {
    this.clear();
    window.removeEventListener("keydown", this.down);
    window.removeEventListener("keyup", this.up);
    window.removeEventListener("blur", this.blur);
    document.removeEventListener("visibilitychange", this.visibility);
  }
}
