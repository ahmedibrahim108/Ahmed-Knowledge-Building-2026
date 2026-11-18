import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  BookNote,
  DomainInfo,
  MonthPlan,
  PersonalCourse,
  QuarterInfo,
} from '../data/curriculumData';
import { OperationType, db, handleFirestoreError } from '../firebase';

function clip(val: string, max: number): string {
  return (val ?? '').slice(0, max);
}

export function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_');
  return (cleaned || `item_${Date.now()}`).slice(0, 128);
}

function buildQuarterPayload(uid: string, q: QuarterInfo) {
  const id = sanitizeId(q.id);
  return {
    id,
    ownerId: uid,
    number: Math.max(1, Math.min(20, Math.round(q.number))),
    title: clip(q.title || `الربع ${q.number}`, 200),
    subtitle: clip(q.subtitle || '', 300),
    updatedAt: serverTimestamp(),
  };
}

function buildMonthPayload(uid: string, m: MonthPlan) {
  const docId = sanitizeId(m.docId || `month-${m.id}`);
  return {
    id: Math.max(1, Math.min(100, Math.round(m.id))),
    docId,
    ownerId: uid,
    quarter: Math.max(1, Math.min(20, Math.round(m.quarter))),
    quarterTitle: clip(m.quarterTitle || `الربع ${m.quarter}`, 200),
    theme: clip(m.theme || `الشهر ${m.id}`, 250),
    foundational: {
      title: clip(m.foundational.title || 'مصدر تأسيسي', 300),
      author: clip(m.foundational.author || '', 200),
      format: clip(m.foundational.format || 'كتاب', 60),
      domainId: clip(m.foundational.domainId || 'islamic_thought', 128),
      pace: clip(m.foundational.pace || '', 300),
      focus: clip(m.foundational.focus || '', 500),
    },
    exploratory: {
      title: clip(m.exploratory.title || 'مصدر استكشافي', 300),
      author: clip(m.exploratory.author || '', 200),
      format: clip(m.exploratory.format || 'كتاب', 60),
      domainId: clip(m.exploratory.domainId || 'philosophy', 128),
      pace: clip(m.exploratory.pace || '', 300),
      focus: clip(m.exploratory.focus || '', 500),
    },
    courseId: Math.max(0, Math.min(100, Math.round(m.courseId))),
    discussionPrompt: clip(m.discussionPrompt || '', 1000),
    applicationTask: clip(m.applicationTask || '', 1000),
    activities: {
      reading: Boolean(m.activities.reading),
      listening: Boolean(m.activities.listening),
      summarizing: Boolean(m.activities.summarizing),
      discussing: Boolean(m.activities.discussing),
    },
    status: m.status,
    notes: clip(m.notes || '', 20000),
    tasks: (m.tasks || []).slice(0, 50),
    resources: (m.resources || []).slice(0, 30),
    updatedAt: serverTimestamp(),
  };
}

function buildDomainPayload(uid: string, d: DomainInfo, order: number) {
  const id = sanitizeId(d.id);
  return {
    id,
    ownerId: uid,
    order: Math.max(0, Math.min(100, Math.round(d.order ?? order))),
    title: clip(d.title || 'محور معرفي', 200),
    subtitle: clip(d.subtitle || '', 300),
    purpose: clip(d.purpose || '', 1000),
    thinkers: (d.thinkers || []).slice(0, 30),
    updatedAt: serverTimestamp(),
  };
}

function buildCoursePayload(uid: string, c: PersonalCourse) {
  const docId = sanitizeId(c.docId || `course-${c.id}`);
  return {
    id: Math.max(1, Math.min(100, Math.round(c.id))),
    docId,
    ownerId: uid,
    title: clip(c.title || `كورس ${c.id}`, 250),
    category: clip(c.category || '', 120),
    linkedMonths: (c.linkedMonths || []).slice(0, 24).map((n) => Math.round(n)),
    complementaryBook: clip(c.complementaryBook || '', 300),
    bookAuthor: clip(c.bookAuthor || '', 250),
    applicationMilestone: clip(c.applicationMilestone || '', 1000),
    completed: Boolean(c.completed),
    resources: (c.resources || []).slice(0, 30),
    tasks: (c.tasks || []).slice(0, 50),
    updatedAt: serverTimestamp(),
  };
}

function buildBookNotePayload(uid: string, bn: BookNote) {
  const id = sanitizeId(bn.id);
  return {
    id,
    ownerId: uid,
    bookTitle: clip(bn.bookTitle || 'كتاب بدون عنوان', 300),
    author: clip(bn.author || '', 200),
    progressMarker: clip(bn.progressMarker || '', 200),
    content: clip(bn.content || '', 40000),
    quotes: clip(bn.quotes || '', 10000),
    updatedAtLabel: clip(bn.updatedAt || '', 100),
    updatedAt: serverTimestamp(),
  };
}

export async function ensureUserDocumentAndSeed(
  user: User,
  seedData: {
    quarters: QuarterInfo[];
    months: MonthPlan[];
    domains: DomainInfo[];
    courses: PersonalCourse[];
    bookNotes: BookNote[];
  }
): Promise<void> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  try {
    const existingUser = await getDoc(userRef);
    if (!existingUser.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: clip(user.displayName || 'مستخدم ميزان المعرفة', 120),
        email: clip(user.email || 'user@example.com', 200),
        photoURL: clip(user.photoURL || '', 600),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName: clip(user.displayName || 'مستخدم ميزان المعرفة', 120),
        email: clip(user.email || 'user@example.com', 200),
        photoURL: clip(user.photoURL || '', 600),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }

  // Seed subcollections ONLY if user's months collection is currently empty
  const monthsPath = `users/${user.uid}/months`;
  try {
    const existingMonthsSnap = await getDocs(
      query(collection(db, 'users', user.uid, 'months'), where('ownerId', '==', user.uid))
    );
    if (existingMonthsSnap.empty) {
      const batch = writeBatch(db);
      for (const q of seedData.quarters) {
        const p = buildQuarterPayload(user.uid, q);
        batch.set(doc(db, 'users', user.uid, 'quarters', p.id), p);
      }
      for (const m of seedData.months) {
        const p = buildMonthPayload(user.uid, m);
        batch.set(doc(db, 'users', user.uid, 'months', p.docId), p);
      }
      seedData.domains.forEach((d, idx) => {
        const p = buildDomainPayload(user.uid, d, idx);
        batch.set(doc(db, 'users', user.uid, 'domains', p.id), p);
      });
      for (const c of seedData.courses) {
        const p = buildCoursePayload(user.uid, c);
        batch.set(doc(db, 'users', user.uid, 'courses', p.docId), p);
      }
      for (const bn of seedData.bookNotes) {
        const p = buildBookNotePayload(user.uid, bn);
        batch.set(doc(db, 'users', user.uid, 'bookNotes', p.id), p);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, monthsPath);
  }
}

export function subscribeUserWorkspace(
  uid: string,
  callbacks: {
    onQuarters: (items: QuarterInfo[]) => void;
    onMonths: (items: MonthPlan[]) => void;
    onDomains: (items: DomainInfo[]) => void;
    onCourses: (items: PersonalCourse[]) => void;
    onBookNotes: (items: BookNote[]) => void;
  }
): () => void {
  const unsubQuarters = onSnapshot(
    query(collection(db, 'users', uid, 'quarters'), where('ownerId', '==', uid)),
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as QuarterInfo)
        .sort((a, b) => a.number - b.number);
      callbacks.onQuarters(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/quarters`)
  );

  const unsubMonths = onSnapshot(
    query(collection(db, 'users', uid, 'months'), where('ownerId', '==', uid)),
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as MonthPlan)
        .sort((a, b) => a.id - b.id);
      callbacks.onMonths(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/months`)
  );

  const unsubDomains = onSnapshot(
    query(collection(db, 'users', uid, 'domains'), where('ownerId', '==', uid)),
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as DomainInfo)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      callbacks.onDomains(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/domains`)
  );

  const unsubCourses = onSnapshot(
    query(collection(db, 'users', uid, 'courses'), where('ownerId', '==', uid)),
    (snap) => {
      const list = snap.docs
        .map((d) => d.data() as PersonalCourse)
        .sort((a, b) => a.id - b.id);
      callbacks.onCourses(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/courses`)
  );

  const unsubBookNotes = onSnapshot(
    query(collection(db, 'users', uid, 'bookNotes'), where('ownerId', '==', uid)),
    (snap) => {
      const list = snap.docs.map((d) => {
        const raw = d.data() as Record<string, unknown>;
        return {
          id: String(raw.id ?? d.id),
          bookTitle: String(raw.bookTitle ?? ''),
          author: String(raw.author ?? ''),
          progressMarker: String(raw.progressMarker ?? ''),
          content: String(raw.content ?? ''),
          quotes: String(raw.quotes ?? ''),
          updatedAt: String(raw.updatedAtLabel ?? ''),
        } satisfies BookNote;
      });
      callbacks.onBookNotes(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/bookNotes`)
  );

  return () => {
    unsubQuarters();
    unsubMonths();
    unsubDomains();
    unsubCourses();
    unsubBookNotes();
  };
}

export async function saveQuarterDoc(uid: string, q: QuarterInfo): Promise<void> {
  const p = buildQuarterPayload(uid, q);
  const path = `users/${uid}/quarters/${p.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'quarters', p.id), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteQuarterDoc(uid: string, quarterId: string): Promise<void> {
  const id = sanitizeId(quarterId);
  const path = `users/${uid}/quarters/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'quarters', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveMonthDoc(uid: string, m: MonthPlan): Promise<void> {
  const p = buildMonthPayload(uid, m);
  const path = `users/${uid}/months/${p.docId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'months', p.docId), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteMonthDoc(uid: string, docId: string): Promise<void> {
  const id = sanitizeId(docId);
  const path = `users/${uid}/months/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'months', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveDomainDoc(
  uid: string,
  d: DomainInfo,
  order: number
): Promise<void> {
  const p = buildDomainPayload(uid, d, order);
  const path = `users/${uid}/domains/${p.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'domains', p.id), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteDomainDoc(uid: string, domainId: string): Promise<void> {
  const id = sanitizeId(domainId);
  const path = `users/${uid}/domains/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'domains', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveCourseDoc(uid: string, c: PersonalCourse): Promise<void> {
  const p = buildCoursePayload(uid, c);
  const path = `users/${uid}/courses/${p.docId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'courses', p.docId), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCourseDoc(uid: string, docId: string): Promise<void> {
  const id = sanitizeId(docId);
  const path = `users/${uid}/courses/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'courses', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveBookNoteDoc(uid: string, bn: BookNote): Promise<void> {
  const p = buildBookNotePayload(uid, bn);
  const path = `users/${uid}/bookNotes/${p.id}`;
  try {
    await setDoc(doc(db, 'users', uid, 'bookNotes', p.id), p);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteBookNoteDoc(uid: string, noteId: string): Promise<void> {
  const id = sanitizeId(noteId);
  const path = `users/${uid}/bookNotes/${id}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'bookNotes', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
