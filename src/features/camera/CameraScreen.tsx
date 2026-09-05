import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { PoseCard } from '@/components/PoseCard';
import { routes } from '@/app/routes';
import { useShotSession } from '@/app/ShotSessionContext';
import { PoseRepository } from '@/data/poseRepository';
import {
  compatiblePoses,
  constraintsFor,
  satisfiesHardConstraints,
} from '@/recommendations/engine';
import { captureFrame, releaseCapture, type Capture } from '@/camera/capture';
import { IDENTITY_TRANSFORM, type OverlayTransform } from '@/models/shotSession';
import { L } from '@/models/landmarks';
import { SavedStore } from '@/features/saved/savedStore';
import { ShotSetupSheet, type ShotSetupDraft } from '@/features/shot-setup/ShotSetupSheet';
import { CaptureReview } from '@/features/capture-review/CaptureReview';
import { useCameraController } from './useCameraController';
import { useViewGeometry } from './useViewGeometry';
import { useVisionGuidance } from './useVisionGuidance';
import { useVoiceGuidance } from './useVoiceGuidance';
import { GuideOverlay } from './GuideOverlay';
import { CameraGrid } from './CameraGrid';
import { GuidanceHud } from './GuidanceHud';
import { AlignmentAnchors } from './AlignmentAnchors';
import { PoseTray } from './PoseTray';
import { CameraBlocked } from './CameraBlocked';
import type { Scene } from '@/models/taxonomy';
import './camera.css';

/**
 * The shooting mode.
 *
 * Everything here is designed so the photographer never has to leave: switch
 * pose, step through compatible poses, edit the whole shot setup, capture,
 * review, and carry on — all without restarting the camera or losing the
 * session (§42 to §47, §81 to §83).
 */
export function CameraScreen() {
  const navigate = useNavigate();
  const { session, update, resetOverlay } = useShotSession();

  const stageRef = useRef<HTMLDivElement>(null);
  const [showTray, setShowTray] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showOpacity, setShowOpacity] = useState(false);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  // Debug is off in the consumer interface (§77). It is reachable by keyboard
  // through the visually-hidden control below, or by adding `debug` to the URL.
  const [debug, setDebug] = useState(
    () => typeof window !== 'undefined' && /(?:[?&#]|\b)debug\b/.test(window.location.href),
  );
  const [pendingSetup, setPendingSetup] = useState<ShotSetupDraft | null>(null);
  const [alignHint, setAlignHint] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(true);

  const pose = PoseRepository.get(session.selectedPoseId);
  const constraints = useMemo(() => constraintsFor(session), [session]);

  /**
   * The pose switcher offers what fits the current shot. When the user has not
   * said how many people they are shooting, the pose they are already using is
   * the answer: someone photographing one person does not want the tray full of
   * couples. An explicit choice always wins over this default.
   */
  const trayConstraints = useMemo(
    () =>
      constraints.peopleType || !pose
        ? constraints
        : { ...constraints, peopleType: pose.peopleType },
    [constraints, pose],
  );
  const options = useMemo(
    () => compatiblePoses(PoseRepository.all(), trayConstraints, 24),
    [trayConstraints],
  );

  const { videoRef, state, environment, videoReady, onVideoLoaded, start, switchCamera } =
    useCameraController(session.facingMode);

  const mirrored = state.facingMode === 'user';
  const { geometry, geometryRef } = useViewGeometry(stageRef, videoRef, mirrored);

  const guideActive = session.guideEnabled && state.status === 'live' && videoReady;
  const { status: visionStatus, guidance, stats, degraded, peopleRef } = useVisionGuidance({
    enabled: guideActive,
    pose,
    videoRef,
    geometryRef,
  });

  const { supported: voiceSupported } = useVoiceGuidance(
    guidance,
    session.voiceEnabled && guideActive && !capture,
  );

  useEffect(() => {
    if (state.facingMode !== session.facingMode) update({ facingMode: state.facingMode });
  }, [state.facingMode, session.facingMode, update]);

  useEffect(() => () => releaseCapture(capture), [capture]);

  // The gesture hint teaches once and then stops taking up the viewfinder.
  useEffect(() => {
    const id = window.setTimeout(() => setShowHint(false), 4500);
    return () => window.clearTimeout(id);
  }, []);

  // No pose selected: send the user to pick one rather than showing an empty
  // viewfinder with nothing to guide toward.
  useEffect(() => {
    if (!pose && state.status !== 'starting') navigate(routes.poses, { replace: true });
  }, [pose, state.status, navigate]);

  const commitTransform = useCallback(
    (t: OverlayTransform) => {
      setShowHint(false);
      update({ overlayTransform: t });
    },
    [update],
  );

  const stepPose = (delta: number) => {
    if (!pose || options.length < 2) return;
    const idx = options.findIndex((p) => p.id === pose.id);
    const next = options[(idx + delta + options.length) % options.length];
    if (next) selectPose(next.id);
  };

  const selectPose = (id: string) => {
    update({ selectedPoseId: id, overlayTransform: { ...IDENTITY_TRANSFORM } });
    setShowTray(false);
  };

  /**
   * Auto-align (§52). One shot: place and scale the guide over the person we
   * can currently see, then leave it alone so the target stays stable while the
   * subject moves toward it. Manual adjustment still works afterwards.
   */
  const alignGuide = () => {
    const person = peopleRef.current?.[0];
    if (!pose || !person) {
      setAlignHint('No one detected yet');
      window.setTimeout(() => setAlignHint(null), 1800);
      return;
    }
    const detected = boundsOf(person);
    const target = boundsOf(pose.targetSkeletons[0]);
    if (!detected || !target) return;

    const scale = clamp(detected.height / Math.max(target.height, 1e-4), 0.35, 3.2);
    // The guide is drawn into the whole stage, so a translation of 1 unit moves
    // it by one container dimension. Aspect must be accounted for in x.
    const aspect = geometry.containerWidth / Math.max(geometry.containerHeight, 1);
    const targetCentreX = 0.5 + (target.centreX - 0.5) * scale * (aspect || 1);
    const targetCentreY = 0.5 + (target.centreY - 0.5) * scale;

    commitTransform({
      x: clamp(detected.centreX - targetCentreX, -1.2, 1.2),
      y: clamp(detected.centreY - targetCentreY, -1.2, 1.2),
      scale,
    });
    setAlignHint('Guide aligned');
    window.setTimeout(() => setAlignHint(null), 1400);
  };

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video || !pose) return;
    try {
      const shot = await captureFrame(video, geometryRef.current ?? geometry, { mirrored });
      releaseCapture(capture);
      setCapture(shot);
      setCaptureError(null);
      SavedStore.markUsed(pose.id);
      update({ capturedPoseIds: [...session.capturedPoseIds, pose.id] });
    } catch (err) {
      setCaptureError(err instanceof Error ? err.message : 'The photo could not be taken.');
    }
  };

  /**
   * Changing the setup can make the active pose impossible. We never silently
   * swap it: we explain, show what does fit, and let the user choose (§47).
   */
  const applySetup = (next: ShotSetupDraft) => {
    update({ ...next });
    setShowSetup(false);
    const nextConstraints = constraintsFor({ ...session, ...next });
    if (pose && !satisfiesHardConstraints(pose, nextConstraints)) setPendingSetup(next);
  };

  const replacements = useMemo(() => {
    if (!pendingSetup) return [];
    return compatiblePoses(
      PoseRepository.all(),
      constraintsFor({ ...session, ...pendingSetup }),
      8,
    );
  }, [pendingSetup, session]);

  const setup: ShotSetupDraft = {
    scene: constraints.scene as Scene | null,
    bodyPosition: constraints.bodyPosition as ShotSetupDraft['bodyPosition'],
    peopleType: constraints.peopleType as ShotSetupDraft['peopleType'],
    framing: constraints.framing as ShotSetupDraft['framing'],
    vibes: constraints.vibes,
    environmentElements: constraints.environmentElements,
  };

  const loadingLine =
    state.status === 'starting'
      ? 'Starting camera…'
      : !videoReady && state.status === 'live'
        ? 'Waiting for the first frame…'
        : null;

  const hudStatus = !session.guideEnabled
    ? null
    : visionStatus === 'loading'
      ? 'Loading pose model…'
      : visionStatus === 'unsupported'
        ? 'Live guidance is off in this preview. Line the guide up by hand.'
        : visionStatus === 'error'
          ? 'Live guidance unavailable. The manual guide still works.'
          : degraded && !guidance.instruction && !guidance.hold
            ? 'Guidance is running slowly on this device'
            : null;

  const blocked = state.status === 'error' || environment.availability === 'embedded-blocked';

  return (
    <div className="cam">
      <div className="cam__stage" ref={stageRef}>
        <video
          ref={videoRef}
          className={`cam__video${mirrored ? ' cam__video--mirrored' : ''}`}
          playsInline
          autoPlay
          muted
          onLoadedMetadata={onVideoLoaded}
          onCanPlay={onVideoLoaded}
        />

        {session.gridEnabled && <CameraGrid />}

        {pose && videoReady && (
          <GuideOverlay
            pose={pose}
            transform={session.overlayTransform}
            opacity={session.overlayOpacity}
            mirrored={session.overlayMirrored}
            locked={session.overlayLocked}
            onCommit={commitTransform}
            containerWidth={geometry.containerWidth}
            containerHeight={geometry.containerHeight}
          />
        )}

        <AlignmentAnchors peopleRef={peopleRef} active={guideActive} hold={guidance.hold} />

        <div className="cam__top">
          <button
            type="button"
            className="icon-btn"
            onClick={() => navigate(-1)}
            aria-label="Back"
          >
            <Icon name="back" size={22} />
          </button>
          <button
            type="button"
            className="pose-pill"
            onClick={() => setShowTray(true)}
            aria-haspopup="dialog"
          >
            <span>{pose?.name ?? 'Choose a pose'}</span>
            <Icon name="chevron-down" size={16} />
          </button>
          <div className="cam__top-spacer" />
          <button
            type="button"
            className={`icon-btn${session.gridEnabled ? ' icon-btn--on' : ''}`}
            onClick={() => update({ gridEnabled: !session.gridEnabled })}
            aria-label={session.gridEnabled ? 'Hide grid' : 'Show grid'}
            aria-pressed={session.gridEnabled}
          >
            <Icon name="grid" size={21} />
          </button>
          <button
            type="button"
            className={`icon-btn${session.guideEnabled ? ' icon-btn--on' : ''}`}
            onClick={() => update({ guideEnabled: !session.guideEnabled })}
            aria-label={session.guideEnabled ? 'Turn live guidance off' : 'Turn live guidance on'}
            aria-pressed={session.guideEnabled}
          >
            <Icon name={session.guideEnabled ? 'eye' : 'eye-off'} size={21} />
          </button>
        </div>

        {debug && (
          <div className="debug">
            {`fps ${stats.fps.toFixed(1)}  infer ${stats.inferenceMs.toFixed(1)}ms  pace ${stats.paceMs.toFixed(0)}ms
guide ${guideActive ? 'on' : 'off'}${degraded ? ' DEGRADED' : ''}
people ${stats.detected}  stage ${guidance.stage}${guidance.hold ? ' HOLD' : ''}
video ${geometry.videoWidth}x${geometry.videoHeight}
view  ${geometry.containerWidth}x${geometry.containerHeight}${geometry.mirrored ? ' mirrored' : ''}
model ${visionStatus}`}
          </div>
        )}

        {loadingLine && <div className="cam__loading">{loadingLine}</div>}

        <GuidanceHud
          guidance={guidance}
          status={captureError ?? alignHint ?? hudStatus}
          enabled={guideActive}
        />

        {showHint && !session.overlayLocked && pose && videoReady && !capture && (
          <div className="guide__hint">Drag to move · pinch to size</div>
        )}

        {blocked && (
          <CameraBlocked
            environment={environment}
            error={state.error}
            onRetry={() => void start()}
          />
        )}

      </div>

      <div className="cam__bottom">
        {showOpacity && (
          <div className="opacity-bar">
            <Icon name="opacity" size={17} />
            <input
              type="range"
              min={5}
              max={90}
              step={5}
              value={Math.round(session.overlayOpacity * 100)}
              onChange={(e) => update({ overlayOpacity: Number(e.target.value) / 100 })}
              aria-label="Guide opacity"
            />
            <span style={{ fontSize: 12, minWidth: 34, textAlign: 'right' }}>
              {Math.round(session.overlayOpacity * 100)}%
            </span>
          </div>
        )}

        <div className="cam__tools">
          <button
            type="button"
            className={`tool${session.overlayLocked ? ' tool--on' : ''}`}
            onClick={() => update({ overlayLocked: !session.overlayLocked })}
            aria-pressed={session.overlayLocked}
          >
            <Icon name={session.overlayLocked ? 'lock' : 'unlock'} size={19} />
            {session.overlayLocked ? 'Locked' : 'Lock'}
          </button>
          <button
            type="button"
            className={`tool${session.overlayMirrored ? ' tool--on' : ''}`}
            onClick={() => update({ overlayMirrored: !session.overlayMirrored })}
            aria-pressed={session.overlayMirrored}
          >
            <Icon name="mirror" size={19} />
            Mirror
          </button>
          <button
            type="button"
            className={`tool${showOpacity ? ' tool--on' : ''}`}
            onClick={() => setShowOpacity((v) => !v)}
            aria-pressed={showOpacity}
          >
            <Icon name="opacity" size={19} />
            Opacity
          </button>
          <button
            type="button"
            className="tool"
            onClick={alignGuide}
            disabled={!guideActive || visionStatus !== 'ready'}
          >
            <Icon name="align" size={19} />
            Align
          </button>
          <button type="button" className="tool" onClick={resetOverlay}>
            <Icon name="reset" size={19} />
            Reset
          </button>
          {voiceSupported && (
            <button
              type="button"
              className={`tool${session.voiceEnabled ? ' tool--on' : ''}`}
              onClick={() => update({ voiceEnabled: !session.voiceEnabled })}
              aria-pressed={session.voiceEnabled}
            >
              <Icon name={session.voiceEnabled ? 'voice' : 'voice-off'} size={19} />
              Voice
            </button>
          )}
          <button type="button" className="tool" onClick={() => setShowSetup(true)}>
            <Icon name="filter" size={19} />
            Setup
          </button>
        </div>

        <div className="cam__shutter-row">
          <button
            type="button"
            className="side-btn side-btn--left"
            onClick={() => stepPose(-1)}
            disabled={options.length < 2}
            aria-label="Previous pose"
          >
            <Icon name="prev" size={20} />
            Pose
          </button>

          <button
            type="button"
            className={`shutter${guidance.hold ? ' shutter--ready' : ''}`}
            onClick={takePhoto}
            disabled={state.status !== 'live' || !videoReady}
            aria-label="Take photo"
          >
            <span className="shutter__core" />
          </button>

          <div
            style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <button
              type="button"
              className="side-btn"
              onClick={() => stepPose(1)}
              disabled={options.length < 2}
              aria-label="Next pose"
            >
              <Icon name="next" size={20} />
              Pose
            </button>
            {(state.devices.cameraCount > 1 ||
              state.devices.hasFrontCamera === true) && (
              <button
                type="button"
                className="side-btn"
                onClick={() => void switchCamera()}
                aria-label="Switch camera"
              >
                <Icon name="camera-flip" size={20} />
                Flip
              </button>
            )}
          </div>
        </div>
      </div>

      {capture && pose && (
        <CaptureReview
          capture={capture}
          pose={pose}
          shotCount={session.capturedPoseIds.length}
          onKeep={() => {
            releaseCapture(capture);
            setCapture(null);
          }}
          onRetake={() => {
            releaseCapture(capture);
            setCapture(null);
            update({ capturedPoseIds: session.capturedPoseIds.slice(0, -1) });
          }}
          onNextPose={() => {
            releaseCapture(capture);
            setCapture(null);
            stepPose(1);
          }}
        />
      )}

      <PoseTray
        open={showTray}
        poses={options}
        currentId={pose?.id ?? null}
        onPick={selectPose}
        onClose={() => setShowTray(false)}
        onEditShot={() => {
          setShowTray(false);
          setShowSetup(true);
        }}
      />

      <ShotSetupSheet
        open={showSetup}
        value={setup}
        onCancel={() => setShowSetup(false)}
        onApply={applySetup}
        title="Edit shot"
      />

      <Sheet
        open={Boolean(pendingSetup)}
        title="Pick a new pose"
        onClose={() => setPendingSetup(null)}
        footer={
          <button
            type="button"
            className="btn btn--secondary btn--block"
            onClick={() => setPendingSetup(null)}
          >
            Keep the current pose
          </button>
        }
      >
        <p className="muted" style={{ fontSize: 14, marginBottom: 'var(--space-4)' }}>
          {pose?.name} does not work with the shot you just described. Here is what does.
        </p>
        {replacements.length ? (
          <div className="pose-grid">
            {replacements.map((p) => (
              <PoseCard
                key={p.id}
                pose={p}
                to={routes.camera}
                onSelect={() => {
                  selectPose(p.id);
                  setPendingSetup(null);
                }}
              />
            ))}
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 14 }}>
            Nothing matches that combination. Widen the shot setup and try again.
          </p>
        )}
      </Sheet>

      <button
        type="button"
        className="sr-only"
        onClick={() => setDebug((v) => !v)}
        aria-label="Toggle developer overlay"
      >
        Toggle debug
      </button>
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function boundsOf(points: Array<{ x: number; y: number; visibility?: number }>) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let n = 0;
  const indices = [
    L.NOSE,
    L.LEFT_SHOULDER,
    L.RIGHT_SHOULDER,
    L.LEFT_HIP,
    L.RIGHT_HIP,
    L.LEFT_KNEE,
    L.RIGHT_KNEE,
    L.LEFT_ANKLE,
    L.RIGHT_ANKLE,
  ];
  for (const i of indices) {
    const p = points[i];
    if (!p || (p.visibility ?? 1) < 0.4) continue;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
    n++;
  }
  if (n < 4) return null;
  return {
    centreX: (minX + maxX) / 2,
    centreY: (minY + maxY) / 2,
    height: maxY - minY,
    width: maxX - minX,
  };
}
