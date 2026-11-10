import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { drawBubble } from '../../assets/vectorArt';
import type { LeisureSession } from '../../core/leisure';

const LOW_BALANCE_WARNING_SEC = 30;

export class BubblesScene extends Phaser.Scene {
  private context!: AppContext;
  private session!: LeisureSession;
  private spawnTimer?: Phaser.Time.TimerEvent;
  private tickTimer?: Phaser.Time.TimerEvent;
  private ended = false;
  private visibilityHandler?: () => void;

  constructor() {
    super('BubblesScene');
  }

  create(): void {
    this.context = this.game.registry.get('appContext') as AppContext;
    this.session = this.context.createLeisureSession();
    this.ended = false;

    this.visibilityHandler = () => this.session.setHidden(document.hidden);
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    this.cameras.main.setBackgroundColor('#a1c4fd');

    this.spawnTimer = this.time.addEvent({ delay: 600, loop: true, callback: () => this.spawnBubble() });
    this.tickTimer = this.time.addEvent({ delay: 1000, loop: true, callback: () => this.tick() });

    this.refreshChrome();
    window.__GAME_READY__ = true;
  }

  private cleanup(): void {
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
  }

  private refreshChrome(): void {
    this.context.shell.setBubblesChrome({
      balanceSec: this.session.balanceSec,
      low: this.session.balanceSec <= LOW_BALANCE_WARNING_SEC,
      onBack: () => this.goBack(),
    });
  }

  private goBack(): void {
    this.context.store.persist();
    this.scene.start('MapScene');
  }

  private tick(): void {
    if (this.ended) return;
    const result = this.session.tick(1);
    this.context.store.persist();
    this.refreshChrome();
    if (result.endedNow) this.endSession();
  }

  private spawnBubble(): void {
    if (this.ended || document.hidden) return;
    const diameter = 70 + Math.random() * 90;
    const bubble = drawBubble(this, diameter);
    const x = diameter / 2 + Math.random() * (this.scale.width - diameter);
    const startY = this.scale.height + diameter;
    const endY = -diameter;
    bubble.setPosition(x, startY);
    bubble.setInteractive({ useHandCursor: true });

    const duration = 5000 + Math.random() * 4000;
    const tween = this.tweens.add({
      targets: bubble,
      y: endY,
      duration,
      ease: 'Linear',
      onUpdate: (t) => {
        const progress = t.progress;
        bubble.x = x + Math.sin(progress * Math.PI * 8) * 30;
      },
      onComplete: () => bubble.destroy(),
    });

    bubble.on('pointerdown', () => {
      this.context.sfx.pop();
      tween.stop();
      this.tweens.add({
        targets: bubble,
        scaleX: 1.5,
        scaleY: 0.6,
        alpha: 0,
        duration: 150,
        onComplete: () => bubble.destroy(),
      });
    });
  }

  private endSession(): void {
    this.ended = true;
    this.spawnTimer?.remove();
    this.tickTimer?.remove();
    this.context.sfx.end();
    this.children.removeAll();
    this.context.shell.showBubblesEndScreen(
      () => this.scene.start('RestaurantScene'),
      () => this.scene.start('MapScene'),
    );
  }
}
