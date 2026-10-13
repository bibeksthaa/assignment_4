/**
 * ImageSlider – a small, dependency-free slider library (ES6 class).
 *
 * Infinite loop technique: a copy of the LAST slide is placed before the
 * first slide, and a copy of the FIRST slide after the last one.
 *
 *   track:  [clone 5] [1] [2] [3] [4] [5] [clone 1]
 *   pos:        0      1   2   3   4   5      6
 *
 * Moving "Next" from slide 5 animates forward onto clone 1. When that
 * transition ends, the track jumps (without animation) to the real slide 1.
 * Both look identical, so the user sees one continuous loop.
 */
class ImageSlider {
  static defaults = {
    duration: 600,                              // ms
    easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
    keyboard: true,                             // arrow-key navigation
    swipe: true,                                // touch / mouse drag
  };

  constructor(root, options = {}) {
    if (!root) throw new Error('ImageSlider: root element is required');

    this.root = root;
    this.options = { ...ImageSlider.defaults, ...options };

    // Cache DOM nodes
    this.viewport = root.querySelector('.slider__viewport');
    this.track = root.querySelector('.slider__track');
    this.prevBtn = root.querySelector('.slider__arrow--prev');
    this.nextBtn = root.querySelector('.slider__arrow--next');
    this.dotsWrap = root.querySelector('.slider__dots');
    this.status = root.querySelector('.slider__status');

    this.slides = Array.from(this.track.children); // real slides only
    this.count = this.slides.length;
    this.index = 0;                                // active real slide (0-based)
    this.position = 1;                             // track position incl. leading clone
    this.isAnimating = false;

    if (this.count === 0) return;

    this.applyMotionSettings();
    this.addClones();
    this.buildDots();
    this.bindEvents();
    this.render(false);
  }

  /* ---------- setup ---------- */

  applyMotionSettings() {
    this.root.style.setProperty('--slide-duration', `${this.options.duration}ms`);
    this.root.style.setProperty('--slide-easing', this.options.easing);
  }

  addClones() {
    if (this.count < 2) return;                  // nothing to loop
    const firstClone = this.slides[0].cloneNode(true);
    const lastClone = this.slides[this.count - 1].cloneNode(true);
    [firstClone, lastClone].forEach((clone) => {
      clone.setAttribute('aria-hidden', 'true');
      clone.classList.add('slider__slide--clone');
    });
    this.track.append(firstClone);
    this.track.prepend(lastClone);
  }

  buildDots() {
    this.dots = this.slides.map((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'slider__dot';
      dot.setAttribute('aria-label', `Go to slide ${i + 1} of ${this.count}`);
      dot.addEventListener('click', () => this.goTo(i));
      this.dotsWrap.append(dot);
      return dot;
    });
  }

  bindEvents() {
    this.prevBtn?.addEventListener('click', () => this.prev());
    this.nextBtn?.addEventListener('click', () => this.next());
    this.track.addEventListener('transitionend', (e) => this.onTransitionEnd(e));

    if (this.options.keyboard) {
      this.root.tabIndex = 0;
      this.root.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); this.prev(); }
        if (e.key === 'ArrowRight') { e.preventDefault(); this.next(); }
      });
    }

    if (this.options.swipe) this.enableSwipe();
  }

  /* ---------- public API ---------- */

  next() { this.moveTo(this.position + 1); }

  prev() { this.moveTo(this.position - 1); }

  goTo(index) {
    if (index === this.index) return;
    this.moveTo(index + 1);                      // +1 skips the leading clone
  }

  /* ---------- core logic ---------- */

  moveTo(position) {
    if (this.isAnimating || this.count < 2) return;
    this.isAnimating = true;
    this.position = position;
    this.index = this.toRealIndex(position);
    this.render(true);

    // Safety net: release the lock even if transitionend never fires
    clearTimeout(this.unlockTimer);
    this.unlockTimer = setTimeout(() => this.onTransitionEnd(), this.options.duration + 100);
  }

  // Map a track position (0 … count+1) to a real slide index (0 … count-1)
  toRealIndex(position) {
    return (position - 1 + this.count) % this.count;
  }

  onTransitionEnd(event) {
    if (event && (event.target !== this.track || event.propertyName !== 'transform')) return;
    clearTimeout(this.unlockTimer);

    // Landed on a clone → jump silently to the matching real slide
    if (this.position === 0 || this.position === this.count + 1) {
      this.position = this.index + 1;
      this.render(false);
    }
    this.isAnimating = false;
  }

  render(animate) {
    this.track.classList.toggle('is-animating', animate);
    // Each slide is 100% wide, so the offset is simply position × 100%
    this.track.style.transform = `translate3d(${-this.position * 100}%, 0, 0)`;

    if (!animate) {
      void this.track.offsetWidth;               // force reflow so the jump is not animated
    }

    this.dots.forEach((dot, i) => {
      const active = i === this.index;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-current', active ? 'true' : 'false');
    });

    if (this.status) this.status.textContent = `Slide ${this.index + 1} of ${this.count}`;
  }

  /* ---------- optional swipe support ---------- */

  enableSwipe() {
    let startX = null;
    this.viewport.addEventListener('pointerdown', (e) => { startX = e.clientX; });
    this.viewport.addEventListener('pointerup', (e) => {
      if (startX === null) return;
      const delta = e.clientX - startX;
      if (Math.abs(delta) > 50) (delta < 0 ? this.next() : this.prev());
      startX = null;
    });
  }
}

// Make the class available to other scripts / modules
window.ImageSlider = ImageSlider;
