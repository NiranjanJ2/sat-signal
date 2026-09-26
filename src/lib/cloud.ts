import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, getFirestore, runTransaction } from "firebase/firestore";
import { firebaseConfig, isCloudConfigured } from "./cloud-config";
import {
  hydratePracticeStateDocument,
  mergePracticeSnapshots,
  type PracticeSnapshot,
} from "./storage";
import type { PracticeState } from "../types";

export type Account = {
  uid: string;
  displayName: string | null;
  email: string | null;
};

const services = () => {
  if (!isCloudConfigured()) {
    throw new Error("Google sync is not configured for this site.");
  }
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth: getAuth(app), db: getFirestore(app) };
};

export function onAccountChanged(callback: (account: Account | null) => void): () => void {
  if (!isCloudConfigured()) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(services().auth, (user) => {
    callback(user ? { uid: user.uid, displayName: user.displayName, email: user.email } : null);
  });
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(services().auth, new GoogleAuthProvider());
}

export async function signOutAccount(): Promise<void> {
  await signOut(services().auth);
}

const progressRef = (uid: string) => doc(services().db, "users", uid, "progress", "current");

const cloudSnapshot = (value: unknown): PracticeSnapshot => {
  const document = value as { generation?: unknown } | undefined;
  return {
    state: hydratePracticeStateDocument(value, []),
    generation: typeof document?.generation === "number" &&
      Number.isInteger(document.generation) && document.generation >= 0
      ? document.generation
      : null,
  };
};

export async function syncCloudProgress(
  uid: string,
  local: PracticeSnapshot,
  guest?: PracticeState,
): Promise<PracticeSnapshot> {
  const ref = progressRef(uid);
  return runTransaction(services().db, async (transaction) => {
    const remote = await transaction.get(ref);
    const merged = remote.exists()
      ? mergePracticeSnapshots(local, cloudSnapshot(remote.data()), guest)
      : local;
    transaction.set(ref, {
      version: 2,
      generation: merged.generation ?? 0,
      attempts: merged.state.attempts.map((attempt) => ({
        id: attempt.id,
        questionId: attempt.questionId,
        response: attempt.response,
        correct: attempt.correct,
        createdAt: attempt.createdAt,
        ...(attempt.durationMs === undefined ? {} : { durationMs: attempt.durationMs }),
      })),
    });
    return merged;
  });
}

export async function resetCloudProgress(uid: string): Promise<PracticeSnapshot> {
  const ref = progressRef(uid);
  return runTransaction(services().db, async (transaction) => {
    const remote = await transaction.get(ref);
    const next: PracticeSnapshot = {
      state: hydratePracticeStateDocument({ version: 2, attempts: [] }, []),
      generation: (cloudSnapshot(remote.data()).generation ?? 0) + 1,
    };
    transaction.set(ref, { version: 2, generation: next.generation, attempts: [] });
    return next;
  });
}
