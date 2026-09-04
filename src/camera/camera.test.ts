import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraController } from './CameraController';
import { classifyCameraError, inspectDevices, inspectEnvironment, inspectTrack } from './capabilities';

/**
 * Camera lifecycle and capability tests (§120). No real hardware: the browser
 * APIs are stubbed so every path — denied, missing, front-only, re-entry — can
 * be exercised deterministically.
 */

class FakeTrack {
  kind = 'video';
  stopped = false;
  constructor(
    private settings: MediaTrackSettings = { facingMode: 'environment', width: 1280, height: 720 },
    private caps: Record<string, unknown> = {},
  ) {}
  getSettings() {
    return this.settings;
  }
  getCapabilities() {
    return this.caps;
  }
  applyConstraints() {
    return Promise.resolve();
  }
  stop() {
    this.stopped = true;
  }
}

class FakeStream {
  constructor(public tracks: FakeTrack[]) {}
  getTracks() {
    return this.tracks;
  }
  getVideoTracks() {
    return this.tracks;
  }
}

const setNavigator = (mediaDevices: unknown) => {
  vi.stubGlobal('navigator', { mediaDevices });
};

beforeEach(() => {
  vi.stubGlobal('window', {
    isSecureContext: true,
    location: { protocol: 'https:', hostname: 'example.com' },
    self: {},
    top: {},
  } as unknown as Window);
  vi.stubGlobal('document', {} as Document);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('environment inspection', () => {
  it('reports a missing camera API rather than assuming one', () => {
    setNavigator(undefined);
    expect(inspectEnvironment().availability).toBe('api-unavailable');
  });

  it('reports an insecure context', () => {
    setNavigator({ getUserMedia: () => {} });
    vi.stubGlobal('window', {
      isSecureContext: false,
      location: { protocol: 'http:', hostname: 'example.com' },
      self: {},
      top: {},
    } as unknown as Window);
    expect(inspectEnvironment().availability).toBe('insecure-context');
  });

  it('treats a permissions-policy denial in an embed as blocked', () => {
    setNavigator({ getUserMedia: () => {} });
    const win: Record<string, unknown> = {
      isSecureContext: true,
      location: { protocol: 'https:', hostname: 'example.com' },
    };
    win.self = win;
    win.top = {};
    vi.stubGlobal('window', win as unknown as Window);
    vi.stubGlobal('document', {
      featurePolicy: { allowsFeature: () => false },
    } as unknown as Document);
    const report = inspectEnvironment();
    expect(report.isEmbedded).toBe(true);
    expect(report.availability).toBe('embedded-blocked');
  });

  it('only asks for permission when everything else checks out', () => {
    setNavigator({ getUserMedia: () => {} });
    expect(inspectEnvironment().availability).toBe('permission-required');
  });
});

describe('device inspection', () => {
  it('refuses to guess facing direction from unlabelled devices', async () => {
    setNavigator({
      enumerateDevices: async () => [
        { kind: 'videoinput', label: '' },
        { kind: 'videoinput', label: '' },
      ],
    });
    const report = await inspectDevices();
    expect(report.hasFrontCamera).toBeNull();
    expect(report.hasRearCamera).toBeNull();
    expect(report.cameraCount).toBe(2);
  });

  it('reads facing direction once labels are available', async () => {
    setNavigator({
      enumerateDevices: async () => [
        { kind: 'videoinput', label: 'Front Camera' },
        { kind: 'videoinput', label: 'Back Camera' },
        { kind: 'audioinput', label: 'Mic' },
      ],
    });
    const report = await inspectDevices();
    expect(report.hasFrontCamera).toBe(true);
    expect(report.hasRearCamera).toBe(true);
    expect(report.cameraCount).toBe(2);
  });

  it('handles a front-only device', async () => {
    setNavigator({
      enumerateDevices: async () => [{ kind: 'videoinput', label: 'FaceTime HD Camera' }],
    });
    const report = await inspectDevices();
    expect(report.hasFrontCamera).toBe(true);
    expect(report.hasRearCamera).toBe(false);
  });

  it('survives enumerateDevices being unavailable', async () => {
    setNavigator({});
    await expect(inspectDevices()).resolves.toEqual({
      hasFrontCamera: null,
      hasRearCamera: null,
      cameraCount: 0,
    });
  });
});

describe('track capabilities', () => {
  it('reports no torch and no zoom when the browser exposes neither', () => {
    const report = inspectTrack(new FakeTrack() as unknown as MediaStreamTrack);
    expect(report.torch).toBe(false);
    expect(report.zoom).toBeNull();
  });

  it('reports zoom only when the range is real', () => {
    const flat = inspectTrack(
      new FakeTrack(undefined, { zoom: { min: 1, max: 1 } }) as unknown as MediaStreamTrack,
    );
    expect(flat.zoom).toBeNull();
    const real = inspectTrack(
      new FakeTrack(undefined, { zoom: { min: 1, max: 4, step: 0.1 } }) as unknown as MediaStreamTrack,
    );
    expect(real.zoom).toEqual({ min: 1, max: 4, step: 0.1 });
  });

  it('survives getCapabilities throwing, as some browsers do', () => {
    const track = {
      getSettings: () => ({}),
      getCapabilities: () => {
        throw new Error('nope');
      },
    } as unknown as MediaStreamTrack;
    expect(() => inspectTrack(track)).not.toThrow();
  });
});

describe('error classification', () => {
  it.each([
    ['NotAllowedError', 'permission-denied'],
    ['SecurityError', 'permission-denied'],
    ['NotFoundError', 'no-camera'],
    ['OverconstrainedError', 'no-camera'],
    ['NotReadableError', 'no-camera'],
    ['SomethingElse', 'api-unavailable'],
  ])('maps %s to %s', (name, expected) => {
    expect(classifyCameraError({ name }).availability).toBe(expected);
  });
});

describe('camera lifecycle', () => {
  it('goes live and exposes what the track can do', async () => {
    const track = new FakeTrack();
    setNavigator({
      getUserMedia: async () => new FakeStream([track]),
      enumerateDevices: async () => [{ kind: 'videoinput', label: 'Back Camera' }],
    });
    const c = new CameraController();
    await c.start('environment');
    expect(c.getState().status).toBe('live');
    expect(c.getState().capabilities?.torch).toBe(false);
  });

  it('falls back to a looser constraint when the ideal one fails', async () => {
    const track = new FakeTrack();
    let calls = 0;
    setNavigator({
      getUserMedia: async () => {
        calls++;
        if (calls < 3) throw Object.assign(new Error('no'), { name: 'OverconstrainedError' });
        return new FakeStream([track]);
      },
      enumerateDevices: async () => [],
    });
    const c = new CameraController();
    await c.start('environment');
    expect(calls).toBe(3);
    expect(c.getState().status).toBe('live');
  });

  it('does not retry a denied permission with looser constraints', async () => {
    let calls = 0;
    setNavigator({
      getUserMedia: async () => {
        calls++;
        throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
      },
      enumerateDevices: async () => [],
    });
    const c = new CameraController();
    await c.start();
    expect(calls).toBe(1);
    expect(c.getState().status).toBe('error');
    expect(c.getState().error?.availability).toBe('permission-denied');
  });

  it('reports an absent API instead of throwing', async () => {
    setNavigator({});
    const c = new CameraController();
    await c.start();
    expect(c.getState().status).toBe('error');
    expect(c.getState().error?.availability).toBe('api-unavailable');
  });

  it('stops every track on stop, and stop is safe to repeat', async () => {
    const track = new FakeTrack();
    setNavigator({
      getUserMedia: async () => new FakeStream([track]),
      enumerateDevices: async () => [],
    });
    const c = new CameraController();
    await c.start();
    c.stop();
    c.stop();
    expect(track.stopped).toBe(true);
    expect(c.getState().status).toBe('idle');
  });

  it('releases the previous stream when switching cameras', async () => {
    const first = new FakeTrack({ facingMode: 'environment' });
    const second = new FakeTrack({ facingMode: 'user' });
    let n = 0;
    setNavigator({
      getUserMedia: async () => new FakeStream([n++ === 0 ? first : second]),
      enumerateDevices: async () => [],
    });
    const c = new CameraController();
    await c.start('environment');
    await c.switchCamera();
    expect(first.stopped).toBe(true);
    expect(second.stopped).toBe(false);
    expect(c.getState().facingMode).toBe('user');
  });

  it('discards a stream that arrives after a newer start', async () => {
    const slow = new FakeTrack();
    const fast = new FakeTrack();
    let n = 0;
    setNavigator({
      getUserMedia: async () => {
        const mine = n++;
        if (mine === 0) await new Promise((r) => setTimeout(r, 30));
        return new FakeStream([mine === 0 ? slow : fast]);
      },
      enumerateDevices: async () => [],
    });
    const c = new CameraController();
    const a = c.start('environment');
    const b = c.start('user');
    await Promise.all([a, b]);
    expect(slow.stopped).toBe(true);
    expect(c.getStream()?.getVideoTracks()[0]).toBe(fast);
  });

  it('can be re-entered after being stopped', async () => {
    setNavigator({
      getUserMedia: async () => new FakeStream([new FakeTrack()]),
      enumerateDevices: async () => [],
    });
    const c = new CameraController();
    await c.start();
    c.stop();
    await c.start();
    expect(c.getState().status).toBe('live');
  });

  it('refuses torch and zoom when the track does not support them', async () => {
    setNavigator({
      getUserMedia: async () => new FakeStream([new FakeTrack()]),
      enumerateDevices: async () => [],
    });
    const c = new CameraController();
    await c.start();
    await expect(c.setTorch(true)).resolves.toBe(false);
    await expect(c.setZoom(2)).resolves.toBe(false);
  });
});
