// The flume as seen by a seated customer. Every position on the flume is a
// distance `s` from 0 (far end, top of the screen) to 1 (near end, at the
// basin). Only rendering turns `s` into pixels, so a curved path can replace
// this one later without touching timing or scoring.

export const BUFFER_W = 180;
export const BUFFER_H = 320;

export class StraightPerspectivePath {
  constructor({ cx = 78, yHorizon = 40, yNear = 290, zFar = 4, zNear = 1, widthNear = 64 } = {}) {
    this.cx = cx;
    this.yHorizon = yHorizon;
    this.yNear = yNear;
    this.zFar = zFar;
    this.zNear = zNear;
    this.widthNear = widthNear;
  }

  // Perspective scale: world distance is linear in s, screen size is 1/z.
  scaleAt(s) {
    const z = this.zFar + (this.zNear - this.zFar) * s;
    return this.zNear / z;
  }

  at(s) {
    const scale = this.scaleAt(s);
    return {
      x: this.cx,
      y: this.yHorizon + (this.yNear - this.yHorizon) * scale,
      scale,
      width: this.widthNear * scale,
    };
  }

  // Inverse of at(s).y, used to draw the flume one screen row at a time.
  sAtY(y) {
    const scale = (y - this.yHorizon) / (this.yNear - this.yHorizon);
    const z = this.zNear / scale;
    return (this.zFar - z) / (this.zFar - this.zNear);
  }
}
