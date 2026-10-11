const FILES = {
  fire: "cannon_fire_1",
  broadside: "cannon_broadside",
  hit: "ship_wood_hit_1",
  explosion: "ship_explosion_1",
  score: "score_point",
  pause: "game_pause",
  resume: "game_resume",
  complete: "game_complete",
};
export class GameAudio {
  muted = false;
  private sounds = new Map<string, HTMLAudioElement>();
  private last = new Map<string, number>();
  play(kind: keyof typeof FILES) {
    if (this.muted) return;
    const now = performance.now();
    if (now - (this.last.get(kind) ?? -1000) < 100) return;
    this.last.set(kind, now);
    let sound = this.sounds.get(kind);
    if (!sound) {
      sound = new Audio(`/assets/sounds/${FILES[kind]}.wav`);
      sound.volume = 0.18;
      this.sounds.set(kind, sound);
    }
    sound.currentTime = 0;
    void sound.play().catch(() => {});
  }
  destroy() {
    this.sounds.forEach((sound) => {
      sound.pause();
      sound.removeAttribute("src");
      sound.load();
    });
    this.sounds.clear();
  }
}
